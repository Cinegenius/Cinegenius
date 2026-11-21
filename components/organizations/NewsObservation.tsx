"use client";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { captureNews } from "@/components/ProductAnalytics";
import { readAnalyticsConsent, subscribeAnalyticsConsent } from "@/lib/analytics-consent";
import type { NewsAnalyticsEvent } from "@/lib/analytics-policy";

/** Measure an actually visible card/article, not all records fetched for a rail. */
export default function NewsObservation({id, event = "news_impression"}: {id: string; event?: NewsAnalyticsEvent}) {
  const anchor = useRef<HTMLSpanElement>(null);
  const pathname = usePathname();
  const consent = useSyncExternalStore(subscribeAnalyticsConsent, readAnalyticsConsent, () => null);
  useEffect(() => {
    if (consent !== "accepted" || !anchor.current || !window.IntersectionObserver) return;
    const element = anchor.current.closest("[data-news-observation]") ?? anchor.current.parentElement;
    if (!element) return;
    let visible = false, stopped = false, sent = false, timer: ReturnType<typeof setTimeout> | undefined;
    const clear = () => {if (timer) clearTimeout(timer); timer = undefined;};
    const schedule = () => {
      clear();
      if (!visible || stopped || sent || document.visibilityState !== "visible") return;
      timer = setTimeout(() => {void captureNews(event, id, () => !stopped && visible && document.visibilityState === "visible").then(ok => {sent = ok;});}, 1000);
    };
    const observer = new IntersectionObserver(entries => {visible = entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= (event === "news_view" ? 0.1 : 0.5)); schedule();}, {threshold: event === "news_view" ? [0, 0.1] : [0, 0.5]});
    observer.observe(element);
    document.addEventListener("visibilitychange", schedule);
    return () => {stopped = true; clear(); observer.disconnect(); document.removeEventListener("visibilitychange", schedule);};
  }, [id, event, consent, pathname]);
  return <span ref={anchor} hidden aria-hidden="true" />;
}
