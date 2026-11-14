"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import styles from "./HomeCardRail.module.css";

type Props = {
  id: string;
  labelledBy: string;
  hint: string;
  itemCount: number;
  variant: "crew" | "location";
  wide?: boolean;
  children: ReactNode;
};

/** Only the scroll controls hydrate; the permission-checked cards stay server rendered. */
export default function HomeCardRail({ id, labelledBy, hint, itemCount, variant, wide = false, children }: Props) {
  const t = useTranslations("home");
  const trackRef = useRef<HTMLDivElement>(null);
  const stopsRef = useRef<number[]>([]);
  const stepRef = useRef(1);
  const gestureRef = useRef<{ id: number; x: number; y: number; left: number; dragging: boolean } | null>(null);
  const suppressClick = useRef(false);
  const animationFrame = useRef(0);
  const [position, setPosition] = useState({ active: 0, pages: Math.max(1, itemCount) });
  const [scrubWindow, setScrubWindow] = useState<number | null>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let frame = 0;
    function updatePosition() {
      if (!track) return;
      const stops = stopsRef.current;
      const active = stops.reduce((nearest, offset, index) => Math.abs(offset - track.scrollLeft) < Math.abs(stops[nearest] - track.scrollLeft) ? index : nearest, 0);
      setPosition(current => current.active === active && current.pages === stops.length ? current : { active, pages: stops.length });
    }
    function measure() {
      if (!track) return;
      const maximum = Math.max(0, track.scrollWidth - track.clientWidth);
      const first = track.firstElementChild as HTMLElement | null;
      const gap = Number.parseFloat(getComputedStyle(track).columnGap) || 0;
      const step = Math.max(1, first ? first.getBoundingClientRect().width + gap : track.clientWidth);
      stepRef.current = step;
      const stops = maximum <= 2 ? [0] : Array.from({ length: Math.ceil(maximum / step) + 1 }, (_, index) => Math.min(index * step, maximum));
      stopsRef.current = stops;
      updatePosition();
    }
    function onScroll() {
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; updatePosition(); });
    }
    measure();
    track.addEventListener("scroll", onScroll, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    if (track.firstElementChild) observer.observe(track.firstElementChild);
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(animationFrame.current);
      track.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, [itemCount]);

  function settle(left: number, instant = false) {
    const track = trackRef.current;
    if (!track) return;
    cancelAnimationFrame(animationFrame.current);
    const from = track.scrollLeft;
    const target = Math.max(0, Math.min(left, track.scrollWidth - track.clientWidth));
    // Keep native snapping off until the animated landing is complete. Restoring
    // it on pointerup makes the browser jump straight to the next card.
    track.dataset.scrubbing = "true";
    const finish = () => {
      track.scrollTo({ left: target, behavior: "instant" });
      delete track.dataset.scrubbing;
      animationFrame.current = 0;
      setScrubWindow(null);
    };
    if (instant || window.matchMedia("(prefers-reduced-motion: reduce)").matches || Math.abs(target - from) < 1) {
      finish();
      return;
    }
    const duration = Math.min(420, Math.max(220, Math.abs(target - from) * 0.3));
    let started: number | undefined;
    const animate = (time: number) => {
      started ??= time;
      const progress = Math.min(1, (time - started) / duration);
      track.scrollTo({ left: from + (target - from) * (1 - Math.pow(1 - progress, 3)), behavior: "instant" });
      if (progress < 1) animationFrame.current = requestAnimationFrame(animate);
      else finish();
    };
    animationFrame.current = requestAnimationFrame(animate);
  }

  function move(page: number) {
    setScrubWindow(firstDot);
    settle(stopsRef.current[page] ?? 0);
  }

  // A sliding window keeps the real page positions reachable within 320px.
  const firstDot = scrubWindow ?? Math.max(0, Math.min(position.active - 2, position.pages - 5));
  const dots = Array.from({ length: Math.min(position.pages, 5) }, (_, index) => firstDot + index);

  function startScrub(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.button !== 0 || !trackRef.current) return;
    suppressClick.current = false;
    gestureRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, left: trackRef.current.scrollLeft, dragging: false };
  }

  function scrub(event: PointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current, track = trackRef.current;
    if (!gesture || !track || gesture.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
    if (!gesture.dragging) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return;
      // Leave vertical swipes to ordinary page scrolling.
      if (Math.abs(dy) > Math.abs(dx)) { gestureRef.current = null; return; }
      gesture.dragging = true;
      cancelAnimationFrame(animationFrame.current);
      animationFrame.current = 0;
      gesture.left = track.scrollLeft;
      // Discard the intent threshold instead of amplifying its first 8px into
      // a visible jump. Subsequent motion follows the finger continuously.
      gesture.x = event.clientX;
      track.dataset.scrubbing = "true";
      event.currentTarget.dataset.scrubbing = "true";
      event.currentTarget.setPointerCapture(event.pointerId);
      setScrubWindow(firstDot);
    }
    event.preventDefault();
    suppressClick.current = true;
    // One dot's touch area corresponds to one card; follow the finger directly.
    track.scrollTo({ left: gesture.left - (event.clientX - gesture.x) * stepRef.current / 44, behavior: "instant" });
  }

  function endScrub(event: PointerEvent<HTMLDivElement>) {
    // Touch capture moves from the pressed dot to the whole controls row.
    if (event.type === "lostpointercapture" && event.target !== event.currentTarget) return;
    const gesture = gestureRef.current, track = trackRef.current;
    if (!gesture || gesture.id !== event.pointerId) return;
    gestureRef.current = null;
    delete event.currentTarget.dataset.scrubbing;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!gesture.dragging || !track) return;
    const stops = stopsRef.current;
    const nearest = stops.reduce((best, stop) => Math.abs(stop - track.scrollLeft) < Math.abs(best - track.scrollLeft) ? stop : best, 0);
    settle(nearest, event.type !== "pointerup");
  }

  return <div className={`${styles.root} ${styles[variant]} ${wide ? styles.wide : ""}`}>
    <div ref={trackRef} id={id} role="region" aria-labelledby={labelledBy} aria-describedby={position.pages > 1 ? `${id}-hint` : undefined} tabIndex={0} className={styles.track}
      onPointerDown={() => {
        cancelAnimationFrame(animationFrame.current);
        animationFrame.current = 0;
        if (trackRef.current) delete trackRef.current.dataset.scrubbing;
        setScrubWindow(null);
      }}>
      {children}
    </div>
    {position.pages > 1 && <div className={styles.controls}
      onPointerDown={startScrub} onPointerMove={scrub} onPointerUp={endScrub} onPointerCancel={endScrub} onLostPointerCapture={endScrub}
      onClickCapture={event => { if (suppressClick.current && event.detail > 0) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; } }}>
      <p id={`${id}-hint`} className="sr-only">{hint}</p>
      {dots.map(page => <button key={page} type="button" aria-label={t("railPage", { page: page + 1, total: position.pages })} aria-controls={id} aria-current={page === position.active ? "step" : undefined} onClick={() => move(page)} className={styles.button}>
        <span aria-hidden="true" className={styles.dot} data-active={page === position.active} />
      </button>)}
    </div>}
  </div>;
}
