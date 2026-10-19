"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell, Check, BookOpen, MessageSquare, Star,
  Wallet, ShieldCheck, FileCheck, Briefcase, UserPlus, Users,
} from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import { timeAgo, notificationMeta, type NotificationType } from "@/lib/notifications";
import { subscribeToMessageReads } from "@/lib/message-read-sync";

type Notification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  href: string;
  read: boolean;
  created_at: string;
};

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

export default function NotificationCenter() {
  const router = useRouter();
  const tn = useTranslations("notifications");
  const [snapshot, setSnapshot] = useState<{
    userId: string;
    sessionId: string;
    notifications: Notification[];
    unreadMessages: number;
  } | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { isSignedIn, userId, sessionId } = useAuth();
  const activeSessionKey = `${userId ?? ""}:${sessionId ?? ""}`;
  const activeSessionKeyRef = useRef(activeSessionKey);

  useEffect(() => {
    activeSessionKeyRef.current = activeSessionKey;
  }, [activeSessionKey]);

  const currentSnapshot = isSignedIn && userId && sessionId && snapshot?.userId === userId && snapshot.sessionId === sessionId
    ? snapshot
    : null;
  const currentNotifications = currentSnapshot?.notifications ?? [];
  const unreadMessagesCount = currentSnapshot?.unreadMessages ?? 0;
  const unreadNotifs = currentNotifications.filter((n) => !n.read).length;
  const totalUnread = unreadMessagesCount + unreadNotifs;

  const fetchAll = useCallback(async (showLoading = false) => {
    if (!isSignedIn || !userId || !sessionId) return;
    if (showLoading) setLoading(true);
    const requestedSessionKey = `${userId}:${sessionId}`;
    try {
      const [msgRes, notifRes] = await Promise.all([
        fetch("/api/unread-count", { cache: "no-store" }),
        fetch("/api/notifications", { cache: "no-store" }),
      ]);
      if (!msgRes.ok || !notifRes.ok) return;
      const [{ count }, { notifications: data }] = await Promise.all([msgRes.json(), notifRes.json()]);
      if (activeSessionKeyRef.current !== requestedSessionKey) return;
      setSnapshot({
        userId,
        sessionId,
        notifications: Array.isArray(data) ? data : [],
        unreadMessages: typeof count === "number" ? count : 0,
      });
    } catch {
      // silently ignore
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [isSignedIn, sessionId, userId]);

  // Initial fetch + authenticated refresh for message and notification counts.
  useEffect(() => {
    if (!isSignedIn || !userId || !sessionId) return;
    void fetchAll(true);
    const interval = setInterval(() => { void fetchAll(); }, 10_000);
    return () => clearInterval(interval);
  }, [fetchAll, isSignedIn, sessionId, userId]);

  useEffect(() => {
    if (!userId) return;
    return subscribeToMessageReads(userId, fetchAll);
  }, [fetchAll, userId]);

  // Fetch when opening the panel
  const handleOpen = () => {
    setOpen((v) => !v);
    if (!open) {
      void fetchAll(true);
    }
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markAllRead = async () => {
    const response = await fetch("/api/notifications", { method: "PATCH" });
    if (response.ok && userId && sessionId) {
      setSnapshot((prev) => prev?.userId === userId && prev.sessionId === sessionId
        ? { ...prev, notifications: prev.notifications.map((n) => ({ ...n, read: true })) }
        : prev);
    }
  };

  const markRead = async (id: string) => {
    try {
      const response = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) return;
      if (userId && sessionId) {
        setSnapshot((prev) => prev?.userId === userId && prev.sessionId === sessionId
          ? { ...prev, notifications: prev.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) }
          : prev);
      }
    } catch {
      // Keep the notification unread if the server couldn't persist the read state.
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleOpen}
        className="relative w-8 h-8 flex items-center justify-center rounded-md text-text-muted hover:text-gold hover:bg-bg-elevated transition-all"
        aria-label={tn("ariaLabel")}
      >
        <Bell size={17} />
        {currentSnapshot && totalUnread > 0 && (
          <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-gold text-bg-primary text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
            {totalUnread > 9 ? "9+" : totalUnread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed top-16 right-2 lg:absolute lg:top-full lg:right-0 lg:mt-2 w-[360px] max-w-[calc(100vw-1rem)] bg-bg-elevated border border-border rounded-2xl shadow-2xl animate-fade-in overflow-hidden z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-text-primary">{tn("heading")}</h3>
              {totalUnread > 0 && (
                <span className="px-1.5 py-0.5 bg-gold text-bg-primary text-[10px] font-bold rounded-full">
                  {totalUnread} {tn("newBadge")}
                </span>
              )}
            </div>
            {unreadNotifs > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs text-gold hover:text-gold-light transition-colors"
              >
                <Check size={12} /> {tn("markAllRead")}
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[420px] overflow-y-auto divide-y divide-border">
            {/* Real unread messages entry */}
            {unreadMessagesCount > 0 && (
              <Link
                href="/messages"
                onClick={() => setOpen(false)}
                className="flex items-start gap-3 px-4 py-3.5 hover:bg-bg-hover transition-colors bg-gold/3"
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 bg-gold/10 border border-gold/20">
                  <MessageSquare size={14} className="text-gold" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-tight text-text-primary">
                      {unreadMessagesCount === 1 ? tn("newMessage") : tn("newMessages", { count: unreadMessagesCount })}
                    </p>
                    <span className="w-2 h-2 rounded-full shrink-0 mt-1 bg-gold" />
                  </div>
                  <p className="text-xs text-text-muted leading-relaxed mt-0.5">
                    {tn("viewMessages")}
                  </p>
                </div>
              </Link>
            )}

            {/* Loading */}
            {loading && currentNotifications.length === 0 && (
              <div className="py-8 text-center">
                <div className="w-5 h-5 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            )}

            {/* Empty state */}
            {!loading && currentNotifications.length === 0 && unreadMessagesCount === 0 && (
              <div className="py-12 text-center">
                <Bell size={28} className="text-text-muted mx-auto mb-3 opacity-40" />
                <p className="text-sm text-text-muted">{tn("empty")}</p>
                <p className="text-xs text-text-muted mt-1 opacity-60">
                  {tn("emptyDesc")}
                </p>
              </div>
            )}

            {/* Real notifications */}
            {currentNotifications.map((n) => {
              const Icon = typeIcons[n.type] ?? Bell;
              const meta = notificationMeta[n.type] ?? { color: "text-text-muted", dot: "bg-text-muted" };
              return (
                <Link
                  key={n.id}
                  href={n.href}
                  onClick={async (event) => {
                    event.preventDefault();
                    await markRead(n.id);
                    setOpen(false);
                    router.push(n.href);
                  }}
                  className={`flex items-start gap-3 px-4 py-3.5 hover:bg-bg-hover transition-colors group ${
                    !n.read ? "bg-gold/3" : ""
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                    n.read ? "bg-bg-elevated border border-border" : "bg-gold/10 border border-gold/20"
                  }`}>
                    <Icon size={14} className={n.read ? "text-text-muted" : meta.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-medium leading-tight ${n.read ? "text-text-secondary" : "text-text-primary"}`}>
                        {n.title}
                      </p>
                      {!n.read && (
                        <span className={`w-2 h-2 rounded-full shrink-0 mt-1 ${meta.dot}`} />
                      )}
                    </div>
                    <p className="text-xs text-text-muted leading-relaxed mt-0.5 line-clamp-2">
                      {n.body}
                    </p>
                    <p className="text-[10px] text-text-muted mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-border flex items-center justify-between">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="text-xs text-gold hover:text-gold-light transition-colors font-medium"
            >
              {tn("viewAll")}
            </Link>
            <Link
              href="/messages"
              onClick={() => setOpen(false)}
              className="text-xs text-text-muted hover:text-gold transition-colors"
            >
              {tn("messages")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
