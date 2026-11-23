import type { SearchBrowseFilters } from "./browse-filters";

/** Presentation state only. The server's closed reader remains authoritative.
 * Keep catalogue/coordinate databases out of the interactive toolbar bundle. */
export function browseFilterControls(value?: SearchBrowseFilters): SearchBrowseFilters {
  const result: Record<string, unknown> = { version: 1 };
  if (!value) return result as SearchBrowseFilters;
  for (const key of ["country", "region", "city"] as const) if (value[key]) result[key] = value[key];
  if (value.radiusKm) result.radiusKm = value.radiusKm;
  for (const key of ["departments", "marketplace", "locationTypes", "companyCategories", "jobTypes", "projectTypes"] as const) {
    if (value[key]?.length) result[key] = [...new Set(value[key])].sort();
  }
  const location: Record<string, unknown> = {};
  for (const key of ["indoorOutdoor", "currency", "min", "max", "sqm", "ceiling", "parking", "loading", "blackout", "natural", "power"] as const) {
    const entry = value.location?.[key];
    if (entry === undefined || entry === "") continue;
    if (["sqm", "ceiling", "parking", "min", "max"].includes(key) && typeof entry === "string") {
      const amount = Number(entry.replace(",", "."));
      if (amount === 0 && !["min", "max"].includes(key)) continue;
      location[key] = Number.isFinite(amount) && amount >= 0 ? String(amount) : entry;
    } else location[key] = entry;
  }
  if (Object.keys(location).length) result.location = location;
  return result as SearchBrowseFilters;
}
export function hasBrowseFilterControls(value?: SearchBrowseFilters): boolean {
  return Object.keys(browseFilterControls(value)).length > 1;
}
