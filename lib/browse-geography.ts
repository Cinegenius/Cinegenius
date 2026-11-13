import { countryCode, placeFromRecord } from "./places/core";

export type BrowsePlace = { country: string; region: string; city: string };
const identifier = (value: unknown) => typeof value === "string" && /^[a-zA-Z0-9:._-]{1,100}$/.test(value) ? value : "";

/** Use the saved place identity, never language, IP, or a guess about a city name. */
export function browsePlace(row: object | null | undefined): BrowsePlace | null {
  if (!row) return null;
  const place = placeFromRecord(row), country = countryCode(place.countryCode);
  return country ? { country, region: identifier(place.regionId), city: identifier(place.cityId) } : null;
}

export function geographicRank(row: object, preferred: BrowsePlace): number {
  const place = placeFromRecord(row);
  if (place.countryCode !== preferred.country) return 3;
  if (preferred.city && place.cityId === preferred.city) return 0;
  if (preferred.region && place.regionId === preferred.region) return 1;
  return 2;
}

/** Stable within each area: retain the directory's own order and every result. */
export function prioritizeGeographically<T extends object>(rows: readonly T[], preferred: BrowsePlace | null): T[] {
  return preferred ? [...rows].sort((a, b) => geographicRank(a, preferred) - geographicRank(b, preferred)) : [...rows];
}

/** Disjoint SQL buckets, including NULL places. Pagination runs after prioritization. */
export function geographicBuckets(place: BrowsePlace): string[] {
  const country = countryCode(place.country), city = identifier(place.city), region = identifier(place.region);
  if (!country) return [];
  const sameCountry = `place_country_code.eq.${country}`;
  const outsideCity = city ? `or(place_city_id.is.null,place_city_id.neq.${city})` : "";
  const outsideRegion = region ? `or(place_region_id.is.null,place_region_id.neq.${region})` : "";
  const and = (...clauses: string[]) => `and(${clauses.filter(Boolean).join(",")})`;
  return [
    ...(city ? [and(sameCountry, `place_city_id.eq.${city}`)] : []),
    ...(region ? [and(sameCountry, `place_region_id.eq.${region}`, outsideCity)] : []),
    and(sameCountry, outsideRegion, outsideCity),
    `or(place_country_code.is.null,place_country_code.neq.${country})`,
  ];
}

type PageResult<T> = { data: T[] | null; count: number | null; error: { message?: string; code?: string } | null };
export async function geographicPage<T>(
  read: (clause: string | null, range: { from: number; to: number } | null) => PromiseLike<PageResult<T>>,
  from: number, to: number, preferred: BrowsePlace | null,
): Promise<PageResult<T>> {
  const buckets = preferred ? geographicBuckets(preferred) : [];
  if (!buckets.length) return read(null, { from, to });
  const counts = await Promise.all(buckets.map(clause => read(clause, null)));
  const failure = counts.find(result => result.error);
  if (failure) return { data: null, count: null, error: failure.error };
  let offset = 0;
  const requests: PromiseLike<PageResult<T>>[] = [];
  counts.forEach((result, index) => {
    const count = result.count ?? 0;
    if (count && to >= offset && from < offset + count) requests.push(read(buckets[index], { from: Math.max(0, from - offset), to: Math.min(count - 1, to - offset) }));
    offset += count;
  });
  const pages = await Promise.all(requests);
  const error = pages.find(result => result.error)?.error ?? null;
  return { data: error ? null : pages.flatMap(result => result.data ?? []), count: offset, error };
}
