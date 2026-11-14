import "server-only";
import { db } from "@/lib/db";
import { collectFacetRows } from "@/lib/browse-facets";
import { placeReadFields } from "@/lib/places/catalog";

/** Only public filter dimensions; no owners, images, descriptions or private metadata. */
export async function listingFacetRows(locale: string, types: readonly string[]) {
  const rows = await collectFacetRows<Record<string, unknown>>((from, to) => db.from("privacy_visible_listings")
    .select("type,category,city,place_country_code,place_region_id,place_city_id,place_city_name,place_region_name,place_status,rental_type:metadata->>rental_type")
    .eq("published", true).in("type", [...types]).order("id").range(from, to));
  const unique = new Map<string, ReturnType<typeof placeReadFields> & { category: string; type: string; rentalType: string }>();
  for (const row of rows) {
    const facet = { ...placeReadFields(String(row.city ?? ""), row, locale), category: String(row.category ?? ""), type: String(row.type), rentalType: String(row.rental_type ?? "miete") };
    unique.set(JSON.stringify(facet), facet);
  }
  return [...unique.values()];
}

export function marketplaceFacetRows(locale: string) { return listingFacetRows(locale, ["prop", "vehicle"]); }
