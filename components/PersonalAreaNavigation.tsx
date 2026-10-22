"use client";

import { Suspense, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@clerk/nextjs";
import { getUnreadCountServerSnapshot, getUnreadCountSnapshot, subscribeToUnreadCount } from "@/lib/unread-count-store";
import {
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  Heart,
  LayoutDashboard,
  Menu,
  MessageSquare,
  BriefcaseBusiness,
  Settings,
  Users,
  Wallet,
  X,
  UserRound,
} from "lucide-react";

const moreLinks = [
  { href: "/dashboard?tab=favorites", labelKey: "savedItems", icon: Heart },
  { href: "/dashboard?tab=friends", labelKey: "network", icon: Users },
  { href: "/dashboard?tab=bookings", labelKey: "bookings", icon: CalendarDays },
  { href: "/dashboard?tab=earnings", labelKey: "payments", icon: Wallet },
  { href: "/company-dashboard", labelKey: "manageCompany", icon: Building2 },
  { href: "/notifications", labelKey: "notifications", icon: Bell },
  { href: "/dashboard?tab=settings", labelKey: "accountSettings", icon: Settings },
  { href: "/dashboard?tab=analytics", labelKey: "analytics", icon: BarChart3 },
] as const;

const mainLinks = [
  { href: "/dashboard", labelKey: "accountOverview", icon: LayoutDashboard, id: "overview" },
  { href: "/profile", labelKey: "myProfile", icon: UserRound, id: "profile" },
  { href: "/messages", labelKey: "messages", icon: MessageSquare, id: "messages" },
  { href: "/dashboard?tab=listings", labelKey: "myOffers", icon: BriefcaseBusiness, id: "offers" },
] as const;

function isPersonalArea(pathname: string) {
  return pathname === "/dashboard"
    || pathname.startsWith("/dashboard/")
    || pathname === "/profile"
    || pathname === "/messages"
    || pathname === "/favorites"
    || pathname === "/notifications"
    || pathname === "/invoices"
    || pathname === "/company-dashboard";
}

function navAreaForPath(pathname: string, tab: string): string {
  if (pathname === "/profile") return "profile";
  if (pathname === "/messages") return "messages";
  if (pathname === "/dashboard") {
    if (tab === "listings" || tab === "jobs") return "offers";
    if (tab === "messages") return "messages";
    if (tab === "overview" || tab === "") return "overview";
    return "more";
  }
  return "more";
}

function AreaNavigation({ pathname, dashboardTab }: { pathname: string; dashboardTab: string }) {
  const t = useTranslations("nav");
  const { userId } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const unreadCount = useSyncExternalStore(
    subscribeToUnreadCount,
    () => getUnreadCountSnapshot(userId ?? null),
    getUnreadCountServerSnapshot,
  );
  const activeArea = navAreaForPath(pathname, dashboardTab);
  const isMoreActive = activeArea === "more";

  useEffect(() => {
    const syncChatState = () => setChatOpen(document.body.dataset.messagesChatOpen === "true");
    const handleChatState = (event: Event) => {
      setChatOpen(Boolean((event as CustomEvent<boolean>).detail));
    };
    syncChatState();
    window.addEventListener("cinegenius:messages-chat-state", handleChatState);
    return () => window.removeEventListener("cinegenius:messages-chat-state", handleChatState);
  }, []);

  const renderLinks = (mobile = false) => (
    <>
      {mainLinks.map(({ href, labelKey, icon: Icon, id }) => {
        const active = activeArea === id;
        const label = t(labelKey);
        return (
          <Link
            key={id}
            href={href}
            aria-current={active ? "page" : undefined}
            onClick={() => setMoreOpen(false)}
            className={mobile
              ? `relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 text-center transition-colors ${active ? "text-gold" : "text-text-muted"}`
              : `inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors ${active ? "bg-gold/10 text-gold" : "text-text-secondary hover:bg-bg-elevated hover:text-text-primary"}`}
          >
            <Icon size={mobile ? 19 : 16} aria-hidden="true" />
            <span className={mobile ? "max-w-full text-[10px] font-medium leading-tight" : "whitespace-nowrap"}>{label}</span>
            {id === "messages" && unreadCount > 0 && (
              <span className={mobile
                ? "absolute right-1 top-1 min-w-4 rounded-full bg-crimson px-1 text-[9px] font-bold leading-4 text-white"
                : "ml-auto min-w-5 rounded-full bg-crimson px-1.5 py-0.5 text-center text-[10px] font-bold leading-4 text-white"}
              >{unreadCount > 9 ? "9+" : unreadCount}</span>
            )}
            {mobile && active && <span className="absolute bottom-0 h-0.5 w-6 rounded-full bg-gold" />}
          </Link>
        );
      })}
      <button
        type="button"
        aria-expanded={moreOpen}
        aria-controls="personal-area-more"
        onClick={() => setMoreOpen((open) => !open)}
        className={mobile
          ? `relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 text-center transition-colors ${moreOpen || isMoreActive ? "text-gold" : "text-text-muted"}`
          : `inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors ${moreOpen || isMoreActive ? "bg-gold/10 text-gold" : "text-text-secondary hover:bg-bg-elevated hover:text-text-primary"}`}
      >
        {moreOpen ? <X size={mobile ? 19 : 16} aria-hidden="true" /> : <Menu size={mobile ? 19 : 16} aria-hidden="true" />}
        <span className={mobile ? "max-w-full text-[10px] font-medium leading-tight" : "whitespace-nowrap"}>{t("more")}</span>
        {mobile && isMoreActive && <span className="absolute bottom-0 h-0.5 w-6 rounded-full bg-gold" />}
      </button>
    </>
  );

  return (
    <div className="relative">
      <div className="hidden border-b border-border bg-bg-secondary/95 backdrop-blur-nav lg:block">
        <nav aria-label={t("personalArea")} className="site-container flex min-h-12 items-center gap-2 py-1">
          {renderLinks()}
        </nav>
      </div>

      <nav aria-label={t("personalArea")} className={`safe-area-pb fixed inset-x-0 bottom-0 z-[60] border-t border-border bg-bg-secondary lg:hidden ${pathname === "/messages" && chatOpen ? "hidden" : ""}`}>
        <div className="relative flex h-16 items-stretch">
          {renderLinks(true)}
        </div>
      </nav>

      {moreOpen && (
        <>
          <button
            type="button"
            aria-label={t("closeMenu")}
            className="fixed inset-0 z-[61] cursor-default bg-black/45 lg:bg-transparent"
            onClick={() => setMoreOpen(false)}
          />
          <section
            id="personal-area-more"
            aria-label={t("additionalAreas")}
            className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] z-[62] max-h-[min(70vh,34rem)] overflow-y-auto rounded-t-2xl border-t border-border bg-bg-secondary p-4 shadow-2xl lg:absolute lg:inset-x-auto lg:bottom-auto lg:right-0 lg:top-full lg:mt-2 lg:max-h-[min(70vh,36rem)] lg:w-[25rem] lg:rounded-2xl lg:border"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border lg:hidden" />
            <h2 className="mb-3 px-1 text-sm font-semibold text-text-primary">{t("additionalAreas")}</h2>
            <div className="grid grid-cols-2 gap-2">
              {moreLinks.map(({ href, labelKey, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMoreOpen(false)}
                  className="flex min-h-12 items-center gap-2 rounded-xl border border-border bg-bg-elevated px-3 py-2 text-sm text-text-secondary transition-colors hover:border-gold/40 hover:text-gold"
                >
                  <Icon size={16} className="shrink-0" aria-hidden="true" />
                  <span className="min-w-0 leading-tight">{t(labelKey)}</span>
                </Link>
              ))}
              <Link
                href="/profile?tab=security"
                onClick={() => setMoreOpen(false)}
                className="flex min-h-12 items-center gap-2 rounded-xl border border-border bg-bg-elevated px-3 py-2 text-sm text-text-secondary transition-colors hover:border-gold/40 hover:text-gold"
              >
                <Settings size={16} className="shrink-0" aria-hidden="true" />
                <span className="min-w-0 leading-tight">{t("securityAndSignIn")}</span>
              </Link>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function AreaNavigationWithQuery({ pathname }: { pathname: string }) {
  const searchParams = useSearchParams();
  const dashboardTab = searchParams.get("tab") ?? "overview";
  return <AreaNavigation key={`${pathname}:${dashboardTab}`} pathname={pathname} dashboardTab={dashboardTab} />;
}

export default function PersonalAreaNavigation({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (!isPersonalArea(pathname)) return <>{children}</>;

  return (
    <>
      <div className="hidden h-16 lg:block" aria-hidden="true" />
      <Suspense fallback={<AreaNavigation pathname={pathname} dashboardTab="overview" />}>
        <AreaNavigationWithQuery pathname={pathname} />
      </Suspense>
      <div className="pb-2 lg:-mt-16 lg:pb-0">{children}</div>
    </>
  );
}
