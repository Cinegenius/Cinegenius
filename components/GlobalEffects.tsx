"use client";

import { useEffect } from "react";

export default function GlobalEffects() {
  useEffect(() => {
    // Enable reveal animations only after hydration — avoids SSR mismatch
    document.documentElement.classList.add("js-ready");

    // ── 3D Tilt + Spotlight ─────────────────────────────────────────────────
    const onMove = (e: MouseEvent) => {
      const card = (e.target as Element).closest?.(".card-hover") as HTMLElement | null;
      if (!card) return;
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      card.style.setProperty("--mx", `${x * 100}%`);
      card.style.setProperty("--my", `${y * 100}%`);
      card.style.setProperty("--rx", String((y - 0.5) * -8));
      card.style.setProperty("--ry", String((x - 0.5) * 8));
    };
    const onOut = (e: MouseEvent) => {
      const card = (e.target as Element).closest?.(".card-hover") as HTMLElement | null;
      if (!card || card.contains(e.relatedTarget as Node)) return;
      card.style.removeProperty("--rx");
      card.style.removeProperty("--ry");
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseout", onOut);

    // ── Scroll Reveal ────────────────────────────────────────────────────────
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((en) => {
          if (en.isIntersecting) {
            const siblings = [...(en.target.parentElement?.children ?? [])].filter(
              (el) => el.classList.contains("card-hover")
            );
            const idx = siblings.indexOf(en.target as Element);
            (en.target as HTMLElement).style.transitionDelay = `${Math.min(idx * 40, 180)}ms`;
            en.target.setAttribute("data-visible", "1");
            io.unobserve(en.target);
          }
        }),
      { threshold: 0.04, rootMargin: "0px 0px -16px 0px" }
    );

    const observe = () => {
      document.querySelectorAll(".card-hover:not([data-visible])").forEach((el) => io.observe(el));
    };

    // GlobalEffects sits in the root layout and its useEffect fires as soon as
    // the layout hydrates — BEFORE page-level Client Components (e.g.
    // CompaniesContent) finish reconciling. requestIdleCallback fires between
    // React's internal hydration batches, which is still too early.
    // A 350 ms macro-task delay is reliably past full-tree hydration on any
    // reasonable device while still being imperceptible to the user.
    const mo = new MutationObserver(observe);
    const timer = setTimeout(() => {
      observe();
      mo.observe(document.body, { childList: true, subtree: true });
    }, 350);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseout", onOut);
      io.disconnect();
      mo.disconnect();
    };
  }, []);

  return null;
}
