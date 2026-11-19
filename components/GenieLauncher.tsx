"use client";

import { useCallback, useEffect, useRef, type ReactNode, type RefObject, type PointerEvent } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useNativeAppAppearance } from "@/lib/use-native-app-appearance";
import { GENIE_FLIGHT_MS, genieFlightPosition, launchGenieFlight, type GenieBounds, type GenieFlight } from "@/lib/genie-flight";
import styles from "./Genie.module.css";

export type GeniePosition = { x: number; y: number };
type Sample = GeniePosition & { at: number };
type Drag = { id: number; x: number; y: number; origin: GeniePosition; moved: boolean; target: HTMLButtonElement; samples: Sample[] };

// Placement remains a UI preference for this document only. No storage or requests.
export default function GenieLauncher({ children, position, visible, onHide, onMoveStart, onPositionChange }: {
  children: ReactNode;
  position: RefObject<GeniePosition | null>;
  visible: boolean;
  onHide: () => void;
  onMoveStart: () => void;
  onPositionChange: (point: GeniePosition) => void;
}) {
  const t = useTranslations("Genie");
  const native = useNativeAppAppearance();
  const dock = useRef<HTMLDivElement>(null);
  const bounds = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const frame = useRef<number | null>(null);
  const pending = useRef<GeniePosition | null>(null);
  const flight = useRef<GenieFlight | null>(null);
  const flightFrame = useRef<number | null>(null);
  const reducedMotion = useRef(true);
  const suppressClick = useRef(false);

  const readBounds = useCallback((): GenieBounds | null => {
    if (!dock.current || !bounds.current) return null;
    const area = bounds.current.getBoundingClientRect(), size = dock.current.getBoundingClientRect();
    const viewport = window.visualViewport;
    const left = Math.max(area.left, (viewport?.offsetLeft ?? 0) + 8);
    const right = Math.min(area.right, (viewport?.offsetLeft ?? 0) + (viewport?.width ?? window.innerWidth) - 8);
    const bottom = Math.min(area.bottom, (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight) - 8);
    const top = Math.min(Math.max(area.top, (viewport?.offsetTop ?? 0) + 40), bottom - size.height);
    return { left, right: Math.max(left, right - size.width), top, bottom: Math.max(top, bottom - size.height) };
  }, []);

  const place = useCallback((point: GeniePosition) => {
    const area = readBounds();
    if (!dock.current || !area) return;
    const next = {
      x: Math.max(area.left, Math.min(point.x, area.right)),
      y: Math.max(area.top, Math.min(point.y, area.bottom)),
    };
    onPositionChange(next);
    Object.assign(dock.current.style, { left: `${next.x}px`, top: `${next.y}px`, right: "auto", bottom: "auto" });
  }, [readBounds, onPositionChange]);

  const stopMotion = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    if (flightFrame.current !== null) cancelAnimationFrame(flightFrame.current);
    if (pending.current) place(pending.current);
    frame.current = flightFrame.current = null;
    pending.current = null;
    flight.current = null;
    dock.current?.removeAttribute("data-flying");
  }, [place]);

  const cancelGesture = useCallback(() => {
    stopMotion();
    const gesture = drag.current;
    drag.current = null;
    if (gesture?.moved) suppressClick.current = true;
    if (gesture?.target.hasPointerCapture(gesture.id)) gesture.target.releasePointerCapture(gesture.id);
    dock.current?.removeAttribute("data-dragging");
  }, [stopMotion]);

  const schedule = useCallback((point: GeniePosition) => {
    pending.current = point;
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      if (pending.current) place(pending.current);
      pending.current = null;
    });
  }, [place]);

  useEffect(() => {
    if (!visible) return;
    const constrain = () => {
      if (native) cancelGesture();
      if (position.current) schedule(position.current);
    };
    if (position.current) place(position.current);
    const observer = new ResizeObserver(constrain);
    if (dock.current) observer.observe(dock.current);
    if (bounds.current) observer.observe(bounds.current);
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotion.current = motion.matches;
    const motionChanged = () => { reducedMotion.current = motion.matches; if (motion.matches) cancelGesture(); };
    const background = () => { if (document.hidden) cancelGesture(); };
    const otherPointer = (event: globalThis.PointerEvent) => {
      if (!event.isPrimary || (flight.current && !dock.current?.contains(event.target as Node))) cancelGesture();
    };
    const inertObserver = new MutationObserver(() => { if (dock.current?.inert) cancelGesture(); });
    if (native && dock.current) inertObserver.observe(dock.current, { attributes: true, attributeFilter: ["inert"] });
    window.addEventListener("resize", constrain);
    window.visualViewport?.addEventListener("resize", constrain);
    window.visualViewport?.addEventListener("scroll", constrain);
    if (native) {
      motion.addEventListener("change", motionChanged);
      document.addEventListener("visibilitychange", background);
      window.addEventListener("pagehide", cancelGesture);
      window.addEventListener("blur", cancelGesture);
      window.addEventListener("pointerdown", otherPointer, true);
    }
    return () => {
      observer.disconnect(); inertObserver.disconnect();
      window.removeEventListener("resize", constrain);
      window.visualViewport?.removeEventListener("resize", constrain);
      window.visualViewport?.removeEventListener("scroll", constrain);
      motion.removeEventListener("change", motionChanged);
      document.removeEventListener("visibilitychange", background);
      window.removeEventListener("pagehide", cancelGesture);
      window.removeEventListener("blur", cancelGesture);
      window.removeEventListener("pointerdown", otherPointer, true);
      cancelGesture();
    };
  }, [visible, native, position, place, schedule, cancelGesture]);

  const sample = (gesture: Drag, event: PointerEvent<HTMLDivElement>) => {
    const at = event.timeStamp;
    if (!Number.isFinite(at) || at <= (gesture.samples.at(-1)?.at ?? -Infinity)) return;
    gesture.samples.push({ x: event.clientX, y: event.clientY, at });
    gesture.samples = gesture.samples.filter(point => at - point.at <= 120).slice(-12);
  };

  const move = (event: PointerEvent<HTMLDivElement>) => {
    const gesture = drag.current;
    if (!gesture || gesture.id !== event.pointerId) return;
    if (native) sample(gesture, event);
    const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
    if (!gesture.moved && Math.hypot(dx, dy) < 6) return;
    if (!gesture.moved) onMoveStart();
    gesture.moved = true;
    schedule({ x: gesture.origin.x + dx, y: gesture.origin.y + dy });
  };

  const end = (event: PointerEvent<HTMLDivElement>) => {
    const gesture = drag.current;
    if (!gesture || gesture.id !== event.pointerId) return;
    if (event.type === "pointerup") move(event);
    stopMotion();
    drag.current = null; // Intentional capture release must not cancel the new flight.
    if (gesture.target.hasPointerCapture(event.pointerId)) gesture.target.releasePointerCapture(event.pointerId);
    dock.current?.removeAttribute("data-dragging");
    if (!gesture.moved) return;
    suppressClick.current = true;
    event.preventDefault();
    if (!native || reducedMotion.current || event.type !== "pointerup" || !dock.current || dock.current.inert) return;
    const first = gesture.samples[0], last = gesture.samples.at(-1);
    const elapsed = first && last ? last.at - first.at : 0;
    const area = readBounds(), rect = dock.current.getBoundingClientRect();
    if (!first || !last || elapsed < 8 || !area) return;
    const launched = launchGenieFlight({ x: rect.left, y: rect.top }, { x: (last.x - first.x) * 1000 / elapsed, y: (last.y - first.y) * 1000 / elapsed }, performance.now(), area);
    if (!launched) return;
    flight.current = launched;
    dock.current.setAttribute("data-flying", "");
    const tick = (now: number) => {
      flightFrame.current = null;
      if (flight.current !== launched) return;
      place(genieFlightPosition(launched, now));
      if (now - launched.startedAt < GENIE_FLIGHT_MS) flightFrame.current = requestAnimationFrame(tick);
      else { flight.current = null; dock.current?.removeAttribute("data-flying"); }
    };
    flightFrame.current = requestAnimationFrame(tick);
  };

  return <>
    <div ref={bounds} className={styles.launcherBounds} aria-hidden="true" />
    <div ref={dock} hidden={!visible} className={styles.launcherDock}
      onPointerDown={event => {
        const target = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-genie-open]");
        if (!event.isPrimary || event.button !== 0 || !target) return;
        stopMotion();
        const rect = event.currentTarget.getBoundingClientRect();
        suppressClick.current = false;
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, origin: { x: rect.left, y: rect.top }, moved: false, target, samples: [{ x: event.clientX, y: event.clientY, at: event.timeStamp }] };
        target.setPointerCapture(event.pointerId);
        event.currentTarget.setAttribute("data-dragging", "");
      }}
      onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}
      onClickCapture={event => {
        if (suppressClick.current && event.detail !== 0 && (event.target as HTMLElement).closest("[data-genie-open]")) {
          event.preventDefault(); event.stopPropagation();
        }
        suppressClick.current = false;
      }}
      onKeyDown={event => {
        if (!event.altKey || !(event.target as HTMLElement).closest("[data-genie-open]")) return;
        const directions: Record<string, GeniePosition> = { ArrowLeft: { x: -16, y: 0 }, ArrowRight: { x: 16, y: 0 }, ArrowUp: { x: 0, y: -16 }, ArrowDown: { x: 0, y: 16 } };
        const delta = directions[event.key];
        if (!delta || !dock.current) return;
        event.preventDefault(); event.stopPropagation();
        cancelGesture(); onMoveStart();
        const rect = dock.current.getBoundingClientRect();
        place({ x: rect.left + delta.x, y: rect.top + delta.y });
      }}>
      {children}
      <button type="button" className={styles.hideLauncher} aria-label={t("hideLauncher")} title={t("hideLauncher")} onClick={() => { cancelGesture(); onHide(); }}>
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  </>;
}
