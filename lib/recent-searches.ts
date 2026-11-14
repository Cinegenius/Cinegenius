const KEY = "cg_recent_searches";
/** Retire only the old search history, without reading it or touching filters. */
export function removeRecentSearches(storage: Pick<Storage, "removeItem">): void {
  try { storage.removeItem(KEY); } catch { /* Storage may be blocked. Search remains usable. */ }
}
