/** Existing structured public offer facts; no address, access notes or private coordinates. */
export type LocationDetailFilters = {
  sqm?: string; ceiling?: string; parking?: string; loading?: string; blackout?: string; natural?: string;
};
export const LOCATION_DETAIL_PARAMS = ["sqm", "ceiling", "parking", "loading", "blackout", "natural"] as const;
export function readLocationDetailFilters(value: Record<string, unknown>): LocationDetailFilters {
  const result: LocationDetailFilters = {};
  for (const key of ["sqm", "ceiling", "parking"] as const) {
    const raw = value[key];
    if (typeof raw !== "string" || !/^\d{1,7}(?:[.,]\d{1,6})?$/.test(raw)) continue;
    const amount = Number(raw.replace(",", "."));
    if (Number.isFinite(amount) && amount > 0 && amount <= 1_000_000) result[key] = String(amount);
  }
  for (const key of ["loading", "blackout", "natural"] as const) if (value[key] === "1") result[key] = "1";
  return result;
}
export function matchesLocationDetails(metadata: Record<string, unknown> | undefined, value: LocationDetailFilters): boolean {
  const filters = readLocationDetailFilters(value);
  for (const [filter, field] of [["sqm", "sqm"], ["ceiling", "ceiling_height_m"], ["parking", "parking_spots"]] as const) {
    if (!filters[filter]) continue;
    const fact = metadata?.[field];
    if (typeof fact !== "number" || !Number.isFinite(fact) || fact < Number(filters[filter])) return false;
  }
  return (!filters.loading || metadata?.loading_access === true) && (!filters.blackout || metadata?.blackout_possible === true)
    && (!filters.natural || metadata?.natural_light === true);
}
