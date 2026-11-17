import { COUNTRY_CODES } from "./places/countries";

export const SEARCH_AREAS = ["crew", "marketplace", "locations", "companies", "jobs", "animals", "projects", "news", "organizations"] as const;
export type SearchArea = typeof SEARCH_AREAS[number];
export const CONTINENTS = ["002", "019", "142", "150", "009", "010"] as const;
export type SearchPlace = { city: string; country: string; continent: string; radiusKm: number };
export const SEARCH_PRICE_UNITS = ["unspecified", "hour", "day", "week", "month", "project", "purchase"] as const;
export const SEARCH_CURRENCIES = ["EUR", "CHF", "USD", "GBP"] as const;
export type SearchBudget = { max: number; currency: typeof SEARCH_CURRENCIES[number]; unit: typeof SEARCH_PRICE_UNITS[number]; scope: "each" | "total" | "unknown" };
export type SearchWish = { area: SearchArea | "all"; query: string; department: string; places: SearchPlace[];
  quantity?: number; recommended?: boolean; requirements?: string[][]; exclude?: string[];
  budget?: SearchBudget; period?: string; unsupported?: string[]; allowNearby?: boolean };
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
    const allowed = ["area", "query", "department", "places", ...(value.version === 2 ? ["quantity", "recommended", "requirements", "exclude", "budget", "period", "unsupported", "allowNearby"] : [])];
    if (!object(wish) || Object.keys(wish).some(key => !allowed.includes(key))
      || ![...SEARCH_AREAS, "all"].includes(wish.area as SearchArea) || !cleanText(wish.query, 120)
      || !cleanText(wish.department, 60) || (!String(wish.query).trim() && !String(wish.department).trim())
      || (wish.department && wish.area !== "crew") || !Array.isArray(wish.places) || wish.places.length > 4) return null;
    if (wish.quantity !== undefined && (!Number.isInteger(wish.quantity) || Number(wish.quantity) < 1 || Number(wish.quantity) > 999)) return null;
    if (wish.recommended !== undefined && typeof wish.recommended !== "boolean") return null;
    if (wish.allowNearby !== undefined && typeof wish.allowNearby !== "boolean") return null;
    if (wish.period !== undefined && (!cleanText(wish.period, 100) || !String(wish.period).trim())) return null;
    if (wish.unsupported !== undefined && (!Array.isArray(wish.unsupported) || wish.unsupported.length > 6 || wish.unsupported.some(term => !cleanText(term, 120) || !String(term).trim()))) return null;
    if (wish.budget !== undefined) {
      const budget = wish.budget;
      if (!object(budget) || Object.keys(budget).length !== 4 || Object.keys(budget).some(key => !["max", "currency", "unit", "scope"].includes(key))
        || typeof budget.max !== "number" || !Number.isFinite(budget.max) || budget.max < 0.01 || budget.max > 1_000_000_000
        || !(SEARCH_CURRENCIES as readonly unknown[]).includes(budget.currency) || !(SEARCH_PRICE_UNITS as readonly unknown[]).includes(budget.unit)
        || !["each", "total", "unknown"].includes(String(budget.scope))) return null;
    }
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
        || (place.radiusKm && !place.city)) return null;
      places.push({ city: String(place.city).trim(), country: place.country, continent: place.continent, radiusKm: Number(place.radiusKm) });
    }
    searches.push({ area: wish.area as SearchWish["area"], query: String(wish.query).trim(), department: String(wish.department).trim(),
      places: places.filter((p, i) => places.findIndex(candidate => JSON.stringify(candidate) === JSON.stringify(p)) === i),
      ...(wish.quantity !== undefined ? { quantity: Number(wish.quantity) } : {}),
      ...(wish.recommended !== undefined ? { recommended: wish.recommended as boolean } : {}),
      ...(wish.requirements !== undefined ? { requirements: (wish.requirements as string[][]).map(group => [...new Set(group.map(term => term.trim()))]) } : {}),
      ...(wish.exclude !== undefined ? { exclude: [...new Set((wish.exclude as string[]).map(term => term.trim()))] } : {}),
      ...(wish.budget !== undefined ? { budget: { ...(wish.budget as SearchBudget) } } : {}),
      ...(wish.period !== undefined ? { period: String(wish.period).trim() } : {}),
      ...(wish.unsupported !== undefined ? { unsupported: [...new Set((wish.unsupported as string[]).map(term => term.trim()))] } : {}),
      ...(wish.allowNearby !== undefined ? { allowNearby: wish.allowNearby as boolean } : {}),
    });
  }
  const plan: SearchPlan = { version: value.version as 1 | 2, searches };
  return JSON.stringify(plan).length <= MAX_PLAN_LENGTH ? plan : null;
}

