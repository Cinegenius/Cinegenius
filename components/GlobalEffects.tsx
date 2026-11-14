"use client";

import { useEffect } from "react";

export default function GlobalEffects() {
  useEffect(() => {
    // Enable reveal animations only after hydration — avoids SSR mismatch
    document.documentElement.classList.add("js-ready");

    // ── 3D Tilt + Spotlight ─────────────────────────────────────────────────
    let moveFrame = 0;
    let pendingMove: { card: HTMLElement; clientX: number; clientY: number } | null = null;
    const paintMove = () => {
      moveFrame = 0;
      const latest = pendingMove;
      pendingMove = null;
      if (!latest || !latest.card.isConnected) return;
      const { card, clientX, clientY } = latest;
      const r = card.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const x = (clientX - r.left) / r.width;
      const y = (clientY - r.top) / r.height;
      card.style.setProperty("--mx", `${x * 100}%`);
      card.style.setProperty("--my", `${y * 100}%`);
      card.style.setProperty("--rx", String((y - 0.5) * -8));
      card.style.setProperty("--ry", String((x - 0.5) * 8));
    };
    const onMove = (e: MouseEvent) => {
      const card = (e.target as Element).closest?.(".card-hover") as HTMLElement | null;
      if (!card) return;
      pendingMove = { card, clientX: e.clientX, clientY: e.clientY };
      if (!moveFrame) moveFrame = requestAnimationFrame(paintMove);
    };
    const onOut = (e: MouseEvent) => {
      const card = (e.target as Element).closest?.(".card-hover") as HTMLElement | null;
      if (!card || card.contains(e.relatedTarget as Node)) return;
      if (pendingMove?.card === card) pendingMove = null;
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

    const observe = (root: ParentNode) => {
      if (root instanceof Element && root.matches(".card-hover:not([data-visible])")) io.observe(root);
      root.querySelectorAll(".card-hover:not([data-visible])").forEach((el) => io.observe(el));
    };

    // GlobalEffects sits in the root layout and its useEffect fires as soon as
    // the layout hydrates — BEFORE page-level Client Components (e.g.
    // CompaniesContent) finish reconciling. requestIdleCallback fires between
    // React's internal hydration batches, which is still too early.
    // A 350 ms macro-task delay is reliably past full-tree hydration on any
    // reasonable device while still being imperceptible to the user.
    const mo = new MutationObserver((records) => {
      // Text, badges and chat updates must not rescan every card on the page.
      for (const record of records) for (const node of record.addedNodes) {
        if (node instanceof Element) observe(node);
      }
    });
    const timer = setTimeout(() => {
      observe(document);
      mo.observe(document.body, { childList: true, subtree: true });
    }, 350);

    // Fallback: force-reveal any cards the observer missed after 1.4s
    const fallback = setTimeout(() => {
      document.querySelectorAll(".card-hover:not([data-visible])").forEach((el) => {
        el.setAttribute("data-visible", "1");
      });
    }, 1400);

    return () => {
      clearTimeout(timer);
      clearTimeout(fallback);
      cancelAnimationFrame(moveFrame);
      pendingMove = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseout", onOut);
      io.disconnect();
      mo.disconnect();
    };
  }, []);

  return null;
}
