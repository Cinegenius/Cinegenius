"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import { Search, SquarePen, X } from "lucide-react";
import { FormDraftSurface, useFormNavigation } from "@/contexts/FormDraftContext";
import { dismissNativeHeaderUtility, nativeHeaderBlocked, useNativeHeaderUtility } from "@/lib/native-header-utility";
import type { InboxView } from "@/lib/message-navigation";
import { validConversationId, type MessageDestination } from "@/lib/messaging-ui";
import NativeInboxConversations from "./NativeInboxConversations";
import InboxNotices from "@/components/messaging/InboxNotices";
import MessagesContent from "@/components/messaging/MessagesContent";
import { NativeInboxSurfaceContext } from "@/components/messaging/NativeInboxSurfaceContext";
import NativeInboxShortcuts from "./NativeInboxShortcuts";
import styles from "./NativeInboxPanel.module.css";

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
  const t = useTranslations("nav"), messaging = useTranslations("Messaging");
  const ref = useRef<HTMLDialogElement>(null);
  const scope = JSON.stringify([userId, sessionId]);
  const currentScope = useRef(scope);
  const [selected, setSelected] = useState<{ view: InboxView; homies: boolean }>({ view: "friends", homies: true });
  const [destination, setDestination] = useState<MessageDestination | null>(null);
  const [compose, setCompose] = useState<"direct" | "group" | null>(null);
  const [search, setSearch] = useState("");
  useLayoutEffect(() => { currentScope.current = scope; return () => { currentScope.current = ""; }; }, [scope]);
  // Real external navigation closes the utility. Local inbox actions never change the URL.
  useLayoutEffect(() => { if (initialRoute.current !== route) onClose(); }, [route, onClose]);
  const guardDismiss = useCallback((commit: () => void) => leave(commit), [leave]);
  useNativeHeaderUtility(ref, true, "messages", onClose, { guardDismiss, keepOnFormNavigation: true });
  const local = (action: () => void) => { if (!nativeHeaderBlocked()) leave(() => { if (currentScope.current === scope) action(); }); };
  const choose = (view: InboxView, homies: boolean) => local(() => { setDestination(null); setCompose(null); setSelected({ view, homies }); });
  const startCompose = () => local(() => { setCompose(selected.view === "groups" ? "group" : "direct"); setDestination({}); });
  const chooseConversation = (id: string) => { if (validConversationId(id)) local(() => { setDestination({ conversationId: id }); }); };
  const searchLabel = selected.view === "notices" ? t("notifications") : messaging("searchChats");
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
          : selected.view === "notices" ? <InboxNotices searchValue={search} onOpenMessage={value => local(() => { setDestination(value); })} />
            : <NativeInboxConversations category={selected.view === "groups" ? "groups" : selected.homies ? "homies" : "colleagues"} query={search} onOpen={chooseConversation} />}
    </div>
  </dialog>, document.body);
}
