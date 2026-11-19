import "server-only";
import { db } from "@/lib/db";
import { browseCountryChoice } from "@/lib/browse-country";
import { publicMapPoint } from "@/lib/places/public-map-point";
import { UNASSIGNED_COUNTRY, cityName, countryName } from "@/lib/places/core";
import { organizationCityFilter, type OrganizationDirectoryFilters } from "./organization-directory-filters";

export type OrganizationDirectoryEntry = { id: string; slug: string; name: string; logo_url: string | null; city: string; country: string; lat: number | null; lng: number | null };
export type OrganizationDirectoryData = { organizations: OrganizationDirectoryEntry[]; cities: { value: string; label: string }[]; count: number; hasMore: boolean; filters: OrganizationDirectoryFilters };
type Row = { id: string; slug: string; name: string; logo_url: string | null; city: string | null; place_city_id: string | null; place_city_name: string | null; place_country_code: string | null; place_status: string | null };
const fields = "id,slug,name,logo_url,city,place_city_id,place_city_name,place_country_code,place_status";
const PAGE_SIZE = 24;

/** Only public seat information. Never treat an organization's service region as its city. */
export async function organizationDirectory(filters: OrganizationDirectoryFilters, locale: string, signal: AbortSignal): Promise<OrganizationDirectoryData> {
  const country = browseCountryChoice(filters.country);
  if (country === undefined || !Number.isInteger(filters.page) || filters.page < 1 || filters.page > 10000
    || filters.q.length > 120 || filters.city.length > 220 || /[\u0000-\u001f]/.test(filters.q + filters.city)) throw new Error("organization_filters_invalid");
  const base = (projection: string, count = false) => {
    let query = db.from("organizations").select(projection, count ? { count: "exact" } : undefined).eq("moderation_status", "approved");
    if (country === UNASSIGNED_COUNTRY) query = query.or('place_country_code.is.null,place_country_code.eq.""');
    else if (country) query = query.eq("place_country_code", country);
    return query;
  };
  const city = organizationCityFilter(filters.city);
  const readCities = async () => {
    const cities = new Map<string, string>();
    // Inspect the complete approved country pool for facets, not just the visible page.
    // Page the narrow projection and retain unique city labels only; no cross-request cache.
    for (let offset = 0; ; offset += 250) {
      signal.throwIfAborted();
      const { data, error } = await base("id,city,place_city_id,place_city_name,place_country_code,place_status").order("id").range(offset, offset + 249).abortSignal(signal);
      if (error) throw new Error("organization_cities_unavailable");
      const rows = (data ?? []) as unknown as Row[];
      for (const row of rows) {
        const verified = row.place_status === "verified" && row.place_city_id && row.place_city_name;
        const name = verified ? cityName(row.place_city_id!, row.place_city_name!, locale) : row.city?.trim();
        const rowCountry = browseCountryChoice(row.place_country_code);
        const value = verified ? `id:${row.place_city_id}` : row.city && rowCountry !== undefined ? `text:${rowCountry || UNASSIGNED_COUNTRY}:${row.city}` : "";
        const label = [name, !country && rowCountry ? countryName(rowCountry, locale) : ""].filter(Boolean).join(" · ");
        if (name && value && value.length <= 220) cities.set(value, label);
      }
      if (rows.length < 250) break;
    }
    return [...cities].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, locale));
  };
  let query = base(fields, true);
  if (city && "id" in city) query = query.eq("place_city_id", city.id).eq("place_status", "verified");
  else if (city) {
    query = query.eq("city", city.text);
    query = city.country === UNASSIGNED_COUNTRY ? query.or('place_country_code.is.null,place_country_code.eq.""') : query.eq("place_country_code", city.country);
  }
  if (filters.q.trim()) query = query.ilike("name", `%${filters.q.trim().replace(/[\\%_]/g, " ")}%`);
  const [cities, { data, error, count }] = await Promise.all([readCities(), query.order("created_at", { ascending: false }).order("id")
    .range((filters.page - 1) * PAGE_SIZE, filters.page * PAGE_SIZE - 1).abortSignal(signal)]);
  if (error || count === null) throw new Error("organization_directory_unavailable");
  const organizations = ((data ?? []) as unknown as Row[]).map(row => ({ id: row.id, slug: row.slug, name: row.name, logo_url: row.logo_url,
    city: row.place_city_name ? cityName(row.place_city_id ?? "", row.place_city_name, locale) : row.city ?? "", country: row.place_country_code ?? "", ...publicMapPoint(row) }));
  if (city && !cities.some(item => item.value === filters.city)) cities.push({ value: filters.city, label: "id" in city ? cityName(city.id, "", locale) : city.text });
  return { organizations, count, hasMore: count > filters.page * PAGE_SIZE, filters, cities };
}
