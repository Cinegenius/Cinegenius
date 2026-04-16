"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Home, Search, MessageSquare, Bell, LayoutDashboard } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function BottomNav() {
  const pathname = usePathname();
  const { isSignedIn, userId } = useAuth();
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifs, setUnreadNotifs] = useState(0);

  const fetchCounts = useCallback(async () => {
    if (!isSignedIn) return;
    try {
      const [msgRes, notifRes] = await Promise.all([
        fetch("/api/conversations"),
        fetch("/api/notifications"),
      ]);
      const { data: convs } = await msgRes.json();
      const { notifications } = await notifRes.json();
      const msgs = (convs ?? []).flatMap((c: { messages?: { sender_id: string; read_at: string | null }[] }) =>
        (c.messages ?? []).filter((m) => m.sender_id !== userId && !m.read_at)
      );
      setUnreadMessages(msgs.length);
      setUnreadNotifs((notifications ?? []).filter((n: { read: boolean }) => !n.read).length);
    } catch { /* ignore */ }
  }, [isSignedIn, userId]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts, pathname]);

  // Realtime new messages
  useEffect(() => {
    if (!isSignedIn) return;
    const channel = supabase
      .channel("bottom-nav-messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => {
        fetchCounts();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isSignedIn, fetchCounts]);

  // Dashboard has its own internal bottom nav — don't double up
  if (pathname.startsWith("/dashboard")) return null;

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const items = [
    { href: "/", icon: Home, label: "Start" },
    { href: "/search", icon: Search, label: "Suche" },
    { href: "/messages", icon: MessageSquare, label: "Nachrichten", badge: unreadMessages },
    { href: "/notifications", icon: Bell, label: "Aktivität", badge: unreadNotifs },
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-bg-secondary border-t border-border safe-area-pb">
      <div className="flex items-stretch h-14">
        {items.map(({ href, icon: Icon, label, badge }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 relative transition-colors ${
                active ? "text-gold" : "text-text-muted hover:text-text-secondary"
              }`}
            >
              <div className="relative">
                <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
                {!!badge && badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 bg-crimson text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-medium leading-none ${active ? "text-gold" : ""}`}>
                {label}
              </span>
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-gold rounded-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
