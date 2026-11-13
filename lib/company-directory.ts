import { db } from "@/lib/db";
import { placeReadFields } from "@/lib/places/catalog";
import { publicMapPoint } from "@/lib/places/public-map-point";

export type DirectoryCompany = {
  id: string; slug: string; name: string; logo_url: string | null;
  description: string; city: string; categories: string[]; services: string[];
  catering_details?: unknown; animal_details?: unknown; verified: boolean;
  created_at: string; lat: number | null; lng: number | null;
};

/** The list and map share all published companies, never private contact/address fields. */
export async function getDirectoryCompanies(locale: string): Promise<DirectoryCompany[]> {
  const companies: DirectoryCompany[] = [];
  const pageSize = 250;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await db.from("companies")
      .select("place_country_code,place_region_id,place_city_id,place_city_name,place_region_name,place_status,id,slug,name,logo_url,description,city,categories,services,catering_details,animal_details,verified,created_at")
      .eq("published", true).order("created_at", { ascending: false }).order("id")
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error("Unable to load the public company directory.");
    for (const row of data ?? []) companies.push({ ...row,
      description: row.description ?? "", city: row.city ?? "",
      categories: row.categories ?? [], services: row.services ?? [],
      ...placeReadFields(row.city ?? "", row, locale), ...publicMapPoint(row),
    });
    if (!data || data.length < pageSize) break;
  }
  return companies;
}
