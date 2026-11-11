"use client";

import { ArrowLeft, ArrowRight, MoveHorizontal } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./HomeCardRail.module.css";

type Props = {
  id: string;
  labelledBy: string;
  hint: string;
  previousLabel: string;
  nextLabel: string;
  itemCount: number;
  variant: "crew" | "location";
  wide?: boolean;
  children: ReactNode;
};

/** Only the scroll controls hydrate; the permission-checked cards stay server rendered. */
export default function HomeCardRail({ id, labelledBy, hint, previousLabel, nextLabel, itemCount, variant, wide = false, children }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ previous: false, next: itemCount > 1, overflow: itemCount > 1 });

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    function update() {
      if (!track) return;
      const maximum = track.scrollWidth - track.clientWidth;
      const next = { previous: track.scrollLeft > 2, next: track.scrollLeft < maximum - 2, overflow: maximum > 2 };
      setPosition(current => current.previous === next.previous && current.next === next.next && current.overflow === next.overflow ? current : next);
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

  function move(direction: number) {
    const track = trackRef.current;
    if (!track) return;
    // A whole-card step keeps the next member or location fully visible.
    const first = track.firstElementChild as HTMLElement | null;
    const gap = Number.parseFloat(getComputedStyle(track).columnGap) || 0;
    const step = first ? first.getBoundingClientRect().width + gap : track.clientWidth;
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth";
    track.scrollBy({ left: direction * step, behavior });
  }

  return <div className={`${styles.root} ${styles[variant]} ${wide ? styles.wide : ""}`}>
    <div ref={trackRef} id={id} role="region" aria-labelledby={labelledBy} aria-describedby={position.overflow ? `${id}-hint` : undefined} tabIndex={0} className={styles.track}>
      {children}
    </div>
    {position.overflow && <div className={styles.controls}>
      <p id={`${id}-hint`} className={styles.hint}><MoveHorizontal size={16} aria-hidden="true" /><span>{hint}</span></p>
      <div className={styles.buttons}>
        <button type="button" aria-label={previousLabel} aria-controls={id} disabled={!position.previous} onClick={() => move(-1)} className={styles.button}><ArrowLeft size={18} aria-hidden="true" /></button>
        <button type="button" aria-label={nextLabel} aria-controls={id} disabled={!position.next} onClick={() => move(1)} className={styles.button}><ArrowRight size={18} aria-hidden="true" /></button>
      </div>
    </div>}
  </div>;
}
