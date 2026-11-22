"use client";

import { useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { nativeViewScroll, viewRecord, writeViewRecord } from "@/lib/navigation-context";
import { ServerAdminContext } from "@/lib/server-admin-context";
import { useNativeAppAppearance } from "@/lib/use-native-app-appearance";

export default function NavigationRestoration() {
  const path = usePathname();
  const { userId, isLoaded, sessionId } = useAuth();
  const native = useNativeAppAppearance();
  const serverAdminId = useContext(ServerAdminContext);
  const owner = userId ?? (!isLoaded && path === "/admin" ? serverAdminId : null) ?? "guest";
  const session = sessionId ?? null;
  const scrollReady = isLoaded && (!userId || typeof sessionId === "string");
  const scope = native ? JSON.stringify([owner, session, isLoaded]) : `web:${owner}`;
  const activeScope = useRef(scope), mountedScope = useRef<string | null>(null);
  const previousIdentity = useRef<{ owner: string; session: string | null; native: boolean } | null>(null);
  const previousPath = useRef(path);
  const linkVisit = useRef<{ from: string; to: string } | null>(null);
  const pending = useRef<{ path: string; y: number; scope: string } | null>(null);
  const restoring = useRef(false);
  const [returnVisit, setReturnVisit] = useState(0);
  useLayoutEffect(() => { activeScope.current = scope; }, [scope]);

  useEffect(() => {
    const pop = (event: PopStateEvent) => {
      const target = window.location.pathname;
      // Next may already have replaced current history by the time React runs.
      const record = viewRecord(native ? event.state : window.history.state, target, owner);
      const y = native ? scrollReady ? nativeViewScroll(record, session) ?? 0 : 0 : record.y;
      pending.current = typeof y === "number" && Number.isFinite(y) ? { path: target, y, scope } : null;
      setReturnVisit(value => value + 1);
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, [owner, native, scope, session, scrollReady]);

  useEffect(() => {
    const record = viewRecord(window.history.state, path, owner);
    const content = native ? document.querySelector<HTMLElement>('main.site-main[data-native-app-surface="v1"]') : null;
    if (native && !content) return;
    const oldIdentity = previousIdentity.current;
    previousIdentity.current = { owner, session, native };
    if (native && oldIdentity?.native && (oldIdentity.owner !== owner || oldIdentity.session !== session)) {
      // A later keyboard resize must not reveal a field from the previous
      // account/session and thereby recreate its abandoned scroll position.
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && content?.contains(focused)) focused.blur();
    }
    const readY = () => content ? content.scrollTop : window.scrollY;
    const availableHeight = () => content ? content.scrollHeight - content.clientHeight : document.documentElement.scrollHeight - window.innerHeight;
    const scrollTo = (y: number) => { if (content) content.scrollTop = y; else window.scrollTo({ top: y, behavior: "instant" }); };
    const scopeChanged = mountedScope.current !== scope;
    mountedScope.current = scope;
    if (pending.current?.scope !== scope) pending.current = null;
    if (native && scopeChanged) {
      linkVisit.current = null;
      pending.current = { path, y: scrollReady ? nativeViewScroll(record, session) ?? 0 : 0, scope };
    }
    const freshPage = previousPath.current !== path && !pending.current;
    if (freshPage && !record.from && linkVisit.current?.to === path) {
      writeViewRecord(path, owner, { from: linkVisit.current.from });
    }
    if (freshPage) linkVisit.current = null;
    previousPath.current = path;
    let frame = 0;
    let timer = 0;
    let observer: ResizeObserver | undefined;
    let mutations: MutationObserver | undefined;
    if (freshPage && !window.location.hash) frame = requestAnimationFrame(() => scrollTo(0));
    const cancel = (clearPending = true) => {
      restoring.current = false;
      if (clearPending) pending.current = null;
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      observer?.disconnect();
      mutations?.disconnect();
    };
    if (pending.current?.path === path) {
      const y = Math.max(0, pending.current.y);
      restoring.current = true;
      const attempt = (final = false) => {
        if (activeScope.current !== scope) { cancel(); return; }
        const available = availableHeight();
        if (available >= y || final) {
          scrollTo(Math.min(y, Math.max(0, available)));
          cancel();
        }
      };
      observer = new ResizeObserver(() => attempt());
      observer.observe(content ?? document.body);
      if (content) {
        mutations = new MutationObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => attempt()); });
        mutations.observe(content, { childList: true, subtree: true });
      }
      frame = requestAnimationFrame(() => attempt());
      timer = window.setTimeout(() => attempt(true), 2500);
    }
    let saveTimer = 0;
    const save = () => {
      if (restoring.current || activeScope.current !== scope || (native && !scrollReady)) return;
      if (native) writeViewRecord(path, owner, { nativeScroll: { session, y: readY() } });
      else writeViewRecord(path, owner, { y: readY() });
    };
    // Safari limits History API writes. Save once scrolling settles, not on every animation frame.
    const scroll = () => { clearTimeout(saveTimer); saveTimer = window.setTimeout(save, 200); };
    // Capture before Next changes the current history entry.
    const rememberLink = (targetNode: EventTarget | null, modified: boolean) => {
      save();
      linkVisit.current = null;
      if (modified) return;
      const link = targetNode instanceof Element ? targetNode.closest<HTMLAnchorElement>("a[href]") : null;
      if (!link || (link.target && link.target !== "_self")) return;
      const target = new URL(link.href, window.location.href);
      if (target.origin === window.location.origin && target.pathname !== path) linkVisit.current = { from: path, to: target.pathname };
    };
    const leave = (event: MouseEvent) => rememberLink(event.target, event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);
    const keyLeave = (event: KeyboardEvent) => { if (event.key === "Enter") rememberLink(event.target, event.metaKey || event.ctrlKey || event.shiftKey || event.altKey); };
    const scrollSource = content ?? window;
    scrollSource.addEventListener("scroll", scroll, { passive: true });
    document.addEventListener("click", leave, true);
    if (native) { document.addEventListener("pointerdown", leave, true); document.addEventListener("keydown", keyLeave, true); }
    window.addEventListener("pagehide", save);
    const userScroll = () => cancel();
    window.addEventListener("wheel", userScroll, { passive: true });
    window.addEventListener("touchstart", userScroll, { passive: true });
    return () => {
      cancel(false); clearTimeout(saveTimer);
      scrollSource.removeEventListener("scroll", scroll);
      document.removeEventListener("click", leave, true);
      if (native) { document.removeEventListener("pointerdown", leave, true); document.removeEventListener("keydown", keyLeave, true); }
      window.removeEventListener("pagehide", save);
      window.removeEventListener("wheel", userScroll);
      window.removeEventListener("touchstart", userScroll);
    };
  }, [owner, path, returnVisit, native, scope, session, scrollReady]);
  return null;
}
