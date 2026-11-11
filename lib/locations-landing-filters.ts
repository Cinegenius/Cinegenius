import { matchesPlace, placeKey, placeSearchMatches } from "./places/core";

export type LocationLandingFilters = {
  q: string; cityText: string; country: string; region: string; city: string;
  type: string; min: string; max: string; sort: string;
};

export const DEFAULT_LOCATION_LANDING_FILTERS: LocationLandingFilters = Object.freeze({
  q: "", cityText: "", country: "", region: "", city: "", type: "", min: "", max: "", sort: "featured",
});

const PARAMS = ["q", "cityText", "country", "region", "city", "type", "min", "max", "sort"] as const;
const SORTS = new Set(["featured", "price-asc", "price-desc", "rating"]);
const KNOWN_TYPES = ["Wohnen", "Villa", "Büro", "Industrie", "Natur", "Gastronomie", "Studio", "Fotostudio", "Speziallocation"];
const textKey = (value: string) => value.normalize("NFKC").toLowerCase();

function first(value: string | string[] | undefined): string {
  const item = Array.isArray(value) ? value[0] : value;
  return typeof item === "string" ? item.trim() : "";
}

function text(value: string | string[] | undefined, limit: number): string {
  return first(value).replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, limit).trim();
}

/** IDs remain IDs: never infer them from a label or a truncated prefix. */
function identifier(value: string | string[] | undefined): string {
  const id = first(value);
  return id.length <= 100 && !/[\u0000-\u001f\u007f]/.test(id) ? id : "";
}

function category(value: string | string[] | undefined): string {
  const original = identifier(value), key = textKey(original);
  if (key === "all types") return "";
  if (key === "filmstudio") return "Studio";
  return KNOWN_TYPES.find(type => textKey(type) === key) ?? original;
}

function price(value: string | string[] | undefined): string {
  const raw = first(value);
  if (raw.length > 20 || !/^\d+(?:[.,]\d{1,2})?$/.test(raw)) return "";
  const amount = Number(raw.replace(",", "."));
  return Number.isFinite(amount) && amount <= 1_000_000 ? String(amount) : "";
}

export function readLocationLandingFilters(params: Record<string, string | string[] | undefined>): LocationLandingFilters {
  const sort = first(params.sort);
  return {
    q: text(params.q, 200), cityText: text(params.cityText, 120),
    country: identifier(params.country), region: identifier(params.region), city: identifier(params.city),
    type: category(params.type), min: price(params.min), max: price(params.max),
    sort: SORTS.has(sort) ? sort : "featured",
  };
}

export function locationLandingParams(filters: LocationLandingFilters): URLSearchParams {
  const normalized = readLocationLandingFilters(filters), params = new URLSearchParams();
  for (const key of PARAMS) if (normalized[key] && !(key === "sort" && normalized.sort === "featured")) params.set(key, normalized[key]);
  return params;
}

type FilterableLocation = { title: string; city: string; type: string; price: number; priceOnRequest: boolean; rating: number };
function hasKnownPrice(row: FilterableLocation): boolean {
  return !row.priceOnRequest && Number.isFinite(row.price) && row.price > 0;
}

function locationMatches(row: FilterableLocation, query: string): boolean {
  return textKey(row.city).includes(textKey(query)) || Boolean(placeKey(query) && placeSearchMatches(row, query));
}

export function filterLandingLocations<T extends FilterableLocation>(rows: T[], filters: LocationLandingFilters, categoryLabel: (value: string) => string): T[] {
  const f = readLocationLandingFilters(filters), query = textKey(f.q), categoryKey = textKey(f.type);
  const result = rows.filter(row => {
    if (!matchesPlace(row, "country", f.country) || !matchesPlace(row, "region", f.region) || !matchesPlace(row, "city", f.city)) return false;
    if (f.cityText && !locationMatches(row, f.cityText)) return false;
    if (categoryKey && textKey(category(row.type)) !== categoryKey) return false;
    if (f.min || f.max) {
      if (!hasKnownPrice(row)) return false;
      if (f.min && row.price < Number(f.min)) return false;
      if (f.max && row.price > Number(f.max)) return false;
    }
    if (query) {
      const rowCategory = category(row.type);
      const terms = [row.title, row.city, row.type, rowCategory, categoryLabel(rowCategory), ...(rowCategory === "Studio" ? ["Filmstudio"] : [])].map(textKey);
      const matches = (value: string) => terms.some(term => term.includes(value)) || Boolean(placeKey(value) && placeSearchMatches(row, value));
      if (!matches(query) && !query.split(/\s+/).every(matches)) return false;
    }
    return true;
  });
  if (f.sort === "featured") return result;
  return result.map((row, index) => ({ row, index })).sort((a, b) => {
    let compared = 0;
    if (f.sort === "rating") {
      const aRating = Number.isFinite(a.row.rating) ? a.row.rating : 0;
      const bRating = Number.isFinite(b.row.rating) ? b.row.rating : 0;
      compared = bRating - aRating;
    } else {
      const aKnown = hasKnownPrice(a.row), bKnown = hasKnownPrice(b.row);
      compared = aKnown !== bKnown ? aKnown ? -1 : 1 : aKnown ? (a.row.price - b.row.price) * (f.sort === "price-desc" ? -1 : 1) : 0;
    }
    return compared || a.index - b.index;
  }).map(({ row }) => row);
}

export function locationLandingCategoryOptions(rows: { type: string }[], labelFn: (value: string) => string, locale: string, selectedType?: string): { value: string; label: string }[] {
  const values = new Map<string, { value: string; label: string }>();
  for (const row of rows) {
    const value = category(row.type), key = textKey(value);
    if (value && !values.has(key)) values.set(key, { value, label: labelFn(value) });
  }
  const selected = category(selectedType), selectedKey = textKey(selected);
  if (selected) values.set(selectedKey, { value: selected, label: values.get(selectedKey)?.label ?? labelFn(selected) });
  const collator = new Intl.Collator(locale, { sensitivity: "base", numeric: true });
  return [...values.values()].sort((a, b) => collator.compare(a.label, b.label) || a.value.localeCompare(b.value, locale));
}
