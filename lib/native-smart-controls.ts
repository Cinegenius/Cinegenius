import type { SearchArea } from "./unified-search";
import type { DirectoryView } from "../components/DirectoryViewControls";

export const NATIVE_SMART_PRIMARY = ["crew", "marketplace", "smart", "locations", "companies"] as const;

/** Result groups follow the visible native choices; other real domains stay reachable. */
export function nativeSmartResultAreas(areas: SearchArea[]): SearchArea[] {
  const primary = NATIVE_SMART_PRIMARY.flatMap(area => area === "smart" || !areas.includes(area) ? [] : [area]);
  return [...primary, ...areas.filter(area => !primary.some(value => value === area))];
}

/** Filter already permission-projected results, without inventing additional result areas. */
export function toggleNativeSmartArea(available: SearchArea[], hidden: SearchArea[], area: SearchArea): SearchArea[] {
  if (!available.includes(area)) return hidden;
  const selected = available.filter(value => !hidden.includes(value));
  if (selected.length === available.length) return available.filter(value => value !== area);
  const next = selected.includes(area) ? selected.filter(value => value !== area) : [...selected, area];
  return next.length ? available.filter(value => !next.includes(value)) : [];
}

export function nativeSmartView(mapOpen: boolean, saved?: DirectoryView): DirectoryView {
  return mapOpen ? "map" : saved === "grid" ? "grid" : "list";
}
