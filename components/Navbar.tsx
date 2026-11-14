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
import { Logo } from "@/components/Logo";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import MediaImage from "@/components/MediaImage";
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
    avatarUrl: string | null;
  } | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const signingOutRef = useRef(false);
  const inbox = useAuthenticatedInbox();
  const pathname = usePathname();
  const authRoute = pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up");
  const { isSignedIn, isLoaded, userId: authenticatedUserId, sessionId: authenticatedSessionId } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { addToast } = useToast();
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const accountButton = useRef<HTMLButtonElement>(null);
  const mobileAccountButton = useRef<HTMLButtonElement>(null);
  const activeAccountButton = useRef<HTMLButtonElement | null>(null);
  const [failedAccountImageUrl, setFailedAccountImageUrl] = useState("");
  const profileRevision = useRef(0);
  const activeUserId = isLoaded && isSignedIn && user?.id === authenticatedUserId ? authenticatedUserId : null;
  const showAdminLink = !!initialAdminUserId && initialAdminUserId === activeUserId;
  const supportUnread = useAdminSupportUnread(showAdminLink ? activeUserId : null);
  const supportUnreadCount = supportUnread.count ?? 0;
  const supportUnreadLabel = uiText("SupportContact.unreadLabel", { count: supportUnreadCount });
  const hasSignedInSession = inbox.status === "expired" ? false : isLoaded ? !!isSignedIn : initialIsSignedIn;
  const profileDisplayName = profileData?.userId === activeUserId ? profileData?.displayName ?? "" : "";
  const unreadMessages = inbox.status === "ready" ? inbox.count ?? 0 : 0;
  const unreadNotices = inbox.status === "ready" ? inbox.notifications.filter(notice => !notice.read && notice.type !== "new_message").length : 0;
  const unreadTotal = unreadMessages + unreadNotices;
  const inboxFailed = inbox.status === "error";
  const messageLabel = inboxFailed ? `${t("messages")}: ${uiText("notifications.loadError")}` : unreadTotal > 0 ? uiText("InboxNavigation.unread", { chats: unreadMessages, notices: unreadNotices }) : t("messages");
  const supportBadge = supportUnreadCount > 0 ? <span title={supportUnreadLabel} aria-label={supportUnreadLabel} className="ml-auto inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-bg-primary">{supportUnreadCount > 99 ? "99+" : supportUnreadCount}</span> : null;
  const displayName = activeUserId ? profileDisplayName || user?.firstName || user?.emailAddresses?.[0]?.emailAddress?.split("@")[0] || "" : "";
  const email = activeUserId ? user?.primaryEmailAddress?.emailAddress ?? "" : "";
  const currentProfile = activeUserId && profileData?.userId === activeUserId ? profileData : null;
  const candidateImageUrl = currentProfile ? currentProfile.avatarUrl ?? "" : (activeUserId && user?.hasImage ? user.imageUrl : "") || "";
  const accountImageUrl = failedAccountImageUrl !== candidateImageUrl ? candidateImageUrl : "";

  const closeAll = () => { setUserMenuOpen(false); };

  useEffect(() => {
    // A route or account/session transition must not retain another identity's open menu.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    closeAll();
  }, [pathname, authenticatedUserId, authenticatedSessionId, activeUserId, hasSignedInSession]);

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

  useEffect(() => {
    if (!activeUserId || !hasSignedInSession) return;
    const controller = new AbortController();
    const revision = ++profileRevision.current;
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    void fetch(`/api/profile/by-id?id=${encodeURIComponent(activeUserId)}`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (!response.ok) return;
        const { profile } = await response.json();
        if (controller.signal.aborted || revision !== profileRevision.current || profile?.user_id !== activeUserId) return;
        setProfileData({
          userId: activeUserId,
          displayName: typeof profile.display_name === "string" ? profile.display_name : "",
          avatarUrl: typeof profile.avatar_url === "string" ? profile.avatar_url : null,
        });
      })
      .catch(() => { /* Keep the account control usable when the photo cannot load. */ })
      .finally(() => window.clearTimeout(timeout));
    return () => { controller.abort(); window.clearTimeout(timeout); };
  }, [activeUserId, hasSignedInSession]);

  useEffect(() => subscribeToProfileUpdated((detail) => {
    if (!activeUserId || detail?.userId !== activeUserId) return;
    ++profileRevision.current;
    setProfileData(previous => ({
      userId: activeUserId,
      displayName: detail.displayName ?? (previous?.userId === activeUserId ? previous.displayName : ""),
      avatarUrl: detail.avatarUrl !== undefined ? detail.avatarUrl : previous?.userId === activeUserId ? previous.avatarUrl : null,
    }));
    if (detail.avatarUrl !== undefined) setFailedAccountImageUrl("");
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
      const target = e.target as Node;
      if (
        accountMenuRef.current?.contains(target) ||
        accountButton.current?.contains(target) ||
        mobileAccountButton.current?.contains(target)
      ) return;
      setUserMenuOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !userMenuOpen) return;
      event.preventDefault(); setUserMenuOpen(false); (activeAccountButton.current ?? accountButton.current ?? mobileAccountButton.current)?.focus();
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
  const accountAvatar = (className: string, iconSize: number) => (
    <span className={`relative flex items-center justify-center overflow-hidden rounded-full bg-gold/10 border border-gold/20 ${className}`} aria-hidden="true">
      {accountImageUrl ? (
        <MediaImage
          key={`${activeUserId}:${accountImageUrl}`}
          src={accountImageUrl}
          alt=""
          width={44}
          height={44}
          unoptimized
          className="h-full w-full object-cover"
          loading="eager"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailedAccountImageUrl(accountImageUrl)}
        />
      ) : (
        <User size={iconSize} className="text-gold" />
      )}
    </span>
  );
  const accountMenu = hasSignedInSession && activeUserId && userMenuOpen ? (
    <div
      ref={accountMenuRef}
      id="header-account-menu"
      className="fixed right-2 top-[var(--site-header-height)] z-50 mt-2 w-[26rem] max-w-[calc(100vw-1rem)] max-h-[calc(100dvh-var(--site-header-height)-1rem-var(--mobile-nav-clearance))] lg:max-h-[calc(100dvh-5rem-env(safe-area-inset-bottom,0px))] overflow-y-auto overscroll-contain rounded-2xl border border-border bg-bg-elevated shadow-2xl animate-fade-in sm:right-4"
    >
      {/* Identity */}
      <div className="px-4 py-3.5 border-b border-border flex items-center gap-3">
        {accountAvatar("h-11 w-11 min-h-11 min-w-11 shrink-0", 18)}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text-primary truncate leading-tight">{displayName}</p>
          <p className="text-[11px] text-text-muted truncate mt-0.5">{email}</p>
        </div>
      </div>

      {/* Links */}
      <div className="grid grid-cols-1 gap-1 py-1.5 min-[480px]:grid-cols-2">
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
      <div className="sticky bottom-0 border-t border-border bg-bg-elevated py-1.5">
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
  ) : null;

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? "backdrop-blur-nav border-b border-border" : "bg-black/30 backdrop-blur-sm"
        }`}
      >
        <div className="site-header-container mx-auto px-4 max-[479px]:px-2 sm:px-6 lg:px-4 xl:px-8">
          <div data-guest={!hasSignedInSession || undefined} className="site-header-row flex h-16 min-w-0 items-center justify-between gap-1 max-[479px]:gap-0 sm:gap-3 lg:gap-2 xl:gap-3">

            {/* Logo */}
            <Logo />

            {/* Desktop nav */}
            <nav aria-label={t("discover")} className="site-header-primary hidden lg:flex shrink-0 items-center">
              {PRIMARY_NAV_ITEMS.map(item => item.kind === "menu" ? <button
                key={item.id} type="button" onClick={event => {event.currentTarget.focus({preventScroll:true});openMenu();}} aria-expanded={menuOpen} aria-controls={SITE_NAV_MENU_ID} aria-haspopup="dialog"
                className={`inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center whitespace-nowrap rounded-md px-1.5 text-xs xl:px-2 xl:text-sm font-medium uppercase tracking-wide transition-colors ${menuOpen || activeId === item.id ? navActive : navBase}`}
              >{t(item.key)}</button> : <Link
                key={item.id} href={item.href} prefetch={authRoute || signingOut ? false : null} aria-current={activeId === item.id ? "page" : undefined}
                className={`inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center whitespace-nowrap rounded-md px-1.5 text-xs xl:px-2 xl:text-sm font-medium uppercase tracking-wide transition-colors ${activeId === item.id ? navActive : navBase}`}
              >{t(item.key)}</Link>)}
            </nav>

            {/* Desktop CTA */}
            <div className="site-header-actions hidden lg:flex shrink-0 items-center gap-1">
              {/* Keep the search footprint identical on the homepage and directory routes. */}
              <button
                type="button"
                onClick={event => { event.currentTarget.focus({ preventScroll: true }); document.dispatchEvent(new Event("cg:opensearch")); }}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-text-muted hover:bg-bg-elevated hover:text-gold transition-colors"
                aria-label={uiText("Ui.text_9f6d74e0a12b67")}
                title={uiText("Ui.text_9f6d74e0a12b67")}
              ><Search size={18} aria-hidden="true" /></button>
              {hasSignedInSession && <Link href="/messages" prefetch={authRoute || signingOut ? false : null} aria-label={messageLabel} title={messageLabel} aria-current={activeId === "messages" ? "page" : undefined} className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-bg-elevated hover:text-gold ${activeId === "messages" ? "text-gold" : "text-text-muted"}`}>
                <MessageSquare size={19} aria-hidden="true" />
                {inboxFailed && <span aria-hidden="true" className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-gold" />}
                {unreadTotal > 0 && <span aria-hidden="true" className="absolute right-0.5 top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-crimson px-1 text-[9px] font-bold text-white">{unreadTotal > 9 ? "9+" : unreadTotal}</span>}
              </Link>}
              <LanguageSwitcher />
              {!hasSignedInSession && (
                <>
                  <Link
                    href="/sign-in"
                    prefetch
                    className="inline-flex min-h-11 items-center whitespace-nowrap px-2 py-2 text-[11px] xl:px-3 xl:text-xs font-semibold border border-border text-text-secondary hover:border-gold hover:text-gold rounded-md transition-all"
                  >
                    {t("signIn")}
                  </Link>
                  <Link
                    href="/sign-up"
                    prefetch
                    className="inline-flex min-h-11 items-center whitespace-nowrap px-2 py-2 text-[11px] xl:px-3 xl:text-xs font-semibold bg-gold text-bg-primary rounded-md hover:bg-gold-light transition-colors"
                  >
                    {t("signUp")}
                  </Link>
                </>
              )}
              {hasSignedInSession && (
                  <div className="relative">
                    <button
                      ref={accountButton}
                      aria-label={t("personalArea")} title={t("personalArea")} aria-expanded={userMenuOpen} aria-controls="header-account-menu"
                      onClick={(event) => { activeAccountButton.current = event.currentTarget; setUserMenuOpen(v => !v); }}
                      className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border hover:border-gold/50 hover:bg-bg-elevated transition-all group"
                    >
                      {accountAvatar("h-7 w-7", 15)}
                      {supportBadge && <span className="absolute -right-1 -top-1">{supportBadge}</span>}
                    </button>
                  </div>
              )}
            </div>

            {/* Mobile: keep both auth destinations visible outside the menu. */}
            <div className="site-header-compact lg:hidden flex shrink-0 items-center gap-1 max-[479px]:gap-0">
              <button type="button"
                onClick={event => { event.currentTarget.focus({ preventScroll: true }); document.dispatchEvent(new Event("cg:opensearch")); }}
                aria-label={uiText("Ui.text_9f6d74e0a12b67")} title={uiText("Ui.text_9f6d74e0a12b67")}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-text-muted hover:bg-bg-elevated hover:text-gold transition-colors">
                <Search size={19} aria-hidden="true" />
              </button>
              {hasSignedInSession && <Link href="/messages" prefetch={false} aria-label={messageLabel} title={messageLabel} aria-current={activeId === "messages" ? "page" : undefined} className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-text-muted hover:bg-bg-elevated hover:text-gold">
                <MessageSquare size={19} aria-hidden="true" />
                {inboxFailed && <span aria-hidden="true" className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-gold" />}
                {unreadTotal > 0 && <span aria-hidden="true" className="absolute right-0.5 top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-crimson px-1 text-[9px] font-bold text-white">{unreadTotal > 9 ? "9+" : unreadTotal}</span>}
              </Link>}
              {!hasSignedInSession && (
                <div className="flex items-center gap-1">{uiText.rich("Ui.text_49b372e77a7a76", { value2: () => (t("signIn")), part1: chunks => (<Link href="/sign-in" prefetch className="min-h-11 inline-flex items-center justify-center whitespace-nowrap rounded-lg border border-border px-2.5 max-[360px]:px-1.5 text-[11px] max-[360px]:text-[10px] font-semibold text-text-primary hover:border-gold hover:text-gold">{chunks}</Link>), value5: () => (t("signUp")), part4: chunks => (<span className="max-[420px]:hidden">{chunks}</span>), part6: chunks => (<span className="min-[421px]:hidden">{chunks}</span>), part3: chunks => (<Link href="/sign-up" prefetch className="min-h-11 inline-flex items-center justify-center whitespace-nowrap rounded-lg bg-gold px-2.5 max-[360px]:px-1.5 text-[11px] max-[360px]:text-[10px] font-bold text-bg-primary hover:bg-gold-light">{chunks}</Link>) })}</div>
              )}
              {hasSignedInSession && (
                <button
                  ref={mobileAccountButton}
                  aria-label={t("personalArea")}
                  title={t("personalArea")}
                  aria-expanded={userMenuOpen}
                  aria-controls="header-account-menu"
                  onClick={(event) => { activeAccountButton.current = event.currentTarget; setUserMenuOpen(v => !v); }}
                  className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border hover:border-gold/50 hover:bg-bg-elevated transition-all"
                >
                  {accountAvatar("h-8 w-8", 16)}
                  {supportBadge && <span className="absolute -right-1 -top-1">{supportBadge}</span>}
                </button>
              )}
              {hasSignedInSession && <LanguageSwitcher />}
              <button
                className="relative w-11 h-11 flex items-center justify-center rounded-lg text-text-secondary hover:text-gold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
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
        {accountMenu}
      </header>

    </>
  );
}
