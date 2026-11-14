"use client";
import MessageAttachments from "@/components/messaging/MessageAttachments";
import type {MessageAttachment} from "@/lib/message-attachments";

import { dismissNativeDialog } from "@/lib/native-dialog";

import UnoptimizedImage from "@/components/UnoptimizedImage";

import { useEffect, useRef, useState, useCallback, type CSSProperties } from "react";
import { useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import InboxNavigation from "@/components/InboxNavigation";
import { ArrowLeft, MessageSquare, Loader2, User, Check, Users, Search, SquarePen } from "lucide-react";
import { Suspense } from "react";
import MessageComposer from "@/components/messaging/MessageComposer";
import NewMessageDialog from "@/components/messaging/NewMessageDialog";
import MessagingDialog from "@/components/messaging/MessagingDialog";
import GroupInfoDialog from "@/components/messaging/GroupInfoDialog";
import {useFormNavigation} from "@/contexts/FormDraftContext";
import type {MessageDestination, ChatMessage} from "@/lib/messaging-ui";
import { useTranslations , useLocale } from "next-intl";
import { applyReadReceiptTimestamps, incomingUnreadMessageIds } from "@/lib/message-read-state";
import { notifyMessagesRead, subscribeToMessageReads } from "@/lib/message-read-sync";
import { mergeMessagesById } from "@/lib/conversation-logic";
import { conversationPeerProfileHref, SUPPORT_AVATAR_URL, SUPPORT_NAME } from "@/lib/support-identity";
import {
  ACTIVE_CONVERSATION_FALLBACK_REFRESH_MS,
  CONVERSATION_LIST_FALLBACK_REFRESH_MS,
} from "@/lib/message-refresh-policy";
import { mergeVisibleMessagePage } from "@/lib/message-actions";
import { backFromMessageView, navigateMessageView } from "@/lib/message-navigation";
import { uiErrorMessage } from "@/lib/ui-error-message";

type Message = {
  attachments?: MessageAttachment[];
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
  read_by?: string[];
  senderName?: string;
  senderAvatar?: string | null;
  sendState?: "sending" | "failed";
};

type Conversation = {
  id: string;
  kind?: "direct" | "group" | "support";
  group_name?: string | null;
  sender_id: string;
  receiver_id: string | null;
  listing_title: string | null;
  listing_id?: string | null;
  updated_at: string;
  messages: Message[];
  unread_count?: number;
  otherName?: string;
  otherAvatar?: string | null;
  memberCount?: number;
  isAdmin?: boolean;
  members?: Array<{ user_id: string; display_name: string; avatar_url: string | null; role: "admin" | "member"; joined_at: string }>;
};

type FriendRequest = {
  friendship_id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  role?: string;
};

function formatTime(locale: string, iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000 && d.getDate() === now.getDate()) {
    return d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString(locale, { day: "numeric", month: "short" });
}

function MessagesContent() {
  useEffect(() => () => dismissNativeDialog(), []);
  const uiText = useTranslations();
  const t = useTranslations("Messaging");
  const contactText = useTranslations("Contacts");
  const {leave} = useFormNavigation();
  const uiLocale = useLocale();

  const navigationText = useTranslations("navigationStability");
  const messageNavigationText = useTranslations("messagesNavigation");
  const companyText = useTranslations("companyMessages");
  const { user } = useUser();
  const searchParams = useSearchParams();
  const toParam = searchParams.get("to");
  const convParam = searchParams.get("conv");
  const groupsOnly = searchParams.get("view") === "groups";
  const requestedCompanySlug = toParam ? searchParams.get("company_slug")?.slice(0, 200) : null;
  const [companyContact, setCompanyContact] = useState<{ name: string; slug: string; recipient: string } | null>(null);
  const verifiedCompany = companyContact?.recipient === toParam && companyContact?.slug === requestedCompanySlug ? companyContact : null;
  const companyLabel = verifiedCompany?.name;
  const companySlug = verifiedCompany?.slug;

  useEffect(() => {
    if (!toParam || !requestedCompanySlug || !user?.id) return;
    const controller = new AbortController();
    const query = new URLSearchParams({ slug: requestedCompanySlug, recipient: toParam });
    fetch(`/api/companies/contact-context?${query}`, { signal: controller.signal, cache: "no-store" })
      .then(async response => response.ok ? response.json() : { company: null })
      .then(({ company }) => { if (!controller.signal.aborted) setCompanyContact(company ? { ...company, recipient: toParam } : null); })
      .catch(() => { if (!controller.signal.aborted) setCompanyContact(null); });
    return () => controller.abort();
  }, [toParam, requestedCompanySlug, user?.id]);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessagesAvailable, setNewMessagesAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [conversationLoadFailed, setConversationLoadFailed] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageLoadFailure, setMessageLoadFailure] = useState<{ conversationId: string; before?: { before: string; before_id: string } } | null>(null);
  const [newConvRecipient, setNewConvRecipient] = useState<string | null>(toParam);
  const [recipientName, setRecipientName] = useState("");
  const [loadingRecipient, setLoadingRecipient] = useState(!!toParam);
  const [sendError, setSendError] = useState("");
  const [newMessageOpen, setNewMessageOpen] = useState(false);
  const [groupInfoOpen, setGroupInfoOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [requestsOpen, setRequestsOpen] = useState(searchParams.get("requests") === "1");
  const [requestError, setRequestError] = useState("");
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [olderLoading, setOlderLoading] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [visualViewportTop, setVisualViewportTop] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesViewportRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const messagesRef = useRef<Message[]>([]);
  const activeIdRef = useRef<string | null>(null);
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // Friend requests
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [contacts, setContacts] = useState<FriendRequest[]>([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [contactsError, setContactsError] = useState(false);
  const [deletingMessage, setDeletingMessage] = useState<string | null>(null);
  const [messageNotice, setMessageNotice] = useState("");
  const deletePendingRef = useRef(false);
  const hiddenMessageIds = useRef(new Set<string>());
  const messageRequestSequence = useRef(0);
  const conversationRequestSequence = useRef(0);
  const currentUserRef = useRef(user?.id);
  useEffect(() => { currentUserRef.current = user?.id; }, [user?.id]);

  // Mobile: true = zeige Chat, false = zeige Liste
  const showChat = !!(activeId || newConvRecipient);

  // Keep the conversation fitted to the visible iOS viewport when the keyboard opens.
  useEffect(() => {
    const viewport = window.visualViewport;
    const updateViewport = () => {
      const top = viewport?.offsetTop ?? 0;
      const visibleBottom = top + (viewport?.height ?? window.innerHeight);
      const coveredBottom = Math.max(0, window.innerHeight - visibleBottom);
      setVisualViewportTop(top);
      // Ignore the small difference caused by Safari's browser chrome.
      setKeyboardInset(coveredBottom > 120 ? coveredBottom : 0);
    };

    updateViewport();
    viewport?.addEventListener("resize", updateViewport);
    viewport?.addEventListener("scroll", updateViewport);
    window.addEventListener("resize", updateViewport);
    return () => {
      viewport?.removeEventListener("resize", updateViewport);
      viewport?.removeEventListener("scroll", updateViewport);
      window.removeEventListener("resize", updateViewport);
    };
  }, []);

  useEffect(() => {
    document.body.dataset.messagesChatOpen = String(showChat);
    window.dispatchEvent(new CustomEvent("cinegenius:messages-chat-state", { detail: showChat }));
    return () => {
      document.body.dataset.messagesChatOpen = "false";
      window.dispatchEvent(new CustomEvent("cinegenius:messages-chat-state", { detail: false }));
    };
  }, [showChat]);

  const loadConversations = useCallback(async () => {
    const owner = currentUserRef.current;
    if (!owner) return;
    const sequence = ++conversationRequestSequence.current;
    try {
      const res = await fetch("/api/conversations", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const { data } = await res.json();
      if (currentUserRef.current !== owner || sequence !== conversationRequestSequence.current) return;
      if (!Array.isArray(data)) throw new Error();
      setConversations(data as Conversation[]);
      setConversationLoadFailed(false);
    } catch {
      if (currentUserRef.current === owner && sequence === conversationRequestSequence.current) setConversationLoadFailed(true);
    } finally {
      if (currentUserRef.current === owner && sequence === conversationRequestSequence.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const unsubscribe = subscribeToMessageReads(user.id, () => { void loadConversations(); });
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadConversations();
    }, CONVERSATION_LIST_FALLBACK_REFRESH_MS);
    return () => {
      unsubscribe();
      window.clearInterval(interval);
    };
  }, [user?.id, loadConversations]);

  const loadFriendRequests = useCallback(async () => {
    const owner = currentUserRef.current;
    if (!owner) return;
    setContactsLoading(true); setContactsError(false);
    try {
      const res = await fetch("/api/friendships", { cache: "no-store", headers:{"X-Contact-Account":owner} });
      if (!res.ok) throw new Error();
      const { incoming, friends } = await res.json();
      if (currentUserRef.current !== owner) return;
      if (Array.isArray(incoming)) setFriendRequests(incoming);
      setContacts(Array.isArray(friends) ? [...new Map((friends as FriendRequest[]).filter(f => f.user_id !== owner).map(f => [f.user_id, f])).values()] : []);
    } catch { if (currentUserRef.current === owner) setContactsError(true); }
    finally { if (currentUserRef.current === owner) setContactsLoading(false); }
  }, []);

  useEffect(() => {
    // Clear private data immediately when the external authentication account changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConversations([]); setContacts([]); setFriendRequests([]); setMessages([]);
    setActiveId(null); activeIdRef.current = null; messagesRef.current = [];
    setNewConvRecipient(null); setRecipientName(""); setLoadingRecipient(false);
    hiddenMessageIds.current.clear(); setMessageNotice(""); setNewMessagesAvailable(false);
    messageRequestSequence.current += 1;
    setSendError(""); setSearch(""); setGroupInfoOpen(false); setNewMessageOpen(false); setSelectedMessage(null);
    setConversationLoadFailed(false); setMessageLoadFailure(null); setLoadingMessages(false); setOlderLoading(false);
    setRequestError("");
    setLoading(true); setContactsLoading(true);
    if (!user?.id) return;
    loadConversations();
    loadFriendRequests();
  }, [user?.id, loadConversations, loadFriendRequests]);

  // The URL is the selection, including browser Back/Forward and native swipe.
  // Changing a chat must not clear the account's contacts or unsent text drafts.
  useEffect(() => {
    const id = user?.id ? convParam : null;
    const recipient = user?.id && !id ? toParam : null;
    activeIdRef.current = id; messagesRef.current = [];
    messageRequestSequence.current += 1;
    // Synchronize the external browser URL with the selected chat in one render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveId(id); setNewConvRecipient(recipient); setMessages([]);
    setHasOlderMessages(false); setNewMessagesAvailable(false);
    setMessageLoadFailure(null); setLoadingMessages(Boolean(id)); setOlderLoading(false);
    setRecipientName(""); setLoadingRecipient(Boolean(recipient));
    setSendError(""); setMessageNotice(""); setGroupInfoOpen(false); setSelectedMessage(null);
    atBottomRef.current = true;
  }, [convParam, toParam, user?.id]);

  useEffect(() => {
    if (!toParam) return;
    const controller = new AbortController();
    fetch(`/api/profile/by-id?id=${encodeURIComponent(toParam)}`, { signal: controller.signal, cache: "no-store" })
      .then(r => r.json())
      .then(({ profile }) => {
        if (controller.signal.aborted) return;
        setRecipientName(profile?.display_name ?? companyLabel ?? t("unknown"));
        setLoadingRecipient(false);
      })
      .catch(() => { if (!controller.signal.aborted) setLoadingRecipient(false); });
    return () => controller.abort();
  }, [toParam, user?.id, companyLabel, t]);

  useEffect(() => { if (searchParams.get("requests") === "1") queueMicrotask(() => setRequestsOpen(true)); }, [searchParams]);

  const loadMessages = useCallback(async (
    convId: string,
    options: { scroll?: boolean; before?: { before: string; before_id: string } } = {},
  ) => {
    const owner = currentUserRef.current;
    if (!owner) return;
    const requestSequence = options.before ? null : ++messageRequestSequence.current;
    const isCurrentRequest = () => currentUserRef.current === owner && activeIdRef.current === convId
      && (requestSequence === null || requestSequence === messageRequestSequence.current);
    const olderViewport = options.before ? messagesViewportRef.current : null;
    const previousScrollHeight = olderViewport?.scrollHeight ?? 0;
    const previousScrollTop = olderViewport?.scrollTop ?? 0;
    try {
      const query = options.before
        ? `?before=${encodeURIComponent(options.before.before)}&before_id=${encodeURIComponent(options.before.before_id)}`
        : "";
      const res = await fetch(`/api/conversations/${convId}${query}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const { messages: msgs, hasOlder, conversation } = await res.json();
      if (!Array.isArray(msgs)) throw new Error();
      const snapshot = msgs as Message[];
      if (!isCurrentRequest()) return;
      setMessageLoadFailure(failure => failure?.conversationId === convId
        && failure.before?.before === options.before?.before
        && failure.before?.before_id === options.before?.before_id ? null : failure);
      const alreadyLoadedOlder = snapshot[0] && messagesRef.current[0]
        && messagesRef.current[0].created_at < snapshot[0].created_at;
      if (options.before || !alreadyLoadedOlder) setHasOlderMessages(Boolean(hasOlder));
      const currentIds = new Set(messagesRef.current.map((message) => message.id));
      const hasNewVisibleMessage = snapshot.some((message) => !currentIds.has(message.id));
      setMessages((current) => mergeVisibleMessagePage(current, snapshot, hiddenMessageIds.current, !options.before));
      if (conversation?.id === convId) setConversations(current => current.some(c => c.id === convId) ? current : [{ ...conversation, messages: snapshot, updated_at: snapshot.at(-1)?.created_at ?? "" }, ...current]);
      const messageIds = incomingUnreadMessageIds(snapshot, owner);
      if (messageIds.length > 0) {
        try {
          const readResponse = await fetch(`/api/conversations/${convId}/read`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
            body: JSON.stringify({ message_ids: messageIds }),
          });
          if (readResponse.ok) {
            const readState = await readResponse.json();
            if (!isCurrentRequest()) return;
            const readMessages = Array.isArray(readState.readMessages) ? readState.readMessages : [];
            setMessages((current) => applyReadReceiptTimestamps(current, readMessages));
            setConversations((current) => current.map((conversation) => conversation.id !== convId ? conversation : {
              ...conversation,
              unread_count: readState.byConversation?.[convId] ?? conversation.unread_count ?? 0,
              messages: applyReadReceiptTimestamps(conversation.messages ?? [], readMessages),
            }));
            notifyMessagesRead(owner);
          }
        } catch { /* Read receipts do not invalidate a successfully loaded history. */ }
      }
      if (olderViewport) {
        window.setTimeout(() => {
          const nextViewport = messagesViewportRef.current;
          if (nextViewport && currentUserRef.current === owner && activeIdRef.current === convId) nextViewport.scrollTop = previousScrollTop + (nextViewport.scrollHeight - previousScrollHeight);
        }, 0);
      } else if (options.scroll || (atBottomRef.current && hasNewVisibleMessage)) {
        window.setTimeout(() => {
          if (currentUserRef.current !== owner || activeIdRef.current !== convId || (!options.scroll && !atBottomRef.current)) return;
          const viewport = messagesViewportRef.current;
          viewport?.scrollTo({ top: viewport.scrollHeight, behavior: options.scroll ? "instant" : "smooth" });
        }, 50);
      } else if (hasNewVisibleMessage && !options.before) {
        setNewMessagesAvailable(true);
      }
    } catch {
      if (isCurrentRequest()) setMessageLoadFailure({ conversationId: convId, before: options.before });
    } finally {
      if (requestSequence !== null && isCurrentRequest()) setLoadingMessages(false);
    }
  }, []);

  // Message data is delivered only through membership-checked server routes.
  // A modest fallback refresh avoids exposing raw message rows to anonymous
  // Supabase realtime subscriptions. Focus and user actions refresh immediately.
  useEffect(() => {
    if (!activeId) return;
    void loadMessages(activeId, { scroll: messagesRef.current.length === 0 });
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadMessages(activeId);
    }, ACTIVE_CONVERSATION_FALLBACK_REFRESH_MS);
    const onFocus = () => { if (document.visibilityState === "visible") void loadMessages(activeId); };
    window.addEventListener("focus", onFocus);
    return () => { window.clearInterval(interval); window.removeEventListener("focus", onFocus); };
  }, [activeId, loadMessages]);

  // Refresh beim Window-Focus (Tab-Wechsel)
  useEffect(() => {
    const onFocus = () => { loadConversations(); loadFriendRequests(); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadConversations, loadFriendRequests]);

  function openConversation(conv: Conversation) {
    if (user?.id) leave(() => navigateMessageView(window, user.id, {conversationId:conv.id}));
  }
  function openDestination(destination: MessageDestination, commit: () => void) {
    const account = user?.id;
    if (!account) return;
    // Close the native modal before a private-draft navigation guard can appear.
    setNewMessageOpen(false);
    window.setTimeout(() => leave(() => {
      if (currentUserRef.current !== account) return;
      commit(); navigateMessageView(window, account, destination);
    }), 0);
  }
  function messageSent(message: ChatMessage, conversationId: string) {
    if (!user?.id || currentUserRef.current !== user.id) return;
    if (newConvRecipient) {
      navigateMessageView(window, user.id, {conversationId, recipientId:requestedCompanySlug ? newConvRecipient : null, companySlug:requestedCompanySlug}, true);
    } else if (activeIdRef.current === conversationId) {
      messageRequestSequence.current += 1;
      setMessages(current => mergeMessagesById(current, [message])); atBottomRef.current = true;
      window.setTimeout(() => { if (activeIdRef.current === conversationId) {const viewport=messagesViewportRef.current; viewport?.scrollTo({top:viewport.scrollHeight,behavior:"smooth"});} }, 30);
    }
    void loadConversations();
  }

  async function hideOwnMessage(message: Message) {
    if (!activeId || message.sender_id !== user?.id || deletePendingRef.current) return;
    deletePendingRef.current = true;
    const conversationId = activeId;
    const owner = user.id;
    setDeletingMessage(message.id); setSendError(""); setMessageNotice("");
    try {
      const response = await fetch(`/api/conversations/${conversationId}?message_id=${encodeURIComponent(message.id)}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok || result.hiddenMessageId !== message.id) throw new Error(result.error ?? uiText("Ui.text_ce810a95feef7e"));
      if (currentUserRef.current !== owner) return;
      hiddenMessageIds.current.add(message.id); setSelectedMessage(null);
      messageRequestSequence.current += 1;
      setMessages(current => current.filter(m => m.id !== message.id));
      setConversations(current => current.map(c => c.id !== conversationId ? c : { ...c, messages: c.messages.filter(m => m.id !== message.id) }));
      if (activeIdRef.current === conversationId) setMessageNotice(uiText("Ui.text_86507fb7342498"));
      await loadConversations();
    } catch (error) { if (currentUserRef.current === owner && activeIdRef.current === conversationId) setSendError(uiErrorMessage(error, uiText("Ui.text_116897e6048096"))); }
    finally { deletePendingRef.current = false; setDeletingMessage(null); }
  }

  function closeChat() {
    if (user?.id) leave(() => backFromMessageView(window, user.id));
  }

  async function loadOlderMessages() {
    if (!activeId || olderLoading || messages.length === 0) return;
    const owner = currentUserRef.current;
    const conversationId = activeId;
    const oldest = messages[0];
    setOlderLoading(true);
    await loadMessages(conversationId, { before: { before: oldest.created_at, before_id: oldest.id } });
    if (currentUserRef.current === owner && activeIdRef.current === conversationId) setOlderLoading(false);
  }

  async function retryMessageLoad() {
    if (!activeId || messageLoadFailure?.conversationId !== activeId || loadingMessages || olderLoading) return;
    const owner = currentUserRef.current;
    const conversationId = activeId;
    if (messageLoadFailure.before) setOlderLoading(true);
    else setLoadingMessages(messages.length === 0);
    await loadMessages(conversationId, { before: messageLoadFailure.before });
    if (currentUserRef.current === owner && activeIdRef.current === conversationId) setOlderLoading(false);
  }

  async function handleFriendRequest(friendshipId: string, action: "accepted" | "rejected") {
    const owner = currentUserRef.current;
    if (!owner || processingIds.has(friendshipId)) return;
    setProcessingIds(previous => new Set(previous).add(friendshipId)); setRequestError("");
    try {
      const response=await fetch(`/api/friendships/${friendshipId}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:action,accountId:owner})});
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload.error??t("requestError"));
      if(currentUserRef.current!==owner)return;
      setFriendRequests(previous=>previous.filter(request=>request.friendship_id!==friendshipId)); await loadFriendRequests();
    }catch(cause){if(currentUserRef.current===owner)setRequestError(uiErrorMessage(cause,t("requestError")));}
    finally{if(currentUserRef.current===owner)setProcessingIds(previous=>{const next=new Set(previous);next.delete(friendshipId);return next;});}
  }

  const activeConv = conversations.find(c => c.id === activeId);
  const isNewConv = !!newConvRecipient && !activeId;
  const peerProfileHref = conversationPeerProfileHref(activeConv, user?.id ?? "", isNewConv ? newConvRecipient : null);

  const people = [...contacts].sort((a,b) => a.display_name.localeCompare(b.display_name,uiLocale)).map(contact => ({id:contact.user_id, name:contact.display_name, avatar:contact.avatar_url, role:contact.role}));
  const filteredConversations = conversations.filter(conversation => (!groupsOnly || conversation.kind === "group") && `${conversation.otherName ?? ""} ${conversation.group_name ?? ""}`.toLocaleLowerCase(uiLocale).includes(search.trim().toLocaleLowerCase(uiLocale)));

  return <div className={`fixed inset-x-0 top-[calc(var(--site-header-height)+var(--messages-viewport-offset,0px))] lg:top-[calc(7.25rem+1px+var(--messages-viewport-offset,0px))] ${showChat ? "bottom-0" : "bottom-[var(--mobile-nav-clearance)]"} lg:bottom-0 flex overflow-hidden bg-bg-primary`}
    style={{"--messages-viewport-offset":`${visualViewportTop}px`,...(keyboardInset>0?{bottom:`${keyboardInset}px`}:{})} as CSSProperties}>
    <aside className={`${showChat?"hidden sm:flex":"flex"} min-w-0 w-full flex-col border-r border-border bg-bg-primary sm:w-80 sm:shrink-0`}>
      <header className="shrink-0 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center justify-between gap-3"><h1 className="min-w-0 break-words font-display text-xl font-bold text-text-primary">{t("title")}</h1><button type="button" onClick={()=>setNewMessageOpen(true)} aria-label={t(groupsOnly ? "createGroup" : "newMessage")} title={t(groupsOnly ? "createGroup" : "newMessage")} className="flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-xl px-2 text-sm text-gold hover:bg-bg-elevated"><SquarePen size={22}/><span className="hidden min-[400px]:inline">{t(groupsOnly ? "createGroup" : "newMessage")}</span></button></div>
        <InboxNavigation active={groupsOnly ? "groups" : "chats"} />
        <label className="mt-2 flex min-h-11 items-center gap-2 rounded-xl border border-border bg-bg-secondary px-3"><Search size={17} className="shrink-0 text-text-muted"/><input type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder={t("searchChats")} aria-label={t("searchChats")} className="min-h-11 min-w-0 flex-1 bg-transparent text-base text-text-primary outline-none"/></label>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {(friendRequests.length>0||requestsOpen)&&<section className="border-b border-border px-4 py-2"><button type="button" aria-expanded={requestsOpen} onClick={()=>setRequestsOpen(value=>!value)} className="min-h-11 w-full text-left text-sm font-semibold text-gold">{t("requests",{count:friendRequests.length})}</button>{requestsOpen&&<div className="space-y-3 pb-2">{friendRequests.map(request=><article key={request.friendship_id} className="rounded-xl border border-border bg-bg-secondary p-3"><Link href={`/profile/${request.user_id}`} className="flex min-h-11 items-center gap-2 break-words text-sm font-semibold text-text-primary">{request.avatar_url&&<UnoptimizedImage src={request.avatar_url} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover"/>}{request.display_name}</Link><div className="mt-2 flex flex-wrap gap-2"><button type="button" disabled={processingIds.has(request.friendship_id)} onClick={()=>void handleFriendRequest(request.friendship_id,"accepted")} className="min-h-11 flex-1 rounded-xl bg-gold px-3 text-sm font-semibold text-bg-primary disabled:opacity-40">{contactText("accept")}</button><button type="button" disabled={processingIds.has(request.friendship_id)} onClick={()=>void handleFriendRequest(request.friendship_id,"rejected")} className="min-h-11 flex-1 rounded-xl border border-border px-3 text-sm text-text-secondary disabled:opacity-40">{contactText("reject")}</button></div></article>)}{!contactsLoading&&!friendRequests.length&&<p className="text-sm text-text-muted">{t("noRequests")}</p>}{requestError&&<p role="alert" className="text-sm text-red-400 [[data-theme=light]_&]:text-red-700">{requestError}</p>}</div>}</section>}
        {contactsError&&<div role="alert" className="px-4 py-2 text-sm text-red-400 [[data-theme=light]_&]:text-red-700"><p>{uiText("Ui.text_4139ecbefbacc6")}</p><button type="button" onClick={()=>void loadFriendRequests()} className="min-h-11 text-gold">{t("retry")}</button></div>}
        {conversationLoadFailed&&<div role="alert" className="px-4 py-3 text-sm text-red-400 [[data-theme=light]_&]:text-red-700"><p>{messageNavigationText("loadError")}</p><button type="button" onClick={()=>{setLoading(conversations.length===0);void loadConversations();}} className="min-h-11 text-gold">{messageNavigationText("retry")}</button></div>}
        {loading&&conversations.length===0?<p role="status" className="px-4 py-8 text-sm text-text-muted">{t("loading")}</p>:filteredConversations.length===0&&!conversationLoadFailed?<div className="space-y-3 px-5 py-10 text-center"><MessageSquare size={26} className="mx-auto text-text-muted"/><p className="text-sm text-text-muted">{t(search.trim()?"noChats":"emptyInbox")}</p><button type="button" onClick={()=>setNewMessageOpen(true)} className="min-h-11 rounded-xl bg-gold px-4 text-sm font-semibold text-bg-primary">{t(groupsOnly ? "createGroup" : "newMessage")}</button></div>:filteredConversations.map(conversation=>{
          const latest=conversation.messages?.[0];
          return <button key={conversation.id} type="button" aria-pressed={conversation.id===activeId} onClick={()=>openConversation(conversation)} className={`flex min-h-20 w-full min-w-0 items-center gap-3 border-b border-border px-4 py-3 text-left hover:bg-bg-elevated ${activeId===conversation.id?"bg-bg-elevated":""}`}>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-bg-elevated">{conversation.kind==="group"?<Users size={19} className="text-gold"/>:conversation.kind==="support"?<UnoptimizedImage src={SUPPORT_AVATAR_URL} alt="" className="h-full w-full object-contain p-1"/>:conversation.otherAvatar?<UnoptimizedImage src={conversation.otherAvatar} alt="" className="h-full w-full object-cover"/>:<User size={19} className="text-text-muted"/>}</span>
            <span className="min-w-0 flex-1"><span className="flex min-w-0 items-center justify-between gap-2"><strong className="min-w-0 truncate text-sm text-text-primary">{conversation.otherName}</strong>{latest&&<span className="shrink-0 text-[10px] text-text-muted">{formatTime(uiLocale,latest.created_at)}</span>}</span><span className="mt-1 block truncate text-xs text-text-muted">{latest ? (latest.content||t("attachmentPreview")) : t("startChat")}</span></span>{(conversation.unread_count??0)>0&&<span className="shrink-0 rounded-full bg-gold px-1.5 py-0.5 text-[10px] font-semibold text-bg-primary">{conversation.unread_count}</span>}
          </button>;
        })}
        <Link href="/support" className="flex min-h-11 items-center gap-2 px-4 py-3 text-sm text-text-secondary hover:text-gold"><MessageSquare size={16}/>{uiText("SupportContact.link")}</Link>
      </div>
    </aside>
    <section aria-label={t("conversation")} className={`${showChat?"flex":"hidden sm:flex"} relative min-w-0 flex-1 flex-col bg-bg-primary`}>
      {showChat?<>
        <header className="flex min-w-0 shrink-0 items-center gap-2 border-b border-border px-3 py-2">
          <button type="button" onClick={closeChat} aria-label={messageNavigationText("back")} className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl text-text-muted"><ArrowLeft size={21}/></button>
          {activeConv?.kind==="group"?<button type="button" onClick={()=>setGroupInfoOpen(true)} aria-label={t("openGroupInfo")} className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg-elevated"><Users size={18} className="text-gold"/></span><span className="min-w-0"><strong className="block truncate text-sm text-text-primary">{activeConv.otherName}</strong><span className="text-xs text-text-muted">{t("members",{count:activeConv.memberCount??0})}</span></span></button>:<div className="flex min-h-11 min-w-0 flex-1 items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-bg-elevated">{activeConv?.kind==="support"?<UnoptimizedImage src={SUPPORT_AVATAR_URL} alt="" className="h-full w-full object-contain p-1"/>:activeConv?.otherAvatar?<UnoptimizedImage src={activeConv.otherAvatar} alt="" className="h-full w-full object-cover"/>:<User size={17} className="text-text-muted"/>}</span><span className="min-w-0"><strong className="block truncate text-sm text-text-primary">{isNewConv?(loadingRecipient?t("loading"):recipientName):(activeConv?.otherName??t("conversation"))}</strong>{activeConv?.kind==="support"&&<span className="text-xs text-gold">{SUPPORT_NAME}</span>}</span></div>}
          {peerProfileHref&&<Link href={peerProfileHref} className="inline-flex min-h-11 shrink-0 items-center px-2 text-xs text-gold">{uiText("profile.tabProfile")}</Link>}
        </header>
            {/* Nachrichten */}
            {companyLabel && companySlug && <Link href={`/companies/${encodeURIComponent(companySlug)}`} className="shrink-0 border-b border-border px-4 py-2 text-xs text-gold">{companyText("context", { name: companyLabel })}</Link>}
            <div
              ref={messagesViewportRef}
              onScroll={(event) => {
                const element = event.currentTarget;
                atBottomRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
                if (atBottomRef.current) setNewMessagesAvailable(false);
              }}
              className="flex-1 min-h-0 min-w-0 overflow-y-auto overscroll-contain px-4 py-4 space-y-1"
            >
              {loadingMessages && messages.length === 0 && <div role="status" aria-label={messageNavigationText("loading")} className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-text-muted" /></div>}
              {messageLoadFailure?.conversationId === activeId && <div role="alert" className="mb-3 text-sm text-red-400 [[data-theme=light]_&]:text-red-700">
                <p>{messageNavigationText("messageLoadError")}</p>
                <button type="button" disabled={loadingMessages || olderLoading} onClick={() => void retryMessageLoad()} className="min-h-11 text-gold disabled:opacity-60">{messageNavigationText("retry")}</button>
              </div>}
              {hasOlderMessages && messages.length > 0 && (
                <div className="flex justify-center pb-3">
                  <button
                    onClick={loadOlderMessages}
                    disabled={olderLoading}
                    className="min-h-11 px-4 rounded-xl border border-border text-sm text-text-muted hover:text-gold hover:border-gold/50 disabled:opacity-60 flex items-center gap-2"
                  >{uiText.rich("Ui.text_76970f0afffef8", { value1: () => (olderLoading && <Loader2 size={15} className="animate-spin" />) })}</button>
                </div>
              )}
              {isNewConv && messages.length === 0 && (
                <div className="text-center py-16">
                  <div className="w-14 h-14 rounded-2xl bg-bg-elevated border border-border flex items-center justify-center mx-auto mb-3">
                    <MessageSquare size={22} className="text-text-muted opacity-50" />
                  </div>
                  <p className="text-sm font-medium text-text-secondary mb-1">{uiText("Ui.text_b1da4f28aa3730")}</p>
                  <p className="text-xs text-text-muted">{uiText.rich("Ui.text_521293c66a546f", { value1: () => (loadingRecipient ? "…" : recipientName) })}</p>
                </div>
              )}
              {(() => {
                let lastDateLabel = "";
                return messages.map((msg, idx) => {
                  const isOwn = msg.sender_id === user?.id;
                  const msgDate = new Date(msg.created_at);
                  const dateLabel = msgDate.toLocaleDateString(uiLocale, { day: "numeric", month: "long", year: "numeric" });
                  const showDateSep = dateLabel !== lastDateLabel;
                  if (showDateSep) lastDateLabel = dateLabel;

                  // Is this the last own message and next is not own (= seen indicator)
                  const isLastOwn = isOwn && (idx === messages.length - 1 || messages[idx + 1]?.sender_id !== user?.id);
                  const isSeen = isOwn && !!msg.read_at;

                  return (
                    <div key={msg.id}>
                      {showDateSep && (
                        <div className="flex items-center gap-3 py-3">
                          <div className="flex-1 h-px bg-border" />
                          <span className="text-[10px] text-text-muted font-medium px-2 shrink-0">{dateLabel}</span>
                          <div className="flex-1 h-px bg-border" />
                        </div>
                      )}
                      <div className={`flex min-w-0 mb-1 ${isOwn ? "justify-end" : "justify-start"}`}>
                        <div className="min-w-0 max-w-[86%] sm:max-w-[78%]">
                        {activeConv?.kind === "group" && (
                          <div className={`flex items-center gap-1.5 mb-1 ${isOwn ? "justify-end" : "justify-start"}`}>
                            {msg.senderAvatar ? (
                              <UnoptimizedImage src={msg.senderAvatar} alt="" className="w-5 h-5 rounded-full object-cover" />
                            ) : (
                              <span className="w-5 h-5 rounded-full bg-bg-elevated border border-border flex items-center justify-center"><User size={11} className="text-text-muted" /></span>
                            )}
                            <span className="text-[11px] text-text-muted">{isOwn ? uiText("Ui.text_0b6722a8adfb93") : (msg.senderName ?? uiText("Ui.text_276ffa1fb4f970"))}</span>
                          </div>
                        )}
                        <div role={isOwn ? "button" : undefined} tabIndex={isOwn ? 0 : undefined} aria-description={isOwn ? t("messageOptions") : undefined} onClick={isOwn ? () => { if (!window.getSelection?.()?.toString()) setSelectedMessage(msg); } : undefined} onKeyDown={isOwn ? event => { if (event.key === "Enter" || event.key === " ") {event.preventDefault();setSelectedMessage(msg);} } : undefined} onContextMenu={isOwn ? event => {event.preventDefault();setSelectedMessage(msg);} : undefined} className={`min-h-11 min-w-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere] px-4 py-2.5 rounded-2xl text-sm leading-relaxed focus-visible:outline-2 focus-visible:outline-gold ${
                          isOwn
                            ? "bg-gold text-bg-primary rounded-br-sm"
                            : "bg-bg-elevated border border-border text-text-primary rounded-bl-sm"
                        }`}>
                          {msg.content&&<span>{msg.content}</span>}
                          <MessageAttachments attachments={msg.attachments}/>
                          <div className="mt-1 flex items-center justify-between gap-2">
                          <p className={`text-[10px] ${isOwn ? "text-bg-primary/60" : "text-text-muted"}`}>
                            {formatTime(uiLocale, msg.created_at)}
                          </p>

                          </div>
        </div>
      </div>

    </div>
                      {isLastOwn && (
                        <div className="flex justify-end pr-1 pb-1">
                          <span className={`text-[10px] flex items-center gap-1 ${isSeen ? "text-gold" : "text-text-muted/60"}`}>
                            {activeConv?.kind === "group" ? (
                              (msg.read_by ?? []).filter((readerId) => readerId !== user?.id).length > 0
                                ? uiText("Ui.text_5719499dc58c85", { value1: String((msg.read_by ?? []).filter((readerId) => readerId !== user?.id).length) })
                                : uiText("Ui.text_4b6a7afab7b4c4")
                            ) : isSeen ? (
                              <>{uiText.rich("Ui.text_a01eb8e60967fc", { part1: () => (<Check size={10} className="inline" />), part2: () => (<Check size={10} className="-ml-1.5 inline" />) })}</>
                            ) : (
                              <>{uiText.rich("Ui.text_c240aaf25cb985", { part1: () => (<Check size={10} className="inline" />) })}</>
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
              <div ref={bottomRef} />
            </div>

            {newMessagesAvailable && <button type="button" onClick={() => {
              const viewport = messagesViewportRef.current;
              viewport?.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
              setNewMessagesAvailable(false);
            }} className="absolute min-h-11 bottom-24 left-1/2 z-10 -translate-x-1/2 rounded-full border border-gold/40 bg-bg-secondary px-4 py-2 text-sm text-gold shadow-lg">{navigationText("newMessages")}</button>}


        {(sendError||messageNotice)&&<div className="shrink-0 px-3 py-2 text-xs">{sendError&&<p role="alert" className="text-red-400 [[data-theme=light]_&]:text-red-700">{sendError}</p>}{messageNotice&&<p role="status" className="text-gold">{messageNotice}</p>}</div>}
        {user?.id&&(activeId||newConvRecipient)&&<MessageComposer key={`${user.id}:${activeId?`conversation:${activeId}`:`recipient:${newConvRecipient}`}`} accountId={user.id} destination={{conversationId:activeId,recipientId:newConvRecipient}} onSent={messageSent}/>}
      </>:<div className="m-auto max-w-sm p-8 text-center"><MessageSquare size={40} className="mx-auto mb-4 text-text-muted"/><h2 className="font-display text-xl text-text-primary">{t("startChat")}</h2><p className="mt-2 text-sm text-text-muted">{t("choosePeople")}</p><button type="button" onClick={()=>setNewMessageOpen(true)} className="mt-5 min-h-11 rounded-xl bg-gold px-4 text-sm font-semibold text-bg-primary">{t("newMessage")}</button></div>}
    </section>
    {user?.id&&<NewMessageDialog key={user.id} open={newMessageOpen} forceGroup={groupsOnly} accountId={user.id} contacts={people} onClose={()=>setNewMessageOpen(false)} onOpen={openDestination}/>}
    {user?.id&&activeConv?.kind==="group"&&<GroupInfoDialog key={`${user.id}:${activeConv.id}`} open={groupInfoOpen} accountId={user.id} group={activeConv} contacts={people} onClose={()=>setGroupInfoOpen(false)} onRefresh={async()=>{await loadConversations();if(activeIdRef.current===activeConv.id)await loadMessages(activeConv.id);}} onResume={()=>setGroupInfoOpen(true)} onLeave={()=>{setGroupInfoOpen(false);if(user?.id)navigateMessageView(window,user.id,{},true);void loadConversations();}}/>}
    <MessagingDialog compact open={!!selectedMessage} title={t("messageOptions")} onClose={()=>setSelectedMessage(null)} busy={!!deletingMessage} footer={<button type="button" disabled={!!deletingMessage} onClick={()=>{if(selectedMessage)void hideOwnMessage(selectedMessage);}} className="min-h-11 w-full rounded-xl border border-crimson/30 px-4 text-sm text-red-400 [[data-theme=light]_&]:text-red-700 disabled:opacity-40">{t("hideForMe")}</button>}><p className="break-words whitespace-pre-wrap rounded-xl border border-border bg-bg-secondary p-3 text-sm [overflow-wrap:anywhere]">{selectedMessage?.content}</p><MessageAttachments attachments={selectedMessage?.attachments}/><p className="text-sm text-text-muted">{t("hideHelp")}</p>{sendError&&<p role="alert" className="text-sm text-red-400 [[data-theme=light]_&]:text-red-700">{sendError}</p>}</MessagingDialog>
  </div>;
}

export default function MessagesPage() {
  return <Suspense><MessagesContent/></Suspense>;
}
