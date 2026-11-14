import { COUNTRY_CODES } from "./places/countries";

/** Read-only links only. Never accept model-generated URLs, paths or write endpoints. */
export function isGenieSearchHref(href: string): boolean {
  if (isGenieCrewSearchHref(href)) return true;
  const path = href.split("?", 1)[0];
  if (!["/props", "/locations"].includes(path) || !href.includes("?") || href.length > 1800 || /[\\\u0000-\u001f#]/.test(href)) return false;
  const params = new URLSearchParams(href.slice(path.length + 1));
  if ([...params.keys()].some(key => !["genie", "q", "cityText", "country"].includes(key) || params.getAll(key).length !== 1)) return false;
  if (params.get("genie") !== "1") return false;
  for (const [key, limit] of [["q", 150], ["cityText", 120]] as const) {
    const value = params.get(key);
    if (value !== null && (!value.trim() || value.length > limit || /[\u0000-\u001f<>\\]/.test(value))) return false;
  }
  const country = params.get("country");
  if (country !== null && !(COUNTRY_CODES as readonly string[]).includes(country)) return false;
  return !!(params.get("q") || params.get("cityText") || country);
}

export function isGenieCrewSearchHref(href: string): boolean {
  if (!href.startsWith("/creators?") || href.length > 1800 || /[\\\u0000-\u001f#]/.test(href)) return false;
  const params = new URLSearchParams(href.slice("/creators?".length));
  if (!params.size || [...params.keys()].some(key => !["department", "role", "near", "radius", "cityText", "country", "genie"].includes(key))) return false;
  if ([...params.keys()].some(key => params.getAll(key).length !== 1)) return false;
  if (params.get("genie") !== "1") return false;
  for (const key of ["department", "role", "near", "cityText", "country"]) {
    const value = params.get(key);
    if (value !== null && (!value.trim() || value.length > 250 || /[\u0000-\u001f<>\\]/.test(value))) return false;
  }
  const radius = params.get("radius");
  if (radius && (!/^[1-9]\d{0,2}$/.test(radius) || Number(radius) > 200 || !params.get("near"))) return false;
  if (params.get("near") && !radius) return false;
  return !!(params.get("department") || params.get("role"));
}

export type CrewNear = { id: string; name: string; lat: number; lng: number; radius: number };
export function withinCrewRadius(row: { lat?: number | null; lng?: number | null }, near: CrewNear): boolean {
  if (typeof row.lat !== "number" || !Number.isFinite(row.lat) || typeof row.lng !== "number" || !Number.isFinite(row.lng)) return false;
  const radians = Math.PI / 180;
  const sinLat = Math.sin((row.lat - near.lat) * radians / 2);
  const sinLng = Math.sin((row.lng - near.lng) * radians / 2);
  const a = sinLat * sinLat + Math.cos(near.lat * radians) * Math.cos(row.lat * radians) * sinLng * sinLng;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a))) <= near.radius;
}
