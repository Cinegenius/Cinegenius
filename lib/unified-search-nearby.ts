import { publicMapPoint } from "./places/public-map-point";
import { locationDistanceKm } from "./location-map";
import { matchesSearchPlace, searchCityCandidates } from "./unified-search-matching";
import type { NearbyCursor, SearchWish } from "./unified-search";

export function nearbyOrigins(wish: SearchWish) {
  if (!wish.places.length || wish.places.some(place => !place.city)) return [];
  const origins = wish.places.flatMap(place => {
    const cities = searchCityCandidates(place.city, place.country);
    if (cities.length !== 1) return [];
    const point = publicMapPoint({ place_city_id: cities[0].id, place_country_code: cities[0].country, place_status: "verified" });
    return point.lat === null || point.lng === null ? [] : [{ place, lat: point.lat, lng: point.lng }];
  });
  // An ambiguous place must not silently disappear from the requested geography.
  return origins.length === wish.places.length ? origins : [];
}

export function nearbyDistance(row: Record<string, unknown>, origins: ReturnType<typeof nearbyOrigins>) {
  // Only call with a permission-projected row. Honor map opt-out too; never use
  // exact coordinates, addresses, or a hidden location to rank a person.
  const point = publicMapPoint(row);
  if (point.lat === null || point.lng === null) return null;
  const distances = origins.filter(origin => matchesSearchPlace(row, { ...origin.place, city: "", radiusKm: 0 }))
    .map(origin => ({ distanceKm: locationDistanceKm([origin.lat, origin.lng], [point.lat!, point.lng!]), origin: origin.place.city }));
  return distances.sort((a, b) => a.distanceKm - b.distanceKm)[0] ?? null;
}

export function compareNearby(a: NearbyCursor, b: NearbyCursor) {
  return a.distanceKm - b.distanceKm || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

export function validNearbyCursor(value: unknown): value is NearbyCursor | undefined {
  if (value === undefined) return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const cursor = value as Record<string, unknown>;
  return Object.keys(cursor).length === 2 && typeof cursor.distanceKm === "number" && Number.isFinite(cursor.distanceKm)
    && cursor.distanceKm >= 0 && cursor.distanceKm <= 20_050 && typeof cursor.id === "string" && !!cursor.id && cursor.id.length <= 200;
}
