"use client";

import { useCallback, useEffect, useRef, type ReactNode, type RefObject, type PointerEvent } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import styles from "./Genie.module.css";

export type GeniePosition = { x: number; y: number };

// Placement is a UI preference for this document only. No cookies, storage or requests.
export default function GenieLauncher({ children, position, visible, onHide, onMoveStart, onPositionChange }: {
  children: ReactNode;
  position: RefObject<GeniePosition | null>;
  visible: boolean;
  onHide: () => void;
  onMoveStart: () => void;
  onPositionChange: (point: GeniePosition) => void;
}) {
  const t = useTranslations("Genie");
  const dock = useRef<HTMLDivElement>(null);
  const bounds = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; origin: GeniePosition; moved: boolean } | null>(null);
  const frame = useRef<number | null>(null);
  const pending = useRef<GeniePosition | null>(null);
  const suppressClick = useRef(false);

  const place = useCallback((point: GeniePosition) => {
    if (!dock.current || !bounds.current) return;
    const area = bounds.current.getBoundingClientRect();
    const size = dock.current.getBoundingClientRect();
    const viewport = window.visualViewport;
    const left = Math.max(area.left, (viewport?.offsetLeft ?? 0) + 8);
    const right = Math.min(area.right, (viewport?.offsetLeft ?? 0) + (viewport?.width ?? window.innerWidth) - 8);
    const bottom = Math.min(area.bottom, (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight) - 8);
    const top = Math.min(Math.max(area.top, (viewport?.offsetTop ?? 0) + 40), bottom - size.height);
    const next = {
      x: Math.max(left, Math.min(point.x, right - size.width)),
      y: Math.max(top, Math.min(point.y, bottom - size.height)),
    };
    onPositionChange(next);
    Object.assign(dock.current.style, { left: `${next.x}px`, top: `${next.y}px`, right: "auto", bottom: "auto" });
  }, [onPositionChange]);

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
      if (position.current) schedule(position.current);
    };
    if (position.current) place(position.current);
    const observer = new ResizeObserver(constrain);
    if (dock.current) observer.observe(dock.current);
    if (bounds.current) observer.observe(bounds.current);
    window.addEventListener("resize", constrain);
    window.visualViewport?.addEventListener("resize", constrain);
    window.visualViewport?.addEventListener("scroll", constrain);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", constrain);
      window.visualViewport?.removeEventListener("resize", constrain);
      window.visualViewport?.removeEventListener("scroll", constrain);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
      pending.current = null;
      drag.current = null;
    };
  }, [visible, position, place, schedule]);

  const move = (event: PointerEvent<HTMLDivElement>) => {
    const gesture = drag.current;
    if (!gesture || gesture.id !== event.pointerId) return;
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
    if (gesture.moved) {
      if (pending.current) place(pending.current);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
      pending.current = null;
      suppressClick.current = true;
      event.preventDefault();
    }
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    dock.current?.removeAttribute("data-dragging");
  };

  return <>
    <div ref={bounds} className={styles.launcherBounds} aria-hidden="true" />
    <div ref={dock} hidden={!visible} className={styles.launcherDock}
      onPointerDown={event => {
        const target = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-genie-open]");
        if (!event.isPrimary || event.button !== 0 || !target) return;
        const rect = event.currentTarget.getBoundingClientRect();
        suppressClick.current = false;
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, origin: { x: rect.left, y: rect.top }, moved: false };
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
        onMoveStart();
        const rect = dock.current.getBoundingClientRect();
        place({ x: rect.left + delta.x, y: rect.top + delta.y });
      }}>
      {children}
      <button type="button" className={styles.hideLauncher} aria-label={t("hideLauncher")} title={t("hideLauncher")} onClick={onHide}>
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  </>;
}
