"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import type { MouseEvent, ReactNode, RefObject } from "react";
import Link from "next/link";
import { Bell, ChevronRight, Loader2, LogOut, Menu, MessageSquare, Search, User } from "lucide-react";
import NavigationIcon from "@/components/NavigationIcon";
import type { SiteNavigationIcon } from "@/lib/site-navigation";
import { announceNativeHeaderAction, useNativeHeaderUtilityKind } from "@/lib/native-header-utility";
import styles from "./NativeAppNavbar.module.css";

type ProfileLink = { id: string; href: string; label: string; icon: SiteNavigationIcon };

export type NativeAppNavbarProps = {
  navigationLabel: string;
  accountButtonRef: RefObject<HTMLButtonElement | null>;
  accountMenuRef: RefObject<HTMLDivElement | null>;
  account: {
    signedIn: boolean;
    ready: boolean;
    open: boolean;
    label: string;
    title: string;
    loadingLabel: string;
    displayName: string;
    email: string;
    avatar: ReactNode;
    supportBadge: ReactNode;
    links: readonly ProfileLink[];
    onToggle: (event: MouseEvent<HTMLButtonElement>) => void;
    onClose: () => void;
    onSignOut: () => void;
    signingOut: boolean;
    signOutLabel: string;
  };
  messages: { label: string; count: number; noticeCount: number; failed: boolean; active: boolean };
  search: { label: string; onClick: (event: MouseEvent<HTMLButtonElement>) => void };
  menu: { label: string; open: boolean; controls: string; onClick: (event: MouseEvent<HTMLButtonElement>) => void };
  signInLabel: string;
};

