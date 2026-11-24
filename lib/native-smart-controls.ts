import type { SearchArea } from "./unified-search";
import type { DirectoryView } from "../components/DirectoryViewControls";
import type { SearchBrowseFilters } from "./browse-filters";
import { browseFilterControls } from "./browse-filter-controls";

export const NATIVE_SMART_PRIMARY = ["crew", "marketplace", "locations", "companies", "jobs"] as const satisfies readonly SearchArea[];

/** Project preferences remain in private history, but never affect native Smart queries or status. */
export function nativeSmartBrowseFilters(value?: SearchBrowseFilters): SearchBrowseFilters {
  return browseFilterControls(value ? { ...value, projectTypes: undefined } : undefined);
}

/** Normalize legacy history choices without changing any other account-owned filter. */
export function nativeSmartHiddenAreas(hidden: unknown): SearchArea[] {
  const normalized = NATIVE_SMART_PRIMARY.filter(area => Array.isArray(hidden) && hidden.includes(area));
  // Pan/zoom updates must not recreate the stable map pool for unchanged sources.
  return Array.isArray(hidden) && hidden.length === normalized.length && hidden.every((area, index) => area === normalized[index]) ? hidden : normalized;
}

/** Only the five visible sources participate in native Smart. Projects have their own tab. */
export function nativeSmartResultAreas(areas: readonly SearchArea[]): SearchArea[] {
  return NATIVE_SMART_PRIMARY.filter(area => areas.includes(area));
}

/** Independent switches: even the last choice can be turned off. No implicit reset. */
export function toggleNativeSmartArea(available: readonly SearchArea[], hidden: SearchArea[], area: SearchArea): SearchArea[] {
  if (!nativeSmartResultAreas(available).includes(area)) return hidden;
  const normalized = nativeSmartHiddenAreas(hidden);
  return nativeSmartHiddenAreas(normalized.includes(area) ? normalized.filter(value => value !== area) : [...normalized, area]);
}

export function nativeSmartView(mapOpen: boolean, saved?: DirectoryView): DirectoryView {
  return mapOpen ? "map" : saved === "grid" ? "grid" : "list";
}
