"use client";

import { useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { floatingPanelPosition } from "@/lib/floating-panel-position";

/** Body portal escapes clipped and isolated headers while retaining the original trigger. */
export default function FloatingPanel({ anchorRef, onClose, children, className = "", width = 208, align = "right", matchAnchorWidth = false, id, label }: {
  anchorRef: RefObject<HTMLElement | null>; onClose: () => void; children: ReactNode;
  className?: string; width?: number; align?: "left" | "right"; matchAnchorWidth?: boolean; id?: string; label?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useLayoutEffect(() => { closeRef.current = onClose; }, [onClose]);
  useLayoutEffect(() => {
    const panel = panelRef.current, anchor = anchorRef.current;
    if (!panel || !anchor) return;
    const position = () => {
      const viewport = window.visualViewport;
      const bounds = anchor.getBoundingClientRect();
      const result = floatingPanelPosition(bounds, {
        left: viewport?.offsetLeft ?? 0, top: viewport?.offsetTop ?? 0,
        width: viewport?.width ?? document.documentElement.clientWidth,
        height: viewport?.height ?? window.innerHeight,
        bottomInset: window.innerWidth < 1024 ? 88 : 12,
      }, matchAnchorWidth ? Math.max(width, bounds.width) : width, panel.scrollHeight, align);
      Object.assign(panel.style, {
        left: result.left + "px", top: result.top + "px", width: result.width + "px",
        maxHeight: result.maxHeight + "px", visibility: "visible",
      });
      panel.dataset.placement = result.placement;
    };
    position();
    const observer = new ResizeObserver(position);
    observer.observe(panel); observer.observe(anchor);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    window.visualViewport?.addEventListener("resize", position);
    window.visualViewport?.addEventListener("scroll", position);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
      window.visualViewport?.removeEventListener("resize", position);
      window.visualViewport?.removeEventListener("scroll", position);
    };
  }, [anchorRef, width, align, matchAnchorWidth]);

  useLayoutEffect(() => {
    const panel = panelRef.current, anchor = anchorRef.current;
    if (!panel || !anchor) return;
    panel.querySelector<HTMLElement>("input, button:not(:disabled), a[href], select, textarea")?.focus({ preventScroll: true });
    const outside = (event: Event) => {
      if (event.target instanceof Node && !panel.contains(event.target) && !anchor.contains(event.target)) closeRef.current();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); closeRef.current(); anchor.focus({ preventScroll: true }); }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", outside);
      document.removeEventListener("keydown", escape);
      if (panel.contains(document.activeElement)) anchor.focus({ preventScroll: true });
    };
  }, [anchorRef]);

  if (typeof document === "undefined") return null;
  return createPortal(<div ref={panelRef} id={id} role={label ? "group" : undefined} aria-label={label}
    style={{ position: "fixed", visibility: "hidden", width }}
    className={`z-[80] overflow-y-auto overscroll-contain ${className}`}>{children}</div>, document.body);
}
