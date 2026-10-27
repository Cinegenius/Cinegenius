export const VIEW_STATE_KEY = "cinegeniusView";
export type ViewRecord = { path: string; owner: string; fields: Record<string, unknown>; y?: number; from?: string };

export function sameViewValue(first: unknown, second: unknown): boolean {
  if (Object.is(first, second)) return true;
  if (first instanceof Set && second instanceof Set) return first.size === second.size && [...first].every(value => second.has(value));
  if (first && second && typeof first === "object" && typeof second === "object") {
    try { return JSON.stringify(first) === JSON.stringify(second); } catch { return false; }
  }
  return false;
}

// History entries contain controls and coordinates only, never fetched rows or messages.
export function viewRecord(state: unknown, path: string, owner: string): ViewRecord {
  const value = (state as Record<string, unknown> | null)?.[VIEW_STATE_KEY] as ViewRecord | undefined;
  const publicList = ["/", "/creators", "/companies", "/locations", "/props", "/jobs", "/projects", "/community", "/photo"].includes(path)
    || /^\/projects\/(alle|film|foto|werbung|social-media|musikvideo|dokumentation|corporate|event)$/.test(path);
  // A visitor can use public filters before Clerk finishes loading. These contain
  // no private records. Adopt only this guest view, never another member's view.
  const adoptGuest = publicList && (value?.owner === "pending" || (value?.owner === "guest" && owner !== "guest"));
  return value?.path === path && (value.owner === owner || adoptGuest) && value.fields && typeof value.fields === "object"
    ? { ...value, owner } : { path, owner, fields: {} };
}

export function mergeViewRecord(state: unknown, path: string, owner: string, patch: Partial<ViewRecord>) {
  return { ...(state as object ?? {}), [VIEW_STATE_KEY]: { ...viewRecord(state, path, owner), ...patch, path, owner } };
}

export function writeViewRecord(path: string, owner: string, patch: Partial<ViewRecord>) {
  if (window.location.pathname !== path) return;
  try { window.history.replaceState(mergeViewRecord(window.history.state, path, owner, patch), ""); }
  catch { /* Navigation and local controls still work when history storage is unavailable. */ }
}
