/** Private form snapshots only. These keys never publish or change the underlying content. */
export const FORM_DRAFT_LIMIT = 250_000;
export function validFormDraftKey(key: unknown): key is string {
  return typeof key === "string" && /^(profile:edit|setup:quick|setup:profile|guided:(location|equipment)|company:(new|[0-9a-f-]{36})|listing:(new|[0-9a-f-]{36})|project:(new|quick|[0-9a-f-]{36})|board:compose)$/.test(key);
}

export function draftFingerprint(value: unknown): string {
  return JSON.stringify(value, (_key, item) => item && typeof item === "object" && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
}

const VIEW_FIELDS = new Set(["step", "activeGroup", "composerOpen", "editing", "editingTimeline", "showFestivalForm", "showStreamingForm", "showTvForm", "showJoin"]);
/** Opening an editor/section is recoverable view state, not an unsaved user edit. */
export function draftContentFingerprint(value: unknown) {
  return draftFingerprint(value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).filter(([key]) => !VIEW_FIELDS.has(key))) : value);
}

export function validFormDraftData(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const serialized = JSON.stringify(value);
  // Local previews/files and authentication material must never become durable snapshots.
  return new TextEncoder().encode(serialized).length <= FORM_DRAFT_LIMIT
    && !/(?:"(?:password|sessionToken|accessToken|secretKey)"\s*:|"(?:blob:|data:))/i.test(serialized);
}

export type DraftWrite = { revision: number; data: Record<string, unknown> | null };

/** Preserve added defaults when restoring an older snapshot; ignore unknown form fields. */
export function mergeFormDraft<T extends Record<string, unknown>>(defaults: T, saved: Record<string, unknown>): T {
  const result = { ...defaults } as Record<string, unknown>;
  for (const key of Object.keys(defaults)) {
    if (!Object.hasOwn(saved, key)) continue;
    const value = saved[key], fallback = defaults[key];
    if (fallback === null) {
      if (value === null || typeof value === "string" || typeof value === "object") result[key] = value;
    } else if (Array.isArray(fallback)) {
      if (Array.isArray(value)) result[key] = value;
    } else if (fallback && typeof fallback === "object") {
      if (value && typeof value === "object" && !Array.isArray(value)) result[key] = Object.keys(fallback).length
        ? mergeFormDraft(fallback as Record<string, unknown>, value as Record<string, unknown>)
        : Object.fromEntries(Object.entries(value).filter(([name]) => !["__proto__", "constructor", "prototype"].includes(name)));
    } else if (typeof value === typeof fallback) result[key] = value;
  }
  return result as T;
}

/** Serial, coalescing writes. A response acknowledges only the exact snapshot sent. */
export function createFormDraftQueue(write: (value: Record<string, unknown> | null, revision: number) => Promise<DraftWrite>) {
  let revision = 0;
  let acknowledged = "";
  let chain: Promise<void> = Promise.resolve();
  return {
    load(value: unknown, version: number) { revision = version; acknowledged = draftFingerprint(value); },
    rebase(value: unknown) { acknowledged = draftFingerprint(value); },
    isSaved(value: unknown) { return draftFingerprint(value) === acknowledged; },
    confirmed() { return acknowledged ? JSON.parse(acknowledged) as Record<string, unknown> | null : null; },
    save(value: Record<string, unknown> | null) {
      const fingerprint = draftFingerprint(value);
      const snapshot = JSON.parse(fingerprint) as Record<string, unknown> | null;
      const task = chain.catch(() => {}).then(async () => {
        if (fingerprint === acknowledged) return;
        const result = await write(snapshot, revision);
        revision = result.revision;
        acknowledged = fingerprint;
      });
      chain = task;
      return task;
    },
    settle() { return chain; },
  };
}
