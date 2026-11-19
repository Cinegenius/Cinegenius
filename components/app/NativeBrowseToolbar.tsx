"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { ArrowUpDown, CalendarRange, Clapperboard, Euro, Globe, MapPin, Tag, UsersRound } from "lucide-react";
import BrowseResultCount from "@/components/BrowseResultCount";
import BrowseSelect, { type BrowseSelectOption } from "@/components/BrowseSelect";
import styles from "./NativeBrowseToolbar.module.css";
import { useNativeAppAppearance } from "@/lib/use-native-app-appearance";

/** One layout for native directory controls; callers retain their real filters and views. */
export default function NativeBrowseToolbar({ count, countLabel, filters = [], moreAction, viewControls, resultActions, keepTwoFilters = false }: {
  count: number | null;
  countLabel: ReactNode;
  filters?: ReactNode[];
  moreAction?: ReactNode;
  viewControls?: ReactNode;
  resultActions?: ReactNode;
  /** Two compact filters with two view actions fit from 320px without a hidden filter. */
  keepTwoFilters?: boolean;
}) {
  const native = useNativeAppAppearance();
  const anchor = useRef<HTMLDivElement>(null), rail = useRef<HTMLDivElement>(null), clearance = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    if (!native) return;
    const host = anchor.current, control = rail.current, probe = clearance.current;
    if (!host || !control || !probe) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const box = host.getBoundingClientRect(), top = probe.getBoundingClientRect().top;
      if (box.top < top) {
        const height = control.getBoundingClientRect().height;
        host.style.height = `${height}px`;
        control.style.setProperty("--native-rail-left", `${box.left}px`); control.style.setProperty("--native-rail-width", `${box.width}px`);
        control.setAttribute("data-native-rail-stuck", "true");
        document.documentElement.style.setProperty("--cg-app-active-rail-height", `${height}px`);
      } else {
        host.style.removeProperty("height"); control.removeAttribute("data-native-rail-stuck");
        document.documentElement.style.removeProperty("--cg-app-active-rail-height");
      }
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const observer = new ResizeObserver(schedule); observer.observe(host); observer.observe(control);
    window.addEventListener("scroll", schedule, { passive: true }); window.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("resize", schedule); window.visualViewport?.addEventListener("scroll", schedule);
    update();
    return () => {
      cancelAnimationFrame(frame); observer.disconnect(); host.style.removeProperty("height"); control.removeAttribute("data-native-rail-stuck");
      document.documentElement.style.removeProperty("--cg-app-active-rail-height");
      window.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("resize", schedule); window.visualViewport?.removeEventListener("scroll", schedule);
    };
  }, [native]);
  return <div ref={anchor} className={styles.anchor} data-native-browse-anchor><span ref={clearance} className={styles.clearance} aria-hidden="true" /><div ref={rail} className={styles.container} data-native-browse-toolbar="v1" data-keep-two-filters={keepTwoFilters || undefined}>
    <div className={styles.rail}>
      <div className={styles.count}><BrowseResultCount count={count} label={countLabel} /></div>
      <div className={styles.filters}>{filters.map((filter, index) => <div className={styles.filter} key={index} data-quick-filter={index}>{filter}</div>)}</div>
      {moreAction && <div className={styles.more}>{moreAction}</div>}
      {viewControls && <div className={styles.views}>{viewControls}</div>}
    </div>
    {resultActions && <div className={styles.actions}>{resultActions}</div>}
  </div></div>;
}

export type NativeBrowseQuickFilterKind = "category" | "departments" | "country" | "topic" | "place" | "sort" | "period" | "price" | "projectType";
const quickFilterIcons = { category: Tag, departments: UsersRound, country: Globe, topic: Tag, place: MapPin, sort: ArrowUpDown, period: CalendarRange, price: Euro, projectType: Clapperboard };

/** The existing anchored listbox supplies keyboard, focus and full option labels. */
export function NativeBrowseQuickFilter({ label, value, options, onChange, icon, kind = "category" }: {
  label: string;
  value: string;
  options: BrowseSelectOption[];
  onChange: (value: string) => void;
  icon?: ReactNode;
  kind?: NativeBrowseQuickFilterKind;
}) {
  const Icon = quickFilterIcons[kind];
  return <BrowseSelect label={label} value={value} options={options} onChange={onChange} icon={icon ?? <Icon size={18} />}
    className={styles.quickSelect} triggerClassName={styles.quickTrigger} compactEmptyLabel iconOnly />;
}