export function decodeSearchPlan(encoded: string | null): SearchPlan | null {
  if (!encoded || encoded.length > MAX_PLAN_LENGTH) return null;
  try { return readSearchPlan(JSON.parse(encoded)); } catch { return null; }
}

export function unifiedSearchHref(plan: SearchPlan, requestText = ""): string {
  return `/search?${new URLSearchParams({ plan: JSON.stringify(plan), ...(requestText ? { q: requestText.slice(0, 2000) } : {}) })}`;
}

export function searchPlanFromHref(href: string): SearchPlan | null {
  if (!href.startsWith("/search?") || href.length > (MAX_PLAN_LENGTH + 2000) * 9 + 32 || /[\\\u0000-\u001f#]/.test(href)) return null;
  const params = new URLSearchParams(href.slice(8));
  return params.has("plan") && params.getAll("plan").length === 1 && params.getAll("q").length <= 1
    && [...params.keys()].every(key => key === "plan" || key === "q") && (params.get("q")?.length ?? 0) <= 2000 ? decodeSearchPlan(params.get("plan")) : null;
}

export type SearchResult = { id: string; title: string; subtitle: string; type: string; price: number; priceLabel?: string; image: string | null; available: boolean | null;
  facets?: { departments?: string[]; marketplace?: string };
  evidence?: "role" | "title" | "requirements" | "category";
  unconfirmed?: ("price" | "period" | "quantity" | "unsupported")[];
  nearby?: { distanceKm: number; origin: string };
  mapPoint?: { lat: number; lng: number; radiusMeters?: 500 } | null };
export type NearbyCursor = { distanceKm: number; id: string };
export type SearchRankCursor = { score: number; distanceKm: number; id: string; uncertain?: boolean };
export type SearchGroup = { area: SearchArea; wishIndex: number; label: string; results: SearchResult[]; nextOffset: number | null;
  segment?: string; rankCursor?: SearchRankCursor; nearby?: true; nearbyCursor?: NearbyCursor; total?: number };

export const searchGroupKey = (group: Pick<SearchGroup, "area" | "wishIndex" | "segment">) => `${group.area}:${group.wishIndex}:${group.segment ?? ""}`;

export const SEARCH_WISH_SCHEMA = { type: "array", maxItems: MAX_SEARCHES, items: { type: "object", additionalProperties: false,
  properties: {
    area: { type: "string", enum: ["all", ...SEARCH_AREAS] }, query: { type: "string" }, department: { type: "string" },
    quantity: { type: ["integer", "null"], minimum: 1, maximum: 999 }, recommended: { type: "boolean" },
    budget: { type: ["object", "null"], additionalProperties: false, properties: {
      max: { type: "number", minimum: 0.01, maximum: 1_000_000_000 }, currency: { type: "string", enum: SEARCH_CURRENCIES },
      unit: { type: "string", enum: SEARCH_PRICE_UNITS }, scope: { type: "string", enum: ["each", "total", "unknown"] },
    }, required: ["max", "currency", "unit", "scope"] },
    period: { type: ["string", "null"], maxLength: 100 },
    unsupported: { type: "array", maxItems: 6, items: { type: "string", maxLength: 120 } },
    allowNearby: { type: "boolean" },
    requirements: { type: "array", maxItems: 5, items: { type: "array", minItems: 1, maxItems: 4, items: { type: "string", maxLength: 60 } } },
    exclude: { type: "array", maxItems: 6, items: { type: "string", maxLength: 60 } },
    places: { type: "array", maxItems: 4, items: { type: "object", additionalProperties: false, properties: {
      city: { type: "string" }, country: { type: "string", enum: ["", ...COUNTRY_CODES] },
      continent: { type: "string", enum: ["", ...CONTINENTS] }, radiusKm: { type: "integer", minimum: 0, maximum: 200 },
    }, required: ["city", "country", "continent", "radiusKm"] } },
  }, required: ["area", "query", "department", "places", "quantity", "recommended", "requirements", "exclude", "budget", "period", "unsupported", "allowNearby"],
} };
