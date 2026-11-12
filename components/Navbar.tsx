"use client";

import { useState, useEffect, useLayoutEffect, useRef } from "react";
import type React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth, useUser, useClerk } from "@clerk/nextjs";
import {
  Menu, Search, Loader2, User,
  LogOut, MessageSquare, ShieldCheck,
} from "lucide-react";
import NavigationIcon from "@/components/NavigationIcon";
import NotificationCenter from "@/components/NotificationCenter";
import { Logo } from "@/components/Logo";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useFormNavigation } from "@/contexts/FormDraftContext";
import { useTranslations } from "next-intl";
import { useToast } from "@/contexts/ToastContext";
import { useAuthenticatedInbox } from "@/lib/use-authenticated-inbox";
import { subscribeToProfileUpdated } from "@/lib/profile-update-events";
import { ACCOUNT_NAV_ITEMS, PRIMARY_NAV_ITEMS, activeNavigationId, SITE_NAV_MENU_ID, SITE_NAV_SIGN_OUT_EVENT } from "@/lib/site-navigation";
import { useSiteNavigation } from "@/contexts/SiteNavigationContext";
import { useAdminSupportUnread } from "@/lib/use-admin-support-unread";

export default function Navbar({ initialIsSignedIn = false, initialAdminUserId = null }: { initialIsSignedIn?: boolean; initialAdminUserId?: string | null }) {
  const uiText = useTranslations();

  const t = useTranslations("nav");
  const { leave } = useFormNavigation();
  const {menuOpen, openMenu, closeMenu} = useSiteNavigation();
  const [scrolled, setScrolled] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [profileData, setProfileData] = useState<{
    userId: string;
    displayName: string;
  } | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const signingOutRef = useRef(false);
  const inbox = useAuthenticatedInbox();
  const pathname = usePathname();
  const authRoute = pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up");
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { addToast } = useToast();
  const userMenuRef = useRef<HTMLDivElement>(null);
  const accountButton = useRef<HTMLButtonElement>(null);
  const activeUserId = isSignedIn ? user?.id : null;
  const showAdminLink = !!initialAdminUserId && initialAdminUserId === activeUserId;
  const supportUnread = useAdminSupportUnread(showAdminLink ? activeUserId : null);
  const supportUnreadCount = supportUnread.count ?? 0;
  const supportUnreadLabel = uiText("SupportContact.unreadLabel", { count: supportUnreadCount });
  const hasSignedInSession = inbox.status === "expired" ? false : isLoaded ? !!isSignedIn : initialIsSignedIn;
  const profileDisplayName = profileData?.userId === activeUserId ? profileData?.displayName ?? "" : "";
  const unreadMessages = inbox.status === "ready" ? inbox.count ?? 0 : 0;
  const messageLabel = unreadMessages > 0 ? `${t("messages")}, ${uiText(unreadMessages === 1 ? "notifications.newMessage" : "notifications.newMessages", { count: unreadMessages })}` : t("messages");
  const supportBadge = supportUnreadCount > 0 ? <span title={supportUnreadLabel} aria-label={supportUnreadLabel} className="ml-auto inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-bg-primary">{supportUnreadCount > 99 ? "99+" : supportUnreadCount}</span> : null;

  const closeAll = () => { setUserMenuOpen(false); };

  useEffect(() => {
    // Route changes must close transient menus, including browser back/forward navigation.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    closeAll();
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.removeItem("cg_profile_name");
      localStorage.removeItem("cg_profile_avatar");
    } catch { /* Retired account-agnostic caches may be unavailable. */ }
  }, [isLoaded]);

  useEffect(() => subscribeToProfileUpdated((detail) => {
    if (!activeUserId || detail?.userId !== activeUserId || detail.displayName === undefined) return;
    setProfileData({userId:activeUserId,displayName:detail.displayName});
  }), [activeUserId]);

  const handleSignOut = async () => {
    if (signingOutRef.current) return;
    signingOutRef.current = true;
    setSigningOut(true);
    const slowNoticeTimer = window.setTimeout(() => {
      addToast(t("signOutSlow"), "info");
    }, 6000);
    try {
      // No sessionId means sign out every CineGenius session active in this
      // browser, so switching between profiles cannot leave an account active.
      await signOut({ redirectUrl: "/" });
    } catch {
      window.clearTimeout(slowNoticeTimer);
      signingOutRef.current = false;
      setSigningOut(false);
      addToast(t("signOutError"), "error");
      return;
    }
    window.clearTimeout(slowNoticeTimer);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !userMenuOpen) return;
      event.preventDefault(); setUserMenuOpen(false); accountButton.current?.focus();
    };
    document.addEventListener("mousedown", handler); document.addEventListener("keydown", escape);
    return () => {document.removeEventListener("mousedown", handler);document.removeEventListener("keydown", escape);};
  }, [userMenuOpen]);

  const requestSignOut = useRef<() => void>(() => {});
  useLayoutEffect(() => {
    requestSignOut.current = () => {
      if (!hasSignedInSession || signingOutRef.current) return;
      setUserMenuOpen(false); closeMenu();
      leave(() => void handleSignOut());
    };
  });
  useEffect(() => {
    const request = () => requestSignOut.current();
    document.addEventListener(SITE_NAV_SIGN_OUT_EVENT, request);
    return () => document.removeEventListener(SITE_NAV_SIGN_OUT_EVENT, request);
  }, []);

  const activeId = activeNavigationId(pathname);
  // When not scrolled (over hero), use white text for contrast against dark image overlay
  const navBase   = scrolled ? "text-text-secondary hover:text-gold" : "text-white/80 hover:text-white";
  const navActive = scrolled ? "text-gold" : "text-white";

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? "backdrop-blur-nav border-b border-border" : "bg-black/30 backdrop-blur-sm"
        }`}
      >
        <div className="site-header-container mx-auto px-4 max-[360px]:px-2 sm:px-6 lg:px-8">
          <div className="flex h-16 min-w-0 items-center justify-between gap-1 sm:gap-3">

            {/* Logo */}
            <Logo />

            {/* Desktop nav */}
            <nav aria-label={t("discover")} className="site-header-primary hidden xl:flex min-w-0 items-center">
              {PRIMARY_NAV_ITEMS.map(item => item.kind === "menu" ? <button
                key={item.id} type="button" onClick={event => {event.currentTarget.focus({preventScroll:true});openMenu();}} aria-expanded={menuOpen} aria-controls={SITE_NAV_MENU_ID} aria-haspopup="dialog"
                className={`inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md px-2 text-xs font-medium uppercase tracking-wide transition-colors ${menuOpen || activeId === item.id ? navActive : navBase}`}
              >{t(item.key)}</button> : <Link
                key={item.id} href={item.href} prefetch={authRoute || signingOut ? false : null} aria-current={activeId === item.id ? "page" : undefined}
                className={`inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md px-2 text-xs font-medium uppercase tracking-wide transition-colors ${activeId === item.id ? navActive : navBase}`}
              >{t(item.key)}</Link>)}
            </nav>

            {/* Desktop CTA */}
            <div className="site-header-actions hidden xl:flex shrink-0 items-center gap-1">
              {/* Keep the search footprint identical on the homepage and directory routes. */}
              <button
                type="button"
                onClick={() => document.dispatchEvent(new Event("cg:opensearch"))}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-text-muted hover:bg-bg-elevated hover:text-gold transition-colors"
                aria-label={uiText("Ui.text_9f6d74e0a12b67")}
                title={uiText("Ui.text_9f6d74e0a12b67")}
              ><Search size={18} aria-hidden="true" /></button>
              {hasSignedInSession && <Link href="/messages" prefetch={authRoute || signingOut ? false : null} aria-label={messageLabel} title={messageLabel} aria-current={activeId === "messages" ? "page" : undefined} className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-bg-elevated hover:text-gold ${activeId === "messages" ? "text-gold" : "text-text-muted"}`}>
                <MessageSquare size={19} aria-hidden="true" />
                {unreadMessages > 0 && <span aria-hidden="true" className="absolute right-0.5 top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-crimson px-1 text-[9px] font-bold text-white">{unreadMessages > 9 ? "9+" : unreadMessages}</span>}
              </Link>}
              <LanguageSwitcher />
              {hasSignedInSession && <NotificationCenter inbox={inbox} includeMessages={false} />}
              {!hasSignedInSession && (
                <>
                  <Link
                    href="/sign-in"
                    prefetch
                    className="inline-flex min-h-11 items-center px-3 py-2 text-xs font-semibold border border-border text-text-secondary hover:border-gold hover:text-gold rounded-md transition-all"
                  >
                    {t("signIn")}
                  </Link>
                  <Link
                    href="/sign-up"
                    prefetch
                    className="inline-flex min-h-11 items-center px-3 py-2 text-xs font-semibold bg-gold text-bg-primary rounded-md hover:bg-gold-light transition-colors"
                  >
                    {t("signUp")}
                  </Link>
                </>
              )}
              {hasSignedInSession && (() => {
                const displayName = profileDisplayName || user?.firstName || user?.emailAddresses?.[0]?.emailAddress?.split("@")[0] || "";
                const email = user?.primaryEmailAddress?.emailAddress ?? "";
                return (
                  <div className="relative" ref={userMenuRef}>
                    <button
                      ref={accountButton}
                      aria-label={t("personalArea")} title={t("personalArea")} aria-expanded={userMenuOpen} aria-controls="header-account-menu"
                      onClick={() => setUserMenuOpen(v => !v)}
                      className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border hover:border-gold/50 hover:bg-bg-elevated transition-all group"
                    >
                      <span className="relative w-7 h-7 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center overflow-hidden" aria-hidden="true">
                        <User size={15} className="text-gold" />
                      </span>

                      {supportBadge && <span className="absolute -right-1 -top-1">{supportBadge}</span>}
                    </button>

                    {userMenuOpen && (
                      <div id="header-account-menu" className="absolute top-full right-0 mt-2 w-[26rem] max-w-[calc(100vw-2rem)] max-h-[calc(100dvh-5rem)] overflow-y-auto overscroll-contain bg-bg-elevated border border-border rounded-2xl shadow-2xl animate-fade-in z-50">
                        {/* Identity */}
                        <div className="px-4 py-3.5 border-b border-border flex items-center gap-3">
                          <span className="relative min-w-11 min-h-11 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0 overflow-hidden" aria-hidden="true">
                            <User size={18} className="text-gold" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-text-primary truncate leading-tight">{displayName}</p>
                            <p className="text-[11px] text-text-muted truncate mt-0.5">{email}</p>
                          </div>
                        </div>

                        {/* Links */}
                        <div className="grid grid-cols-2 gap-1 py-1.5">
                          {ACCOUNT_NAV_ITEMS.map(item => <Link
                            key={item.id} href={item.href} prefetch={false} onClick={() => setUserMenuOpen(false)}
                            className="flex min-h-11 items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
                          ><NavigationIcon name={item.icon} size={15} className="text-text-muted shrink-0" /><span className="min-w-0 break-words">{t(item.id === "overview" ? "personalArea" : item.key)}</span></Link>)}
                          <Link
                            href={user?.id ? `/profile/${user.id}` : "/profile"}
                            onClick={() => setUserMenuOpen(false)}
                            className="flex min-h-11 items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
                          >
                            <User size={15} className="text-text-muted shrink-0" /> {t("publicProfile")}
                          </Link>
                          {showAdminLink && <Link href="/admin" onClick={() => setUserMenuOpen(false)} className="flex min-h-11 items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"><ShieldCheck size={15} className="text-text-muted shrink-0" />{t("adminArea")}{supportBadge}</Link>}
                        </div>

                        {/* Sign out */}
                        <div className="border-t border-border py-1.5">
                          <button
                            onClick={() => requestSignOut.current()}
                            disabled={signingOut}
                            aria-busy={signingOut}
                            className="w-full min-h-11 flex items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:text-red-400 hover:bg-red-500/5 transition-colors disabled:opacity-60"
                          >
                            {signingOut ? <Loader2 size={15} className="shrink-0 animate-spin" /> : <LogOut size={15} className="shrink-0" />}
                            {signingOut ? t("signingOut") : t("signOut")}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Mobile: keep both auth destinations visible outside the menu. */}
            <div className="xl:hidden flex shrink-0 items-center gap-1">
              {hasSignedInSession && <Link href="/messages" prefetch={false} aria-label={messageLabel} title={messageLabel} aria-current={activeId === "messages" ? "page" : undefined} className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-text-muted hover:bg-bg-elevated hover:text-gold">
                <MessageSquare size={19} aria-hidden="true" />
                {unreadMessages > 0 && <span aria-hidden="true" className="absolute right-0.5 top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-crimson px-1 text-[9px] font-bold text-white">{unreadMessages > 9 ? "9+" : unreadMessages}</span>}
              </Link>}
              {!hasSignedInSession && (
                <div className="flex items-center gap-1">{uiText.rich("Ui.text_49b372e77a7a76", { value2: () => (t("signIn")), part1: chunks => (<Link href="/sign-in" prefetch className="min-h-11 inline-flex items-center justify-center whitespace-nowrap rounded-lg border border-border px-2.5 max-[360px]:px-1.5 text-[11px] max-[360px]:text-[10px] font-semibold text-text-primary hover:border-gold hover:text-gold">{chunks}</Link>), value5: () => (t("signUp")), part4: chunks => (<span className="max-[420px]:hidden">{chunks}</span>), part6: chunks => (<span className="min-[421px]:hidden">{chunks}</span>), part3: chunks => (<Link href="/sign-up" prefetch className="min-h-11 inline-flex items-center justify-center whitespace-nowrap rounded-lg bg-gold px-2.5 max-[360px]:px-1.5 text-[11px] max-[360px]:text-[10px] font-bold text-bg-primary hover:bg-gold-light">{chunks}</Link>) })}</div>
              )}
              {hasSignedInSession && <div className="hidden min-[360px]:block"><NotificationCenter inbox={inbox} includeMessages={false} /></div>}
              {hasSignedInSession && <LanguageSwitcher />}
              <button
                className="relative w-11 h-11 flex items-center justify-center text-text-secondary hover:text-gold transition-colors"
                onClick={event => {event.currentTarget.focus({preventScroll:true});openMenu();}}
                aria-label={t("openMenu")}
                aria-expanded={menuOpen}
                aria-controls={SITE_NAV_MENU_ID} aria-haspopup="dialog"
              >
                <Menu size={22} />
                {supportBadge && <span className="absolute -right-1 -top-1">{supportBadge}</span>}
              </button>
            </div>
          </div>
        </div>
      </header>

    </>
  );
}
