import { hasCoordinates, inMapBounds, type MapBounds } from "./location-map";
import type { SearchGroup } from "./unified-search";
import { smartMapEntries } from "./smart-search-map";

/** The input is the permission-projected, non-geographically filtered pool.
 * Unpositioned entries remain reachable, but never count as viewport matches. */
export function nativeSmartViewportGroups(groups: SearchGroup[], bounds: MapBounds | null) {
  // Match the map's first identity occurrence even if repeated wishes carry
  // inconsistent coordinates. Never promote a later point into the viewport.
  const positions = new Map(smartMapEntries(groups).map(({ key, result }) => [key, result.mapPoint]));
  const visible: SearchGroup[] = [], unmapped: SearchGroup[] = [];
  for (const group of groups) {
    const mappedRows: SearchGroup["results"] = [], unmappedRows: SearchGroup["results"] = [];
    for (const result of group.results) {
      const point = positions.get(`${result.type}:${result.id}`);
      if (!point || !hasCoordinates(point)) unmappedRows.push(result);
      else if (!bounds || inMapBounds(point, bounds)) mappedRows.push(result);
    }
    visible.push({ ...group, results: mappedRows });
    unmapped.push({ ...group, results: unmappedRows });
  }
  return { visible, unmapped };
}
