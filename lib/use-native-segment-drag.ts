"use client";

import { useEffect, useLayoutEffect, useRef, type DragEvent, type MouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { useNativeAppAppearance } from "./use-native-app-appearance";

type Gesture = { id: number; x: number; y: number; dragging: boolean; path: string };

/** Preview locally; only a completed horizontal drag invokes the existing choice. */
export function useNativeSegmentDrag(selection: string, onChoose: (index: number) => void) {
  const enabled = useNativeAppAppearance();
  const ref = useRef<HTMLDivElement>(null), gesture = useRef<Gesture | null>(null);
  const suppressed = useRef(0), choose = useRef(onChoose);
  useLayoutEffect(() => { choose.current = onChoose; });
  const buttons = () => Array.from(ref.current?.querySelectorAll<HTMLButtonElement>("button[data-native-segment]") ?? []);
  function paint(button: HTMLButtonElement | undefined) {
    const rail = ref.current;
    rail?.querySelectorAll("[data-native-segment-preview]").forEach(node => node.removeAttribute("data-native-segment-preview"));
    if (!rail || !button) return;
    button.setAttribute("data-native-segment-preview", "true");
    rail.style.setProperty("--native-segment-x", `${button.offsetLeft}px`);
    rail.style.setProperty("--native-segment-width", `${button.offsetWidth}px`);
  }
  function reset() {
    const current = gesture.current; gesture.current = null;
    const rail = ref.current;
    rail?.removeAttribute("data-native-segment-dragging");
    paint(buttons().find(button => button.getAttribute("aria-pressed") === "true"));
    rail?.querySelectorAll("[data-native-segment-preview]").forEach(node => node.removeAttribute("data-native-segment-preview"));
    try { if (current && rail?.hasPointerCapture(current.id)) rail.releasePointerCapture(current.id); } catch { /* Pointer already ended. */ }
  }
  function cancel() { if (gesture.current) suppressed.current = performance.now() + 500; reset(); }
  function eligible() {
    const rail = ref.current;
    return enabled && !!rail?.isConnected && !document.hidden && !rail.closest("[inert],[hidden]")
      && !Array.from(document.querySelectorAll<HTMLElement>('[aria-modal="true"],dialog[open]')).some(node => node.getClientRects().length > 0);
  }
  function hit(x: number, y: number) {
    return buttons().find(button => { const box = button.getBoundingClientRect(); return !button.disabled && x >= box.left && x <= box.right && y >= box.top && y <= box.bottom; });
  }
  useLayoutEffect(() => { if (gesture.current) cancel(); else reset(); }, [selection, enabled]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!enabled) return;
    const visibility = () => { if (document.hidden) cancel(); };
    window.addEventListener("blur", cancel); window.addEventListener("resize", cancel); window.addEventListener("pagehide", cancel);
    document.addEventListener("visibilitychange", visibility);
    return () => { reset(); window.removeEventListener("blur", cancel); window.removeEventListener("resize", cancel); window.removeEventListener("pagehide", cancel); document.removeEventListener("visibilitychange", visibility); };
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    ref,
    onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
      if (!enabled) return;
      if (!event.isPrimary) { cancel(); return; }
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || !eligible() || !hit(event.clientX, event.clientY)) return;
      reset(); suppressed.current = 0;
      gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, dragging: false, path: location.pathname + location.search };
    },
    onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
      const current = gesture.current; if (!current || current.id !== event.pointerId) return;
      const dx = event.clientX - current.x, dy = event.clientY - current.y;
      if (!eligible() || current.path !== location.pathname + location.search || Math.abs(dy) > 70 || !current.dragging && Math.abs(dy) > 6 && Math.abs(dy) > Math.abs(dx) * 1.2) { cancel(); return; }
      if (!current.dragging) {
        if (Math.abs(dx) < 8) return;
        current.dragging = true; ref.current?.setAttribute("data-native-segment-dragging", "true");
        try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Ordinary buttons remain usable. */ }
      }
      event.preventDefault();
      const target = hit(event.clientX, event.clientY);
      paint(target);
      const rail = ref.current, choices = buttons();
      if (rail && target) {
        const bounds = rail.getBoundingClientRect(), first = choices[0], last = choices.at(-1);
        const width = target.offsetWidth;
        const x = Math.max(first.offsetLeft, Math.min((last?.offsetLeft ?? 0) + (last?.offsetWidth ?? 0) - width, event.clientX - bounds.left - width / 2));
        rail.style.setProperty("--native-segment-x", `${x}px`);
      }
    },
    onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
      const current = gesture.current; if (!current || current.id !== event.pointerId) return;
      if (!current.dragging) { reset(); return; }
      event.preventDefault(); suppressed.current = performance.now() + 500;
      const target = eligible() && current.path === location.pathname + location.search && Math.abs(event.clientY - current.y) <= 70 ? hit(event.clientX, event.clientY) : undefined;
      const index = target ? buttons().indexOf(target) : -1;
      reset();
      if (index >= 0) choose.current(index);
    },
    onPointerCancel: cancel,
    onLostPointerCapture(event: ReactPointerEvent<HTMLDivElement>) {
      // Touch starts with implicit capture on the button. Its transfer to this
      // rail bubbles a descendant loss; only losing the rail's capture cancels.
      if (event.target === event.currentTarget && gesture.current) cancel();
    },
    onClickCapture(event: MouseEvent<HTMLDivElement>) {
      if (event.detail > 0 && performance.now() < suppressed.current) { suppressed.current = 0; event.preventDefault(); event.stopPropagation(); }
    },
    onDragStart(event: DragEvent<HTMLDivElement>) { if (enabled) event.preventDefault(); },
  };
}
