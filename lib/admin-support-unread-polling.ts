export type SupportUnreadSnapshot = { count: number | null; status: "idle" | "loading" | "ready" | "error" };
export const EMPTY_SUPPORT_UNREAD: SupportUnreadSnapshot = { count: null, status: "idle" };
export const SUPPORT_UNREAD_CHANGED = "cg:support-unread-changed";

/** One account/session owns requests; deactivation invalidates late token responses too. */
export function createAdminSupportUnreadRequestOwner({ getToken, request = fetch, timeoutMs = 15_000 }: {
  getToken: () => Promise<string | null>; request?: typeof fetch; timeoutMs?: number;
}) {
  let snapshot = EMPTY_SUPPORT_UNREAD;
  let active = false;
  let generation = 0;
  let controller: AbortController | null = null;
  let pending: Promise<void> | null = null;
  const listeners = new Set<() => void>();
  const publish = (next: SupportUnreadSnapshot) => { snapshot = next; for (const listener of listeners) listener(); };
  return {
    snapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    setActive(next: boolean) {
      if (active === next) return;
      active = next;
      if (!active) { generation++; controller?.abort(); controller = null; pending = null; publish(EMPTY_SUPPORT_UNREAD); }
    },
    refresh(invalidate = false): Promise<void> {
      if (!active) return Promise.resolve();
      if (invalidate && pending) { generation++; controller?.abort(); controller = null; pending = null; }
      if (pending) return pending;
      const ownGeneration = generation;
      const ownController = new AbortController(); controller = ownController;
      const timer = setTimeout(() => ownController.abort(), timeoutMs);
      publish({ count: snapshot.count, status: "loading" });
      pending = (async () => {
        try {
          const payload = await new Promise<{ unreadCount: unknown }>((resolve, reject) => {
            const aborted = () => reject(new Error("request_aborted"));
            ownController.signal.addEventListener("abort", aborted, { once: true });
            Promise.resolve().then(async () => {
              const token = await getToken();
              if (ownController.signal.aborted || !active || generation !== ownGeneration) throw new Error("session_changed");
              if (!token) throw new Error("session_unavailable");
              const response = await request("/api/admin/support/unread", {
                cache: "no-store", headers: { Authorization: `Bearer ${token}` }, signal: ownController.signal,
              });
              if (!response.ok) throw new Error("unread_unavailable");
              return await response.json();
            }).then(resolve, reject).finally(() => ownController.signal.removeEventListener("abort", aborted));
          });
          if (!active || generation !== ownGeneration) return;
          if (!Number.isSafeInteger(payload?.unreadCount) || Number(payload.unreadCount) < 0) throw new Error("unread_unavailable");
          publish({ count: Number(payload.unreadCount), status: "ready" });
        } catch {
          if (active && generation === ownGeneration) publish({ count: snapshot.count, status: "error" });
        } finally {
          clearTimeout(timer);
          if (generation === ownGeneration) { pending = null; controller = null; }
        }
      })();
      return pending;
    },
  };
}
