import { hasCoordinates, locationDistanceKm } from "./location-map";
import { matchesPlace } from "./places/core";

export type BrowseRadius = { city: string; km: number; lat: number; lng: number };
/** Only coordinates already projected as public approximate places by the server. */
export function browseRadiusCenter(rows: readonly object[], city: string): { lat: number; lng: number } | null {
  if (!city) return null;
  for (const input of rows) {
    if (!matchesPlace(input, "city", city)) continue;
    const row = input as Record<string, unknown>;
    const point = row.cityCenter ?? row;
    if (point && typeof point === "object" && hasCoordinates(point as { lat: number | null; lng: number | null })) {
      const value = point as { lat: number; lng: number };
      return { lat: value.lat, lng: value.lng };
    }
  }
  return null;
}
export function inBrowseRadius(row: object, radius: BrowseRadius | null): boolean {
  if (!radius) return true;
  if (!Number.isInteger(radius.km) || radius.km < 1 || radius.km > 200 || !hasCoordinates(radius)) return false;
  const point = row as { lat: number | null; lng: number | null };
  return hasCoordinates(point) && locationDistanceKm([radius.lat, radius.lng], [point.lat, point.lng]) <= radius.km;
}
/** In radius mode the selected place is the origin, including across borders. */
export function matchesBrowsePlace(row: object, place: {country:string;region:string;city:string}, radius: BrowseRadius | null = null): boolean {
  return radius ? inBrowseRadius(row,radius) : matchesPlace(row,"country",place.country) && matchesPlace(row,"region",place.region) && matchesPlace(row,"city",place.city);
}
