import type { QuickStartDraft } from "./quick-start-flow";

export function isQuickStartContentSaved(draft: QuickStartDraft) {
  return draft.intents.length > 0 && draft.intents.every(intent =>
    intent === "search" || (intent === "crew" || intent === "talent") && draft.completed.profile
    || intent === "company" && !!draft.completed.company
    || (intent === "location" || intent === "equipment") && !!draft.completed.listings[intent]);
}

/** Serialize writes and skip snapshots already acknowledged by the server. */
export function createOnboardingSaveQueue<T = QuickStartDraft>(save: (draft: T) => Promise<boolean>) {
  let acknowledged = "";
  let queue: Promise<boolean> = Promise.resolve(true);
  return {
    acknowledge(draft: T) { acknowledged = JSON.stringify(draft); },
    matches(draft: T) { return acknowledged ? acknowledged === JSON.stringify(draft) : null; },
    save(draft: T) {
      const fingerprint = JSON.stringify(draft);
      queue = queue.catch(() => false).then(async () => {
        if (acknowledged === fingerprint) return true;
        const saved = await save(draft);
        if (saved) acknowledged = fingerprint;
        return saved;
      });
      return queue;
    },
    settle() { return queue; },
  };
}

export function clerkRateLimitSeconds(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const value = error as { status?: number; retryAfter?: number; errors?: { code?: string }[] };
  if (value.status !== 429 && !value.errors?.some(entry => entry.code === "too_many_requests")) return null;
  return Number.isFinite(value.retryAfter) && Number(value.retryAfter) > 0 ? Math.ceil(Number(value.retryAfter)) : 10;
}