/** App presentation of the existing Navbar controller; no identity, request or preference store. */
export default function NativeAppNavbar({ navigationLabel, accountButtonRef, accountMenuRef, account, messages, search, menu, signInLabel }: NativeAppNavbarProps) {
  const { open, ready } = account;
  const utility = useNativeHeaderUtilityKind();
  const header = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const root = document.documentElement, element = header.current, bubble = element?.querySelector("nav");
    if (!element || !bubble) return;
    const previous = root.style.getPropertyValue("--cg-app-header-height");
    const measure = () => {
      const height = `${Math.ceil(bubble.getBoundingClientRect().height)}px`;
      if (root.style.getPropertyValue("--cg-app-header-height") !== height) root.style.setProperty("--cg-app-header-height", height);
    };
    const observer = new ResizeObserver(measure); observer.observe(bubble); measure();
    const revealFocus = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || !target.closest('[data-native-app-surface="v1"]') || target.closest('dialog,[role="dialog"],[data-native-browse-toolbar]')) return;
      requestAnimationFrame(() => {
        if (!target.isConnected || document.activeElement !== target) return;
        const top = element.getBoundingClientRect().bottom + 20;
        const toolbar = document.querySelector<HTMLElement>('[data-native-rail-stuck="true"]');
        let safeTop = (toolbar?.getBoundingClientRect().bottom ?? top) + 8;
        let scrollport: HTMLElement | null = target.parentElement;
        while (scrollport && scrollport !== document.body && !(scrollport.scrollHeight > scrollport.clientHeight && /^(auto|scroll)$/.test(getComputedStyle(scrollport).overflowY))) scrollport = scrollport.parentElement;
        if (scrollport === document.body) scrollport = null;
        let safeBottom = document.querySelector('[data-native-app-bottom-nav]')?.getBoundingClientRect().top ?? window.innerHeight;
        const genie = document.querySelector('[data-genie-open]');
        if (genie) for (const control of genie.parentElement?.querySelectorAll('button') ?? []) safeBottom = Math.min(safeBottom, control.getBoundingClientRect().top);
        if (scrollport) {
          const clip = scrollport.getBoundingClientRect();
          safeTop = Math.max(safeTop, clip.top + 8);
          safeBottom = Math.min(safeBottom, clip.bottom);
        }
        safeBottom -= 8;
        const box = target.getBoundingClientRect();
        if (box.top < safeTop) (scrollport ?? window).scrollBy({ top: box.top - safeTop, behavior: "instant" });
        else if (box.bottom > safeBottom && box.height < safeBottom - safeTop) (scrollport ?? window).scrollBy({ top: box.bottom - safeBottom, behavior: "instant" });
      });
    };
    document.addEventListener("focusin", revealFocus);
    return () => { observer.disconnect(); document.removeEventListener("focusin", revealFocus); if (previous) root.style.setProperty("--cg-app-header-height", previous); else root.style.removeProperty("--cg-app-header-height"); };
  }, []);
  useEffect(() => {
    if (!open || !ready) return;
    const frame = window.requestAnimationFrame(() => accountMenuRef.current?.querySelector<HTMLAnchorElement>("[data-native-profile-link]")?.focus({ preventScroll: true }));
    return () => window.cancelAnimationFrame(frame);
  }, [open, ready, accountMenuRef]);

  return <header ref={header} data-native-app-navbar="v1" className={styles.header}>
    <nav className={styles.bubble} aria-label={navigationLabel}>
      {account.signedIn ? <button
        ref={accountButtonRef} type="button" className={styles.action}
        data-native-app-action="profile" aria-label={account.ready ? account.label : account.loadingLabel}
        title={account.ready ? account.label : account.loadingLabel}
        aria-expanded={account.ready && account.open} aria-controls="header-account-menu" aria-haspopup="dialog"
        disabled={!account.ready} aria-busy={!account.ready || account.signingOut}
        onClick={account.onToggle}
      ><span className={styles.avatar}>{account.avatar}</span>{account.supportBadge && <span className={styles.support}>{account.supportBadge}</span>}</button>
        : <Link href="/sign-in" prefetch={false} className={styles.action} data-native-app-action="profile" aria-label={signInLabel} title={signInLabel}><User size={22} aria-hidden="true" /></Link>}
      <Link href="/messages" prefetch={false} className={styles.action} data-native-app-action="messages"
        aria-label={messages.label} title={messages.label} aria-current={messages.active ? "page" : undefined} onClick={event => { if (!announceNativeHeaderAction("messages")) { event.preventDefault(); return; } account.onClose(); }}>
        <MessageSquare size={22} aria-hidden="true" />
        {messages.failed && <span aria-hidden="true" className={styles.failed} />}
        {messages.count > 0 && <span aria-hidden="true" data-native-unread="messages" className={styles.messageBadge}>{messages.count > 9 ? "9+" : messages.count}</span>}
        {messages.noticeCount > 0 && <span aria-hidden="true" data-native-unread="notices" className={styles.noticeBadge}><Bell size={8} />{messages.noticeCount > 9 ? "9+" : messages.noticeCount}</span>}
      </Link>
      <button type="button" className={styles.action} data-native-app-action="search" aria-label={search.label} title={search.label} aria-expanded={utility === "search"} aria-haspopup="dialog" onClick={search.onClick}><Search size={22} aria-hidden="true" /></button>
      <button type="button" className={styles.action} data-native-app-action="menu" aria-label={menu.label} title={menu.label}
        aria-expanded={menu.open} aria-controls={menu.controls} aria-haspopup="dialog" onClick={menu.onClick}><Menu size={22} aria-hidden="true" /></button>
    </nav>
    {account.ready && account.open && <div ref={accountMenuRef} id="header-account-menu" className={styles.profileMenu}
      role="dialog" aria-labelledby="native-profile-menu-title"
      onBlur={event => {
        const next = event.relatedTarget;
        if (next instanceof Node && !event.currentTarget.contains(next) && !accountButtonRef.current?.contains(next)) account.onClose();
      }}>
      <h2 id="native-profile-menu-title" className={styles.srOnly}>{account.title}</h2>
      <Link href="/dashboard" prefetch={false} data-native-profile-link="identity" className={styles.identity} onClick={account.onClose}>
        <span className={styles.identityAvatar}>{account.avatar}</span>
        <span className={styles.identityCopy}><strong>{account.displayName}</strong><span>{account.email}</span></span>
        {account.supportBadge}<ChevronRight size={16} aria-hidden="true" />
      </Link>
      <div className={styles.links}>{account.links.map(link => <Link key={link.id} href={link.href} prefetch={false}
        data-native-profile-link={link.id} className={styles.profileLink} onClick={account.onClose}>
        <NavigationIcon name={link.icon} size={18} /><span>{link.label}</span><ChevronRight size={15} aria-hidden="true" />
      </Link>)}</div>
      <div className={styles.signOut}><button type="button" className={styles.profileLink} onClick={account.onSignOut} disabled={account.signingOut} aria-busy={account.signingOut}>
        {account.signingOut ? <Loader2 size={18} className={styles.spinner} aria-hidden="true" /> : <LogOut size={18} aria-hidden="true" />}<span>{account.signOutLabel}</span>
      </button></div>
    </div>}
  </header>;
}
