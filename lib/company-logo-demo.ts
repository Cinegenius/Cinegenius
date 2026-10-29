type DemoMotion = { angle: number; rotor: HTMLElement; gesture: unknown; frame: number };
type Demo = { coin: HTMLElement; motion: DemoMotion; id: string; elapsed: number; delay: number; duration: number; target: number; last: number | null; frame: number };

export function logoDemoPlan(index: number) {
  const slot = index % 6;
  return {
    delay: 180 + [0, 120, 260, 80, 210, 340][slot],
    duration: [1600, 1900, 1750, 2050, 1850, 1700][slot],
    target: [360, -360, 360, -360, -360, 360][slot],
  };
}

/** One demonstration per page visit; manual drag/coasting retain their existing physics. */
export function observeCompanyLogoDemos(root: HTMLElement, options: {
  motionFor: (coin: HTMLElement) => DemoMotion | null;
  reduced: () => boolean;
  busy: () => boolean;
  reset: (coin: HTMLElement, motion: DemoMotion) => void;
}) {
  const coins = [...root.querySelectorAll<HTMLElement>("[data-logo-coin]")];
  const visible = new Set<HTMLElement>();
  const completed = new Set<string>();
  const demos = new Map<HTMLElement, Demo>();
  let held = false;
  let pageHidden = false;
  let disposed = false;

  function loaded(coin: HTMLElement) {
    return coin.dataset.logoFailed !== "true" && [...coin.querySelectorAll("img")].some(image => image.complete && image.naturalWidth > 0);
  }
  function allowed(coin: HTMLElement) {
    return !disposed && !pageHidden && !held && !options.busy() && !options.reduced() && document.visibilityState === "visible" && visible.has(coin) && coin.isConnected && loaded(coin);
  }
  function pause(demo: Demo) {
    cancelAnimationFrame(demo.frame);
    demo.frame = 0;
    demo.last = null;
    demo.motion.rotor.style.willChange = "";
  }
  function schedule(demo: Demo) {
    if (demo.frame || !allowed(demo.coin)) return;
    demo.frame = requestAnimationFrame(now => {
      demo.frame = 0;
      if (!allowed(demo.coin)) { pause(demo); return; }
      if (demo.last !== null) demo.elapsed += Math.max(0, now - demo.last);
      demo.last = now;
      if (demo.elapsed >= demo.delay) {
        const progress = Math.min(1, (demo.elapsed - demo.delay) / demo.duration);
        demo.motion.angle = demo.target * (0.5 - Math.cos(progress * Math.PI) / 2);
        demo.motion.rotor.style.willChange = "transform";
        demo.motion.rotor.style.transform = `rotateY(${demo.motion.angle}deg)`;
        if (progress === 1) { completed.add(demo.id); demos.delete(demo.coin); options.reset(demo.coin, demo.motion); return; }
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
    if (disposed || pageHidden || held || options.busy() || document.visibilityState !== "visible") return;
    coins.forEach((coin, index) => {
      const id = coin.dataset.logoDemoId;
      if (!id || completed.has(id) || demos.has(coin) || !allowed(coin)) return;
      const motion = options.motionFor(coin);
      if (!motion || motion.frame || motion.gesture) return;
      const demo: Demo = { coin, motion, id, elapsed: 0, last: null, frame: 0, ...logoDemoPlan(index) };
      demos.set(coin, demo);
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
  const pageHide = () => { pageHidden = true; held = false; for (const demo of demos.values()) pause(demo); };
  const pageShow = (event: PageTransitionEvent) => {
    pageHidden = false;
    if (event.persisted) {
      // Browser Back can restore the whole document without remounting React.
      for (const demo of demos.values()) pause(demo);
      demos.clear(); completed.clear(); visible.clear(); held = false;
      for (const coin of coins) {
        const motion = options.motionFor(coin);
        if (motion) options.reset(coin, motion);
      }
      observer.disconnect();
      coins.forEach(coin => observer.observe(coin));
    }
    refresh();
  };
  root.addEventListener("load", refresh, true);
  document.addEventListener("visibilitychange", visibility);
  document.addEventListener("pointerup", release);
  document.addEventListener("pointercancel", release);
  window.addEventListener("pagehide", pageHide);
  window.addEventListener("pageshow", pageShow);
  return {
    refresh,
    pause() { held = true; for (const demo of demos.values()) pause(demo); },
    has(coin: HTMLElement) { return demos.has(coin); },
    takeover(coin: HTMLElement) {
      const demo = demos.get(coin);
      if (demo) { pause(demo); demos.delete(coin); }
      const id = coin.dataset.logoDemoId;
      if (id) completed.add(id);
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
      window.removeEventListener("pageshow", pageShow);
      for (const demo of demos.values()) { pause(demo); options.reset(demo.coin, demo.motion); }
      demos.clear();
    },
  };
}
