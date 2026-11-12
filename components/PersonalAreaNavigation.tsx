"use client";

import { Suspense, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@clerk/nextjs";
import { BriefcaseBusiness, LayoutDashboard, Menu, MessageSquare, UserRound } from "lucide-react";
import { useSiteNavigation } from "@/contexts/SiteNavigationContext";
import { getUnreadCountServerSnapshot, getUnreadCountSnapshot, subscribeToUnreadCount } from "@/lib/unread-count-store";

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
  }
  return "more";
}

function AreaNavigation({ pathname, dashboardTab }: { pathname: string; dashboardTab: string }) {
  const t = useTranslations("nav");
  const { userId } = useAuth();
  const { menuOpen, openMenu } = useSiteNavigation();
  const unreadCount = useSyncExternalStore(
    subscribeToUnreadCount,
    () => getUnreadCountSnapshot(userId ?? null),
    getUnreadCountServerSnapshot,
  );
  const activeArea = navAreaForPath(pathname, dashboardTab);
  const moreActive = menuOpen || activeArea === "more";

  return (
    <div className="hidden border-b border-border bg-bg-secondary/95 backdrop-blur-nav lg:block">
      <nav aria-label={t("personalArea")} className="site-container flex min-h-12 items-center gap-2 py-1">
        {mainLinks.map(({ href, labelKey, icon: Icon, id }) => {
          const active = activeArea === id;
          return (
            <Link
              key={id}
              href={href}
              prefetch={false}
              aria-current={active ? "page" : undefined}
              className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors ${active ? "bg-gold/10 text-gold" : "text-text-secondary hover:bg-bg-elevated hover:text-text-primary"}`}
            >
              <Icon size={16} aria-hidden="true" />
              <span className="whitespace-nowrap">{t(labelKey)}</span>
              {id === "messages" && unreadCount > 0 && (
                <span className="ml-auto min-w-5 rounded-full bg-crimson px-1.5 py-0.5 text-center text-[10px] font-bold leading-4 text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>
          );
        })}
        <button
          type="button"
          aria-expanded={menuOpen}
          aria-controls="site-navigation-menu"
          aria-haspopup="dialog"
          onClick={event => { event.currentTarget.focus({ preventScroll: true }); openMenu(); }}
          className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors ${moreActive ? "bg-gold/10 text-gold" : "text-text-secondary hover:bg-bg-elevated hover:text-text-primary"}`}
        >
          <Menu size={16} aria-hidden="true" />
          <span className="whitespace-nowrap">{t("more")}</span>
        </button>
      </nav>
    </div>
  );
}

function AreaNavigationWithQuery({ pathname }: { pathname: string }) {
  const searchParams = useSearchParams();
  const dashboardTab = searchParams.get("tab") ?? "overview";
  return <AreaNavigation pathname={pathname} dashboardTab={dashboardTab} />;
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
      <div className="lg:-mt-16">{children}</div>
    </>
  );
}
