"use client";

import { useEffect, useLayoutEffect, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { Clapperboard, Images, Newspaper, PanelsTopLeft, Sparkles } from "lucide-react";
import { useFormNavigation } from "@/contexts/FormDraftContext";
import { NATIVE_APP_NAV_ITEMS, nativeAppActiveArea, type NativeAppArea } from "@/lib/native-app-navigation";
import styles from "./NativeAppBottomNav.module.css";

const icons = { shots: Images, workspace: PanelsTopLeft, smart: Sparkles, news: Newspaper, projects: Clapperboard };
const PREVIEW_EVENT = "cinegenius:native-navigation-preview";
// Event/lifecycle clock only; no time-dependent value is read during render.
const navigationTime = () => performance.now();
const clamp = (value: number) => Math.max(0, Math.min(4, value));
export function nativeNavigationPosition(x: number, left: number, width: number) {
  return width > 0 ? clamp((x - left) / (width / 5) - .5) : 2;
}
export function nativeNavigationIntent(dx: number, dy: number): "pending" | "vertical" | "horizontal" {
  if (Math.abs(dy) > 6 && Math.abs(dy) > Math.abs(dx) * 1.2) return "vertical";
  return Math.abs(dx) >= 6 ? "horizontal" : "pending";
}
type Gesture = { id: number; x: number; y: number; index: number; path: string; dragging: boolean; lastX: number; lastTime: number; velocity: number };
type Motion = { frame: number; position: number; target: number; velocity: number; rollback: ReturnType<typeof setTimeout> | undefined };

export default function NativeAppBottomNav({ pathname, label, labels }: {
  pathname: string;
  label: string;
  labels: Record<NativeAppArea, string>;
}) {
  const active = nativeAppActiveArea(pathname);
  const activeIndex = NATIVE_APP_NAV_ITEMS.findIndex(item => item.id === active);
  const base = activeIndex < 0 ? 2 : activeIndex;
  const nav = useRef<HTMLElement>(null), track = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const motion = useRef<Motion>({ frame: 0, position: base, target: base, velocity: 0, rollback: undefined });
  const suppressClick = useRef(0), reduced = useRef(false), baseRef = useRef(base);
  const router = useRouter(), { leave } = useFormNavigation(), locale = useLocale();

  function preview(value: number | null) { window.dispatchEvent(new CustomEvent(PREVIEW_EVENT, { detail: value })); }
  function paint(value: number) {
    motion.current.position = clamp(value);
    nav.current?.style.setProperty("--native-nav-index", String(motion.current.position));
    preview(motion.current.position);
  }
  function stop(clearRollback = true) {
    if (motion.current.frame) cancelAnimationFrame(motion.current.frame);
    motion.current.frame = 0;
    if (clearRollback) {
      if (motion.current.rollback) clearTimeout(motion.current.rollback);
      motion.current.rollback = undefined;
    }
    nav.current?.removeAttribute("data-native-nav-settling");
  }
  function settle(target: number, velocity = 0) {
    stop();
    const state = motion.current;
    state.target = clamp(target); state.velocity = velocity;
    if (reduced.current || document.hidden || Math.abs(state.position - target) < .001 && Math.abs(velocity) < .012) {
      paint(target); preview(null); return;
    }
    const lower = Math.max(0, Math.min(state.position, target) - .06);
    const upper = Math.min(4, Math.max(state.position, target) + .06);
    const started = navigationTime(); let previous = started;
    nav.current?.setAttribute("data-native-nav-settling", "true");
    const step = (now: number) => {
      const dt = Math.min((now - previous) / 1000, 1 / 30); previous = now;
      state.velocity += ((state.target - state.position) * 100 - state.velocity * 6.2 * 2.8) * dt;
      let next = state.position + state.velocity * dt;
      if (next < lower || next > upper) { next = Math.max(lower, Math.min(upper, next)); state.velocity *= -.30; }
      paint(next);
      if (now - started >= 850 || Math.abs(state.position - state.target) < .001 && Math.abs(state.velocity) < .012) {
        stop(false); paint(state.target); preview(null); return;
      }
      state.frame = requestAnimationFrame(step);
    };
    state.frame = requestAnimationFrame(step);
  }
  function clearGesture() {
    const prior = gesture.current; gesture.current = null;
    try { if (prior && nav.current?.hasPointerCapture(prior.id)) nav.current.releasePointerCapture(prior.id); } catch { /* Pointer ended during teardown. */ }
    nav.current?.removeAttribute("data-native-nav-dragging");
    nav.current?.removeAttribute("data-native-nav-pressing");
    nav.current?.querySelectorAll("[data-native-nav-pressed]").forEach(node => node.removeAttribute("data-native-nav-pressed"));
  }
  function cancel() { suppressClick.current = navigationTime() + 400; clearGesture(); stop(); paint(baseRef.current); preview(null); }
  function eligible() {
    return !!nav.current?.isConnected && !document.hidden && !nav.current.closest("[inert],[hidden]")
      && !Array.from(document.querySelectorAll<HTMLElement>('[aria-modal="true"]')).some(node => node.getClientRects().length > 0);
  }
  function choose(index: number, velocity: number, trusted: boolean) {
    const item = NATIVE_APP_NAV_ITEMS[index];
    if (!item || !trusted || !eligible()) { settle(baseRef.current); return; }
    const from = location.pathname + location.search;
    let committed = false;
    leave(() => {
      if (document.hidden || location.pathname + location.search !== from) return;
      committed = true;
      if (item.id === "workspace" && document.documentElement.getAttribute("data-cg-native-workspace-ready") === "v1" && window.top === window.self && location.protocol === "https:") {
        const bridge = (window as Window & { webkit?: { messageHandlers?: { cinegeniusWorkplace?: { postMessage: (value: { action: string; locale: string }) => void } } } }).webkit?.messageHandlers?.cinegeniusWorkplace;
        if (typeof bridge?.postMessage === "function") {
          try { bridge.postMessage({ action: "openWorkplace", locale }); settle(baseRef.current); return; }
          catch { /* The real route remains usable when the native bridge disappears. */ }
        }
      }
      settle(index, velocity);
      if (from !== item.href) router.push(item.href, { scroll: false });
      // A cancelled/failed router transition must not leave a false selection.
      motion.current.rollback = setTimeout(() => { motion.current.rollback = undefined; if (location.pathname + location.search === from) { stop(); paint(baseRef.current); preview(null); } }, 2000);
    });
    if (!committed) settle(baseRef.current);
  }
  function pointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (!event.isPrimary) { cancel(); return; }
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || !eligible()) return;
    const cell = (event.target as Element).closest<HTMLElement>("[data-native-app-area]");
    const index = NATIVE_APP_NAV_ITEMS.findIndex(item => item.id === cell?.dataset.nativeAppArea);
    if (index < 0) return;
    clearGesture(); stop();
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, index, path: location.pathname + location.search, dragging: false, lastX: event.clientX, lastTime: navigationTime(), velocity: 0 };
    nav.current?.setAttribute("data-native-nav-pressing", "true"); cell?.setAttribute("data-native-nav-pressed", "true");
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Keyboard and ordinary link fallback remain available. */ }
  }
  function pointerMove(event: ReactPointerEvent<HTMLElement>) {
    const current = gesture.current;
    if (!current || current.id !== event.pointerId) return;
    if (!eligible() || current.path !== location.pathname + location.search) { cancel(); return; }
    const dx = event.clientX - current.x, dy = event.clientY - current.y;
    if (!current.dragging) {
      const intent = nativeNavigationIntent(dx, dy);
      if (intent === "vertical") { suppressClick.current = navigationTime() + 400; cancel(); return; }
      if (intent === "pending") return;
      current.dragging = true; nav.current?.setAttribute("data-native-nav-dragging", "true");
    }
    if (Math.abs(dy) > 70) { cancel(); return; }
    event.preventDefault();
    const bounds = track.current?.getBoundingClientRect(); if (!bounds) return;
    const now = navigationTime(), dt = now - current.lastTime;
    if (dt > 0) current.velocity = Math.max(-1600, Math.min(1600, (event.clientX - current.lastX) / dt * 1000));
    current.lastX = event.clientX; current.lastTime = now;
    paint(nativeNavigationPosition(event.clientX, bounds.left, bounds.width));
  }
  function pointerUp(event: ReactPointerEvent<HTMLElement>) {
    const current = gesture.current;
    if (!current || current.id !== event.pointerId) return;
    event.preventDefault(); suppressClick.current = navigationTime() + 400;
    const bounds = track.current?.getBoundingClientRect();
    const valid = current.path === location.pathname + location.search && Math.abs(event.clientY - current.y) <= (current.dragging ? 70 : 6);
    const index = current.dragging && bounds ? Math.round(nativeNavigationPosition(event.clientX, bounds.left, bounds.width)) : current.index;
    const velocity = current.dragging && bounds && navigationTime() - current.lastTime < 100 && Math.abs(current.velocity) >= 65 ? Math.max(-10, Math.min(10, current.velocity / (bounds.width / 5))) : 0;
    clearGesture();
    if (valid) choose(index, velocity, event.isTrusted); else settle(baseRef.current);
  }

  useLayoutEffect(() => {
    baseRef.current = base;
    clearGesture();
    if (motion.current.frame && motion.current.target === base) {
      if (motion.current.rollback) clearTimeout(motion.current.rollback);
      motion.current.rollback = undefined;
      paint(motion.current.position);
    }
    else { stop(); paint(base); preview(null); }
    // Route changes are commits, not another gesture or a private history record.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, base]);
  useEffect(() => {
    const element = nav.current;
    element?.setAttribute("data-native-app-gesture-ready", "v1");
    const media = window.matchMedia("(prefers-reduced-motion: reduce)"); reduced.current = media.matches;
    const reset = () => cancel();
    const visibility = () => { if (document.hidden) reset(); };
    const preference = () => { reduced.current = media.matches; reset(); };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("blur", reset); window.addEventListener("pagehide", reset); window.addEventListener("resize", reset);
    media.addEventListener("change", preference);
    return () => {
      clearGesture(); stop(); preview(null); element?.removeAttribute("data-native-app-gesture-ready");
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("blur", reset); window.removeEventListener("pagehide", reset); window.removeEventListener("resize", reset);
      media.removeEventListener("change", preference);
    };
    // Functions intentionally read the active route of this listener generation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <nav ref={nav} data-native-app-bottom-nav="v1" aria-label={label} className={styles.navigation}
    data-native-nav-active={activeIndex >= 0} style={{ "--native-nav-index": base } as CSSProperties}
    onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp}
    onPointerCancel={() => { suppressClick.current = navigationTime() + 400; cancel(); }}
    onLostPointerCapture={() => { if (gesture.current) cancel(); }} onDragStart={event => event.preventDefault()}
    onClickCapture={event => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault(); event.stopPropagation();
      if (navigationTime() < suppressClick.current) return;
      const id = (event.target as Element).closest<HTMLElement>("[data-native-app-area]")?.dataset.nativeAppArea;
      const index = NATIVE_APP_NAV_ITEMS.findIndex(item => item.id === id);
      choose(index, 0, event.isTrusted);
    }}>
    <div ref={track} className={styles.track}>
      <span aria-hidden="true" className={styles.indicator} />
      {NATIVE_APP_NAV_ITEMS.map((item, index) => {
        const Icon = icons[item.id];
        return <Link key={item.id} href={item.href} prefetch={false} draggable={false}
          data-native-app-area={item.id} aria-current={item.id === active ? "page" : undefined}
          onKeyDown={event => { if (event.key === "Enter" && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); suppressClick.current = navigationTime() + 400; choose(index, 0, event.isTrusted); } }}
          className={`${styles.item} ${item.id === "smart" ? styles.smart : ""}`}>
          <Icon size={21} aria-hidden="true" /><span className={styles.label}>{labels[item.id]}</span>
        </Link>;
      })}
    </div>
  </nav>;
}
