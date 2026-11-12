"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useAuth } from "@clerk/nextjs";
import { createAdminSupportUnreadRequestOwner, EMPTY_SUPPORT_UNREAD, SUPPORT_UNREAD_CHANGED } from "@/lib/admin-support-unread-polling";

function createStore(getToken: () => Promise<string | null>) {
  const owner = createAdminSupportUnreadRequestOwner({ getToken });
  let subscribers = 0;
  let stop: (() => void) | null = null;
  const visible = () => document.visibilityState === "visible" && navigator.onLine !== false;
  const refresh = () => { if (visible()) void owner.refresh(); };
  const invalidate = () => { if (visible()) void owner.refresh(true); };
  return {
    snapshot: owner.snapshot, refresh: invalidate,
    subscribe(listener: () => void) {
      const unsubscribe = owner.subscribe(listener);
      if (++subscribers === 1) {
        owner.setActive(true);
        const timer = window.setInterval(refresh, 60_000);
        document.addEventListener("visibilitychange", refresh);
        window.addEventListener("focus", refresh);
        window.addEventListener("online", refresh);
        window.addEventListener(SUPPORT_UNREAD_CHANGED, invalidate);
        stop = () => {
          window.clearInterval(timer);
          document.removeEventListener("visibilitychange", refresh);
          window.removeEventListener("focus", refresh);
          window.removeEventListener("online", refresh);
          window.removeEventListener(SUPPORT_UNREAD_CHANGED, invalidate);
          owner.setActive(false);
        };
        refresh();
      }
      return () => { unsubscribe(); if (--subscribers === 0) { stop?.(); stop = null; } };
    },
  };
}
const stores = new Map<string, ReturnType<typeof createStore>>();
const inactiveSubscribe = () => () => {};
const inactiveSnapshot = () => EMPTY_SUPPORT_UNREAD;

/** Header and admin page share one request owner scoped to the verified session. */
export function useAdminSupportUnread(serverAdminId: string | null | undefined) {
  const { userId, sessionId, isLoaded, getToken } = useAuth();
  const key = isLoaded && userId && sessionId && serverAdminId === userId ? `${userId}:${sessionId}` : null;
  const store = useMemo(() => {
    if (!key) return null;
    let current = stores.get(key);
    if (!current) { current = createStore(() => getToken()); stores.set(key, current); }
    return current;
  }, [key, getToken]);
  const snapshot = useSyncExternalStore(store?.subscribe ?? inactiveSubscribe, store?.snapshot ?? inactiveSnapshot, inactiveSnapshot);
  const refresh = useCallback(() => store?.refresh(), [store]);
  return { ...snapshot, refresh };
}
