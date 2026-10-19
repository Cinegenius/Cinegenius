"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { Send, ArrowLeft, MessageSquare, Loader2, User, UserPlus, Check, X, Users, Pencil, UserMinus, Plus } from "lucide-react";
import { Suspense } from "react";
import { applyReadReceiptTimestamps, incomingUnreadMessageIds } from "@/lib/message-read-state";
import { notifyMessagesRead, subscribeToMessageReads } from "@/lib/message-read-sync";
import { mergeMessagesById } from "@/lib/conversation-logic";

type Message = {
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
  kind?: "direct" | "group";
  group_name?: string | null;
  sender_id: string;
  receiver_id: string | null;
  listing_title: string | null;
  updated_at: string;
  messages: Message[];
  unread_count?: number;
  otherName?: string;
  otherAvatar?: string;
  memberCount?: number;
  isAdmin?: boolean;
  members?: Array<{ user_id: string; display_name: string; avatar_url: string | null; role: "admin" | "member"; joined_at: string }>;
};

type SearchableUser = { id: string; name: string; avatar: string | null; role: string | null; location: string | null };

type FriendRequest = {
  friendship_id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
};

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000 && d.getDate() === now.getDate()) {
    return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("de-DE", { day: "numeric", month: "short" });
}

function MessagesContent() {
  const { user } = useUser();
  const searchParams = useSearchParams();
  const toParam = searchParams.get("to");
  const convParam = searchParams.get("conv");

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newConvRecipient, setNewConvRecipient] = useState<string | null>(toParam);
  const [recipientName, setRecipientName] = useState("");
  const [loadingRecipient, setLoadingRecipient] = useState(!!toParam);
  const [sendError, setSendError] = useState("");
  const [groupModalMode, setGroupModalMode] = useState<"create" | "manage" | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupSearch, setGroupSearch] = useState("");
  const [groupSearchResults, setGroupSearchResults] = useState<SearchableUser[]>([]);
  const [selectedGroupUsers, setSelectedGroupUsers] = useState<SearchableUser[]>([]);
  const [groupSaving, setGroupSaving] = useState(false);
  const [groupError, setGroupError] = useState("");
  const [olderLoading, setOlderLoading] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [visualViewportTop, setVisualViewportTop] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesViewportRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const messagesRef = useRef<Message[]>([]);
  const activeIdRef = useRef<string | null>(null);
  const autoOpenedConversationRef = useRef<string | null>(null);
  const autoOpenedRecipientRef = useRef<string | null>(null);
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // Friend requests
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

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
    try {
      const res = await fetch("/api/conversations", { cache: "no-store" });
      if (!res.ok) throw new Error("fetch failed");
      const { data } = await res.json();
      setConversations(Array.isArray(data) ? data as Conversation[] : []);
    } catch { /* silent — UI shows empty state */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const unsubscribe = subscribeToMessageReads(user.id, () => { void loadConversations(); });
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadConversations();
    }, 8_000);
    return () => {
      unsubscribe();
      window.clearInterval(interval);
    };
  }, [user?.id, loadConversations]);

  const loadFriendRequests = useCallback(async () => {
    try {
      const res = await fetch("/api/friendships");
      if (!res.ok) return;
      const { incoming } = await res.json();
      if (Array.isArray(incoming)) setFriendRequests(incoming);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!user) return;
    loadConversations();
    loadFriendRequests();
  }, [user, loadConversations, loadFriendRequests]);

  useEffect(() => {
    if (!toParam) return;
    fetch(`/api/profile/by-id?id=${toParam}`)
      .then(r => r.json())
      .then(({ profile }) => {
        setRecipientName(profile?.display_name ?? "Unbekannt");
        setLoadingRecipient(false);
      })
      .catch(() => setLoadingRecipient(false));
  }, [toParam]);

  useEffect(() => {
    if (!toParam) {
      autoOpenedRecipientRef.current = null;
      return;
    }
    if (loading || autoOpenedRecipientRef.current === toParam) return;
    const existing = conversations.find(c =>
      c.sender_id === toParam || c.receiver_id === toParam
    );
    if (existing) {
      autoOpenedRecipientRef.current = toParam;
      activeIdRef.current = existing.id;
      setActiveId(existing.id);
      messagesRef.current = [];
      setMessages([]);
      setNewConvRecipient(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toParam, loading, conversations]);

  useEffect(() => {
    const query = groupSearch.trim();
    if (query.length < 2) {
      setGroupSearchResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(`/api/conversations/users?q=${encodeURIComponent(query)}`, { signal: controller.signal, cache: "no-store" })
        .then(async (response) => response.ok ? response.json() : { users: [] })
        .then((payload) => setGroupSearchResults(Array.isArray(payload.users) ? payload.users : []))
        .catch(() => {});
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [groupSearch]);

  // Open a specific conversation by ID (from notification links: ?conv=...)
  useEffect(() => {
    if (!convParam) {
      autoOpenedConversationRef.current = null;
      return;
    }
    if (loading || autoOpenedConversationRef.current === convParam) return;
    const existing = conversations.find(c => c.id === convParam);
    if (existing) {
      autoOpenedConversationRef.current = convParam;
      activeIdRef.current = existing.id;
      setActiveId(existing.id);
      messagesRef.current = [];
      setMessages([]);
      setNewConvRecipient(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convParam, loading, conversations]);

  const loadMessages = useCallback(async (
    convId: string,
    options: { scroll?: boolean; before?: { before: string; before_id: string } } = {},
  ) => {
    const olderViewport = options.before ? messagesViewportRef.current : null;
    const previousScrollHeight = olderViewport?.scrollHeight ?? 0;
    const previousScrollTop = olderViewport?.scrollTop ?? 0;
    try {
      const query = options.before
        ? `?before=${encodeURIComponent(options.before.before)}&before_id=${encodeURIComponent(options.before.before_id)}`
        : "";
      const res = await fetch(`/api/conversations/${convId}${query}`, { cache: "no-store" });
      if (!res.ok) return;
      const { messages: msgs, hasOlder } = await res.json();
      const snapshot = Array.isArray(msgs) ? msgs as Message[] : [];
      if (activeIdRef.current !== convId) return;
      setHasOlderMessages(Boolean(hasOlder));
      const currentIds = new Set(messagesRef.current.map((message) => message.id));
      const hasNewVisibleMessage = snapshot.some((message) => !currentIds.has(message.id));
      setMessages((current) => mergeMessagesById(current, snapshot));
      const messageIds = incomingUnreadMessageIds(snapshot, user?.id ?? "");
      if (messageIds.length > 0 && user?.id) {
        const readResponse = await fetch(`/api/conversations/${convId}/read`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ message_ids: messageIds }),
        });
        if (readResponse.ok) {
          const readState = await readResponse.json();
          const readMessages = Array.isArray(readState.readMessages) ? readState.readMessages : [];
          setMessages((current) => applyReadReceiptTimestamps(current, readMessages));
          setConversations((current) => current.map((conversation) => conversation.id !== convId ? conversation : {
            ...conversation,
            unread_count: readState.byConversation?.[convId] ?? conversation.unread_count ?? 0,
            messages: applyReadReceiptTimestamps(conversation.messages ?? [], readMessages),
          }));
          if (user?.id) notifyMessagesRead(user.id);
        }
      }
      if (olderViewport) {
        window.setTimeout(() => {
          const nextViewport = messagesViewportRef.current;
          if (nextViewport) nextViewport.scrollTop = previousScrollTop + (nextViewport.scrollHeight - previousScrollHeight);
        }, 0);
      } else if (options.scroll || (atBottomRef.current && hasNewVisibleMessage)) {
        window.setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: options.scroll ? "auto" : "smooth" }), 50);
      }
    } catch { /* silent */ }
  }, [user?.id]);

  // Message data is delivered only through membership-checked server routes.
  // Polling every few seconds avoids exposing raw message rows to anonymous
  // Supabase realtime subscriptions while still updating open group chats.
  useEffect(() => {
    if (!activeId) return;
    void loadMessages(activeId, { scroll: messagesRef.current.length === 0 });
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadMessages(activeId);
    }, 3_000);
    const onFocus = () => { if (document.visibilityState === "visible") void loadMessages(activeId); };
    window.addEventListener("focus", onFocus);
    return () => { window.clearInterval(interval); window.removeEventListener("focus", onFocus); };
  }, [activeId, loadMessages]);

  // Refresh beim Window-Focus (Tab-Wechsel)
  useEffect(() => {
    const onFocus = () => { loadConversations(); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadConversations]);

  function openConversation(conv: Conversation) {
    activeIdRef.current = conv.id;
    messagesRef.current = [];
    setActiveId(conv.id);
    setMessages([]);
    setHasOlderMessages(false);
    setNewConvRecipient(null);
  }

  function closeChat() {
    activeIdRef.current = null;
    messagesRef.current = [];
    setActiveId(null);
    setNewConvRecipient(null);
    setMessages([]);
  }

  function openCreateGroup() {
    setGroupName("");
    setGroupSearch("");
    setSelectedGroupUsers([]);
    setGroupError("");
    setGroupModalMode("create");
  }

  function openGroupDetails() {
    if (!activeConv || activeConv.kind !== "group") return;
    setGroupName(activeConv.group_name ?? activeConv.otherName ?? "");
    setGroupSearch("");
    setSelectedGroupUsers([]);
    setGroupError("");
    setGroupModalMode("manage");
  }

  function toggleSelectedUser(person: SearchableUser) {
    setSelectedGroupUsers((current) => current.some((selected) => selected.id === person.id)
      ? current.filter((selected) => selected.id !== person.id)
      : [...current, person]);
  }

  async function createGroup() {
    if (groupSaving) return;
    setGroupSaving(true);
    setGroupError("");
    try {
      const response = await fetch("/api/conversations/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: groupName.trim(), member_ids: selectedGroupUsers.map((person) => person.id) }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Gruppe konnte nicht erstellt werden.");
      const conversationId = payload.conversationId as string;
      setGroupModalMode(null);
      await loadConversations();
      activeIdRef.current = conversationId;
      setActiveId(conversationId);
      messagesRef.current = [];
      setMessages([]);
      setHasOlderMessages(false);
    } catch (error) {
      setGroupError(error instanceof Error ? error.message : "Gruppe konnte nicht erstellt werden.");
    } finally {
      setGroupSaving(false);
    }
  }

  async function renameGroup() {
    if (!activeId || groupSaving) return;
    setGroupSaving(true);
    setGroupError("");
    try {
      const response = await fetch(`/api/conversations/${activeId}/group`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: groupName.trim() }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Gruppenname konnte nicht geändert werden.");
      await loadConversations();
    } catch (error) {
      setGroupError(error instanceof Error ? error.message : "Gruppenname konnte nicht geändert werden.");
    } finally {
      setGroupSaving(false);
    }
  }

  async function updateGroupMembers(action: "add" | "remove" | "leave", targetUserId?: string) {
    if (!activeId || groupSaving) return;
    setGroupSaving(true);
    setGroupError("");
    try {
      const response = await fetch(`/api/conversations/${activeId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, user_id: targetUserId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Mitgliedschaft konnte nicht geändert werden.");
      setSelectedGroupUsers([]);
      setGroupSearch("");
      if (action === "leave") {
        setGroupModalMode(null);
        closeChat();
        await loadConversations();
      } else {
        await loadConversations();
        await loadMessages(activeId);
      }
    } catch (error) {
      setGroupError(error instanceof Error ? error.message : "Mitgliedschaft konnte nicht geändert werden.");
    } finally {
      setGroupSaving(false);
    }
  }

  async function addSelectedMembers() {
    if (!activeId || selectedGroupUsers.length === 0 || groupSaving) return;
    setGroupSaving(true);
    setGroupError("");
    try {
      for (const person of selectedGroupUsers) {
        const response = await fetch(`/api/conversations/${activeId}/members`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "add", user_id: person.id }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error ?? `${person.name} konnte nicht hinzugefügt werden.`);
      }
      setSelectedGroupUsers([]);
      setGroupSearch("");
      await loadConversations();
      await loadMessages(activeId);
    } catch (error) {
      setGroupError(error instanceof Error ? error.message : "Mitglieder konnten nicht hinzugefügt werden.");
      await loadConversations();
    } finally {
      setGroupSaving(false);
    }
  }

  async function loadOlderMessages() {
    if (!activeId || olderLoading || messages.length === 0) return;
    const oldest = messages[0];
    setOlderLoading(true);
    await loadMessages(activeId, { before: { before: oldest.created_at, before_id: oldest.id } });
    setOlderLoading(false);
  }

  async function handleFriendRequest(friendshipId: string, action: "accepted" | "rejected") {
    setProcessingIds(prev => new Set(prev).add(friendshipId));
    try {
      const res = await fetch(`/api/friendships/${friendshipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: action }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Fehler" }));
        console.error("[handleFriendRequest]", res.status, error);
        return;
      }
      setFriendRequests(prev => prev.filter(r => r.friendship_id !== friendshipId));
    } catch (e) {
      console.error("[handleFriendRequest] network error", e);
    } finally {
      setProcessingIds(prev => { const s = new Set(prev); s.delete(friendshipId); return s; });
    }
  }

  function dismissRequest(friendshipId: string) {
    setDismissedIds(prev => new Set(prev).add(friendshipId));
  }

  const visibleRequests = friendRequests.filter(r => !dismissedIds.has(r.friendship_id));

  async function sendMessage() {
    if (!text.trim() || sending) return;
    setSending(true);
    setSendError("");

    try {
      if (newConvRecipient) {
        const res = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ receiver_id: newConvRecipient, content: text.trim() }),
        });
        const { conversationId, error } = await res.json().catch(() => ({}));
        if (!res.ok || error || typeof conversationId !== "string") throw new Error(error ?? "Nachricht konnte nicht gesendet werden.");
        setText("");
        setNewConvRecipient(null);
        await loadConversations();
        activeIdRef.current = conversationId;
        setActiveId(conversationId);
        messagesRef.current = [];
        setMessages([]);
      } else if (activeId) {
        const res = await fetch(`/api/conversations/${activeId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: text.trim() }),
        });
        const { message, error } = await res.json().catch(() => ({}));
        if (!res.ok || error || !message?.id) throw new Error(error ?? "Nachricht konnte nicht bestätigt werden.");
        setText("");
        setMessages(prev => mergeMessagesById(prev, [message]));
        atBottomRef.current = true;
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      }
    } catch (e) {
      setSendError(e instanceof Error ? e.message : "Nachricht konnte nicht gesendet werden. Deine Eingabe ist erhalten.");
    } finally {
      setSending(false);
    }
  }

  const activeConv = conversations.find(c => c.id === activeId);
  const isNewConv = !!newConvRecipient && !activeId;
  const otherUserId = isNewConv
    ? newConvRecipient
    : activeConv && activeConv.kind !== "group"
      ? (activeConv.sender_id === user?.id ? activeConv.receiver_id : activeConv.sender_id)
      : null;

  return (
    <div
      className={`fixed inset-x-0 top-16 ${showChat ? "bottom-0" : "bottom-14"} lg:bottom-0 bg-bg-primary flex overflow-hidden`}
      style={{
        ...(visualViewportTop > 0 ? { top: `${64 + visualViewportTop}px` } : {}),
        ...(keyboardInset > 0 ? { bottom: `${keyboardInset}px` } : {}),
      }}
    >

      {/* ── KONVERSATIONSLISTE ── */}
      <div className={`
        ${showChat ? "hidden sm:flex" : "flex"}
        flex-col min-w-0 w-full sm:w-80 sm:shrink-0 border-r border-border bg-bg-primary
      `}>
        <div className="px-4 py-4 border-b border-border shrink-0 flex items-center justify-between gap-3">
          <h1 className="font-display text-lg font-bold text-text-primary flex items-center gap-2">
            <MessageSquare size={18} className="text-gold" /> Nachrichten
          </h1>
          <button
            onClick={openCreateGroup}
            className="min-h-11 px-3 rounded-xl border border-border text-sm text-text-secondary hover:text-gold hover:border-gold/50 flex items-center gap-2 shrink-0"
            title="Gruppe erstellen"
          >
            <Users size={16} /> <span className="hidden min-[380px]:inline">Gruppe</span><Plus size={14} />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 size={20} className="animate-spin text-text-muted" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">

            {/* ── Freundschaftsanfragen ── */}
            {visibleRequests.length > 0 && (
              <div className="border-b border-border">
                <div className="px-4 py-2 bg-bg-elevated">
                  <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                    <UserPlus size={12} /> Anfragen · {visibleRequests.length}
                  </p>
                </div>
                {visibleRequests.map(req => {
                  const isProcessing = processingIds.has(req.friendship_id);
                  return (
                    <div key={req.friendship_id} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0">
                      <Link href={`/profile/${req.user_id}`} className="shrink-0">
                        <div className="w-10 h-10 rounded-full bg-bg-elevated border border-border flex items-center justify-center overflow-hidden">
                          {req.avatar_url
                            ? <img src={req.avatar_url} alt="" className="w-full h-full object-cover" />
                            : <User size={16} className="text-text-muted" />}
                        </div>
                      </Link>
                      <div className="flex-1 min-w-0">
                        <Link href={`/profile/${req.user_id}`}>
                          <p className="text-sm font-semibold text-text-primary truncate hover:text-gold transition-colors">
                            {req.display_name}
                          </p>
                        </Link>
                        <p className="text-xs text-text-muted">möchte sich vernetzen</p>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        {isProcessing ? (
                          <Loader2 size={16} className="animate-spin text-text-muted" />
                        ) : (
                          <>
                            <button
                              onClick={() => handleFriendRequest(req.friendship_id, "accepted")}
                              title="Annehmen"
                              className="w-8 h-8 rounded-full bg-gold/10 text-gold border border-gold/20 flex items-center justify-center hover:bg-gold hover:text-bg-primary transition-colors"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={() => handleFriendRequest(req.friendship_id, "rejected")}
                              title="Ablehnen"
                              className="w-8 h-8 rounded-full bg-bg-elevated border border-border flex items-center justify-center text-text-muted hover:text-red-400 hover:border-red-400/40 transition-colors"
                            >
                              <X size={14} />
                            </button>
                            <button
                              onClick={() => dismissRequest(req.friendship_id)}
                              title="Ausblenden"
                              className="w-8 h-8 rounded-full bg-bg-elevated border border-border flex items-center justify-center text-text-muted hover:text-text-primary transition-colors text-[10px] font-bold"
                            >
                              –
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Neue Konversation Placeholder ── */}
            {isNewConv && (
              <button className="w-full flex items-center gap-3 p-4 bg-gold/5 border-b border-gold/20 text-left">
                <div className="w-10 h-10 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
                  <User size={16} className="text-gold" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text-primary truncate">
                    {loadingRecipient ? "Lädt..." : recipientName}
                  </p>
                  <p className="text-xs text-gold">Neue Nachricht</p>
                </div>
              </button>
            )}

            {/* ── Konversationsliste ── */}
            {conversations.length === 0 && !isNewConv && visibleRequests.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center min-h-[200px] gap-4">
                <div className="w-12 h-12 rounded-2xl bg-bg-elevated border border-border flex items-center justify-center">
                  <MessageSquare size={20} className="text-text-muted opacity-50" />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-secondary mb-1">Keine Nachrichten</p>
                  <p className="text-xs text-text-muted leading-relaxed">Schreibe Filmschaffenden oder Inserenten direkt an.</p>
                </div>
                <Link href="/creators" className="text-xs text-gold hover:text-gold-light transition-colors font-medium">
                  Crew entdecken →
                </Link>
              </div>
            ) : (
              conversations.map(conv => {
                const lastMsg = conv.messages?.[0];
                const unread = conv.unread_count ?? 0;
                return (
                  <button
                    key={conv.id}
                    onClick={() => openConversation(conv)}
                    className={`w-full flex items-center gap-3 p-4 border-b border-border text-left hover:bg-bg-elevated transition-colors ${activeId === conv.id ? "bg-bg-elevated" : ""}`}
                  >
                    <div className="w-10 h-10 rounded-full bg-bg-elevated border border-border flex items-center justify-center shrink-0 overflow-hidden">
                      {conv.kind === "group"
                        ? <Users size={17} className="text-gold" />
                        : conv.otherAvatar
                        ? <img src={conv.otherAvatar} alt="" className="w-full h-full object-cover" />
                        : <User size={16} className="text-text-muted" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-text-primary truncate">{conv.otherName}{conv.kind === "group" && conv.memberCount ? ` · ${conv.memberCount}` : ""}</p>
                        {lastMsg && <span className="text-[10px] text-text-muted shrink-0 ml-1">{formatTime(lastMsg.created_at)}</span>}
                      </div>
                      <p className="text-xs text-text-muted truncate">{lastMsg?.content ?? "Keine Nachrichten"}</p>
                    </div>
                    {unread > 0 && (
                      <span className="w-5 h-5 rounded-full bg-gold text-bg-primary text-[10px] font-bold flex items-center justify-center shrink-0">{unread}</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* ── CHAT-BEREICH ── */}
      <div className={`
        ${showChat ? "flex" : "hidden sm:flex"}
        flex-col flex-1 min-w-0 bg-bg-primary
      `}>
        {showChat ? (
          <>
            {/* Header */}
            <div className="px-4 py-3.5 border-b border-border flex items-center gap-3 shrink-0">
              <button
                onClick={closeChat}
                className="p-1.5 -ml-1 text-text-muted hover:text-text-primary active:scale-95 transition-all"
              >
                <ArrowLeft size={20} />
              </button>
              <div className="w-9 h-9 rounded-full bg-bg-elevated border border-border flex items-center justify-center overflow-hidden shrink-0">
                {activeConv?.kind === "group"
                  ? <Users size={16} className="text-gold" />
                  : activeConv?.otherAvatar
                  ? <img src={activeConv.otherAvatar} alt="" className="w-full h-full object-cover" />
                  : <User size={15} className="text-text-muted" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text-primary truncate">
                  {isNewConv ? (loadingRecipient ? "Lädt..." : recipientName) : (activeConv?.otherName ?? "Gespräch")}
                </p>
              {activeConv?.kind === "group" && (
                <p className="text-xs text-text-muted truncate">{activeConv.memberCount ?? 0} Mitglieder</p>
              )}
              {activeConv?.listing_title && (
                <p className="text-xs text-text-muted truncate">{activeConv.listing_title}</p>
              )}
            </div>
            {activeConv?.kind === "group" && (
              <button
                onClick={openGroupDetails}
                className="min-w-11 min-h-11 px-2 rounded-xl border border-border text-text-muted hover:text-gold hover:border-gold/50 flex items-center justify-center gap-2 shrink-0"
                aria-label="Gruppeninformationen öffnen"
              >
                <Users size={17} />
              </button>
            )}
              {otherUserId && (
                <Link
                  href={`/profile/${otherUserId}`}
                  className="shrink-0 text-xs text-gold hover:text-gold-light transition-colors"
                >
                  Profil
                </Link>
              )}
            </div>

            {/* Nachrichten */}
            <div
              ref={messagesViewportRef}
              onScroll={(event) => {
                const element = event.currentTarget;
                atBottomRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
              }}
              className="flex-1 min-w-0 overflow-y-auto overscroll-contain px-4 py-4 space-y-1"
            >
              {hasOlderMessages && messages.length > 0 && (
                <div className="flex justify-center pb-3">
                  <button
                    onClick={loadOlderMessages}
                    disabled={olderLoading}
                    className="min-h-11 px-4 rounded-xl border border-border text-sm text-text-muted hover:text-gold hover:border-gold/50 disabled:opacity-60 flex items-center gap-2"
                  >
                    {olderLoading && <Loader2 size={15} className="animate-spin" />}
                    Ältere Nachrichten laden
                  </button>
                </div>
              )}
              {isNewConv && messages.length === 0 && (
                <div className="text-center py-16">
                  <div className="w-14 h-14 rounded-2xl bg-bg-elevated border border-border flex items-center justify-center mx-auto mb-3">
                    <MessageSquare size={22} className="text-text-muted opacity-50" />
                  </div>
                  <p className="text-sm font-medium text-text-secondary mb-1">Neue Unterhaltung</p>
                  <p className="text-xs text-text-muted">
                    Schreib deine erste Nachricht an {loadingRecipient ? "…" : recipientName}.
                  </p>
                </div>
              )}
              {(() => {
                let lastDateLabel = "";
                return messages.map((msg, idx) => {
                  const isOwn = msg.sender_id === user?.id;
                  const msgDate = new Date(msg.created_at);
                  const dateLabel = msgDate.toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" });
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
                              <img src={msg.senderAvatar} alt="" className="w-5 h-5 rounded-full object-cover" />
                            ) : (
                              <span className="w-5 h-5 rounded-full bg-bg-elevated border border-border flex items-center justify-center"><User size={11} className="text-text-muted" /></span>
                            )}
                            <span className="text-[11px] text-text-muted">{isOwn ? "Du" : (msg.senderName ?? "Unbekannt")}</span>
                          </div>
                        )}
                        <div className={`min-w-0 break-words [overflow-wrap:anywhere] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                          isOwn
                            ? "bg-gold text-bg-primary rounded-br-sm"
                            : "bg-bg-elevated border border-border text-text-primary rounded-bl-sm"
                        }`}>
                          {msg.content}
                          <p className={`text-[10px] mt-1 ${isOwn ? "text-bg-primary/60" : "text-text-muted"}`}>
                            {formatTime(msg.created_at)}
                          </p>
        </div>
      </div>

    </div>
                      {isLastOwn && (
                        <div className="flex justify-end pr-1 pb-1">
                          <span className={`text-[10px] flex items-center gap-1 ${isSeen ? "text-gold" : "text-text-muted/60"}`}>
                            {activeConv?.kind === "group" ? (
                              (msg.read_by ?? []).filter((readerId) => readerId !== user?.id).length > 0
                                ? `Gesehen von ${(msg.read_by ?? []).filter((readerId) => readerId !== user?.id).length}`
                                : "Gesendet"
                            ) : isSeen ? (
                              <><Check size={10} className="inline" /><Check size={10} className="-ml-1.5 inline" /> Gesehen</>
                            ) : (
                              <><Check size={10} className="inline" /> Gesendet</>
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

            {/* Eingabe */}
            <div className="px-4 py-3 border-t border-border shrink-0 safe-area-pb">
              {sendError && <p role="alert" className="text-xs text-red-400 mb-2">{sendError}</p>}
              <div className="flex min-w-0 gap-2">
                <input
                  type="text"
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
                  placeholder="Nachricht schreiben…"
                  className="min-w-0 flex-1 bg-bg-elevated border border-border rounded-2xl px-4 py-3 text-base sm:text-sm focus:outline-none focus:border-gold transition-colors"
                />
                <button
                  onClick={sendMessage}
                  disabled={!text.trim() || sending}
                  className="w-11 h-11 bg-gold text-bg-primary rounded-2xl flex items-center justify-center hover:bg-gold-light transition-colors disabled:opacity-40 shrink-0"
                >
                  {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Desktop: leerer Zustand wenn kein Gespräch offen */
          <div className="flex-1 hidden sm:flex flex-col items-center justify-center text-center p-8">
            <div className="max-w-sm">
              <div className="relative w-20 h-20 mx-auto mb-5">
                <div className="w-20 h-20 rounded-2xl bg-bg-elevated border border-border flex items-center justify-center">
                  <MessageSquare size={32} className="text-text-muted opacity-30" />
                </div>
                <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center">
                  <span className="text-[10px] text-gold font-bold">+</span>
                </div>
              </div>
              <h3 className="font-display text-lg font-bold text-text-secondary mb-2">Wähle ein Gespräch</h3>
              <p className="text-sm text-text-muted leading-relaxed mb-5">
                Wähle links eine Konversation aus, oder starte direkt von einem Profil oder Inserat.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                <Link href="/creators" className="px-3 py-1.5 text-xs border border-border rounded-lg text-text-secondary hover:border-gold/40 hover:text-gold transition-all">
                  Crew entdecken
                </Link>
                <Link href="/locations" className="px-3 py-1.5 text-xs border border-border rounded-lg text-text-secondary hover:border-gold/40 hover:text-gold transition-all">
                  Locations
                </Link>
                <Link href="/jobs" className="px-3 py-1.5 text-xs border border-border rounded-lg text-text-secondary hover:border-gold/40 hover:text-gold transition-all">
                  Jobs
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
      {groupModalMode && (
        <div
          className="fixed inset-0 z-[80] bg-black/70 p-3 sm:p-6 flex items-center justify-center"
          role="presentation"
          onMouseDown={(event) => { if (event.target === event.currentTarget && !groupSaving) setGroupModalMode(null); }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="group-dialog-title"
            className="w-full max-w-lg max-h-[88dvh] overflow-y-auto overscroll-contain rounded-2xl border border-border bg-bg-primary shadow-2xl p-4 sm:p-6"
          >
            <div className="flex items-center justify-between gap-4 mb-5">
              <div>
                <p className="text-xs uppercase tracking-widest text-gold mb-1">Nachrichten</p>
                <h2 id="group-dialog-title" className="font-display text-xl font-bold text-text-primary">
                  {groupModalMode === "create" ? "Gruppe erstellen" : "Gruppeninformationen"}
                </h2>
              </div>
              <button
                onClick={() => setGroupModalMode(null)}
                disabled={groupSaving}
                className="w-11 h-11 rounded-xl border border-border text-text-muted hover:text-text-primary flex items-center justify-center shrink-0"
                aria-label="Dialog schließen"
              ><X size={18} /></button>
            </div>

            <label className="block text-sm text-text-secondary mb-2" htmlFor="group-name">Gruppenname</label>
            <div className="flex gap-2 mb-5">
              <input
                id="group-name"
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
                maxLength={80}
                placeholder="Zum Beispiel: Drehteam"
                readOnly={groupModalMode === "manage" && !activeConv?.isAdmin}
                className="min-w-0 flex-1 min-h-11 rounded-xl border border-border bg-bg-elevated px-3 text-sm text-text-primary focus:outline-none focus:border-gold read-only:opacity-80"
              />
              {groupModalMode === "manage" && activeConv?.isAdmin && (
                <button
                  onClick={renameGroup}
                  disabled={groupSaving || !groupName.trim() || groupName.trim() === activeConv.group_name}
                  className="min-h-11 px-3 rounded-xl border border-gold/40 text-gold disabled:opacity-40 flex items-center gap-2 shrink-0"
                >{groupSaving ? <Loader2 size={15} className="animate-spin" /> : <Pencil size={15} />}<span className="hidden sm:inline">Speichern</span></button>
              )}
            </div>

            {groupModalMode === "manage" && (
              <div className="mb-5">
                <h3 className="text-sm font-semibold text-text-primary mb-2">Mitglieder · {activeConv?.members?.length ?? 0}</h3>
                <div className="space-y-2">
                  {(activeConv?.members ?? []).map((member) => (
                    <div key={member.user_id} className="flex items-center gap-3 rounded-xl border border-border bg-bg-elevated/50 p-2.5">
                      <div className="w-9 h-9 rounded-full overflow-hidden bg-bg-elevated border border-border flex items-center justify-center shrink-0">
                        {member.avatar_url
                          ? <img src={member.avatar_url} alt="" className="w-full h-full object-cover" />
                          : <User size={15} className="text-text-muted" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-text-primary truncate">{member.user_id === user?.id ? `${member.display_name} (Du)` : member.display_name}</p>
                        <p className="text-xs text-text-muted">{member.role === "admin" ? "Admin" : "Mitglied"}</p>
                      </div>
                      {activeConv?.isAdmin && member.user_id !== user?.id && (
                        <button
                          onClick={() => updateGroupMembers("remove", member.user_id)}
                          disabled={groupSaving}
                          className="w-11 h-11 rounded-lg text-text-muted hover:text-red-400 flex items-center justify-center shrink-0"
                          title={`${member.display_name} entfernen`}
                          aria-label={`${member.display_name} aus Gruppe entfernen`}
                        ><UserMinus size={17} /></button>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-text-muted mt-2">Neue Mitglieder sehen Nachrichten ab ihrem Beitritt. Beim erneuten Beitritt beginnt der Verlauf wieder ab diesem Zeitpunkt.</p>
              </div>
            )}

            {(groupModalMode === "create" || activeConv?.isAdmin) && (
              <div className="mb-4">
                <label className="block text-sm text-text-secondary mb-2" htmlFor="group-member-search">
                  {groupModalMode === "create" ? "Mitglieder auswählen" : "Mitglieder hinzufügen"}
                </label>
                <input
                  id="group-member-search"
                  value={groupSearch}
                  onChange={(event) => setGroupSearch(event.target.value)}
                  placeholder="Namen suchen…"
                  autoComplete="off"
                  className="w-full min-h-11 rounded-xl border border-border bg-bg-elevated px-3 text-sm text-text-primary focus:outline-none focus:border-gold"
                />
                {selectedGroupUsers.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {selectedGroupUsers.map((person) => (
                      <button
                        key={person.id}
                        onClick={() => toggleSelectedUser(person)}
                        className="min-h-10 px-3 rounded-full border border-gold/40 bg-gold/10 text-sm text-gold flex items-center gap-2"
                        aria-label={`${person.name} aus Auswahl entfernen`}
                      >{person.name}<X size={14} /></button>
                    ))}
                  </div>
                )}
                {groupSearch.trim().length >= 2 && (
                  <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-border divide-y divide-border">
                    {groupSearchResults
                      .filter((person) => groupModalMode !== "manage" || !(activeConv?.members ?? []).some((member) => member.user_id === person.id))
                      .map((person) => {
                        const selected = selectedGroupUsers.some((selectedUser) => selectedUser.id === person.id);
                        return (
                          <button
                            key={person.id}
                            onClick={() => toggleSelectedUser(person)}
                            className="w-full min-h-12 px-3 py-2 text-left hover:bg-bg-elevated flex items-center gap-3"
                          >
                            <div className="w-8 h-8 rounded-full overflow-hidden bg-bg-elevated border border-border flex items-center justify-center shrink-0">
                              {person.avatar ? <img src={person.avatar} alt="" className="w-full h-full object-cover" /> : <User size={14} className="text-text-muted" />}
                            </div>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm text-text-primary">{person.name}</span>
                              <span className="block truncate text-xs text-text-muted">{[person.role, person.location].filter(Boolean).join(" · ")}</span>
                            </span>
                            {selected && <Check size={16} className="text-gold shrink-0" />}
                          </button>
                        );
                      })}
                    {groupSearchResults.length === 0 && <p className="p-3 text-sm text-text-muted">Keine passenden Profile gefunden.</p>}
                  </div>
                )}
              </div>
            )}

            {groupError && <p role="alert" className="text-sm text-red-400 mb-4">{groupError}</p>}
            <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2 pt-2">
              {groupModalMode === "manage" ? (
                <button
                  onClick={() => updateGroupMembers("leave")}
                  disabled={groupSaving}
                  className="min-h-11 px-4 rounded-xl border border-red-400/30 text-red-300 hover:bg-red-400/10 disabled:opacity-50"
                >Gruppe verlassen</button>
              ) : <span />}
              <div className="flex gap-2 justify-end">
                <button onClick={() => setGroupModalMode(null)} disabled={groupSaving} className="min-h-11 px-4 rounded-xl border border-border text-text-secondary">Abbrechen</button>
                {groupModalMode === "create" ? (
                  <button
                    onClick={createGroup}
                    disabled={groupSaving || !groupName.trim() || selectedGroupUsers.length === 0}
                    className="min-h-11 px-4 rounded-xl bg-gold text-bg-primary font-semibold disabled:opacity-50 flex items-center gap-2"
                  >{groupSaving ? <Loader2 size={16} className="animate-spin" /> : <Users size={16} />}Gruppe erstellen</button>
                ) : activeConv?.isAdmin && (
                  <button
                    onClick={addSelectedMembers}
                    disabled={groupSaving || selectedGroupUsers.length === 0}
                    className="min-h-11 px-4 rounded-xl bg-gold text-bg-primary font-semibold disabled:opacity-50 flex items-center gap-2"
                  >{groupSaving ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}Hinzufügen</button>
                )}
              </div>
            </div>
            {groupModalMode === "manage" && activeConv?.isAdmin && (
              <p className="text-xs text-text-muted mt-3">Wenn der letzte Admin die Gruppe verlässt, wird das am längsten aktive verbleibende Mitglied automatisch Admin.</p>
            )}
          </section>
        </div>
      )}

    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense>
      <MessagesContent />
    </Suspense>
  );
}
