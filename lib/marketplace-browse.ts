import { DEPARTMENTS, marketplaceCategory } from "./marketplaceCategories";

export const MARKETPLACE_PAGE_SIZE = 24;
export type MarketplaceSort = "featured" | "price-asc" | "price-desc";
export type MarketplaceOfferFilter = "alle" | "miete" | "kauf";

/** Keep a child filter visible by resolving its parent, and reject mismatched paths. */
export function marketplaceCategorySelection(department: string | null, subcategory: string | null) {
  const parent = marketplaceCategory(department)?.department ?? department;
  const child = marketplaceCategory(subcategory);
  const childId = child?.subcategory ?? "";
  const departmentId = DEPARTMENTS.some(row => row.id === parent) ? parent : childId ? child?.department : null;
  return {
    department: departmentId ?? null,
    subcategory: childId && child?.department === departmentId ? childId : "",
  };
}

export function readMarketplaceBrowseState(params: Pick<URLSearchParams, "get">) {
  const category = marketplaceCategorySelection(params.get("dept"), params.get("sub"));
  const offer = params.get("offer");
  const sort = params.get("sort");
  return {
    ...category,
    query: params.get("q") ?? "",
    offer: (offer === "miete" || offer === "kauf" ? offer : "alle") as MarketplaceOfferFilter,
    sort: (sort === "price-asc" || sort === "price-desc" ? sort : "featured") as MarketplaceSort,
    view: params.get("view") === "map" ? "map" as const : params.get("view") === "list" ? "list" as const : "grid" as const,
  };
}

/** Public API rows and the initial page must project the same offer metadata. */
export function marketplaceCardData(row: Record<string, unknown>) {
  const metadata = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
    ? row.metadata as Record<string, unknown> : {};
  const meta: Record<string, unknown> = { ...metadata };
  for (const key of ["marketplace", "rental_type", "price_on_request", "price_negotiable", "condition", "delivery", "focal_point"] as const) {
    if (row[key] !== undefined) meta[key] = row[key];
  }
  const offer = meta.marketplace && typeof meta.marketplace === "object" && !Array.isArray(meta.marketplace)
    ? meta.marketplace as Record<string, unknown> : null;
  const mode = offer?.mode;
  const rentalType = mode === "both" ? "beides" : mode === "sale" ? "kauf" : mode === "rent" ? "miete" : meta.rental_type;
  const focal = meta.focal_point;
  return {
    ...row,
    lat: typeof row.lat === "number" ? row.lat : null, lng: typeof row.lng === "number" ? row.lng : null,
    id: String(row.id), title: String(row.title ?? ""), type: String(row.type ?? "prop"),
    category: String(row.category ?? ""), location: String(row.city ?? ""),
    dailyRate: Number(row.price) || 0, image: String(row.image_url ?? ""),
    vendor: "", condition: typeof meta.condition === "string" ? meta.condition : "",
    era: null, delivery: meta.delivery === true || (Array.isArray(offer?.fulfilment) && offer.fulfilment.includes("delivery")),
    rentalType: (rentalType === "kauf" || rentalType === "beides" ? rentalType : "miete") as "miete" | "kauf" | "beides",
    focalPoint: focal && typeof focal === "object" && typeof (focal as { x?: unknown }).x === "number" && typeof (focal as { y?: unknown }).y === "number" ? focal as { x: number; y: number } : null,
    meta, ownerId: typeof row.user_id === "string" ? row.user_id : undefined,
  };
}
