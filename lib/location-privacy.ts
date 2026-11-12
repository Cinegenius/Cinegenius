import { hasCoordinates } from './location-map';
export type PrivateLocation = { address: string; lat: number; lng: number };
export type PublicLocationArea = { lat: number; lng: number; radius_meters: 500 };
export function privateLocationInput(value: unknown): PrivateLocation | null | false {
  if (value === null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  if (typeof row.address !== 'string' || row.address.length > 500 || /[\u0000-\u001f]/.test(row.address)) return false;
  if (!hasCoordinates(row as {lat: number; lng: number})) return false;
  return { address: row.address.trim(), lat: row.lat as number, lng: row.lng as number };
}
/** Stable grid cells prevent repeated requests from averaging away privacy offsets. */
export function publicLocationArea(point: PrivateLocation): PublicLocationArea {
  const latitudeBands = 45000; // ~445m cells; half the diagonal fits inside 500m.
  const band = Math.min(latitudeBands - 1, Math.floor((point.lat + 90) / 180 * latitudeBands));
  const lat = -90 + (band + 0.5) * 180 / latitudeBands;
  const longitudeBands = Math.max(1, Math.ceil(360 * 111195 * Math.cos(lat * Math.PI / 180) / 445));
  const column = Math.min(longitudeBands - 1, Math.floor((point.lng + 180) / 360 * longitudeBands));
  return { lat, lng: -180 + (column + 0.5) * 360 / longitudeBands, radius_meters: 500 };
}
export function readPublicLocationArea(metadata: unknown): PublicLocationArea | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const area = (metadata as Record<string,unknown>).location_area;
  if (!area || typeof area !== 'object' || Array.isArray(area)) return null;
  const row = area as Record<string,unknown>;
  if (row.radius_meters !== 500 || !hasCoordinates(row as {lat:number;lng:number})) return null;
  return {lat:row.lat as number,lng:row.lng as number,radius_meters:500};
}

/** Public discovery needs pricing/filter flags and the derived area, never arbitrary metadata. */
export function publicLocationBrowseMetadata(value: unknown, description = ""): Record<string, unknown> {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const result: Record<string, unknown> = {};
  for (const key of ['price_on_request', 'price_negotiable', 'power_available']) if (typeof source[key] === 'boolean') result[key] = source[key];
  if (['miete', 'kauf', 'beides'].includes(String(source.rental_type))) result.rental_type = source.rental_type;
  if (['innen', 'außen', 'beides'].includes(String(source.indoor_outdoor))) result.indoor_outdoor = source.indoor_outdoor;
  // Older public descriptions used these exact labels before structured fields.
  if (!result.indoor_outdoor) {
    const legacy = description.match(/Lage: ([^·\n]+)/)?.[1]?.trim();
    const normalized = legacy === 'Innen' ? 'innen' : legacy === 'Außen' ? 'außen' : legacy === 'Innen & Außen' ? 'beides' : null;
    if (normalized) result.indoor_outdoor = normalized;
  }
  if (typeof result.power_available !== 'boolean' && description.includes('Stromanschluss vorhanden')) result.power_available = true;
  const area = readPublicLocationArea(source);
  if (area) result.location_area = area;
  return result;
}
export function publicLocationFocalPoint(value: unknown): {x:number;y:number} | null {
  if (!value || typeof value !== 'object') return null;
  const point = (value as Record<string,unknown>).focal_point;
  if (!point || typeof point !== 'object' || Array.isArray(point)) return null;
  const {x,y} = point as Record<string,unknown>;
  return typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 100 && typeof y === 'number' && Number.isFinite(y) && y >= 0 && y <= 100 ? {x,y} : null;
}
