"use client";

import { useState, useEffect, useRef } from "react";
import type React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth, useUser, useClerk } from "@clerk/nextjs";
import {
  Menu, X, Film, ChevronDown, Search, Loader2, User,
  LayoutDashboard, LogOut, MessageSquare, Bell, ShieldCheck,
} from "lucide-react";
import NotificationCenter from "@/components/NotificationCenter";
import { Logo } from "@/components/Logo";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useTranslations } from "next-intl";
import { useToast } from "@/contexts/ToastContext";
import { subscribeToMessageReads } from "@/lib/message-read-sync";
import { publishUnreadCount } from "@/lib/unread-count-store";
import { subscribeToProfileUpdated } from "@/lib/profile-update-events";

const desktopNavHrefs = [
  { href: "/locations", key: "locations" },
  { href: "/creators", key: "crew" },
  { href: "/jobs", key: "jobs" },
  { href: "/props", key: "marketplace" },
  { href: "/projects", key: "projects" },
  { href: "/companies", key: "companies" },
] as const;

export default function Navbar({ initialIsSignedIn = false, initialAdminUserId = null }: { initialIsSignedIn?: boolean; initialAdminUserId?: string | null }) {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [profileData, setProfileData] = useState<{
    userId: string;
    displayName: string;
    avatarUrl: string;
  } | null>(null);
  const profileUpdateRevision = useRef(0);
  const [signingOut, setSigningOut] = useState(false);
  const signingOutRef = useRef(false);
  const [unreadData, setUnreadData] = useState<{ userId: string; count: number } | null>(null);
  const pathname = usePathname();
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { addToast } = useToast();
  const userMenuRef = useRef<HTMLDivElement>(null);
  const activeUserId = isSignedIn ? user?.id : null;
  const showAdminLink = !!initialAdminUserId && initialAdminUserId === activeUserId;
  const hasSignedInSession = isLoaded ? !!isSignedIn : initialIsSignedIn;
  const profileDisplayName = profileData?.userId === activeUserId ? profileData?.displayName ?? "" : "";
  const profileAvatarUrl = profileData?.userId === activeUserId ? profileData?.avatarUrl ?? "" : "";
  const unreadMessages = unreadData?.userId === activeUserId ? unreadData?.count ?? 0 : 0;

  useEffect(() => {
    publishUnreadCount(activeUserId ?? null, unreadMessages);
  }, [activeUserId, unreadMessages]);

  const closeAll = () => { setUserMenuOpen(false); };

  useEffect(() => {
    // Route changes must close transient menus, including browser back/forward navigation.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    closeAll();
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;

    try {
      // Remove the old account-agnostic cache written by previous releases.
      localStorage.removeItem("cg_profile_name");
      localStorage.removeItem("cg_profile_avatar");
    } catch { /* storage can be disabled */ }

    if (!activeUserId) {
      return;
    }

    const controller = new AbortController();
    const { signal } = controller;
    let current = true;
    const initialProfileRevision = profileUpdateRevision.current;

    fetch("/api/profile", { signal, cache: "no-store" })
      .then(r => r.ok ? r.json() : null)
      .then((json) => {
        if (!current || !json || initialProfileRevision !== profileUpdateRevision.current) return;
        setProfileData({
          userId: activeUserId,
          displayName: json.profile?.display_name ?? "",
          avatarUrl: json.profile?.avatar_url ?? "",
        });
      })
      .catch(() => {});
    fetch("/api/unread-count", { signal, cache: "no-store" })
      .then(r => r.ok ? r.json() : null)
      .then((json) => { if (current && json) setUnreadData({ userId: activeUserId, count: json.count ?? 0 }); })
      .catch(() => {});

    const refreshUnreadMessages = () => {
      fetch("/api/unread-count", { cache: "no-store", signal })
        .then(r => r.ok ? r.json() : null)
        .then((json) => { if (current && json) setUnreadData({ userId: activeUserId, count: json.count ?? 0 }); })
        .catch(() => {});
    };
    const unsubscribeMessageReads = subscribeToMessageReads(activeUserId, refreshUnreadMessages);
    const refreshInterval = window.setInterval(() => {
      if (document.visibilityState === "visible") refreshUnreadMessages();
    }, 10_000);

    return () => {
      current = false;
      controller.abort();
      unsubscribeMessageReads();
      window.clearInterval(refreshInterval);
    };
  }, [isLoaded, activeUserId]);

  useEffect(() => {
    return subscribeToProfileUpdated((detail) => {
      if (!activeUserId || detail?.userId !== activeUserId) return;
      profileUpdateRevision.current += 1;
      setProfileData((current) => ({
        userId: activeUserId,
        displayName: detail.displayName ?? (current?.userId === activeUserId ? current.displayName : ""),
        avatarUrl: detail.avatarUrl !== undefined
          ? detail.avatarUrl ?? ""
          : current?.userId === activeUserId ? current.avatarUrl : "",
      }));
    });
  }, [activeUserId]);

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
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href.split("?")[0] + "/");
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">

            {/* Logo */}
            <Logo />

            {/* Desktop nav */}
            <nav className="hidden lg:flex items-center gap-1">
              {desktopNavHrefs.map(({ href, key }) => {
                const basePath = href.split("?")[0] ?? href;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`px-3 py-2 text-sm font-medium transition-colors uppercase tracking-widest rounded-md ${isActive(basePath) ? navActive : navBase}`}
                  >
                    {t(key)}
                  </Link>
                );
              })}
            </nav>

            {/* Desktop CTA */}
            <div className="hidden lg:flex items-center gap-2">
              {pathname !== "/" && (
                <button
                  onClick={() => document.dispatchEvent(new Event("cg:opensearch"))}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-text-muted hover:border-gold/40 hover:text-gold transition-all text-sm"
                  aria-label="CineGenius durchsuchen"
                >
                  <Search size={14} />
                  <span className="hidden xl:inline">Suchen…</span>
                  <kbd className="hidden xl:inline text-[10px] px-1.5 py-0.5 rounded bg-bg-hover border border-border font-mono">⌘K</kbd>
                </button>
              )}
              <LanguageSwitcher />
              <NotificationCenter />
              {!hasSignedInSession && (
                <>
                  <Link
                    href="/sign-in"
                    prefetch
                    className="px-4 py-2 text-sm font-semibold border border-border text-text-secondary hover:border-gold hover:text-gold rounded-md transition-all"
                  >
                    {t("signIn")}
                  </Link>
                  <Link
                    href="/sign-up"
                    prefetch
                    className="px-4 py-2 text-sm font-semibold bg-gold text-bg-primary rounded-md hover:bg-gold-light transition-colors"
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
                      onClick={() => setUserMenuOpen(v => !v)}
                      className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full border border-border hover:border-gold/50 hover:bg-bg-elevated transition-all group"
                    >
                      <span className="relative w-7 h-7 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center overflow-hidden" aria-hidden="true">
                        {profileAvatarUrl
                          ? <Image src={profileAvatarUrl} alt="" width={28} height={28} unoptimized className="h-full w-full object-cover" />
                          : <User size={15} className="text-gold" />}
                      </span>
                      <span className="text-sm font-medium text-text-secondary group-hover:text-text-primary transition-colors max-w-[100px] truncate hidden xl:block">
                        {displayName}
                      </span>
                      <ChevronDown size={12} className={`text-text-muted transition-transform duration-200 ${userMenuOpen ? "rotate-180" : ""}`} />
                    </button>

                    {userMenuOpen && (
                      <div className="absolute top-full right-0 mt-2 w-56 bg-bg-elevated border border-border rounded-2xl shadow-2xl overflow-hidden animate-fade-in z-50">
                        {/* Identity */}
                        <div className="px-4 py-3.5 border-b border-border flex items-center gap-3">
                          <span className="relative w-9 h-9 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0 overflow-hidden" aria-hidden="true">
                            {profileAvatarUrl
                              ? <Image src={profileAvatarUrl} alt="" width={36} height={36} unoptimized className="h-full w-full object-cover" />
                              : <User size={18} className="text-gold" />}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-text-primary truncate leading-tight">{displayName}</p>
                            <p className="text-[11px] text-text-muted truncate mt-0.5">{email}</p>
                          </div>
                        </div>

                        {/* Links */}
                        <div className="py-1.5">
                          <Link
                            href="/dashboard"
                            onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
                          >
                            <LayoutDashboard size={15} className="text-text-muted shrink-0" /> {t("personalArea")}
                          </Link>
                          <Link
                            href="/messages"
                            onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
                          >
                            <MessageSquare size={15} className="text-text-muted shrink-0" />
                            <span>{t("messages")}</span>
                            {unreadMessages > 0 && (
                              <span className="ml-auto min-w-[18px] h-4.5 bg-crimson text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                                {unreadMessages > 9 ? "9+" : unreadMessages}
                              </span>
                            )}
                          </Link>
                          <Link
                            href={user?.id ? `/profile/${user.id}` : "/profile"}
                            onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
                          >
                            <User size={15} className="text-text-muted shrink-0" /> {t("publicProfile")}
                          </Link>
                          {showAdminLink && <Link href="/admin" onClick={() => setUserMenuOpen(false)} className="flex min-h-11 items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"><ShieldCheck size={15} className="text-text-muted shrink-0" />{t("adminArea")}</Link>}
                        </div>

                        {/* Sign out */}
                        <div className="border-t border-border py-1.5">
                          <button
                            onClick={() => { setUserMenuOpen(false); void handleSignOut(); }}
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
            <div className="lg:hidden flex items-center gap-1">
              {hasSignedInSession && pathname !== "/" && (
                <button
                  onClick={() => document.dispatchEvent(new Event("cg:opensearch"))}
                  className="w-9 h-9 flex items-center justify-center text-text-secondary hover:text-gold transition-colors"
                  aria-label="CineGenius durchsuchen"
                >
                  <Search size={20} />
                </button>
              )}
              {!hasSignedInSession && (
                <div className="flex items-center gap-1">
                  <Link href="/sign-in" prefetch className="min-h-11 inline-flex items-center justify-center whitespace-nowrap rounded-lg border border-border px-2.5 max-[360px]:px-1.5 text-[11px] max-[360px]:text-[10px] font-semibold text-text-primary hover:border-gold hover:text-gold">
                    {t("signIn")}
                  </Link>
                  <Link href="/sign-up" prefetch className="min-h-11 inline-flex items-center justify-center whitespace-nowrap rounded-lg bg-gold px-2.5 max-[360px]:px-1.5 text-[11px] max-[360px]:text-[10px] font-bold text-bg-primary hover:bg-gold-light">
                    <span className="max-[420px]:hidden">{t("signUp")}</span>
                    <span className="min-[421px]:hidden">Registrieren</span>
                  </Link>
                </div>
              )}
              {hasSignedInSession && (() => {
                return (
                  <>
                    <NotificationCenter />
                    <Link
                      href="/dashboard"
                      className="relative w-9 h-9 rounded-full border border-gold/30 shrink-0 flex items-center justify-center bg-gold/10 overflow-hidden"
                      title={t("personalArea")}
                      aria-label={t("personalArea")}
                    >
                      {profileAvatarUrl
                        ? <Image src={profileAvatarUrl} alt="" width={36} height={36} unoptimized className="h-full w-full object-cover" />
                        : <User size={18} className="text-gold" aria-hidden="true" />}
                    </Link>
                  </>
                );
              })()}
              {hasSignedInSession && <LanguageSwitcher />}
              <button
                className="w-11 h-11 flex items-center justify-center text-text-secondary hover:text-gold transition-colors"
                onClick={() => setOpen(!open)}
                aria-label={t("openMenu")}
              >
                {open ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {open && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
      )}

      {/* Mobile panel */}
      <div
        className={`lg:hidden fixed top-0 right-0 bottom-0 z-50 w-80 bg-bg-secondary border-l border-border shadow-2xl transform transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 h-16 border-b border-border">
          <Logo onClick={() => setOpen(false)} />
          <button onClick={() => setOpen(false)} className="text-text-muted hover:text-gold transition-colors">
            <X size={20} />
          </button>
        </div>

        <nav className="px-4 py-5 overflow-y-auto h-[calc(100%-4rem)] flex flex-col gap-4">

          {hasSignedInSession ? (
            <>
              {/* Account links */}
              <div className="space-y-1">
                {[
                  { href: "/dashboard",     icon: LayoutDashboard, label: t("personalArea")    },
                  ...(showAdminLink ? [{ href: "/admin", icon: ShieldCheck, label: t("adminArea") }] : []),
                  { href: "/dashboard?tab=listings", icon: Film,    label: t("myOffers")        },
                  { href: "/messages",      icon: MessageSquare,   label: t("messages")        },
                  { href: "/notifications", icon: Bell,            label: t("notifications")   },
                  { href: user?.id ? `/profile/${user.id}` : "/profile", icon: User, label: t("publicProfile") },
                ].map(({ href, icon: Icon, label }) => (
                  <Link
                    key={label}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-4 px-4 py-3.5 rounded-xl text-base font-medium transition-all ${
                      isActive(href)
                        ? "bg-gold/10 text-gold border border-gold/20"
                        : "text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
                    }`}
                  >
                    <Icon size={18} className={isActive(href) ? "text-gold" : "text-text-muted"} />
                    <span>{label}</span>
                    {href === "/messages" && unreadMessages > 0 && (
                      <span className="ml-auto min-w-[20px] h-5 bg-crimson text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                        {unreadMessages > 9 ? "9+" : unreadMessages}
                      </span>
                    )}
                  </Link>
                ))}
              </div>

              {/* CTA */}
              <div className="pt-2 border-t border-border">
                <Link
                  href="/inserat"
                  onClick={() => setOpen(false)}
                  className="block w-full py-3 px-4 text-sm text-center font-semibold bg-gold text-bg-primary rounded-xl hover:bg-gold-light transition-colors"
                >
                  + {t("createListing")}
                </Link>
              </div>

              {/* Sign out */}
              <div className="pt-2 border-t border-border">
                <button
                  onClick={() => { setOpen(false); void handleSignOut(); }}
                  disabled={signingOut}
                  aria-busy={signingOut}
                  className="w-full min-h-11 flex items-center gap-2 px-3 py-2.5 text-sm text-text-secondary hover:text-red-400 rounded-lg transition-colors disabled:opacity-60"
                >
                  {signingOut ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
                  {signingOut ? t("signingOut") : t("signOut")}
                </button>
              </div>
            </>
          ) : (
            <div className="mt-auto pt-4 border-t border-border space-y-2">
              <Link href="/sign-in" onClick={() => setOpen(false)} className="block w-full py-2.5 px-3 text-sm text-center font-medium border border-border text-text-secondary hover:border-gold hover:text-gold rounded-lg transition-all">
                {t("signIn")}
              </Link>
              <Link href="/sign-up" onClick={() => setOpen(false)} className="block w-full py-2.5 px-3 text-sm text-center font-semibold bg-gold text-bg-primary rounded-lg hover:bg-gold-light transition-colors">
                {t("signUp")}
              </Link>
            </div>
          )}
        </nav>
      </div>
    </>
  );
}
