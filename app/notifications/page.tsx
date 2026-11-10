"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import {
  Bell, CheckCheck, BookOpen, MessageSquare, Star,
  Wallet, ShieldCheck, FileCheck, Briefcase, UserPlus, Users,
  ArrowLeft, Inbox, ExternalLink, Circle, Check, X, Loader2,
} from "lucide-react";
import { timeAgo, notificationMeta, type NotificationType } from "@/lib/notifications";
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
  chatUnread?: boolean;
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

type FilterId = "all" | "booking" | "message" | "job" | "money" | "social" | "system";

function getLocalizedFILTER_TABS(translate: (key: string) => string) {
  return ([
  { id: "all",      label: translate("common.all") },
  { id: "booking",  label: translate("nav.bookings") },
  { id: "message",  label: translate("nav.messages") },
  { id: "job",      label: translate("nav.jobs") },
  { id: "money",    label: translate("nav.payments") },
  { id: "social",   label: translate("nav.network") },
  { id: "system",   label: translate("Ui.text_6725e7bbcd28f3") },
] as const);
}

function matchesFilter(type: NotificationType, filter: FilterId): boolean {
  if (filter === "all") return true;
  if (filter === "booking") return type === "booking_confirmed" || type === "booking_request" || type === "booking_rejected";
  if (filter === "message") return type === "new_message";
  if (filter === "job") return type === "new_application" || type === "application_sent";
  if (filter === "money") return type === "payout_ready";
  if (filter === "social") return type === "friend_request" || type === "friend_accepted";
  if (filter === "system") return type === "verification_approved" || type === "verification_pending" || type === "review_request";
  return false;
}

// ─── Notification Row ──────────────────────────────────────────────────────────

