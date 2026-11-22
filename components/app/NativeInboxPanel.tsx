"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useLocale, useTranslations } from "next-intl";
import { ChevronRight, Search, SquarePen, Users, X } from "lucide-react";
import { FormDraftSurface, useFormNavigation } from "@/contexts/FormDraftContext";
import { dismissNativeHeaderUtility, nativeHeaderBlocked, useNativeHeaderUtility } from "@/lib/native-header-utility";
import type { InboxView } from "@/lib/message-navigation";
import { validConversationId, type MessageDestination } from "@/lib/messaging-ui";
import InboxFriends from "@/components/messaging/InboxFriends";
import InboxNotices from "@/components/messaging/InboxNotices";
import MessagesContent from "@/components/messaging/MessagesContent";
import { NativeInboxSurfaceContext } from "@/components/messaging/NativeInboxSurfaceContext";
import NativeInboxShortcuts from "./NativeInboxShortcuts";
import styles from "./NativeInboxPanel.module.css";

type Group = { id: string; kind: "group"; otherName?: string; group_name?: string; memberCount?: number };
function InboxGroups({ query, onOpen }: { query: string; onOpen: (id: string) => void }) {
  const { userId, sessionId } = useAuth(), locale = useLocale();
  const t = useTranslations("Messaging"), navigation = useTranslations("messagesNavigation");
  const scope = JSON.stringify([userId, sessionId]);
  const [snapshot, setSnapshot] = useState<{ scope: string; status: "loading" | "ready" | "error"; rows: Group[] }>({ scope: "", status: "loading", rows: [] });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!userId || !sessionId) return;
    const controller = new AbortController();
    void fetch("/api/conversations", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) })
      .then(async response => {
        const data = await response.json();
        if (!response.ok || !Array.isArray(data.data)) throw new Error("conversations_unavailable");
        if (!controller.signal.aborted) setSnapshot({ scope, status: "ready", rows: data.data.filter((row: Group) => row.kind === "group" && validConversationId(row.id)) });
      }).catch(() => { if (!controller.signal.aborted) setSnapshot({ scope, status: "error", rows: [] }); });
    return () => controller.abort();
  }, [userId, sessionId, scope, attempt]);
  const status = snapshot.scope === scope ? snapshot.status : "loading";
  const rows = snapshot.scope === scope ? snapshot.rows.filter(row => `${row.otherName ?? ""} ${row.group_name ?? ""}`.toLocaleLowerCase(locale).includes(query.trim().toLocaleLowerCase(locale))) : [];
  return <div className={styles.groups}>
    {status === "loading" && <p role="status">{t("loading")}</p>}
    {status === "error" && <div role="alert"><p>{navigation("loadError")}</p><button type="button" onClick={() => setAttempt(value => value + 1)}>{navigation("retry")}</button></div>}
    {status === "ready" && !rows.length && <p role="status">{t("noChats")}</p>}
    {status === "ready" && rows.map(row => <button type="button" key={row.id} onClick={() => onOpen(row.id)}><Users size={21} aria-hidden="true" /><span><strong>{row.otherName || row.group_name || t("conversation")}</strong>{typeof row.memberCount === "number" && <small>{t("members", { count: row.memberCount })}</small>}</span><ChevronRight size={17} aria-hidden="true" /></button>)}
  </div>;
}

