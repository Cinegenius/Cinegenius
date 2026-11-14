import { COUNTRY_CODES } from "./places/countries";

export const SEARCH_AREAS = ["crew", "marketplace", "locations", "companies", "jobs", "animals", "projects", "news", "organizations"] as const;
export type SearchArea = typeof SEARCH_AREAS[number];
export const CONTINENTS = ["002", "019", "142", "150", "009", "010"] as const;
export type SearchPlace = { city: string; country: string; continent: string; radiusKm: number };
export type SearchWish = { area: SearchArea | "all"; query: string; department: string; places: SearchPlace[] };
export type SearchPlan = { version: 1; searches: SearchWish[] };
export const MAX_SEARCHES = 6;
export const MAX_PLAN_LENGTH = 6000;

function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
const cleanText = (value: unknown, length: number) => typeof value === "string" && value.length <= length && !/[\u0000-\u001f<>\\]/.test(value);

/** Same bounded contract at the provider, navigation and data boundaries. No URLs or IDs of members. */
export function readSearchPlan(value: unknown): SearchPlan | null {
  if (!object(value) || value.version !== 1 || Object.keys(value).some(key => !["version", "searches"].includes(key))
    || !Array.isArray(value.searches) || !value.searches.length || value.searches.length > MAX_SEARCHES) return null;
  const searches: SearchWish[] = [];
  for (const wish of value.searches) {
    if (!object(wish) || Object.keys(wish).some(key => !["area", "query", "department", "places"].includes(key))
      || ![...SEARCH_AREAS, "all"].includes(wish.area as SearchArea) || !cleanText(wish.query, 120)
      || !cleanText(wish.department, 60) || (!String(wish.query).trim() && !String(wish.department).trim())
      || (wish.department && wish.area !== "crew") || !Array.isArray(wish.places) || wish.places.length > 4) return null;
    const places: SearchPlace[] = [];
    for (const place of wish.places) {
      if (!object(place) || Object.keys(place).some(key => !["city", "country", "continent", "radiusKm"].includes(key))
        || !cleanText(place.city, 100) || typeof place.country !== "string" || typeof place.continent !== "string"
        || (place.country && !(COUNTRY_CODES as readonly string[]).includes(place.country))
        || (place.continent && !(CONTINENTS as readonly string[]).includes(place.continent))
        || (place.continent && (place.country || place.city)) || !Number.isInteger(place.radiusKm)
        || Number(place.radiusKm) < 0 || Number(place.radiusKm) > 200
        || (place.radiusKm && (!place.city || wish.area !== "crew"))) return null;
      places.push({ city: String(place.city).trim(), country: place.country, continent: place.continent, radiusKm: Number(place.radiusKm) });
    }
    searches.push({ area: wish.area as SearchWish["area"], query: String(wish.query).trim(), department: String(wish.department).trim(),
      places: places.filter((p, i) => places.findIndex(candidate => JSON.stringify(candidate) === JSON.stringify(p)) === i) });
  }
  const plan: SearchPlan = { version: 1, searches };
  return JSON.stringify(plan).length <= MAX_PLAN_LENGTH ? plan : null;
}

export function decodeSearchPlan(encoded: string | null): SearchPlan | null {
  if (!encoded || encoded.length > MAX_PLAN_LENGTH) return null;
  try { return readSearchPlan(JSON.parse(encoded)); } catch { return null; }
}

export function unifiedSearchHref(plan: SearchPlan): string {
  return `/search?${new URLSearchParams({ plan: JSON.stringify(plan) })}`;
}

export function searchPlanFromHref(href: string): SearchPlan | null {
  if (!href.startsWith("/search?") || href.length > MAX_PLAN_LENGTH * 3 || /[\\\u0000-\u001f#]/.test(href)) return null;
  const params = new URLSearchParams(href.slice(8));
  return params.size === 1 && params.has("plan") ? decodeSearchPlan(params.get("plan")) : null;
}

export type SearchResult = { id: string; title: string; subtitle: string; type: string; price: number; priceLabel?: string; image: string | null; available: boolean | null };
export type SearchGroup = { area: SearchArea; wishIndex: number; label: string; results: SearchResult[]; nextOffset: number | null };

export const SEARCH_WISH_SCHEMA = { type: "array", maxItems: MAX_SEARCHES, items: { type: "object", additionalProperties: false,
  properties: {
    area: { type: "string", enum: ["all", ...SEARCH_AREAS] }, query: { type: "string" }, department: { type: "string" },
    places: { type: "array", maxItems: 4, items: { type: "object", additionalProperties: false, properties: {
      city: { type: "string" }, country: { type: "string", enum: ["", ...COUNTRY_CODES] },
      continent: { type: "string", enum: ["", ...CONTINENTS] }, radiusKm: { type: "integer", minimum: 0, maximum: 200 },
    }, required: ["city", "country", "continent", "radiusKm"] } },
  }, required: ["area", "query", "department", "places"],
} };
