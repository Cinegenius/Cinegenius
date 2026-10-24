const LISTING_ROUTE_SEGMENTS: Record<string, string> = {
  location: "locations",
  prop: "props",
  vehicle: "vehicles",
  job: "jobs",
  creator: "creators",
  animal: "tiere",
};

/** Return the public detail route that owns a listing type. */
export function listingDetailPath(type: string, id: string, companySlug?: string | null): string | null {
  const segment = LISTING_ROUTE_SEGMENTS[type];
  if (segment && id) return `/${segment}/${encodeURIComponent(id)}`;
  if (type === "service" && companySlug) return `/companies/${encodeURIComponent(companySlug)}`;
  return null;
}

export function isListingDetailRouteSupported(type: string, companySlug?: string | null): boolean {
  return Boolean(LISTING_ROUTE_SEGMENTS[type] || (type === "service" && companySlug));
}
