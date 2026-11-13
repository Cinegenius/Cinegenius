import coordinates from './city-coordinates.json' with { type: 'json' };

const points = coordinates as unknown as Record<string, [string, number, number]>;

/** Server-side public projection. A city centre is never a member's address. */
export function publicMapPoint(record: object): { lat: number | null; lng: number | null } {
  const row = record as Record<string, unknown>;
  const point = typeof row.place_city_id === 'string' && Object.hasOwn(points, row.place_city_id)
    ? points[row.place_city_id] : undefined;
  if (row.place_status !== 'verified' || !point || point[0] !== row.place_country_code) {
    return { lat: null, lng: null };
  }
  return { lat: point[1], lng: point[2] };
}
