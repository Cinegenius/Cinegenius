import { COMPANY_LOGO_DEMO_KEY } from "./company-logo-motion";

type DemoMotion = { angle: number; rotor: HTMLElement; gesture: unknown; frame: number };
type DemoProgress = { elapsed: number; delay: number; duration: number; target: number };
type Demo = DemoProgress & { coin: HTMLElement; motion: DemoMotion; id: string; last: number | null; frame: number };
const completedInPageSession = new Set<string>();
const progressInPageSession = new Map<string, DemoProgress>();

export function logoDemoPlan(index: number) {
  const slot = index % 6;
  return {
    delay: 180 + [0, 120, 260, 80, 210, 340][slot],
    duration: [1600, 1900, 1750, 2050, 1850, 1700][slot],
    target: [360, -360, 360, -360, -360, 360][slot],
  };
}

/** Demo scheduling only: manual drag/coasting continue to use their existing physics. */
export function observeCompanyLogoDemos(root: HTMLElement, options: {
  motionFor: (coin: HTMLElement) => DemoMotion | null;
  reduced: () => boolean;
  busy: () => boolean;
  reset: (coin: HTMLElement, motion: DemoMotion) => void;
}) {
  const coins = [...root.querySelectorAll<HTMLElement>("[data-logo-coin]")];
  const visible = new Set<HTMLElement>();
  const demos = new Map<HTMLElement, Demo>();
  let held = false;
  let disposed = false;
  try {
    const saved = JSON.parse(sessionStorage.getItem(COMPANY_LOGO_DEMO_KEY) ?? "{}");
    if (saved && typeof saved === "object" && !Array.isArray(saved)) {
      if (Array.isArray(saved.completed)) for (const id of saved.completed) if (typeof id === "string") completedInPageSession.add(id);
      if (saved.pending && typeof saved.pending === "object" && !Array.isArray(saved.pending)) {
        for (const [id, value] of Object.entries(saved.pending)) {
          if (!value || typeof value !== "object") continue;
          const item = value as DemoProgress;
          if ([item.elapsed, item.delay, item.duration, item.target].every(Number.isFinite)
            && item.elapsed >= 0 && item.delay >= 180 && item.delay <= 520
            && item.duration >= 1600 && item.duration <= 2050
            && Math.abs(item.target) === 360 && item.elapsed < item.delay + item.duration
            && !completedInPageSession.has(id) && !progressInPageSession.has(id)) progressInPageSession.set(id, { elapsed: item.elapsed, delay: item.delay, duration: item.duration, target: item.target });
        }
      }
    }
  } catch { /* Session memory also works when storage is unavailable. */ }

  function persist() {
    try { sessionStorage.setItem(COMPANY_LOGO_DEMO_KEY, JSON.stringify({ completed: [...completedInPageSession], pending: Object.fromEntries(progressInPageSession) })); } catch { /* Keep in-memory completion and progress. */ }
  }
  function complete(id: string) {
    completedInPageSession.add(id);
    progressInPageSession.delete(id);
    persist();
  }
  function checkpoint(demo: Demo) {
    const previous = progressInPageSession.get(demo.id);
    if (previous?.elapsed === demo.elapsed) return;
    progressInPageSession.set(demo.id, { elapsed: demo.elapsed, delay: demo.delay, duration: demo.duration, target: demo.target });
    persist();
  }
  function draw(demo: Demo) {
    const progress = Math.min(1, Math.max(0, (demo.elapsed - demo.delay) / demo.duration));
    demo.motion.angle = demo.target * (0.5 - Math.cos(progress * Math.PI) / 2);
    demo.motion.rotor.style.willChange = "transform";
    demo.motion.rotor.style.transform = `rotateY(${demo.motion.angle}deg)`;
    return progress;
  }
  function loaded(coin: HTMLElement) {
    return coin.dataset.logoFailed !== "true" && [...coin.querySelectorAll("img")].some(image => image.complete && image.naturalWidth > 0);
  }
  function allowed(coin: HTMLElement) {
    return !disposed && !held && !options.busy() && !options.reduced() && document.visibilityState === "visible" && visible.has(coin) && coin.isConnected && loaded(coin);
  }
  function pause(demo: Demo) {
    cancelAnimationFrame(demo.frame);
    demo.frame = 0;
    demo.last = null;
    demo.motion.rotor.style.willChange = "";
    checkpoint(demo);
  }
  function schedule(demo: Demo) {
    if (demo.frame || !allowed(demo.coin)) return;
    demo.frame = requestAnimationFrame(now => {
      demo.frame = 0;
      if (!allowed(demo.coin)) { pause(demo); return; }
      if (demo.last !== null) demo.elapsed += Math.max(0, now - demo.last);
      demo.last = now;
      if (demo.elapsed >= demo.delay) {
        if (draw(demo) === 1) { complete(demo.id); demos.delete(demo.coin); options.reset(demo.coin, demo.motion); return; }
      }
      schedule(demo);
    });
  }
  function refresh() {
    if (options.reduced()) {
      for (const demo of demos.values()) { pause(demo); options.reset(demo.coin, demo.motion); }
      demos.clear();
      return;
    }
    for (const demo of demos.values()) {
      if (allowed(demo.coin)) schedule(demo); else pause(demo);
    }
    if (disposed || held || options.busy() || document.visibilityState !== "visible") return;
    coins.forEach((coin, index) => {
      const id = coin.dataset.logoDemoId;
      if (!id || completedInPageSession.has(id) || demos.has(coin) || !allowed(coin)) return;
      const motion = options.motionFor(coin);
      if (!motion || motion.frame || motion.gesture) return;
      const saved = progressInPageSession.get(id);
      const demo: Demo = { coin, motion, id, last: null, frame: 0, ...(saved ?? { elapsed: 0, ...logoDemoPlan(index) }) };
      demos.set(coin, demo);
      if (saved && saved.elapsed >= saved.delay) draw(demo);
      schedule(demo);
    });
  }
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const coin = entry.target as HTMLElement;
      if (entry.isIntersecting && entry.intersectionRatio >= 0.7) visible.add(coin);
      else visible.delete(coin);
    }
    refresh();
  }, { threshold: [0, 0.7], rootMargin: "-96px 0px -80px 0px" });
  coins.forEach(coin => observer.observe(coin));
  const release = () => { held = false; refresh(); };
  const visibility = () => { if (document.visibilityState === "hidden") held = false; refresh(); };
  const pageHide = () => { held = false; for (const demo of demos.values()) pause(demo); };
  root.addEventListener("load", refresh, true);
  document.addEventListener("visibilitychange", visibility);
  document.addEventListener("pointerup", release);
  document.addEventListener("pointercancel", release);
  window.addEventListener("pagehide", pageHide);
  window.addEventListener("pageshow", refresh);
  return {
    refresh,
    pause() { held = true; for (const demo of demos.values()) pause(demo); },
    has(coin: HTMLElement) { return demos.has(coin); },
    takeover(coin: HTMLElement) {
      const demo = demos.get(coin);
      if (demo) { pause(demo); demos.delete(coin); }
      const id = coin.dataset.logoDemoId;
      if (id) complete(id);
      return Boolean(demo);
    },
    release,
    dispose() {
      disposed = true;
      observer.disconnect();
      root.removeEventListener("load", refresh, true);
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("pointerup", release);
      document.removeEventListener("pointercancel", release);
      window.removeEventListener("pagehide", pageHide);
      window.removeEventListener("pageshow", refresh);
      for (const demo of demos.values()) { pause(demo); options.reset(demo.coin, demo.motion); }
      demos.clear();
    },
  };
}
