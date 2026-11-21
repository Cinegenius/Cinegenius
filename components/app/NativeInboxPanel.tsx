"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useLocale, useTranslations } from "next-intl";
import { ArrowUpRight, Search, Users, X } from "lucide-react";
import { useFormNavigation } from "@/contexts/FormDraftContext";
import { nativeHeaderBlocked, useNativeHeaderUtility } from "@/lib/native-header-utility";
import type { InboxView } from "@/lib/message-navigation";
import InboxFriends from "@/components/messaging/InboxFriends";
import InboxNotices from "@/components/messaging/InboxNotices";
import NativeInboxShortcuts from "./NativeInboxShortcuts";
import styles from "./NativeInboxPanel.module.css";

type Group = { id: string; kind: "group"; otherName?: string; group_name?: string; memberCount?: number };
function InboxGroups({ query, onOpen }: { query: string; onOpen: (href: string) => void }) {
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
        if (!controller.signal.aborted) setSnapshot({ scope, status: "ready", rows: data.data.filter((row: Group) => row.kind === "group" && typeof row.id === "string") });
      }).catch(() => { if (!controller.signal.aborted) setSnapshot({ scope, status: "error", rows: [] }); });
    return () => controller.abort();
  }, [userId, sessionId, scope, attempt]);
  const status = snapshot.scope === scope ? snapshot.status : "loading";
  const rows = snapshot.scope === scope ? snapshot.rows.filter(row => `${row.otherName ?? ""} ${row.group_name ?? ""}`.toLocaleLowerCase(locale).includes(query.trim().toLocaleLowerCase(locale))) : [];
  return <div className={styles.groups}>
    {status === "loading" && <p role="status">{t("loading")}</p>}
    {status === "error" && <div role="alert"><p>{navigation("loadError")}</p><button type="button" onClick={() => setAttempt(value => value + 1)}>{navigation("retry")}</button></div>}
    {status === "ready" && !rows.length && <p role="status">{t("noChats")}</p>}
    {status === "ready" && rows.map(row => <Link key={row.id} href={`/messages?conv=${encodeURIComponent(row.id)}`} prefetch={false}
      onClick={event => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
        event.preventDefault(); onOpen(`/messages?conv=${encodeURIComponent(row.id)}`);
      }}><Users size={21} aria-hidden="true" /><span><strong>{row.otherName || row.group_name || t("conversation")}</strong>{typeof row.memberCount === "number" && <small>{t("members", { count: row.memberCount })}</small>}</span><ArrowUpRight size={17} aria-hidden="true" /></Link>)}
  </div>;
}

/** Mounted only by an explicit header action. Reuses the authorized inbox views;
 * switching mounts only the selected reader and never acknowledges messages. */
export default function NativeInboxPanel({ onClose }: { onClose: () => void }) {
  const { userId, sessionId, isSignedIn } = useAuth();
  const router = useRouter(), { leave } = useFormNavigation();
  const t = useTranslations("nav"), contacts = useTranslations("Contacts"), messaging = useTranslations("Messaging");
  const ref = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<{ view: InboxView; homies: boolean }>({ view: "friends", homies: true });
  const [search, setSearch] = useState("");
  useNativeHeaderUtility(ref, true, "messages", onClose);
  const open = useCallback((href: string) => leave(() => { onClose(); router.push(href); }), [leave, onClose, router]);
  const choose = (view: InboxView, homies: boolean) => { if (!nativeHeaderBlocked()) setSelected({ view, homies }); };
  const href = selected.view === "friends" ? `/messages?view=friends${selected.homies ? "&homies=1" : ""}` : `/messages?view=${selected.view}`;
  const searchLabel = selected.view === "friends" ? contacts("search") : selected.view === "notices" ? t("notifications") : messaging("searchChats");
  const authorized = !!isSignedIn && !!userId && !!sessionId;
  return createPortal(<dialog ref={ref} id="native-inbox-panel" className={styles.panel} aria-labelledby="native-inbox-panel-title" data-native-inbox-panel="v1">
    <h2 id="native-inbox-panel-title" className={styles.srOnly}>{t("messages")}</h2>
    <div className={styles.top}>
      <label className={styles.search}><Search size={18} aria-hidden="true" /><input type="search" maxLength={120} value={search} onChange={event => setSearch(event.target.value)}
        placeholder={searchLabel} aria-label={searchLabel} /></label>
      <button type="button" onClick={onClose} aria-label={t("closeMenu")} title={t("closeMenu")}><X size={20} aria-hidden="true" /></button>
    </div>
    <NativeInboxShortcuts active={selected.view} selectedHomies={selected.homies} onSelect={choose} />
    <div className={styles.content} key={JSON.stringify([userId, sessionId, selected.view, selected.homies])}>
      {!authorized ? <Link href="/sign-in" prefetch={false} onClick={onClose}>{t("signIn")}</Link>
        : selected.view === "friends" ? <InboxFriends hideSearch hideTabs searchValue={search} homiesOnly={selected.homies} onOpenMessage={id => open(`/messages?to=${encodeURIComponent(id)}`)} />
          : selected.view === "groups" ? <InboxGroups query={search} onOpen={open} />
            : <InboxNotices searchValue={search} />}
    </div>
    <Link className={styles.full} href={href} prefetch={false} onClick={event => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      event.preventDefault(); open(href);
    }}>{t("messages")}<ArrowUpRight size={18} aria-hidden="true" /></Link>
  </dialog>, document.body);
}
