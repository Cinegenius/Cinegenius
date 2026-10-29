"use client";

import Link from "next/link";
import { useEffect, useRef, type PointerEvent } from "react";
import { useTranslations } from "next-intl";
import { MoveHorizontal } from "lucide-react";
import CompanyLogo from "@/components/CompanyLogo";
import { COMPANY_LOGO_DEMO_KEY, isLogoDragClick, logoDragAngle, logoDragVelocity, logoGestureAxis, logoSpinAngle, logoSpinPlan } from "@/lib/company-logo-motion";
import styles from "./HomeCompanyPartners.module.css";

type Partner = { id: string; href: string; name: string; logo: string | null; category?: string; city: string };
type Gesture = { id: number; x: number; y: number; lastX: number; time: number; origin: number; width: number; velocity: number; dragging: boolean; vertical: boolean; canSpin: boolean };
type Motion = { rotor: HTMLElement; angle: number; frame: number; gesture: Gesture | null };
let demoConsumedInPageSession = false;

/** Homepage-only interaction. Names and links never rotate with the logo. */
export default function HomeCompanyPartners({ companies }: { companies: Partner[] }) {
  const t = useTranslations("homeCompanyLogos");
  const logoSources = companies.map(company => `${company.id}:${company.logo ?? ""}`).join("|");
  const root = useRef<HTMLDivElement>(null);
  const motions = useRef(new Map<HTMLElement, Motion>());
  const reduced = useRef(true);
  const interacted = useRef(false);
  const demo = useRef<HTMLElement | null>(null);
  const dragClick = useRef<{ link: Element | null; until: number } | null>(null);

  function motionFor(coin: HTMLElement) {
    let motion = motions.current.get(coin);
    if (!motion) {
      const rotor = coin.querySelector<HTMLElement>("[data-logo-rotor]");
      if (!rotor) return null;
      motion = { rotor, angle: 0, frame: 0, gesture: null };
      motions.current.set(coin, motion);
    }
    return motion;
  }

  function reset(coin: HTMLElement, motion: Motion) {
    cancelAnimationFrame(motion.frame);
    motion.frame = 0; motion.angle = 0; motion.gesture = null;
    motion.rotor.style.transform = "";
    motion.rotor.style.willChange = "";
    delete coin.dataset.dragging;
  }

  function animate(coin: HTMLElement, motion: Motion, target: number, duration: number) {
    cancelAnimationFrame(motion.frame);
    const from = motion.angle;
    const started = performance.now();
    motion.rotor.style.willChange = "transform";
    const tick = (now: number) => {
      if (reduced.current || !coin.isConnected) { reset(coin, motion); return; }
      motion.angle = logoSpinAngle(from, target, now - started, duration);
      motion.rotor.style.transform = `rotateY(${motion.angle}deg)`;
      if (now - started < duration) motion.frame = requestAnimationFrame(tick);
      else { reset(coin, motion); if (demo.current === coin) demo.current = null; }
    };
    motion.frame = requestAnimationFrame(tick);
  }

  function consumeDemo() {
    if (demoConsumedInPageSession) return;
    demoConsumedInPageSession = true;
    try { sessionStorage.setItem(COMPANY_LOGO_DEMO_KEY, "1"); } catch { /* Storage may be unavailable; retain the in-memory session flag. */ }
  }

  function beginInteraction() {
    interacted.current = true;
    consumeDemo();
    const coin = demo.current;
    if (coin) {
      const motion = motions.current.get(coin);
      if (motion) reset(coin, motion);
      demo.current = null;
    }
  }

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const motionMap = motions.current;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduced.current = preference.matches;
    element.dataset.reducedMotion = String(preference.matches);
    const onPreference = () => {
      reduced.current = preference.matches;
      element.dataset.reducedMotion = String(preference.matches);
      if (preference.matches) {
        for (const [coin, motion] of motionMap) reset(coin, motion);
        demo.current = null;
      }
    };
    preference.addEventListener("change", onPreference);
    const visible = new Set<HTMLElement>();
    const tryDemo = () => {
      if (reduced.current || interacted.current || demoConsumedInPageSession || document.visibilityState !== "visible") return;
      try { if (sessionStorage.getItem(COMPANY_LOGO_DEMO_KEY)) { demoConsumedInPageSession = true; return; } } catch { /* Use the in-memory flag. */ }
      const coin = [...visible].find(candidate => [...candidate.querySelectorAll("img")].some(image => image.complete && image.naturalWidth > 0));
      if (!coin) return;
      const motion = motionFor(coin);
      if (!motion) return;
      consumeDemo(); demo.current = coin;
      animate(coin, motion, 360, 1400);
    };
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const coin = entry.target as HTMLElement;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.7) visible.add(coin);
        else { visible.delete(coin); if (demo.current === coin) { const motion = motionMap.get(coin); if (motion) reset(coin, motion); demo.current = null; } }
      }
      tryDemo();
    }, { threshold: [0, 0.7], rootMargin: "-96px 0px -80px 0px" });
    element.querySelectorAll<HTMLElement>("[data-logo-coin]").forEach(coin => observer.observe(coin));
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        for (const [coin, motion] of motionMap) reset(coin, motion);
        demo.current = null;
      } else tryDemo();
    };
    element.addEventListener("load", tryDemo, true);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      observer.disconnect(); preference.removeEventListener("change", onPreference);
      element.removeEventListener("load", tryDemo, true);
      document.removeEventListener("visibilitychange", onVisibility);
      for (const [coin, motion] of motionMap) reset(coin, motion);
      motionMap.clear();
    };
  // Handlers use stable refs; re-observe only when the actual logo sources change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logoSources]);

  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.button !== 0) return;
    const coin = event.currentTarget;
    const canSpin = !reduced.current && [...coin.querySelectorAll("img")].some(image => image.complete && image.naturalWidth > 0);
    const motion = motionFor(coin);
    if (!motion) return;
    cancelAnimationFrame(motion.frame); motion.frame = 0;
    motion.gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, lastX: event.clientX, time: event.timeStamp, origin: motion.angle, width: coin.getBoundingClientRect().width, velocity: 0, dragging: false, vertical: false, canSpin };
  }

  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const coin = event.currentTarget;
    const motion = motions.current.get(coin);
    const gesture = motion?.gesture;
    if (!motion || !gesture || gesture.id !== event.pointerId) return;
    if (gesture.vertical) {
      dragClick.current = { link: coin.closest("a"), until: performance.now() + 600 };
      return;
    }
    const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
    if (!gesture.dragging) {
      const axis = logoGestureAxis(dx, dy, event.pointerType);
      if (axis === "vertical") {
        // Do not cancel native vertical scrolling, but ignore a browser-generated
        // click at the end of a deliberate vertical mouse drag as well.
        dragClick.current = { link: coin.closest("a"), until: performance.now() + 600 };
        reset(coin, motion); gesture.vertical = true; motion.gesture = gesture;
        coin.setPointerCapture(event.pointerId);
        return;
      }
      if (axis !== "horizontal") return;
      gesture.dragging = true;
      if (gesture.canSpin) coin.dataset.dragging = "true";
      coin.setPointerCapture(event.pointerId);
      if (gesture.canSpin) motion.rotor.style.willChange = "transform";
    }
    dragClick.current = { link: coin.closest("a"), until: performance.now() + 600 };
    event.preventDefault();
    if (!gesture.canSpin || reduced.current) return;
    gesture.velocity = logoDragVelocity(gesture.velocity, logoDragAngle(0, event.clientX - gesture.lastX, gesture.width), event.timeStamp - gesture.time);
    gesture.lastX = event.clientX; gesture.time = event.timeStamp;
    motion.angle = logoDragAngle(gesture.origin, dx, gesture.width);
    motion.rotor.style.transform = `rotateY(${motion.angle}deg)`;
  }

  function pointerEnd(event: PointerEvent<HTMLDivElement>) {
    const coin = event.currentTarget;
    const motion = motions.current.get(coin);
    const gesture = motion?.gesture;
    if (!motion || !gesture || gesture.id !== event.pointerId) return;
    if (gesture.dragging || gesture.vertical) dragClick.current = { link: coin.closest("a"), until: performance.now() + 600 };
    motion.gesture = null; delete coin.dataset.dragging;
    if (coin.hasPointerCapture(event.pointerId)) coin.releasePointerCapture(event.pointerId);
    if (event.type === "pointercancel") { reset(coin, motion); return; }
    if (!gesture.dragging || !gesture.canSpin || reduced.current) { reset(coin, motion); return; }
    const plan = logoSpinPlan(motion.angle, event.timeStamp - gesture.time > 100 ? 0 : gesture.velocity, event.clientX - gesture.x);
    animate(coin, motion, plan.target, plan.duration);
  }

  return <div ref={root} className={styles.partners} onPointerDownCapture={() => { dragClick.current = null; beginInteraction(); }} onKeyDownCapture={beginInteraction} onFocusCapture={beginInteraction} onWheelCapture={beginInteraction}>
    {companies.some(company => company.logo) && <p className={`${styles.hint} mb-4 flex items-center justify-end gap-1.5 text-xs text-text-muted`}>
      <MoveHorizontal size={14} aria-hidden="true" />
      <span className={styles.touchHint}>{t("touchHint")}</span><span className={styles.dragHint}>{t("dragHint")}</span>
    </p>}
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      {companies.map(company => <Link key={company.id} href={company.href} draggable={false}
        className="group flex min-w-0 flex-col items-center text-center gap-2"
        onDragStart={event => event.preventDefault()}
        onClickCapture={event => {
          const blocked = dragClick.current?.link === event.currentTarget && isLogoDragClick(event.detail, dragClick.current.until, performance.now());
          dragClick.current = null;
          if (blocked) { event.preventDefault(); event.stopPropagation(); }
        }}>
        <div className={styles.coin} data-logo-coin={company.logo ? "" : undefined}
          onErrorCapture={event => {
            const coin = event.currentTarget;
            coin.dataset.logoFailed = "true";
            const motion = motions.current.get(coin);
            if (motion) reset(coin, motion);
            if (demo.current === coin) demo.current = null;
          }}
          onLoadCapture={event => { if (event.target instanceof HTMLImageElement && event.target.naturalWidth > 0) delete event.currentTarget.dataset.logoFailed; }}
          onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd}
          onLostPointerCapture={event => {
            // Touch implicitly captures the hit-tested child. Its bubbling
            // capture-loss event during transfer is not loss by this logo.
            if (event.target !== event.currentTarget) return;
            const motion = motions.current.get(event.currentTarget);
            if (motion?.gesture?.id === event.pointerId) reset(event.currentTarget, motion);
          }}>
          <div className={styles.rotor} data-logo-rotor>
            <div className={styles.face} aria-hidden="true"><CompanyLogo src={company.logo} name={company.name} className="h-full w-full" /></div>
            {company.logo && <div className={`${styles.face} ${styles.back}`} aria-hidden="true"><CompanyLogo src={company.logo} name={company.name} className="h-full w-full" /></div>}
          </div>
        </div>
        <div className="min-w-0 w-full">
          <h3 className="font-semibold text-text-secondary group-hover:text-text-primary text-xs leading-snug break-words [overflow-wrap:anywhere] transition-colors">{company.name}</h3>
          {company.category && <p className="text-[10px] text-gold/70 truncate">{company.category}</p>}
          {company.city && <p className="text-[10px] text-text-muted truncate">{company.city}</p>}
        </div>
      </Link>)}
    </div>
  </div>;
}