function NotifRow({
  notif,
  onRead,
  friendRequest,
  onAccept,
  onReject,
  isProcessing,
}: {
  notif: Notification;
  onRead: (id: string) => void;
  friendRequest?: FriendRequest;
  onAccept?: (id: string) => void;
  onReject?: (id: string) => void;
  isProcessing?: boolean;
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
        <div className="flex items-center gap-3 mt-2.5">
          {notif.type === "friend_request" && friendRequest && onAccept && onReject ? (
            isProcessing ? (
              <Loader2 size={14} className="animate-spin text-text-muted" />
            ) : (
              <>
                <button
                  onClick={() => { onAccept(friendRequest.friendship_id); if (!notif.read) onRead(notif.id); }}
                  className="flex items-center gap-1 px-3 py-1 bg-success/10 border border-success/20 text-success text-xs font-medium rounded-lg hover:bg-success/20 transition-colors"
                >{uiText.rich("Ui.text_048edf533fa6f4", { part1: () => (<Check size={11} />) })}</button>
                <button
                  onClick={() => { onReject(friendRequest.friendship_id); if (!notif.read) onRead(notif.id); }}
                  className="flex items-center gap-1 px-3 py-1 border border-border text-text-muted text-xs rounded-lg hover:border-red-400 hover:text-red-400 transition-colors"
                >{uiText.rich("Ui.text_2424239b7d6d6c", { part1: () => (<X size={11} />) })}</button>
              </>
            )
          ) : (
            <>
              {notif.href && notif.href !== "/dashboard" && (
                <Link
                  href={notif.href}
                  onClick={() => { if (!notif.read) onRead(notif.id); }}
                  className="flex items-center gap-1 text-xs text-gold hover:text-gold-light font-medium transition-colors"
                >{uiText.rich("Ui.text_1ee06198abe18c", { part1: () => (<ExternalLink size={10} />) })}</Link>
              )}
            </>
          )}
          {!notif.read && !notif.chatUnread && (
            <button
              onClick={() => onRead(notif.id)}
              className="flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary transition-colors"
            >{uiText.rich("Ui.text_ccd4999556ee96", { part1: () => (<Circle size={10} />) })}</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

type FriendRequest = { friendship_id: string; user_id: string; display_name: string };

export default function NotificationsPage() {
  const uiText = useTranslations();
  const FILTER_TABS = getLocalizedFILTER_TABS(uiText);


  const locale = useLocale();
  const { isSignedIn, isLoaded, userId, sessionId } = useAuth();
  const requestScope = JSON.stringify([userId, sessionId, locale]);
  const currentScope = useRef(requestScope);
  currentScope.current = requestScope;
  const requestGeneration = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);
  const [storedNotifications, setNotifications] = useState<Notification[]>([]);
  const [notificationsScope, setNotificationsScope] = useState(requestScope);
  const [loadingState, setLoading] = useState(true);
  const notifications = notificationsScope === requestScope ? storedNotifications : [];
  const loading = notificationsScope !== requestScope || loadingState;
  const [activeFilter, setActiveFilter] = useState<FilterId>("all");
  const [markingAll, setMarkingAll] = useState(false);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

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
      const [notificationResponse, conversationsResponse] = await Promise.all([
        fetch("/api/notifications", { cache: "no-store", signal: controller.signal }),
        fetch("/api/conversations", { cache: "no-store", signal: controller.signal }),
      ]);
      if (!isCurrent()) return;
      if (notificationResponse.status === 401) return;
      if (!notificationResponse.ok || !conversationsResponse.ok) return;
      const [{ notifications: notificationData }, { data: conversations }] = await Promise.all([
        notificationResponse.json(),
        conversationsResponse.json(),
      ]);
      if (!isCurrent()) return;
      const unreadChats: Notification[] = (conversations ?? [])
        .filter((conversation: { unread_count?: number }) => Number(conversation.unread_count) > 0)
        .map((conversation: { id: string; kind?: string; group_name?: string | null; otherName?: string; unread_count: number; updated_at: string }) => ({
          id: `chat-unread:${conversation.id}`,
          type: "new_message",
          title: conversation.kind === "group" ? (conversation.group_name ?? uiText("Ui.text_d96e55720c85b8")) : (conversation.otherName ?? uiText("Ui.text_e8a28a55f6fbf9")),
          body: uiText("Ui.text_f6d5879b399536", { value1: String(conversation.unread_count), value2: String(conversation.unread_count === 1 ? uiText("creators.sendMessage") : uiText("nav.messages")) }),
          href: `/messages?conv=${conversation.id}`,
          read: false,
          created_at: conversation.updated_at,
          chatUnread: true,
        }));
      setNotifications([...(notificationData ?? []), ...unreadChats].sort(
        (a: Notification, b: Notification) => b.created_at.localeCompare(a.created_at),
      ));
    } catch {
      // Cancelled or failed loads keep the existing empty-list fallback.
    } finally {
      if (isCurrent()) {
        activeRequest.current = null;
        setLoading(false);
      }
    }
  }, [requestScope, uiText]);

  useEffect(() => {
    void fetchNotifications();
    return () => {
      requestGeneration.current += 1;
      activeRequest.current?.abort();
      activeRequest.current = null;
    };
  }, [fetchNotifications]);

  useEffect(() => {
    fetch("/api/friendships")
      .then(r => r.json())
      .then(({ incoming }) => setFriendRequests(incoming ?? []))
      .catch(() => {});
  }, []);

  const handleFriendRequest = async (friendshipId: string, action: "accepted" | "rejected") => {
    setProcessingIds(prev => new Set(prev).add(friendshipId));
    try {
      const res = await fetch(`/api/friendships/${friendshipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: action }),
      });
      if (res.ok) setFriendRequests(prev => prev.filter(r => r.friendship_id !== friendshipId));
    } finally {
      setProcessingIds(prev => { const s = new Set(prev); s.delete(friendshipId); return s; });
    }
  };

  const markAsRead = async (id: string) => {
    if (id.startsWith("chat-unread:")) return;
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  };

  const markAllRead = async () => {
    setMarkingAll(true);
    setNotifications((prev) => prev.map((n) => n.chatUnread ? n : ({ ...n, read: true })));
    await fetch("/api/notifications", { method: "PATCH" });
    setMarkingAll(false);
  };

  const filtered = notifications.filter((n) => matchesFilter(n.type, activeFilter));
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
    <div className="pt-16 min-h-screen">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="w-9 h-9 rounded-lg border border-border flex items-center justify-center text-text-secondary hover:border-gold hover:text-gold transition-all shrink-0"
            >
              <ArrowLeft size={16} />
            </Link>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="font-display text-2xl font-bold text-text-primary">{uiText("nav.notifications")}</h1>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 bg-gold/15 border border-gold/30 text-gold text-xs font-bold rounded-full">{uiText.rich("Ui.text_488b93937e6625", { value1: () => (unreadCount) })}</span>
                )}
              </div>
              <p className="text-xs text-text-muted mt-0.5">{uiText("Ui.text_40d091dae1995d")}</p>
            </div>
          </div>

          {notifications.some((notification) => !notification.read && !notification.chatUnread) && (
            <button
              onClick={markAllRead}
              disabled={markingAll}
              className="flex items-center gap-1.5 text-xs text-text-muted hover:text-gold transition-colors px-3 py-2 rounded-lg border border-border hover:border-gold/30 shrink-0"
            >{uiText.rich("Ui.text_110bf3daa72f97", { part1: () => (<CheckCheck size={13} />) })}</button>
          )}
        </div>

        {/* ── Filter Tabs ── */}
        <div className="flex gap-1 overflow-x-auto pb-1 mb-6 no-scrollbar">
          {FILTER_TABS.map(({ id, label }) => {
            const count = id === "all"
              ? notifications.filter((n) => !n.read).length
              : notifications.filter((n) => matchesFilter(n.type, id) && !n.read).length;
            const isActive = activeFilter === id;
            return (
              <button
                key={id}
                onClick={() => setActiveFilter(id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg whitespace-nowrap transition-all ${
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

        {/* ── List ── */}
        <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
          {loading ? (
            <div className="py-16 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-gold/20 border-t-gold rounded-full animate-spin" />
                <p className="text-xs text-text-muted">{uiText("Ui.text_ba8a3775a261b9")}</p>
              </div>
            </div>
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
                    const fr = n.type === "friend_request"
                      ? friendRequests.find(r => n.body.startsWith(r.display_name))
                      : undefined;
                    return (
                      <NotifRow
                        key={n.id}
                        notif={n}
                        onRead={markAsRead}
                        friendRequest={fr}
                        onAccept={(id) => handleFriendRequest(id, "accepted")}
                        onReject={(id) => handleFriendRequest(id, "rejected")}
                        isProcessing={!!fr && processingIds.has(fr.friendship_id)}
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
                    const fr = n.type === "friend_request"
                      ? friendRequests.find(r => n.body.startsWith(r.display_name))
                      : undefined;
                    return (
                      <NotifRow
                        key={n.id}
                        notif={n}
                        onRead={markAsRead}
                        friendRequest={fr}
                        onAccept={(id) => handleFriendRequest(id, "accepted")}
                        onReject={(id) => handleFriendRequest(id, "rejected")}
                        isProcessing={!!fr && processingIds.has(fr.friendship_id)}
                      />
                    );
                  })}
                </>
              )}
            </>
          )}
        </div>

        {/* Footer hint */}
        {!loading && notifications.length >= 30 && (
          <p className="text-center text-xs text-text-muted mt-4">{uiText("Ui.text_563c43496d39ff")}</p>
        )}
      </div>
    </div>
  );
}
