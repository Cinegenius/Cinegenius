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
  return value?.path === path && value.owner === owner && value.fields && typeof value.fields === "object"
    ? value : { path, owner, fields: {} };
}

export function mergeViewRecord(state: unknown, path: string, owner: string, patch: Partial<ViewRecord>) {
  return { ...(state as object ?? {}), [VIEW_STATE_KEY]: { ...viewRecord(state, path, owner), ...patch, path, owner } };
}

export function writeViewRecord(path: string, owner: string, patch: Partial<ViewRecord>) {
  if (window.location.pathname !== path) return;
  try { window.history.replaceState(mergeViewRecord(window.history.state, path, owner, patch), ""); }
  catch { /* Navigation and local controls still work when history storage is unavailable. */ }
}
