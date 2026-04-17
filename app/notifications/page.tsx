"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import {
  Bell, CheckCheck, BookOpen, MessageSquare, Star,
  Wallet, ShieldCheck, FileCheck, Briefcase, UserPlus, Users,
  ArrowLeft, Inbox, ExternalLink, Circle,
} from "lucide-react";
import { timeAgo, notificationMeta, type NotificationType } from "@/lib/notifications";

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

const FILTER_TABS = [
  { id: "all",      label: "Alle" },
  { id: "booking",  label: "Buchungen" },
  { id: "message",  label: "Nachrichten" },
  { id: "job",      label: "Jobs" },
  { id: "money",    label: "Zahlungen" },
  { id: "social",   label: "Netzwerk" },
  { id: "system",   label: "System" },
] as const;

type FilterId = typeof FILTER_TABS[number]["id"];

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
}: {
  notif: Notification;
  onRead: (id: string) => void;
}) {
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
              {timeAgo(notif.created_at)}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 mt-2.5">
          {notif.href && notif.href !== "/dashboard" && (
            <Link
              href={notif.href}
              onClick={() => { if (!notif.read) onRead(notif.id); }}
              className="flex items-center gap-1 text-xs text-gold hover:text-gold-light font-medium transition-colors"
            >
              Ansehen <ExternalLink size={10} />
            </Link>
          )}
          {!notif.read && (
            <button
              onClick={() => onRead(notif.id)}
              className="flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary transition-colors"
            >
              <Circle size={10} /> Als gelesen markieren
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterId>("all");
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const { notifications: data } = await res.json();
      setNotifications(data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) { setLoading(false); return; }
    fetchNotifications();
  }, [isLoaded, isSignedIn, fetchNotifications]);

  const markAsRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  };

  const markAllRead = async () => {
    setMarkingAll(true);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
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
        <h2 className="font-display text-2xl font-bold text-text-primary">Anmeldung erforderlich</h2>
        <p className="text-text-muted text-sm max-w-xs">Melde dich an, um deine Benachrichtigungen zu sehen.</p>
        <Link href="/sign-in" className="px-6 py-2.5 bg-gold text-bg-primary font-semibold rounded-xl text-sm hover:bg-gold-light transition-colors">
          Anmelden
        </Link>
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
                <h1 className="font-display text-2xl font-bold text-text-primary">Benachrichtigungen</h1>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 bg-gold/15 border border-gold/30 text-gold text-xs font-bold rounded-full">
                    {unreadCount} neu
                  </span>
                )}
              </div>
              <p className="text-xs text-text-muted mt-0.5">Alle Aktivitäten auf deinem Konto</p>
            </div>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              disabled={markingAll}
              className="flex items-center gap-1.5 text-xs text-text-muted hover:text-gold transition-colors px-3 py-2 rounded-lg border border-border hover:border-gold/30 shrink-0"
            >
              <CheckCheck size={13} />
              Alle gelesen
            </button>
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
                <p className="text-xs text-text-muted">Lade Benachrichtigungen…</p>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-center px-6">
              <div className="w-14 h-14 rounded-2xl bg-bg-elevated border border-border flex items-center justify-center">
                <Inbox size={22} className="text-text-muted" />
              </div>
              <h3 className="font-semibold text-text-secondary">
                {activeFilter === "all" ? "Keine Benachrichtigungen" : "Nichts in dieser Kategorie"}
              </h3>
              <p className="text-xs text-text-muted max-w-xs leading-relaxed">
                {activeFilter === "all"
                  ? "Sobald es Aktivität auf deinem Konto gibt, erscheint sie hier."
                  : "Wechsle in eine andere Kategorie oder warte auf neue Aktivität."}
              </p>
            </div>
          ) : (
            <>
              {/* Unread section */}
              {unreadFiltered > 0 && (
                <>
                  <div className="px-5 pt-4 pb-2">
                    <p className="text-[10px] uppercase tracking-widest font-semibold text-gold">
                      Neu · {unreadFiltered}
                    </p>
                  </div>
                  {filtered.filter((n) => !n.read).map((n) => (
                    <NotifRow key={n.id} notif={n} onRead={markAsRead} />
                  ))}
                </>
              )}

              {/* Read section */}
              {filtered.filter((n) => n.read).length > 0 && (
                <>
                  <div className={`px-5 pb-2 ${unreadFiltered > 0 ? "pt-4 border-t border-border" : "pt-4"}`}>
                    <p className="text-[10px] uppercase tracking-widest font-semibold text-text-muted">
                      Frühere
                    </p>
                  </div>
                  {filtered.filter((n) => n.read).map((n) => (
                    <NotifRow key={n.id} notif={n} onRead={markAsRead} />
                  ))}
                </>
              )}
            </>
          )}
        </div>

        {/* Footer hint */}
        {!loading && notifications.length >= 30 && (
          <p className="text-center text-xs text-text-muted mt-4">
            Es werden maximal die letzten 30 Benachrichtigungen angezeigt.
          </p>
        )}
      </div>
    </div>
  );
}
