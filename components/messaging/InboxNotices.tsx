"use client";

import { useState, useEffect, useLayoutEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { notifyMessagesRead } from "@/lib/message-read-sync";
import { useAuth } from "@clerk/nextjs";
import {
  Bell, CheckCheck, BookOpen, MessageSquare, Star,
  Wallet, ShieldCheck, FileCheck, Briefcase, UserPlus, Users,
  Inbox, ExternalLink, Circle,
} from "lucide-react";
import { timeAgo, notificationMeta, type NotificationType } from "@/lib/notifications";
import { uiErrorMessage } from "@/lib/ui-error-message";
import { useTranslations , useLocale } from "next-intl";


// ─── Types ─────────────────────────────────────────────────────────────────────

type Notification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  href: string;
  read: boolean;
  created_at: string;
};

// ─── Config ────────────────────────────────────────────────────────────────────

const typeIcons: Record<NotificationType, React.ComponentType<{ size?: number; className?: string }>> = {
  booking_confirmed:     BookOpen,
  booking_request:       BookOpen,
  booking_rejected:      BookOpen,
  new_message:           MessageSquare,
  new_application:       Briefcase,
  application_sent:      Briefcase,
  review_request:        Star,
  payout_ready:          Wallet,
  verification_approved: ShieldCheck,
  verification_pending:  FileCheck,
  friend_request:        UserPlus,
  friend_accepted:       Users,
};

type FilterId = "all" | "booking" | "job" | "money" | "social" | "system";

function getLocalizedFILTER_TABS(translate: (key: string) => string) {
  return ([
  { id: "all",      label: translate("common.all") },
  { id: "booking",  label: translate("nav.bookings") },
  { id: "job",      label: translate("nav.jobs") },
  { id: "money",    label: translate("nav.payments") },
  { id: "social",   label: translate("nav.network") },
  { id: "system",   label: translate("Ui.text_6725e7bbcd28f3") },
] as const);
}

function matchesFilter(type: NotificationType, filter: FilterId): boolean {
  if (filter === "all") return true;
  if (filter === "booking") return type === "booking_confirmed" || type === "booking_request" || type === "booking_rejected";
  if (filter === "job") return type === "new_application" || type === "application_sent";
  if (filter === "money") return type === "payout_ready";
  if (filter === "social") return type === "friend_request" || type === "friend_accepted";
  if (filter === "system") return type === "verification_approved" || type === "verification_pending" || type === "review_request";
  return false;
}

// ─── Notification Row ──────────────────────────────────────────────────────────

