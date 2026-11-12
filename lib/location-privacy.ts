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
