"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Bell, Check, BookOpen, MessageSquare, Star,
  Wallet, ShieldCheck, FileCheck, Briefcase, UserPlus, Users,
} from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { timeAgo, notificationMeta, type NotificationType } from "@/lib/notifications";

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
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { isSignedIn } = useAuth();

  const unreadNotifs = notifications.filter((n) => !n.read).length;
  const totalUnread = unreadMessages + unreadNotifs;

  const fetchAll = useCallback(async () => {
    if (!isSignedIn) return;
    try {
      const [msgRes, notifRes] = await Promise.all([
        fetch("/api/unread-count"),
        fetch("/api/notifications"),
      ]);
      if (msgRes.ok) {
        const { count } = await msgRes.json();
        setUnreadMessages(count ?? 0);
      }
      if (notifRes.ok) {
        const { notifications: data } = await notifRes.json();
        setNotifications(data ?? []);
      }
    } catch {
      // silently ignore
    }
  }, [isSignedIn]);

  // Initial fetch + poll every 30s
  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30_000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  // Fetch when opening the panel
  const handleOpen = () => {
    setOpen((v) => !v);
    if (!open) {
      setLoading(true);
      fetchAll().finally(() => setLoading(false));
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
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await fetch("/api/notifications", { method: "PATCH" });
  };

  const markRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleOpen}
        className="relative w-8 h-8 flex items-center justify-center rounded-md text-text-muted hover:text-gold hover:bg-bg-elevated transition-all"
        aria-label="Benachrichtigungen"
      >
        <Bell size={17} />
        {totalUnread > 0 && (
          <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-gold text-bg-primary text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
            {totalUnread > 9 ? "9+" : totalUnread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-[360px] bg-bg-elevated border border-border rounded-2xl shadow-2xl animate-fade-in overflow-hidden z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-text-primary">Benachrichtigungen</h3>
              {totalUnread > 0 && (
                <span className="px-1.5 py-0.5 bg-gold text-bg-primary text-[10px] font-bold rounded-full">
                  {totalUnread} neu
                </span>
              )}
            </div>
            {unreadNotifs > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs text-gold hover:text-gold-light transition-colors"
              >
                <Check size={12} /> Alle gelesen
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[420px] overflow-y-auto divide-y divide-border">
            {/* Real unread messages entry */}
            {unreadMessages > 0 && (
              <Link
                href="/dashboard?tab=messages"
                onClick={() => setOpen(false)}
                className="flex items-start gap-3 px-4 py-3.5 hover:bg-bg-hover transition-colors bg-gold/3"
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 bg-gold/10 border border-gold/20">
                  <MessageSquare size={14} className="text-gold" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-tight text-text-primary">
                      {unreadMessages === 1 ? "1 neue Nachricht" : `${unreadMessages} neue Nachrichten`}
                    </p>
                    <span className="w-2 h-2 rounded-full shrink-0 mt-1 bg-gold" />
                  </div>
                  <p className="text-xs text-text-muted leading-relaxed mt-0.5">
                    Jetzt in der Nachrichtenübersicht ansehen
                  </p>
                </div>
              </Link>
            )}

            {/* Loading */}
            {loading && notifications.length === 0 && (
              <div className="py-8 text-center">
                <div className="w-5 h-5 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            )}

            {/* Empty state */}
            {!loading && notifications.length === 0 && unreadMessages === 0 && (
              <div className="py-12 text-center">
                <Bell size={28} className="text-text-muted mx-auto mb-3 opacity-40" />
                <p className="text-sm text-text-muted">Keine Benachrichtigungen</p>
                <p className="text-xs text-text-muted mt-1 opacity-60">
                  Hier erscheinen Buchungen, Anfragen und mehr.
                </p>
              </div>
            )}

            {/* Real notifications */}
            {notifications.map((n) => {
              const Icon = typeIcons[n.type] ?? Bell;
              const meta = notificationMeta[n.type] ?? { color: "text-text-muted", dot: "bg-text-muted" };
              return (
                <Link
                  key={n.id}
                  href={n.href}
                  onClick={() => { markRead(n.id); setOpen(false); }}
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
          <div className="px-4 py-2.5 border-t border-border">
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="text-xs text-gold hover:text-gold-light transition-colors font-medium"
            >
              Alle im Dashboard ansehen →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
