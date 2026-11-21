"use client";

import { useEffect, useLayoutEffect, useRef, useSyncExternalStore, type RefObject } from "react";
import { BEFORE_FORM_NAVIGATION_EVENT } from "./form-navigation-events";

export type NativeHeaderAction = "profile" | "messages" | "search" | "menu" | "close";
const EVENT = "cinegenius:native-header-action";
const listeners = new Set<() => void>();
type Lease = { kind: "search" | "menu" | "messages"; dismiss: (restoreFocus?: boolean) => void };
let active: Lease | null = null;
const publish = () => { for (const listener of listeners) listener(); };

/** A genuine decision dialog still owns the screen; header utilities never bypass it. */
export function nativeHeaderBlocked() {
  return Array.from(document.querySelectorAll<HTMLElement>('dialog[open],[aria-modal="true"]')).some(node =>
    !node.hasAttribute("data-native-header-utility") && node.getClientRects().length > 0);
}
export function announceNativeHeaderAction(action: NativeHeaderAction) {
  if (nativeHeaderBlocked()) return false;
  if (active && active.kind !== action) active.dismiss(false);
  document.dispatchEvent(new CustomEvent(EVENT, { detail: action }));
  return true;
}
export function dismissNativeHeaderUtility() { active?.dismiss(false); }
export function useNativeHeaderAction(onAction: (action: NativeHeaderAction) => void) {
  const callback = useRef(onAction);
  useLayoutEffect(() => { callback.current = onAction; });
  useEffect(() => {
    const event = (value: Event) => callback.current((value as CustomEvent<NativeHeaderAction>).detail);
    document.addEventListener(EVENT, event);
    return () => document.removeEventListener(EVENT, event);
  }, []);
}
export function useNativeHeaderUtilityKind() {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => active?.kind ?? null, () => null);
}

/** One native utility owns its lock. The real four actions remain outside its nonmodal surface. */
export function useNativeHeaderUtility(ref: RefObject<HTMLDialogElement | null>, enabled: boolean, kind: "search" | "menu" | "messages", onClose: () => void) {
  const close = useRef(onClose);
  useLayoutEffect(() => { close.current = onClose; });
  useLayoutEffect(() => {
    if (!enabled || !ref.current) return;
    const element = ref.current;
    if (nativeHeaderBlocked()) { queueMicrotask(() => close.current()); return; }
    active?.dismiss(false);
    const previousFocus = document.activeElement;
    const overflow = document.body.style.overflow;
    const originalStyle = element.getAttribute("style");
    const inert = new Map<HTMLElement, boolean>();
    const targets = document.querySelectorAll<HTMLElement>('[data-native-app-surface], [data-native-app-bottom-nav]');
    for (const target of targets) { inert.set(target, target.inert); target.inert = true; }
    for (const launcher of document.querySelectorAll('[data-genie-open]')) {
      const dock = launcher.parentElement;
      if (dock) { inert.set(dock, dock.inert); dock.inert = true; }
    }
    const scrim = document.createElement("div"), probe = document.createElement("span");
    scrim.setAttribute("data-native-header-scrim", ""); scrim.setAttribute("aria-hidden", "true");
    Object.assign(scrim.style, { position:"fixed", zIndex:"70", left:"0", right:"0", bottom:"0", background:"rgb(0 0 0 / .28)", touchAction:"none" });
    Object.assign(probe.style, { position:"fixed", top:"var(--cg-app-chrome-clearance,88px)", width:"0", height:"0", visibility:"hidden", pointerEvents:"none" });
    document.body.append(scrim, probe);
    document.body.style.overflow = "hidden";
    let frame = 0, released = false;
    const viewport = window.visualViewport;
    const position = () => {
      const top = probe.getBoundingClientRect().top;
      const bottom = (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight);
      Object.assign(element.style, { top:`${top}px`, bottom:"auto", maxHeight:`${Math.max(44,bottom-top-12)}px`, zIndex:"90" });
      scrim.style.top = `${top}px`;
    };
    const controls = () => Array.from(document.querySelectorAll<HTMLElement>('[data-native-app-navbar] a[href],[data-native-app-navbar] button'))
      .concat(Array.from(element.querySelectorAll<HTMLElement>('a[href],button,input,textarea,select,[tabindex="0"]')))
      .filter(node => !node.matches(':disabled,[aria-disabled="true"]') && !node.closest('[inert]') && node.getClientRects().length > 0);
    const focusSurface = () => (element.querySelector<HTMLElement>('[data-native-header-initial-focus]') ?? element.querySelector<HTMLElement>('input,textarea,button:not(:disabled),a[href]') ?? element).focus({ preventScroll:true });
    const release = (restore = true) => {
      if (released) return;
      released = true; cancelAnimationFrame(frame);
      if (element.open) element.close();
      scrim.remove(); probe.remove();
      for (const [target, wasInert] of inert) target.inert = wasInert;
      document.body.style.overflow = overflow;
      if (originalStyle === null) element.removeAttribute("style"); else element.setAttribute("style", originalStyle);
      if (active === lease) { active = null; publish(); }
      if (restore && previousFocus instanceof HTMLElement) requestAnimationFrame(() => {
        if (!active && !nativeHeaderBlocked() && previousFocus.isConnected) previousFocus.focus({ preventScroll:true });
      });
    };
    const dismiss = (restore = true) => { release(restore); close.current(); };
    const lease: Lease = { kind, dismiss };
    active = lease;
    element.setAttribute("data-native-header-utility", kind);
    element.show(); position(); publish();
    frame = requestAnimationFrame(() => { if (!released) focusSurface(); });
    const beforeNavigation = () => dismiss(false);
    const scrimDown = (event: PointerEvent) => { event.preventDefault(); event.stopPropagation(); dismiss(); };
    const key = (event: KeyboardEvent) => {
      if (released || nativeHeaderBlocked()) return;
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); dismiss(); return; }
      if (event.key !== "Tab") return;
      const available = controls();
      if (!available.length) return;
      event.preventDefault();
      const index = available.indexOf(document.activeElement as HTMLElement);
      const next = index < 0 ? (event.shiftKey ? available.length - 1 : 0) : (index + (event.shiftKey ? -1 : 1) + available.length) % available.length;
      available[next].focus({ preventScroll:true });
    };
    const focus = (event: FocusEvent) => {
      const target = event.target;
      if (!released && target instanceof Node && !element.contains(target) && !(target instanceof Element && target.closest('[data-native-app-navbar]')) && !nativeHeaderBlocked()) focusSurface();
    };
    scrim.addEventListener("pointerdown", scrimDown);
    document.addEventListener("keydown", key); document.addEventListener("focusin", focus);
    window.addEventListener(BEFORE_FORM_NAVIGATION_EVENT, beforeNavigation); window.addEventListener("popstate", beforeNavigation);
    window.addEventListener("resize", position); viewport?.addEventListener("resize", position); viewport?.addEventListener("scroll", position);
    return () => {
      scrim.removeEventListener("pointerdown", scrimDown);
      document.removeEventListener("keydown", key); document.removeEventListener("focusin", focus);
      window.removeEventListener(BEFORE_FORM_NAVIGATION_EVENT, beforeNavigation); window.removeEventListener("popstate", beforeNavigation);
      window.removeEventListener("resize", position); viewport?.removeEventListener("resize", position); viewport?.removeEventListener("scroll", position);
      element.removeAttribute("data-native-header-utility"); release();
    };
  }, [ref, enabled, kind]);
}
