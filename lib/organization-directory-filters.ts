import { browseCountryChoice } from "./browse-country";
import { UNASSIGNED_COUNTRY } from "./places/core";

export type OrganizationDirectoryFilters = { country: string; city: string; q: string; page: number; automatic?: boolean };

export function organizationDirectoryHref(filters: OrganizationDirectoryFilters) {
  const query = new URLSearchParams();
  // An absent country retains the current request's regional priority. An
  // explicit All countries choice must stay global on every following page.
  if (filters.country || !filters.automatic) query.set("country", filters.country || "all");
  if (filters.city) query.set("city", filters.city);
  if (filters.q) query.set("q", filters.q);
  if (filters.page > 1) query.set("page", String(filters.page));
  return `/organizations${query.size ? `?${query}` : ""}`;
}

/** An unverified city label is qualified by its actual saved country, not geocoded. */
export function organizationCityFilter(value: string): { id: string } | { text: string; country: string } | null {
  if (!value) return null;
  if (value.startsWith("id:") && value.length > 3) return { id: value.slice(3) };
  const match = /^text:([^:]+):(.+)$/.exec(value);
  if (!match || !browseCountryChoice(match[1])) throw new Error("organization_city_invalid");
  return { text: match[2], country: browseCountryChoice(match[1]) || UNASSIGNED_COUNTRY };
}
