const KEY = "cg_recent_searches";
const LIMIT = 5;
type SearchStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
/** A blocked, full or damaged browser store must never prevent search/navigation. */
export function readRecentSearches(storage: SearchStorage): string[] {
  try {
    const value: unknown = JSON.parse(storage.getItem(KEY) ?? "[]");
    return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string" && !!item.trim()).map(item => item.trim().slice(0, 100)))].slice(0, LIMIT) : [];
  } catch { return []; }
}
export function saveRecentSearch(storage: SearchStorage, query: string): void {
  const value = query.trim().slice(0, 100);
  if (!value) return;
  try { storage.setItem(KEY, JSON.stringify([value, ...readRecentSearches(storage).filter(item => item !== value)].slice(0, LIMIT))); }
  catch { /* Optional history never blocks navigation. */ }
}
export function removeRecentSearches(storage: SearchStorage): void {
  try { storage.removeItem(KEY); } catch { /* Optional history. */ }
}
