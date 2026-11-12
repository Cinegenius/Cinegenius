export type MapBounds = { south: number; north: number; west: number; east: number };
export function hasCoordinates<T extends { lat: number | null; lng: number | null }>(row: T): row is T & { lat: number; lng: number } {
  return typeof row.lat === "number" && Number.isFinite(row.lat) && Math.abs(row.lat) <= 90
    && typeof row.lng === "number" && Number.isFinite(row.lng) && Math.abs(row.lng) <= 180;
}
export function inMapBounds(row: { lat: number | null; lng: number | null }, bounds: MapBounds) {
  if (!hasCoordinates(row) || row.lat < bounds.south || row.lat > bounds.north) return false;
  if (bounds.east - bounds.west >= 360) return true;
  const west = ((bounds.west + 180) % 360 + 360) % 360 - 180;
  const east = ((bounds.east + 180) % 360 + 360) % 360 - 180;
  return west <= east ? row.lng >= west && row.lng <= east : row.lng >= west || row.lng <= east;
}
