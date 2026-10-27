"use client";

import { useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { viewRecord, writeViewRecord } from "@/lib/navigation-context";
import { ServerAdminContext } from "@/lib/server-admin-context";

export default function NavigationRestoration() {
  const path = usePathname();
  const { userId, isLoaded } = useAuth();
  const serverAdminId = useContext(ServerAdminContext);
  const owner = userId ?? (!isLoaded && path === "/admin" ? serverAdminId : null) ?? "guest";
  const previousPath = useRef(path);
  const linkVisit = useRef<{ from: string; to: string } | null>(null);
  const pending = useRef<{ path: string; y: number } | null>(null);
  const restoring = useRef(false);
  const [returnVisit, setReturnVisit] = useState(0);

  useEffect(() => {
    const pop = () => {
      const target = window.location.pathname;
      const record = viewRecord(window.history.state, target, owner);
      pending.current = typeof record.y === "number" ? { path: target, y: record.y } : null;
      setReturnVisit(value => value + 1);
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, [owner]);

  useEffect(() => {
    const record = viewRecord(window.history.state, path, owner);
    const freshPage = previousPath.current !== path && !pending.current;
    if (freshPage && !record.from && linkVisit.current?.to === path) {
      writeViewRecord(path, owner, { from: linkVisit.current.from });
    }
    if (freshPage) linkVisit.current = null;
    previousPath.current = path;
    let frame = 0;
    let timer = 0;
    let observer: ResizeObserver | undefined;
    if (freshPage && !window.location.hash) frame = requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "instant" }));
    const cancel = (clearPending = true) => {
      restoring.current = false;
      if (clearPending) pending.current = null;
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      observer?.disconnect();
    };
    if (pending.current?.path === path) {
      const y = Math.max(0, pending.current.y);
      restoring.current = true;
      const attempt = (final = false) => {
        const available = document.documentElement.scrollHeight - window.innerHeight;
        if (available >= y || final) {
          window.scrollTo({ top: Math.min(y, Math.max(0, available)), behavior: "instant" });
          cancel();
        }
      };
      observer = new ResizeObserver(() => attempt());
      observer.observe(document.body);
      frame = requestAnimationFrame(() => attempt());
      timer = window.setTimeout(() => attempt(true), 2500);
    }
    let saveTimer = 0;
    const save = () => {
      if (!restoring.current) writeViewRecord(path, owner, { y: window.scrollY });
    };
    // Safari limits History API writes. Save once scrolling settles, not on every animation frame.
    const scroll = () => { clearTimeout(saveTimer); saveTimer = window.setTimeout(save, 200); };
    // Capture before Next changes the current history entry.
    const leave = (event: MouseEvent) => {
      save();
      linkVisit.current = null;
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!link || (link.target && link.target !== "_self")) return;
      const target = new URL(link.href, window.location.href);
      if (target.origin === window.location.origin && target.pathname !== path) linkVisit.current = { from: path, to: target.pathname };
    };
    window.addEventListener("scroll", scroll, { passive: true });
    document.addEventListener("click", leave, true);
    window.addEventListener("pagehide", save);
    const userScroll = () => cancel();
    window.addEventListener("wheel", userScroll, { passive: true });
    window.addEventListener("touchstart", userScroll, { passive: true });
    return () => {
      cancel(false); clearTimeout(saveTimer);
      window.removeEventListener("scroll", scroll);
      document.removeEventListener("click", leave, true);
      window.removeEventListener("pagehide", save);
      window.removeEventListener("wheel", userScroll);
      window.removeEventListener("touchstart", userScroll);
    };
  }, [owner, path, returnVisit]);
  return null;
}
