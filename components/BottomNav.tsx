"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import NavigationIcon from "@/components/NavigationIcon";
import { MOBILE_NAV_ITEMS, activeMobileNavigationId, hideMobileNavigation } from "@/lib/site-navigation";

export default function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const [chatOpen, setChatOpen] = useState(false);

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
  const activeId = activeMobileNavigationId(pathname);
  return <nav aria-label={t("allAreas")} className="fixed bottom-0 left-0 right-0 z-60 border-t border-border bg-bg-secondary safe-area-pb lg:hidden">
    <div className="flex h-[var(--mobile-nav-height)] items-stretch overflow-x-auto pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)]">
      {MOBILE_NAV_ITEMS.map(item => {
        const active = item.id === activeId;
        return <Link key={item.id} href={item.href} prefetch={false} aria-current={active ? "page" : undefined} className={`relative flex min-h-11 min-w-11 flex-1 shrink-0 flex-col items-center justify-center gap-1 py-1.5 text-center transition-colors focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-gold ${active ? "text-gold" : "text-text-muted hover:text-text-secondary"}`}>
          <NavigationIcon name={item.icon} size={21} />
          <span className="max-w-full hyphens-auto break-words text-[8.5px] min-[360px]:text-[9px] min-[390px]:text-[10px] font-medium leading-3">{t(item.key)}</span>
          {active && <span aria-hidden="true" className="absolute left-1/2 top-0 h-0.5 w-6 -translate-x-1/2 rounded-full bg-gold" />}
        </Link>;
      })}
    </div>
  </nav>;
}
