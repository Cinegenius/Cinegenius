import { COUNTRY_CODES } from "./places/countries";

export const SEARCH_AREAS = ["crew", "marketplace", "locations", "companies", "jobs", "animals", "projects", "news", "organizations"] as const;
export type SearchArea = typeof SEARCH_AREAS[number];
export const CONTINENTS = ["002", "019", "142", "150", "009", "010"] as const;
export type SearchPlace = { city: string; country: string; continent: string; radiusKm: number };
export type SearchWish = { area: SearchArea | "all"; query: string; department: string; places: SearchPlace[];
  quantity?: number; recommended?: boolean; requirements?: string[][]; exclude?: string[] };
export type SearchPlan = { version: 1 | 2; searches: SearchWish[] };
export const MAX_SEARCHES = 6;
export const MAX_PLAN_LENGTH = 6000;

function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
const cleanText = (value: unknown, length: number) => typeof value === "string" && value.length <= length && !/[\u0000-\u001f<>\\]/.test(value);

/** Same bounded contract at the provider, navigation and data boundaries. No URLs or IDs of members. */
export function readSearchPlan(value: unknown): SearchPlan | null {
  if (!object(value) || ![1, 2].includes(Number(value.version)) || typeof value.version !== "number" || Object.keys(value).some(key => !["version", "searches"].includes(key))
    || !Array.isArray(value.searches) || !value.searches.length || value.searches.length > MAX_SEARCHES) return null;
  const searches: SearchWish[] = [];
  for (const wish of value.searches) {
    const allowed = ["area", "query", "department", "places", ...(value.version === 2 ? ["quantity", "recommended", "requirements", "exclude"] : [])];
    if (!object(wish) || Object.keys(wish).some(key => !allowed.includes(key))
      || ![...SEARCH_AREAS, "all"].includes(wish.area as SearchArea) || !cleanText(wish.query, 120)
      || !cleanText(wish.department, 60) || (!String(wish.query).trim() && !String(wish.department).trim())
      || (wish.department && wish.area !== "crew") || !Array.isArray(wish.places) || wish.places.length > 4) return null;
    if (wish.quantity !== undefined && (!Number.isInteger(wish.quantity) || Number(wish.quantity) < 1 || Number(wish.quantity) > 999)) return null;
    if (wish.recommended !== undefined && typeof wish.recommended !== "boolean") return null;
    if (wish.requirements !== undefined && (!Array.isArray(wish.requirements) || wish.requirements.length > 5 || wish.requirements.some(group => !Array.isArray(group) || !group.length || group.length > 4 || group.some(term => !cleanText(term, 60) || !String(term).trim())))) return null;
    if (wish.exclude !== undefined && (!Array.isArray(wish.exclude) || wish.exclude.length > 6 || wish.exclude.some(term => !cleanText(term, 60) || !String(term).trim()))) return null;
    const places: SearchPlace[] = [];
    for (const place of wish.places) {
      if (!object(place) || Object.keys(place).some(key => !["city", "country", "continent", "radiusKm"].includes(key))
        || !cleanText(place.city, 100) || typeof place.country !== "string" || typeof place.continent !== "string"
        || (place.country && !(COUNTRY_CODES as readonly string[]).includes(place.country))
        || (place.continent && !(CONTINENTS as readonly string[]).includes(place.continent))
        || (place.continent && (place.country || place.city)) || !Number.isInteger(place.radiusKm)
        || (value.version === 2 && !String(place.city).trim() && !place.country && !place.continent)
        || Number(place.radiusKm) < 0 || Number(place.radiusKm) > 200
        || (place.radiusKm && (!place.city || wish.area !== "crew"))) return null;
      places.push({ city: String(place.city).trim(), country: place.country, continent: place.continent, radiusKm: Number(place.radiusKm) });
    }
    searches.push({ area: wish.area as SearchWish["area"], query: String(wish.query).trim(), department: String(wish.department).trim(),
      places: places.filter((p, i) => places.findIndex(candidate => JSON.stringify(candidate) === JSON.stringify(p)) === i),
      ...(wish.quantity !== undefined ? { quantity: Number(wish.quantity) } : {}),
      ...(wish.recommended !== undefined ? { recommended: wish.recommended as boolean } : {}),
      ...(wish.requirements !== undefined ? { requirements: (wish.requirements as string[][]).map(group => [...new Set(group.map(term => term.trim()))]) } : {}),
      ...(wish.exclude !== undefined ? { exclude: [...new Set((wish.exclude as string[]).map(term => term.trim()))] } : {}),
    });
  }
  const plan: SearchPlan = { version: value.version as 1 | 2, searches };
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

export type SearchResult = { id: string; title: string; subtitle: string; type: string; price: number; priceLabel?: string; image: string | null; available: boolean | null;
  facets?: { departments?: string[]; marketplace?: string };
  evidence?: "role" | "title" | "requirements";
  nearby?: { distanceKm: number; origin: string };
  mapPoint?: { lat: number; lng: number; radiusMeters?: 500 } | null };
export type NearbyCursor = { distanceKm: number; id: string };
export type SearchRankCursor = { score: number; distanceKm: number; id: string };
export type SearchGroup = { area: SearchArea; wishIndex: number; label: string; results: SearchResult[]; nextOffset: number | null;
  segment?: string; rankCursor?: SearchRankCursor; nearby?: true; nearbyCursor?: NearbyCursor };

export const searchGroupKey = (group: Pick<SearchGroup, "area" | "wishIndex" | "segment">) => `${group.area}:${group.wishIndex}:${group.segment ?? ""}`;

export const SEARCH_WISH_SCHEMA = { type: "array", maxItems: MAX_SEARCHES, items: { type: "object", additionalProperties: false,
  properties: {
    area: { type: "string", enum: ["all", ...SEARCH_AREAS] }, query: { type: "string" }, department: { type: "string" },
    quantity: { type: ["integer", "null"], minimum: 1, maximum: 999 }, recommended: { type: "boolean" },
    requirements: { type: "array", maxItems: 5, items: { type: "array", minItems: 1, maxItems: 4, items: { type: "string", maxLength: 60 } } },
    exclude: { type: "array", maxItems: 6, items: { type: "string", maxLength: 60 } },
    places: { type: "array", maxItems: 4, items: { type: "object", additionalProperties: false, properties: {
      city: { type: "string" }, country: { type: "string", enum: ["", ...COUNTRY_CODES] },
      continent: { type: "string", enum: ["", ...CONTINENTS] }, radiusKm: { type: "integer", minimum: 0, maximum: 200 },
    }, required: ["city", "country", "continent", "radiusKm"] } },
  }, required: ["area", "query", "department", "places", "quantity", "recommended", "requirements", "exclude"],
} };
