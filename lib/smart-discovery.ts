import { inMapBounds, type MapBounds } from "./location-map";
import { SEARCH_AREAS, searchGroupKey, type SearchArea, type SearchGroup, type SearchPlan, type SearchResult } from "./unified-search";
import type { SearchBrowseFilters } from "./browse-filters";

export type DiscoveryFilters = {
  hiddenAreas: SearchArea[];
  hiddenWishes: number[];
  departments: string[];
  marketplace: string[];
  bounds: MapBounds | null;
  browse?: SearchBrowseFilters;
  /** Ephemeral canonical place picker text; never used as a search identity. */
  placeLabel?: string;
};
export const emptyDiscoveryFilters = (): DiscoveryFilters => ({ hiddenAreas: [], hiddenWishes: [], departments: [], marketplace: [], bounds: null });

/** Filter only permission-projected results. Unknown map positions remain in the
 * list, explicitly outside geographic filtering, rather than inventing a pin. */
export function filterDiscoveryGroups(groups: SearchGroup[], filters: DiscoveryFilters): SearchGroup[] {
  return groups.filter(group => !filters.hiddenAreas.includes(group.area) && !filters.hiddenWishes.includes(group.wishIndex)
    && !(group.area === "crew" && group.segment && filters.departments.length && !filters.departments.includes(group.segment)))
    .map(group => ({ ...group, results: group.results.filter(result => {
      if (group.area === "crew" && filters.departments.length && !group.segment
        && !result.facets?.departments?.some(id => filters.departments.includes(id))) return false;
      if (group.area === "marketplace" && filters.marketplace.length
        && !filters.marketplace.includes(result.facets?.marketplace ?? "")) return false;
      return !filters.bounds || !result.mapPoint || inMapBounds(result.mapPoint, filters.bounds);
    }) }));
}

/** Explicit wishes first; within each area local matches precede alternatives.
 * Preserve the server's evidence/distance order inside every group. */
export function sortDiscoveryGroups(groups: SearchGroup[], plan: SearchPlan): SearchGroup[] {
  return [...groups].sort((a, b) => Number(!!plan.searches[a.wishIndex]?.recommended) - Number(!!plan.searches[b.wishIndex]?.recommended)
    || Number(!a.results.length) - Number(!b.results.length)
    || Number(!!a.nearby) - Number(!!b.nearby)
    || SEARCH_AREAS.indexOf(a.area) - SEARCH_AREAS.indexOf(b.area)
    || a.wishIndex - b.wishIndex);
}

export function mergeDiscoveryPage(groups: SearchGroup[], page: SearchGroup): SearchGroup[] {
  return groups.map(group => searchGroupKey(group) !== searchGroupKey(page) ? group : {
    ...page,
    results: [...new Map([...(!!group.nearby === !!page.nearby ? group.results : []), ...page.results]
      .map(result => [`${result.type}:${result.id}`, result])).values()],
  });
}

export function discoveryCount(groups: SearchGroup[]): number {
  return new Set(groups.flatMap(group => group.results.map(result => `${result.type}:${result.id}`))).size;
}

export function discoveryFacets(groups: SearchGroup[]) {
  const departments = new Set<string>(), marketplace = new Set<string>();
  for (const group of groups) for (const result of group.results) {
    if (group.area === "crew") {
      if (group.segment) departments.add(group.segment);
      else result.facets?.departments?.forEach(id => departments.add(id));
    }
    if (group.area === "marketplace" && result.facets?.marketplace) marketplace.add(result.facets.marketplace);
  }
  return { departments: [...departments], marketplace: [...marketplace] };
}

/** Display only areas backed by currently visible rows, never by the plan alone. */
export function discoveryAreas(groups: SearchGroup[]) {
  const primary: SearchArea[] = ["crew", "locations", "marketplace", "companies"];
  return [...primary, ...SEARCH_AREAS.filter(area => !primary.includes(area))].filter(area => groups.some(group => group.area === area && group.results.length > 0));
}

/** One compact row per actual identity; the map uses the same first-match order. */
export function discoveryResults(groups: SearchGroup[]): SearchResult[] {
  const results = new Map<string, SearchResult>();
  for (const group of groups) for (const result of group.results) {
    const key = `${result.type}:${result.id}`;
    if (!results.has(key)) results.set(key, result);
  }
  return [...results.values()];
}
