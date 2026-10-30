import type { NotificationType } from "./notifications";

export type InboxNotification = {
  id: string; type: NotificationType; title: string; body: string;
  href: string; read: boolean; created_at: string;
};
export type InboxSnapshot = {
  status: "idle" | "loading" | "ready" | "error" | "expired";
  count: number | null;
  notifications: InboxNotification[];
};
type Identity = { userId: string; sessionId: string };
type TokenGetter = (options?: { skipCache?: boolean }) => Promise<string | null>;

/** One session-scoped request owner for both header variants and both counters. */
export function createInboxPolling(identity: Identity | null, getToken: TokenGetter, options: {
  fetch?: typeof fetch; now?: () => number; timeoutMs?: number;
} = {}) {
  const request = options.fetch ?? fetch;
  const now = options.now ?? Date.now;
  const initial: InboxSnapshot = { status: identity ? "loading" : "idle", count: null, notifications: [] };
  let snapshot = initial;
  let stopped = false;
  let inFlight: Promise<void> | null = null;
  let failureCount = 0;
  let retryAt = 0;
  let readRevision = 0;
  const controllers = new Set<AbortController>();
  const listeners = new Set<() => void>();
  const isExpired = () => snapshot.status === "expired";
  const update = (next: InboxSnapshot) => {
    if (stopped) return;
    snapshot = next;
    listeners.forEach(listener => listener());
  };
  const expire = () => {
    update({ status: "expired", count: null, notifications: [] });
    controllers.forEach(controller => controller.abort());
  };

  async function tokenBeforeTimeout(signal: AbortSignal, retry: boolean) {
    let onAbort: () => void = () => {};
    try {
      return await Promise.race([
        getToken(retry ? { skipCache: true } : undefined),
        new Promise<never>((_resolve, reject) => {
          onAbort = () => reject(new Error("cancelled"));
          if (signal.aborted) onAbort();
          else signal.addEventListener("abort", onAbort, { once: true });
        }),
      ]);
    } finally {
      signal.removeEventListener("abort", onAbort);
    }
  }

  async function authorizedRequest(url: string, init: RequestInit, signal: AbortSignal, retry: boolean) {
    const token = await tokenBeforeTimeout(signal, retry);
    if (stopped || signal.aborted) throw new Error("cancelled");
    if (!token) { expire(); throw new Error("session"); }
    const response = await request(url, {
      ...init, signal, cache: "no-store", credentials: "same-origin",
      headers: { ...init.headers, Authorization: `Bearer ${token}` },
    });
    if (!stopped && response.status === 401) expire();
    return response;
  }

  function refresh(retry = false): Promise<void> {
    if (stopped || !identity || (snapshot.status === "expired" && !retry)) return Promise.resolve();
    if (inFlight) return inFlight;
    if (!retry && now() < retryAt) return Promise.resolve();
    const controller = new AbortController();
    controllers.add(controller);
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 15_000);
    const revision = readRevision;
    if (retry || snapshot.count === null) update({ ...snapshot, status: "loading" });
    inFlight = (async () => {
      try {
        // Obtain one fresh SDK token before starting either protected request.
        const token = await tokenBeforeTimeout(controller.signal, retry);
        if (stopped || controller.signal.aborted) return;
        if (!token) { expire(); return; }
        const fetchPart = async (url: string) => {
          const response = await request(url, {
            signal: controller.signal, cache: "no-store", credentials: "same-origin",
            headers: { Authorization: `Bearer ${token}` },
          });
          if (response.status === 401) { expire(); throw new Error("session"); }
          if (!response.ok) throw new Error("request");
          return response.json();
        };
        const [messages, notifications] = await Promise.all([
          fetchPart("/api/unread-count"), fetchPart("/api/notifications"),
        ]);
        if (stopped || controller.signal.aborted || snapshot.status === "expired") return;
        if (!Number.isInteger(messages.count) || messages.count < 0 || !Array.isArray(notifications.notifications)) throw new Error("response");
        failureCount = 0;
        retryAt = 0;
        // A concurrent successful read must not be undone by an older list response.
        if (revision !== readRevision) return;
        update({ status: "ready", count: messages.count, notifications: notifications.notifications });
      } catch {
        if (stopped || snapshot.status === "expired") return;
        controller.abort();
        failureCount += 1;
        retryAt = now() + Math.min(60_000, 10_000 * 2 ** (failureCount - 1));
        update({ ...snapshot, status: "error" });
      } finally {
        clearTimeout(timeout);
        controllers.delete(controller);
        inFlight = null;
      }
    })();
    return inFlight;
  }

  async function markRead(id?: string) {
    if (stopped || !identity || snapshot.status === "expired") return false;
    const controller = new AbortController();
    controllers.add(controller);
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 15_000);
    try {
      const response = await authorizedRequest("/api/notifications", id ? {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }),
      } : { method: "PATCH" }, controller.signal, false);
      if (!response.ok || (await response.json()).success !== true) throw new Error("read");
      if (stopped || controller.signal.aborted || isExpired()) return false;
      readRevision += 1;
      update({ ...snapshot, notifications: snapshot.notifications.map(n => !id || n.id === id ? { ...n, read: true } : n) });
      return true;
    } catch {
      if (!stopped && !isExpired()) update({ ...snapshot, status: "error" });
      return false;
    } finally {
      clearTimeout(timeout);
      controllers.delete(controller);
    }
  }

  async function refreshAfterMessageRead() {
    // A count requested before a successful read receipt may already be stale.
    readRevision += 1;
    if (inFlight) await inFlight;
    await refresh();
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    refresh, markRead, refreshAfterMessageRead,
    stop() {
      stopped = true;
      controllers.forEach(controller => controller.abort());
      controllers.clear();
      snapshot = { status: "idle", count: null, notifications: [] };
      listeners.clear();
    },
  };
}
