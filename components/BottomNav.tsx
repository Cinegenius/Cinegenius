"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import NavigationIcon from "@/components/NavigationIcon";
import { useSiteNavigation } from "@/contexts/SiteNavigationContext";
import { PRIMARY_NAV_ITEMS, SITE_NAV_MENU_ID, activeNavigationId, hideMobileNavigation } from "@/lib/site-navigation";
import { getUnreadCountServerSnapshot, getUnreadCountSnapshot, subscribeToUnreadCount } from "@/lib/unread-count-store";

export default function BottomNav() {
  const pathname = usePathname();
  const { userId } = useAuth();
  const t = useTranslations("nav");
  const { menuOpen, openMenu } = useSiteNavigation();
  const [chatOpen, setChatOpen] = useState(false);
  const unread = useSyncExternalStore(subscribeToUnreadCount, () => getUnreadCountSnapshot(userId ?? null), getUnreadCountServerSnapshot);

  useEffect(() => {
    const sync = () => setChatOpen(document.body.dataset.messagesChatOpen === "true");
    const onChatState = (event: Event) => {
      const isOpen = (event as CustomEvent<boolean>).detail;
      document.body.dataset.messagesChatOpen = String(isOpen);
      setChatOpen(isOpen);
    };
    sync();
    window.addEventListener("cinegenius:messages-chat-state", onChatState);
    return () => window.removeEventListener("cinegenius:messages-chat-state", onChatState);
  }, []);

  if (hideMobileNavigation(pathname, chatOpen)) return null;
  const activeId = activeNavigationId(pathname);
  return <nav aria-label={t("allAreas")} className="fixed bottom-0 left-0 right-0 z-60 border-t border-border bg-bg-secondary safe-area-pb lg:hidden">
    <div className="flex h-[var(--mobile-nav-height)] items-stretch pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)]">
      {PRIMARY_NAV_ITEMS.map(item => {
        const active = item.id === activeId || item.id === "more" && menuOpen;
        const className = `relative flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-1 py-1.5 text-center transition-colors focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-gold ${active ? "text-gold" : "text-text-muted hover:text-text-secondary"}`;
        const content = <><span className="relative"><NavigationIcon name={item.icon} size={21} />{item.id === "messages" && unread > 0 && <span className="absolute -right-3 -top-1 min-w-4 rounded-full bg-crimson px-1 text-[9px] font-bold leading-4 text-white">{unread > 9 ? "9+" : unread}</span>}</span><span className="max-w-full break-words text-[8.5px] min-[360px]:text-[9px] min-[390px]:text-[10px] font-medium leading-3">{t(item.key)}</span>{active && <span aria-hidden="true" className="absolute left-1/2 top-0 h-0.5 w-6 -translate-x-1/2 rounded-full bg-gold" />}</>;
        return item.kind === "menu" ? <button key={item.id} type="button" className={className} onClick={event => { event.currentTarget.focus({ preventScroll: true }); openMenu(); }} aria-expanded={menuOpen} aria-controls={SITE_NAV_MENU_ID} aria-haspopup="dialog">{content}</button>
          : <Link key={item.id} href={item.href} prefetch={false} aria-current={item.id === activeId ? "page" : undefined} className={className}>{content}</Link>;
      })}
    </div>
  </nav>;
}
