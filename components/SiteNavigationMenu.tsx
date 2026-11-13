"use client";

import { Suspense, useCallback, useContext, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import { LogOut, Search, ShieldCheck, X } from "lucide-react";
import NavigationIcon from "@/components/NavigationIcon";
import { useSiteNavigation } from "@/contexts/SiteNavigationContext";
import { ServerAdminContext } from "@/lib/server-admin-context";
import { ACCOUNT_NAV_ITEMS, BROWSE_NAV_ITEMS, UPCOMING_NAV_ITEMS, SITE_NAV_MENU_ID, SITE_NAV_SIGN_OUT_EVENT, isPrimaryBrowseItem, routeMatches } from "@/lib/site-navigation";
import { BEFORE_FORM_NAVIGATION_EVENT } from "@/lib/form-navigation-events";

function MenuContent() {
  const t = useTranslations("nav");
  const uiText = useTranslations();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isSignedIn, userId } = useAuth();
  const adminUserId = useContext(ServerAdminContext);
  const { menuOpen, closeMenu } = useSiteNavigation();
  const dialog = useRef<HTMLDialogElement>(null);
  const oldOverflow = useRef<string | null>(null);

  const closeNative = useCallback(() => {
    dialog.current?.close();
    if (oldOverflow.current !== null) {
      document.body.style.overflow = oldOverflow.current;
      oldOverflow.current = null;
    }
  }, []);
  const dismiss = useCallback(() => { closeNative(); closeMenu(); }, [closeNative, closeMenu]);

  useEffect(() => {
    if (!menuOpen) return;
    const element = dialog.current;
    if (!element) return;
    oldOverflow.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element.showModal();
    element.querySelector<HTMLButtonElement>("[data-close-navigation]")?.focus({ preventScroll: true });
    const closeForNavigation = () => dismiss();
    window.addEventListener(BEFORE_FORM_NAVIGATION_EVENT, closeForNavigation);
    window.addEventListener("popstate", closeForNavigation);
    return () => {
      window.removeEventListener(BEFORE_FORM_NAVIGATION_EVENT, closeForNavigation);
      window.removeEventListener("popstate", closeForNavigation);
      closeNative();
    };
  }, [menuOpen, closeNative, dismiss]);

  const routeKey = `${pathname}?${searchParams.toString()}`;
  const previousScreen = useRef({ routeKey, userId });
  useEffect(() => {
    const previous = previousScreen.current;
    previousScreen.current = { routeKey, userId };
    if (previous.routeKey !== routeKey || previous.userId !== userId) dismiss();
  }, [routeKey, userId, dismiss]);

  const currentHref = (href: string) => {
    const [path, query] = href.split("?");
    if (path !== pathname) return false;
    const tab = searchParams.get("tab");
    return query ? new URLSearchParams(query).get("tab") === tab : !tab || tab === "overview";
  };
  const linkClass = "flex min-h-12 min-w-0 items-center gap-2 rounded-xl px-2 py-2.5 text-sm text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold";
  return (
    <dialog ref={dialog} id={SITE_NAV_MENU_ID} aria-labelledby="site-navigation-title"
      onCancel={event => { event.preventDefault(); dismiss(); }} onClose={closeMenu}
      onClick={event => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dismiss();
      }}
      className="fixed inset-x-0 bottom-0 top-auto m-0 h-[min(88dvh,44rem)] max-h-[calc(100dvh-env(safe-area-inset-top,0px)-1rem)] w-full max-w-none overflow-hidden rounded-t-2xl border border-border bg-bg-secondary p-0 text-text-primary shadow-2xl backdrop:bg-black/60 xl:inset-0 xl:m-auto xl:h-fit xl:max-h-[min(88dvh,44rem)] xl:w-[min(36rem,calc(100vw-2rem))] xl:rounded-2xl">
      <div className="flex h-full min-h-0 flex-col xl:h-auto">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border py-3 pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))]">
          <h2 id="site-navigation-title" className="font-display text-xl"><span className="xl:hidden">{t("allAreas")}</span><span className="hidden xl:inline">{t("more")}</span></h2>
          <button data-close-navigation type="button" onClick={dismiss} aria-label={t("closeMenu")} className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-text-muted hover:bg-bg-elevated hover:text-text-primary focus-visible:outline-2 focus-visible:outline-gold"><X size={22} aria-hidden="true" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain xl:max-h-[calc(min(88dvh,44rem)-4.5rem)] pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] pt-4">
          <button type="button" onClick={() => { dismiss(); document.dispatchEvent(new Event("cg:opensearch")); }} className={`${linkClass} mb-4 w-full border border-border xl:hidden`}><Search size={20} aria-hidden="true" />{uiText("Ui.text_9f6d74e0a12b67")}</button>
          <nav aria-label={t("discover")}>
            <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-text-muted">{t("discover")}</h3>
            <div className="grid grid-cols-2 gap-1">
              {BROWSE_NAV_ITEMS.map(item => <Link key={item.id} href={item.href} prefetch={false} onClick={dismiss} aria-current={routeMatches(pathname, item.href) ? "page" : undefined} className={`${linkClass} ${isPrimaryBrowseItem(item.id) ? "xl:hidden" : ""} ${routeMatches(pathname, item.href) ? "bg-gold/10 text-gold" : ""}`}><NavigationIcon name={item.icon} className="shrink-0 text-gold" /><span className="min-w-0 break-words">{t(item.key)}</span></Link>)}
              {UPCOMING_NAV_ITEMS.map(item => <button key={item.id} type="button" disabled className="flex min-h-12 min-w-0 cursor-default items-center gap-2 rounded-xl px-2 py-2.5 text-left text-sm text-text-muted">
                <NavigationIcon name={item.icon} className="shrink-0" />
                <span className="min-w-0 break-words"><span className="block">{t(item.key)}</span><span className="block text-xs leading-relaxed">{t("comingSoon")}</span></span>
              </button>)}
            </div>
          </nav>
          <nav aria-label={t("personalArea")} className="mt-5 border-t border-border pt-4 xl:hidden">
            <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-text-muted">{t("personalArea")}</h3>
            {isSignedIn ? <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {ACCOUNT_NAV_ITEMS.map(item => <Link key={item.id} href={item.href} prefetch={false} onClick={dismiss} aria-current={currentHref(item.href) ? "page" : undefined} className={`${linkClass} ${currentHref(item.href) ? "bg-gold/10 text-gold" : ""}`}><NavigationIcon name={item.icon} className="shrink-0" /><span className="min-w-0 break-words">{t(item.key)}</span></Link>)}
              {adminUserId && adminUserId === userId && <Link href="/admin" prefetch={false} onClick={dismiss} className={linkClass}><ShieldCheck size={20} className="shrink-0" aria-hidden="true" />{t("adminArea")}</Link>}
            </div> : <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Link href="/sign-in" prefetch onClick={dismiss} className={`${linkClass} justify-center border border-border`}>{t("signIn")}</Link>
              <Link href="/sign-up" prefetch onClick={dismiss} className={`${linkClass} justify-center bg-gold font-semibold text-bg-primary hover:bg-gold/90 hover:text-bg-primary`}>{t("signUp")}</Link>
            </div>}
          </nav>
          <nav aria-label={t("helpAndInfo")} className="mt-5 border-t border-border pt-4">
            <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-text-muted">{t("helpAndInfo")}</h3>
            <div className="grid grid-cols-2 gap-1">
              <Link href="/help" prefetch={false} onClick={dismiss} className={linkClass}><NavigationIcon name="help" className="shrink-0" />{t("help")}</Link>
              <Link href="/support" prefetch={false} onClick={dismiss} className={linkClass}><NavigationIcon name="support" className="shrink-0" />{t("support")}</Link>
            </div>
          </nav>
          {isSignedIn && <button type="button" className={`${linkClass} mt-3 w-full border-t border-border xl:hidden`} onClick={() => { dismiss(); document.dispatchEvent(new Event(SITE_NAV_SIGN_OUT_EVENT)); }}><LogOut size={20} aria-hidden="true" />{t("signOut")}</button>}
        </div>
      </div>
    </dialog>
  );
}

export default function SiteNavigationMenu() {
  return <Suspense fallback={null}><MenuContent /></Suspense>;
}
