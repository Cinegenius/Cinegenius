"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useLocale, useTranslations } from "next-intl";
import { ChevronRight, MessageSquare, Users } from "lucide-react";
import { nativeInboxConversations, nativeInboxCursor, nativeInboxPageURL, nativeInboxPreview, type NativeInboxCursor, type NativeInboxCategory, type NativeInboxConversation, type NativeInboxFriend } from "@/lib/native-inbox-conversations";
import { watchContactRefresh } from "@/lib/contact-refresh";
import styles from "./NativeInboxPanel.module.css";

type Snapshot = { scope: string; rows: NativeInboxConversation[]; friends: NativeInboxFriend[]; cursor: NativeInboxCursor | null };
export default function NativeInboxConversations({ category, query, onOpen }: { category: NativeInboxCategory; query: string; onOpen: (id: string) => void }) {
  const { userId, sessionId } = useAuth(), locale = useLocale();
  const t = useTranslations("Messaging"), navigation = useTranslations("messagesNavigation");
  const scope = JSON.stringify([userId, sessionId, category]);
  const current = useRef(scope);
  const [snapshot, setSnapshot] = useState<Snapshot>({ scope: "", rows: [], friends: [], cursor: null });
  const [request, setRequest] = useState({ cursor: null as NativeInboxCursor | null, attempt: 0 });
  const requestKey = JSON.stringify([scope, request]);
  const [state, setState] = useState({ requestKey: "", error: false });
  useLayoutEffect(() => { current.current = scope; return () => { current.current = ""; }; }, [scope]);
  useEffect(() => {
    if (!userId || !sessionId) return;
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]);
    const cursor = request.cursor;
    void Promise.all([
      fetch(nativeInboxPageURL(cursor), { cache: "no-store", signal }).then(async response => { const body = await response.json(); if (!response.ok || !Array.isArray(body.data) || body.nextCursor != null && !nativeInboxCursor(body.nextCursor)) throw new Error(); return body; }),
      category === "groups" ? Promise.resolve(null) : fetch("/api/friendships", { cache: "no-store", signal, headers: { "X-CineGenius-Native-Contract": "cinegenius.friendships.v1", "X-Contact-Account": userId } }).then(async response => {
        const body = await response.json();
        if (!response.ok || body.contract !== "cinegenius.friendships.v1" || body.accountId !== userId || !Array.isArray(body.friends)
          || category === "homies" && (body.capabilities?.favoriteFriendsRead !== true || body.friends.some((friend: NativeInboxFriend) => typeof friend.is_favorite !== "boolean"))) throw new Error();
        return body;
      }),
    ]).then(([conversations, relationships]) => {
      if (controller.signal.aborted || current.current !== scope) return;
      setSnapshot(previous => ({ scope, rows: [...new Map<string, NativeInboxConversation>([...(cursor && previous.scope === scope ? previous.rows : []), ...conversations.data].map((row: NativeInboxConversation) => [row.id, row])).values()], friends: relationships?.friends ?? [], cursor: nativeInboxCursor(conversations.nextCursor) }));
      setState({ requestKey, error: false });
    }).catch(() => { if (!controller.signal.aborted && current.current === scope) setState({ requestKey, error: true }); });
    return () => controller.abort();
  }, [userId, sessionId, scope, category, request, requestKey]);
  useEffect(() => {
    if (!userId || !sessionId) return;
    return watchContactRefresh(window, () => setRequest(previous => ({ cursor: null, attempt: previous.attempt + 1 })));
  }, [userId, sessionId]);
  const ready = snapshot.scope === scope;
  const rows = ready ? nativeInboxConversations(snapshot.rows, snapshot.friends, userId ?? "", category, query, locale) : [];
  const loading = state.requestKey !== requestKey, error = state.requestKey === requestKey && state.error;
  return <div className={styles.groups} data-native-inbox-conversations={category} aria-busy={loading}>
    {rows.map(row => <button type="button" key={row.id} onClick={() => onOpen(row.id)}>
      {category === "groups" ? <Users size={21} aria-hidden="true" /> : <MessageSquare size={21} aria-hidden="true" />}
      <span><strong>{row.otherName || row.group_name || t("conversation")}</strong><small>{nativeInboxPreview(row)}</small></span>
      {typeof row.unread_count === "number" && row.unread_count > 0 && <span className={styles.unread}>{Math.min(999, row.unread_count)}</span>}
      <ChevronRight size={17} aria-hidden="true" />
    </button>)}
    {loading && <p role="status">{t("loading")}</p>}
    {error && <div role="alert"><p>{navigation("loadError")}</p><button type="button" onClick={() => setRequest(value => ({ ...value, attempt: value.attempt + 1 }))}>{navigation("retry")}</button></div>}
    {ready && !loading && !error && !rows.length && <p role="status">{t("noChats")}</p>}
    {ready && snapshot.cursor && !loading && !error && <button type="button" onClick={() => setRequest(value => ({ cursor: snapshot.cursor, attempt: value.attempt + 1 }))}>{t("loadMoreConversations")}</button>}
  </div>;
}
