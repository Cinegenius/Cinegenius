import coordinates from './city-coordinates.json' with { type: 'json' };
import { placeCandidatesForLabel, placeFieldsForId, placeCatalog, regionAliases } from './catalog';
import { countryCode, placeKey } from './core';

const points = coordinates as unknown as Record<string, [string, number, number]>;
const regions = new Map(placeCatalog.regions.map(region => [region.id, region]));

/** Approximate display only. Never upgrades or writes a member's stored place fields. */
function legacyCityPoint(row: Record<string, unknown>) {
  const raw = (typeof row.location === 'string' ? row.location : typeof row.city === 'string' ? row.city : '').trim();
  if (!raw || raw.length > 500 || countryCode(raw) || row.place_status === 'empty') return undefined;
  const parts = raw.split(',').map(part => part.trim()).filter(Boolean);
  if (parts.length > 8) return undefined;
  const namedCountry = parts.length > 1 ? countryCode(parts.at(-1)!) : '';
  const storedCountry = typeof row.place_country_code === 'string' ? countryCode(row.place_country_code) : '';
  if (row.place_country_code && !storedCountry) return undefined;
  if (namedCountry && storedCountry && namedCountry !== storedCountry) return undefined;
  if (namedCountry) parts.pop();
  const country = namedCountry || storedCountry;
  const candidates = new Map<string, typeof placeCatalog.cities[number]>();
  // A suffix may be a region, but never silently discard another city or an address.
  for (let end = parts.length; end > 0; end--) {
    for (const city of placeCandidatesForLabel(parts.slice(0, end).join(', '), country)) {
      if (row.place_region_id && row.place_region_id !== city.region) continue;
      const region = regions.get(city.region);
      if (typeof row.place_region_name === 'string' && row.place_region_name.trim()
        && (!region || !regionAliases(region).some(name => placeKey(name) === placeKey(row.place_region_name as string)))) continue;
      if (placeFieldsForId(city.id, [...parts, city.country].join(', '))) candidates.set(city.id, city);
    }
  }
  if (candidates.size !== 1) return undefined;
  return points[candidates.keys().next().value!];
}

/** Server-side public projection. A city centre is never a member's address. */
export function publicMapPoint(record: object): { lat: number | null; lng: number | null } {
  const row = record as Record<string, unknown>;
  if (row.map_visible === false) return { lat: null, lng: null };
  if (row.place_city_id) {
    const point = typeof row.place_city_id === 'string' && Object.hasOwn(points, row.place_city_id)
      ? points[row.place_city_id] : undefined;
    if (row.place_status === 'verified' && point && point[0] === row.place_country_code) return { lat: point[1], lng: point[2] };
    return { lat: null, lng: null };
  }
  const point = legacyCityPoint(row);
  return point ? { lat: point[1], lng: point[2] } : { lat: null, lng: null };
}
