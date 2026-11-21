import "server-only";
import { db } from "@/lib/db";
import { collectFacetRows } from "@/lib/browse-facets";
import { selectHomeMarketplace } from "@/lib/home-marketplace-selection";
import type { BrowsePlace } from "@/lib/browse-geography";

export async function homeMarketplaceOffers(now: number, preferred: BrowsePlace | null = null) {
  // Read only the dimensions needed for selection, including older offers.
  const pool = await collectFacetRows<{id:string;type:string;category:string|null}>((from,to) => {
    const table = db.from("privacy_visible_listings");
    const query = preferred
      ? table.select("id,type,category,place_country_code,place_region_id,place_city_id")
      : table.select("id,type,category");
    return query.in("type", ["prop", "vehicle"]).eq("published", true).order("id").range(from,to);
  });
  const chosen = selectHomeMarketplace(pool, now, 4, preferred);
  if (!chosen.length) return {data:[],error:null};
  // Recheck publication when loading card data; never cache a visibility decision.
  const result = await db.from("privacy_visible_listings")
    .select("id,user_id,company_id,responsible_person,title,city,price,image_url,type,category,metadata,created_at")
    .in("id",chosen.map(row=>row.id)).in("type",["prop","vehicle"]).eq("published",true);
  return {...result,data:chosen.flatMap(row=>(result.data ?? []).filter(offer=>offer.id===row.id))};
}
