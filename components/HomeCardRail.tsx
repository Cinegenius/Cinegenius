"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type ReactNode } from "react";
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
  const [position, setPosition] = useState({ active: 0, pages: Math.max(1, itemCount) });

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    function update() {
      if (!track) return;
      const maximum = Math.max(0, track.scrollWidth - track.clientWidth);
      const first = track.firstElementChild as HTMLElement | null;
      const gap = Number.parseFloat(getComputedStyle(track).columnGap) || 0;
      const step = Math.max(1, first ? first.getBoundingClientRect().width + gap : track.clientWidth);
      const stops = maximum <= 2 ? [0] : Array.from({ length: Math.ceil(maximum / step) + 1 }, (_, index) => Math.min(index * step, maximum));
      stopsRef.current = stops;
      const active = stops.reduce((nearest, offset, index) => Math.abs(offset - track.scrollLeft) < Math.abs(stops[nearest] - track.scrollLeft) ? index : nearest, 0);
      setPosition(current => current.active === active && current.pages === stops.length ? current : { active, pages: stops.length });
    }
    update();
    track.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(track);
    return () => {
      track.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [itemCount]);

  function move(page: number) {
    const track = trackRef.current;
    if (!track) return;
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth";
    track.scrollTo({ left: stopsRef.current[page] ?? 0, behavior });
  }

  // A sliding window keeps the real page positions reachable within 320px.
  const firstDot = Math.max(0, Math.min(position.active - 2, position.pages - 5));
  const dots = Array.from({ length: Math.min(position.pages, 5) }, (_, index) => firstDot + index);

  return <div className={`${styles.root} ${styles[variant]} ${wide ? styles.wide : ""}`}>
    <div ref={trackRef} id={id} role="region" aria-labelledby={labelledBy} aria-describedby={position.pages > 1 ? `${id}-hint` : undefined} tabIndex={0} className={styles.track}>
      {children}
    </div>
    {position.pages > 1 && <div className={styles.controls}>
      <p id={`${id}-hint`} className="sr-only">{hint}</p>
      {dots.map(page => <button key={page} type="button" aria-label={t("railPage", { page: page + 1, total: position.pages })} aria-controls={id} aria-current={page === position.active ? "step" : undefined} onClick={() => move(page)} className={styles.button}>
        <span aria-hidden="true" className={styles.dot} data-active={page === position.active} />
      </button>)}
    </div>}
  </div>;
}
