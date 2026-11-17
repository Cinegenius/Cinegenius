"use client";

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";

const INTERACTIVE = 'button, a, input, textarea, select, label, summary, [role="button"], [role="option"], [role="slider"], [contenteditable="true"]';

/** Touch-only dismissal; leave form controls and ordinary scrolling to the browser. */
export function useSwipeDismiss(surfaceRef: RefObject<HTMLElement | null>, enabled: boolean, onDismiss: () => void) {
  const dismiss = useRef(onDismiss);
  useLayoutEffect(() => { dismiss.current = onDismiss; }, [onDismiss]);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!enabled || !surface) return;
    let gesture: { id: number; x: number; y: number; distance: number; active: boolean } | null = null;
    let frame = 0;
    let animation: Animation | null = null;
    let suppressClickUntil = 0;
    const originalTransform = surface.style.transform;
    const originalWillChange = surface.style.willChange;

    const restore = () => {
      cancelAnimationFrame(frame); frame = 0;
      surface.style.transform = originalTransform;
      surface.style.willChange = originalWillChange;
    };
    const settle = (distance: number, close: boolean) => {
      cancelAnimationFrame(frame); frame = 0;
      const end = close ? Math.max(distance, window.innerHeight - surface.getBoundingClientRect().top + distance + 24) : 0;
      const finish = () => {
        animation?.cancel(); animation = null;
        restore();
        if (close) dismiss.current();
      };
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { finish(); return; }
      animation = surface.animate([
        { transform: `translateY(${distance}px)` },
        { transform: `translateY(${end}px)` },
      ], { duration: close ? 180 : 160, easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards" });
      animation.onfinish = finish;
    };
    const cancel = () => {
      const current = gesture; gesture = null;
      if (current?.active) settle(current.distance, false);
    };
    const start = (event: TouchEvent) => {
      if (event.touches.length !== 1) { cancel(); return; }
      if (animation || !(event.target instanceof Element)) return;
      const target = event.target;
      if (target.closest(INTERACTIVE) || !surface.contains(target)) return;
      // A header/handle can always move the sheet. Content must be at its start;
      // a gesture which started in a scrolled list never turns into dismissal.
      if (!target.closest("[data-swipe-dismiss-handle]")) {
        for (let node: Element | null = target; node && node !== surface; node = node.parentElement) {
          if (node.scrollTop > 1) return;
        }
      }
      const touch = event.touches[0];
      gesture = { id: touch.identifier, x: touch.clientX, y: touch.clientY, distance: 0, active: false };
    };
    const move = (event: TouchEvent) => {
      const current = gesture;
      if (!current) return;
      if (event.touches.length !== 1) { cancel(); return; }
      const touch = Array.from(event.touches).find(item => item.identifier === current.id);
      if (!touch) { cancel(); return; }
      const dx = touch.clientX - current.x, dy = touch.clientY - current.y;
      if (!current.active) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return;
        if (dy <= 0 || dy < Math.abs(dx) * 1.25 || !event.cancelable) { gesture = null; return; }
        current.active = true;
        surface.style.willChange = "transform";
      }
      if (!event.cancelable) { cancel(); return; }
      event.preventDefault();
      current.distance = Math.max(0, dy);
      suppressClickUntil = performance.now() + 500;
      if (!frame) frame = requestAnimationFrame(() => {
        frame = 0;
        if (gesture?.active) surface.style.transform = `translateY(${gesture.distance}px)`;
      });
    };
    const end = (event: TouchEvent) => {
      const current = gesture;
      if (!current || !Array.from(event.changedTouches).some(touch => touch.identifier === current.id)) return;
      gesture = null;
      if (current.active) settle(current.distance, current.distance >= 72);
    };
    const click = (event: MouseEvent) => {
      if (event.detail > 0 && performance.now() < suppressClickUntil) { event.preventDefault(); event.stopPropagation(); }
    };
    surface.addEventListener("touchstart", start, { passive: true });
    surface.addEventListener("touchmove", move, { passive: false });
    surface.addEventListener("touchend", end, { passive: true });
    surface.addEventListener("touchcancel", cancel, { passive: true });
    surface.addEventListener("click", click, true);
    return () => {
      surface.removeEventListener("touchstart", start);
      surface.removeEventListener("touchmove", move);
      surface.removeEventListener("touchend", end);
      surface.removeEventListener("touchcancel", cancel);
      surface.removeEventListener("click", click, true);
      if (animation) { animation.onfinish = null; animation.cancel(); }
      restore();
    };
  }, [surfaceRef, enabled]);
}