/** An app-only local surface. Data, receipts and drafts remain owned by the existing inbox. */
export default function NativeInboxPanel({ onClose }: { onClose: () => void }) {
  const { userId, sessionId } = useAuth();
  return <FormDraftSurface><NativeInboxSurfaceContext.Provider value={true}>
    <NativeInboxPanelSurface key={JSON.stringify([userId, sessionId])} onClose={onClose} />
  </NativeInboxSurfaceContext.Provider></FormDraftSurface>;
}
function NativeInboxPanelSurface({ onClose }: { onClose: () => void }) {
  const { userId, sessionId, isSignedIn } = useAuth();
  const { leave } = useFormNavigation();
  const pathname = usePathname(), params = useSearchParams();
  const route = `${pathname}?${params.toString()}`;
  const initialRoute = useRef(route);
  const t = useTranslations("nav"), contacts = useTranslations("Contacts"), messaging = useTranslations("Messaging"), navigation = useTranslations("messagesNavigation");
  const ref = useRef<HTMLDialogElement>(null);
  const scope = JSON.stringify([userId, sessionId]);
  const currentScope = useRef(scope), opening = useRef<AbortController | null>(null);
  const [selected, setSelected] = useState<{ view: InboxView; homies: boolean }>({ view: "friends", homies: true });
  const [destination, setDestination] = useState<MessageDestination | null>(null);
  const [compose, setCompose] = useState<"direct" | "group" | null>(null);
  const [search, setSearch] = useState("");
  const [recipient, setRecipient] = useState<{ id: string; failed: boolean } | null>(null);
  useLayoutEffect(() => { currentScope.current = scope; return () => { currentScope.current = ""; opening.current?.abort(); }; }, [scope]);
  // Real external navigation closes the utility. Local inbox actions never change the URL.
  useLayoutEffect(() => { if (initialRoute.current !== route) onClose(); }, [route, onClose]);
  const guardDismiss = useCallback((commit: () => void) => leave(commit), [leave]);
  useNativeHeaderUtility(ref, true, "messages", onClose, { guardDismiss, keepOnFormNavigation: true });
  const local = (action: () => void) => { if (!nativeHeaderBlocked()) leave(() => { if (currentScope.current === scope) action(); }); };
  const choose = (view: InboxView, homies: boolean) => local(() => { opening.current?.abort(); setRecipient(null); setDestination(null); setCompose(null); setSelected({ view, homies }); });
  const startCompose = () => local(() => { opening.current?.abort(); setRecipient(null); setCompose(selected.view === "groups" ? "group" : "direct"); setDestination({}); });
  const chooseConversation = (id: string) => { if (validConversationId(id)) local(() => { opening.current?.abort(); setRecipient(null); setDestination({ conversationId: id }); }); };
  const openRecipient = async (id: string) => {
    opening.current?.abort(); const controller = new AbortController(); opening.current = controller;
    setRecipient({ id, failed: false });
    try {
      // A contact may already have a direct conversation. Resolve only from the
      // same membership-checked list; opening never creates/sends a message.
      const response = await fetch("/api/conversations", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.data)) throw new Error();
      if (controller.signal.aborted || currentScope.current !== scope) return;
      const existing = data.data.find((row: { id: string; kind?: string; sender_id?: string; receiver_id?: string }) => (row.kind === "direct" || !row.kind) && validConversationId(row.id)
        && (row.sender_id === userId && row.receiver_id === id || row.sender_id === id && row.receiver_id === userId));
      setRecipient(null); setDestination(existing ? { conversationId: existing.id } : { recipientId: id });
    } catch { if (!controller.signal.aborted && currentScope.current === scope) setRecipient({ id, failed: true }); }
  };
  const searchLabel = selected.view === "friends" ? contacts("search") : selected.view === "notices" ? t("notifications") : messaging("searchChats");
  const authorized = !!isSignedIn && !!userId && !!sessionId;
  return createPortal(<dialog ref={ref} id="native-inbox-panel" className={styles.panel} aria-labelledby="native-inbox-panel-title" data-native-inbox-panel="v1">
    <h2 id="native-inbox-panel-title" className={styles.srOnly}>{t("messages")}</h2>
    {!destination && <div className={styles.top}>
      <label className={styles.search}><Search size={18} aria-hidden="true" /><input type="search" maxLength={120} value={search} onChange={event => setSearch(event.target.value)} placeholder={searchLabel} aria-label={searchLabel} /></label>
      {isSignedIn && <button type="button" onClick={startCompose} aria-label={messaging(selected.view === "groups" ? "createGroup" : "newMessage")} title={messaging(selected.view === "groups" ? "createGroup" : "newMessage")}><SquarePen size={20} aria-hidden="true" /></button>}
      <button type="button" onClick={dismissNativeHeaderUtility} aria-label={t("closeMenu")} title={t("closeMenu")}><X size={20} aria-hidden="true" /></button>
    </div>}
    <NativeInboxShortcuts active={selected.view} selectedHomies={selected.homies} onSelect={choose} />
    <div className={`${styles.content} ${destination ? styles.thread : ""}`} key={JSON.stringify([scope, selected.view, selected.homies])}>
      {!authorized ? <Link href="/sign-in" prefetch={false} onClick={onClose}>{t("signIn")}</Link>
        : destination ? <MessagesContent embedded={{ destination, initialCompose: compose, onDestination: value => { setCompose(null); setDestination(value); }, onBack: () => { setCompose(null); setDestination(null); }, onClose: dismissNativeHeaderUtility }} />
          : <>{recipient && <div className={styles.status} role={recipient.failed ? "alert" : "status"}>{recipient.failed ? <><p>{navigation("loadError")}</p><button type="button" onClick={() => local(() => { void openRecipient(recipient.id); })}>{navigation("retry")}</button></> : messaging("loading")}</div>}
            {selected.view === "friends" ? <InboxFriends hideSearch hideTabs searchValue={search} homiesOnly={selected.homies} onOpenMessage={id => local(() => { void openRecipient(id); })} />
              : selected.view === "groups" ? <InboxGroups query={search} onOpen={chooseConversation} />
                : <InboxNotices searchValue={search} onOpenMessage={value => local(() => { setDestination(value); })} />}</>}
    </div>
  </dialog>, document.body);
}