function NotifRow({ notif, onRead }: {
  notif: Notification;
  onRead: (id: string) => void;
}) {
  const uiPriceLocale = useLocale();

  const uiText = useTranslations();

  const Icon = typeIcons[notif.type] ?? Bell;
  const meta = notificationMeta[notif.type];

  return (
    <div
      className={`relative group flex gap-4 p-5 border-b border-border last:border-0 hover:bg-bg-elevated transition-colors ${
        !notif.read ? "bg-gold/[0.02]" : ""
      }`}
    >
      {/* Unread dot */}
      {!notif.read && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-gold" />
      )}

      {/* Icon */}
      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${notif.read ? "bg-bg-elevated border-border" : "bg-gold/10 border-gold/20"}`}>
        <Icon size={17} className={notif.read ? "text-text-muted" : meta?.color ?? "text-gold"} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold leading-tight mb-0.5 ${notif.read ? "text-text-secondary" : "text-text-primary"}`}>
              {notif.title}
            </p>
            <p className="text-xs text-text-muted leading-relaxed line-clamp-2">{notif.body}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] text-text-muted whitespace-nowrap">
              {timeAgo(notif.created_at, uiPriceLocale)}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3 mt-2.5">
          {notif.href && notif.href !== "/dashboard" && <Link
            href={notif.href}
            onClick={() => { if (!notif.read) onRead(notif.id); }}
            className="flex min-h-11 items-center gap-1 text-xs text-gold hover:text-gold-light font-medium transition-colors"
          >{uiText.rich("Ui.text_1ee06198abe18c", { part1: () => (<ExternalLink size={10} />) })}</Link>}
          {!notif.read && (
            <button
              onClick={() => onRead(notif.id)}
              className="flex min-h-11 items-center gap-1 text-xs text-text-muted hover:text-text-secondary transition-colors"
            >{uiText.rich("Ui.text_ccd4999556ee96", { part1: () => (<Circle size={10} />) })}</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

type FriendRequest = { friendship_id: string; user_id: string; display_name: string };

export default function InboxNotices() {
  const uiText = useTranslations();
  const FILTER_TABS = getLocalizedFILTER_TABS(uiText);


  const locale = useLocale();
  const { isSignedIn, isLoaded, userId, sessionId } = useAuth();
  const requestScope = JSON.stringify([userId, sessionId, locale]);
  const contactScope = JSON.stringify([userId, sessionId]);
  const currentScope = useRef(requestScope);
  useLayoutEffect(() => { currentScope.current = requestScope; return () => { currentScope.current = ""; }; }, [requestScope]);
  const currentContactScope = useRef(contactScope);
  useLayoutEffect(() => { currentContactScope.current = contactScope; return () => { currentContactScope.current = ""; }; }, [contactScope]);
  const requestGeneration = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);
  const [storedNotifications, setNotifications] = useState<Notification[]>([]);
  const [notificationsScope, setNotificationsScope] = useState(requestScope);
  const [loadingState, setLoading] = useState(true);
  const notifications = notificationsScope === requestScope ? storedNotifications : [];
  const loading = notificationsScope !== requestScope || loadingState;
  const [activeFilter, setActiveFilter] = useState<FilterId>("all");
  const [markingAll, setMarkingAll] = useState(false);
  const readAllOperations = useRef(new Set<string>());
  const [noticeError, setNoticeError] = useState<{ scope: string; kind: "load" | "read" } | null>(null);
  const [storedFriendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [friendScope, setFriendScope] = useState("");
  const friendRequests = friendScope === contactScope ? storedFriendRequests : [];
  const [friendFailure, setFriendFailure] = useState<{ scope: string; text: string; load?: boolean; locale?: string }>({ scope: "", text: "" });
  const [friendAttempt, setFriendAttempt] = useState(0);
  const friendOperations = useRef(new Set<string>());
  const notificationRefresh = useRef<(() => Promise<void>) | null>(null);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    const prefix = `${contactScope}:`;
    queueMicrotask(() => {
      if (active) {
        setProcessingIds(new Set([...friendOperations.current].filter(key => key.startsWith(prefix)).map(key => key.slice(prefix.length))));
        setMarkingAll(readAllOperations.current.has(contactScope));
      }
    });
    return () => { active = false; };
  }, [contactScope]);

  const fetchNotifications = useCallback(async () => {
    const generation = ++requestGeneration.current;
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    const isCurrent = () => !controller.signal.aborted
      && generation === requestGeneration.current && currentScope.current === requestScope;
    setLoading(true);
    setNotifications([]);
    setNotificationsScope(requestScope);
    try {
      const response = await fetch("/api/notifications", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) });
      if (!isCurrent()) return;
      if (!response.ok) throw new Error("notifications_unavailable");
      const { notifications: rows } = await response.json();
      if (!isCurrent()) return;
      if (!Array.isArray(rows)) throw new Error("notifications_unavailable");
      setNotifications(rows.filter((notice: Notification) => notice.type !== "new_message").sort(
        (a: Notification, b: Notification) => b.created_at.localeCompare(a.created_at),
      ));
      setNoticeError(null);
    } catch {
      if (isCurrent()) setNoticeError({ scope: requestScope, kind: "load" });
    } finally {
      if (isCurrent()) {
        activeRequest.current = null;
        setLoading(false);
      }
    }
  }, [requestScope]);
  useLayoutEffect(() => { notificationRefresh.current = fetchNotifications; }, [fetchNotifications]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) void fetchNotifications(); });
    return () => {
      active = false;
      requestGeneration.current += 1;
      activeRequest.current?.abort();
      activeRequest.current = null;
    };
  }, [fetchNotifications]);

  useEffect(() => {
    if (!isLoaded || !userId) return;
    const controller = new AbortController();
    void fetch("/api/friendships", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) })
      .then(async response => {
        const data = await response.json();
        if (!response.ok || !Array.isArray(data.incoming)) throw new Error("contacts_unavailable");
        if (!controller.signal.aborted && currentContactScope.current === contactScope) {
          setFriendRequests(data.incoming); setFriendScope(contactScope); setFriendFailure({ scope: contactScope, text: "" });
        }
      }).catch(() => {
        if (!controller.signal.aborted && currentContactScope.current === contactScope) setFriendFailure({ scope: contactScope, text: "", load: true });
      });
    return () => controller.abort();
  }, [isLoaded, userId, contactScope, friendAttempt]);

  const handleFriendRequest = async (friendshipId: string, action: "accepted" | "rejected") => {
    const key = `${contactScope}:${friendshipId}`;
    if (!userId || friendOperations.current.has(key)) return;
    friendOperations.current.add(key);
    setProcessingIds(prev => new Set(prev).add(friendshipId));
    setFriendFailure({ scope: contactScope, text: "" });
    try {
      const res = await fetch(`/api/friendships/${friendshipId}`, {
        method: "PATCH", cache: "no-store", signal: AbortSignal.timeout(20_000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: action, accountId: userId }),
      });
      const data = await res.json().catch(() => ({}));
      if (currentContactScope.current !== contactScope) return;
      if (!res.ok || data.success !== true) throw new Error(data.error || uiText("Contacts.error"));
      setFriendRequests(prev => prev.filter(r => r.friendship_id !== friendshipId));
      void notificationRefresh.current?.();
    } catch (cause) {
      if (currentContactScope.current === contactScope) setFriendFailure({ scope: contactScope, text: uiErrorMessage(cause, uiText("Contacts.error")), locale });
    } finally {
      friendOperations.current.delete(key);
      if (currentContactScope.current === contactScope) setProcessingIds(prev => { const next = new Set(prev); next.delete(friendshipId); return next; });
    }
  };

  const acknowledge = async (id?: string) => {
    const owner = userId;
    if (!owner || (!id && readAllOperations.current.has(contactScope))) return;
    if (!id) {
      readAllOperations.current.add(contactScope);
      setMarkingAll(true);
    }
    try {
      const response = await fetch("/api/notifications", {
        method: id ? "POST" : "PATCH", cache: "no-store", signal: AbortSignal.timeout(15_000),
        ...(id ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) } : {}),
      });
      if (currentContactScope.current !== contactScope) return;
      if (!response.ok) throw new Error("notification_read_failed");
      setNotifications(previous => previous.map(notice => !id || notice.id === id ? { ...notice, read: true } : notice));
      setNoticeError(null);
      // Refresh the same account-bound inbox snapshot used by the shared header.
      notifyMessagesRead(owner);
    } catch {
      if (currentContactScope.current === contactScope) setNoticeError({ scope: requestScope, kind: "read" });
    } finally {
      if (!id) {
        readAllOperations.current.delete(contactScope);
        if (currentContactScope.current === contactScope) setMarkingAll(false);
      }
    }
  };
  const markAsRead = (id: string) => acknowledge(id);
  const markAllRead = () => acknowledge();

  const showRequests = (activeFilter === "all" || activeFilter === "social") && friendRequests.length > 0;
  const filtered = notifications.filter((n) => matchesFilter(n.type, activeFilter)
    && !(n.type === "friend_request" && friendRequests.some(request => n.body.startsWith(request.display_name))));
  const unreadCount = notifications.filter((n) => !n.read).length;
  const unreadFiltered = filtered.filter((n) => !n.read).length;

  // Not logged in
  if (isLoaded && !isSignedIn) {
    return (
      <div className="pt-16 min-h-screen flex flex-col items-center justify-center gap-5 text-center px-4">
        <div className="w-16 h-16 rounded-2xl bg-bg-elevated border border-border flex items-center justify-center">
          <Bell size={28} className="text-text-muted" />
        </div>
        <h2 className="font-display text-2xl font-bold text-text-primary">{uiText("Ui.text_6638bb26a46e61")}</h2>
        <p className="text-text-muted text-sm max-w-xs">{uiText("Ui.text_3ccacf6d64e54f")}</p>
        <Link href="/sign-in" className="px-6 py-2.5 bg-gold text-bg-primary font-semibold rounded-xl text-sm hover:bg-gold-light transition-colors">{uiText("nav.signIn")}</Link>
      </div>
    );
  }

  return (
    <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {unreadCount > 0 && <div className="mb-3 flex min-h-11 flex-wrap items-center justify-between gap-3">
          <span className="rounded-full border border-gold/30 bg-gold/15 px-2 py-0.5 text-xs font-bold text-gold">{uiText.rich("Ui.text_488b93937e6625", { value1: () => (unreadCount) })}</span>
          <button onClick={markAllRead} disabled={markingAll} className="flex min-h-11 items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs text-text-muted hover:text-gold">{uiText.rich("Ui.text_110bf3daa72f97", { part1: () => (<CheckCheck size={13} />) })}</button>
        </div>}

        {/* ── Filter Tabs ── */}
        <div className="mt-4 flex flex-wrap gap-1 pb-1 mb-6">
          {FILTER_TABS.map(({ id, label }) => {
            const count = id === "all"
              ? notifications.filter((n) => !n.read).length
              : notifications.filter((n) => matchesFilter(n.type, id) && !n.read).length;
            const isActive = activeFilter === id;
            return (
              <button
                key={id}
                onClick={() => setActiveFilter(id)}
                className={`flex min-h-11 items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-gold/10 border border-gold/20 text-gold"
                    : "border border-border text-text-muted hover:border-gold/30 hover:text-text-secondary"
                }`}
              >
                {label}
                {count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${isActive ? "bg-gold/20 text-gold" : "bg-bg-elevated text-text-muted"}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {showRequests && <section aria-label={uiText("Messaging.requests", { count: friendRequests.length })} className="mb-4 space-y-3">
          <h2 className="text-sm font-semibold text-text-primary">{uiText("Messaging.requests", { count: friendRequests.length })}</h2>
          {friendRequests.map(request => <article key={request.friendship_id} className="rounded-xl border border-border bg-bg-secondary p-4">
            <Link href={`/profile/${encodeURIComponent(request.user_id)}`} className="flex min-h-11 items-center gap-2 text-sm font-semibold text-text-primary [overflow-wrap:anywhere]"><UserPlus size={18} className="shrink-0 text-gold" />{request.display_name}</Link>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" disabled={processingIds.has(request.friendship_id)} onClick={() => handleFriendRequest(request.friendship_id, "accepted")} className="min-h-11 rounded-xl border border-gold/30 bg-gold/10 px-3 text-sm font-semibold text-gold disabled:opacity-40">{uiText("Contacts.accept")}</button>
              <button type="button" disabled={processingIds.has(request.friendship_id)} onClick={() => handleFriendRequest(request.friendship_id, "rejected")} className="min-h-11 rounded-xl border border-border px-3 text-sm text-text-secondary disabled:opacity-40">{uiText("Contacts.reject")}</button>
            </div>
          </article>)}
        </section>}
        {friendFailure.scope === contactScope && (friendFailure.load || friendFailure.text) && <div role="alert" className="mb-4 rounded-xl border border-red-400/30 p-3 text-sm text-red-400">
          <p>{friendFailure.load ? uiText("Contacts.loadError") : friendFailure.locale === locale ? friendFailure.text : uiText("Contacts.error")}</p><button type="button" onClick={() => setFriendAttempt(value => value + 1)} className="inline-flex min-h-11 items-center text-gold underline">{uiText("Contacts.retry")}</button>
        </div>}
        {noticeError?.scope === requestScope && noticeError.kind === "read" && <p role="alert" className="mb-3 text-sm text-text-muted">{uiText("InboxNavigation.readError")}</p>}
        {/* ── List ── */}
        {(loading || noticeError || filtered.length > 0 || !showRequests) && <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
          {loading ? (
            <div className="py-16 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-gold/20 border-t-gold rounded-full animate-spin" />
                <p className="text-xs text-text-muted">{uiText("Ui.text_ba8a3775a261b9")}</p>
              </div>
            </div>
          ) : noticeError?.scope === requestScope && noticeError.kind === "load" ? (
            <div role="alert" className="p-5 text-sm text-text-muted"><p>{uiText("notifications.loadError")}</p><button type="button" onClick={() => void fetchNotifications()} className="min-h-11 text-gold">{uiText("notifications.retry")}</button></div>
          ) : filtered.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-center px-6">
              <div className="w-14 h-14 rounded-2xl bg-bg-elevated border border-border flex items-center justify-center">
                <Inbox size={22} className="text-text-muted" />
              </div>
              <h3 className="font-semibold text-text-secondary">
                {activeFilter === "all" ? uiText("notifications.empty") : uiText("Ui.text_13a15ea9efa92f")}
              </h3>
              <p className="text-xs text-text-muted max-w-xs leading-relaxed">
                {activeFilter === "all"
                  ? uiText("Ui.text_748c6fdacaffbb")
                  : uiText("Ui.text_14954d0afe0557")}
              </p>
            </div>
          ) : (
            <>
              {/* Unread section */}
              {unreadFiltered > 0 && (
                <>
                  <div className="px-5 pt-4 pb-2">
                    <p className="text-[10px] uppercase tracking-widest font-semibold text-gold">{uiText.rich("Ui.text_98887e202b0505", { value1: () => (unreadFiltered) })}</p>
                  </div>
                  {filtered.filter((n) => !n.read).map((n) => {
                    return (
                      <NotifRow
                        key={n.id}
                        notif={n}
                        onRead={markAsRead}
                      />
                    );
                  })}
                </>
              )}

              {/* Read section */}
              {filtered.filter((n) => n.read).length > 0 && (
                <>
                  <div className={`px-5 pb-2 ${unreadFiltered > 0 ? "pt-4 border-t border-border" : "pt-4"}`}>
                    <p className="text-[10px] uppercase tracking-widest font-semibold text-text-muted">{uiText("Ui.text_cf5073c7dcf96d")}</p>
                  </div>
                  {filtered.filter((n) => n.read).map((n) => {
                    return (
                      <NotifRow
                        key={n.id}
                        notif={n}
                        onRead={markAsRead}
                      />
                    );
                  })}
                </>
              )}
            </>
          )}
        </div>}

        {/* Footer hint */}
        {!loading && notifications.length >= 30 && (
          <p className="text-center text-xs text-text-muted mt-4">{uiText("Ui.text_563c43496d39ff")}</p>
        )}
      </div>
    </div>
  );
}
