import { countryCode, UNASSIGNED_COUNTRY } from "./places/core";

/** Read-only directory choice. Unknown text never becomes a country predicate. */
export function browseCountryChoice(value: unknown): string | undefined {
  if (value === null || value === undefined || value === "" || value === "all") return "";
  if (value === UNASSIGNED_COUNTRY) return value;
  return typeof value === "string" ? countryCode(value) || undefined : undefined;
}

export function organizationsCountryHref(country: string, page = 1) {
  const query = new URLSearchParams();
  if (country) query.set("country", country);
  if (page > 1) query.set("page", String(page));
  return `/organizations${query.size ? `?${query}` : ""}`;
}
