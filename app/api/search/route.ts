import { animalCompanySearchFilter,animalProfileSearchValues } from "@/lib/animal-taxonomy";
import {
CATERING_COMPANY_CATEGORY,
getCateringProfileSearchValues,
isCateringSearchQuery,
} from "@/lib/catering-taxonomy";
import { db } from "@/lib/db";
import { listingPriceLabel } from "@/lib/listing-price";
import { marketplaceSearchCategories } from "@/lib/marketplaceCategories";
import { placeReadFields,placeSearchFilter } from "@/lib/places/catalog";
import { placeDisplay } from "@/lib/places/core";
import {
SAFETY_MEDICAL_COMPANY_CATEGORY_ID,
safetyMedicalProfileValues,
safetyMedicalSearchTerms,
} from "@/lib/safety-medical-taxonomy";
import { getPrivateProfileIds } from "@/lib/trust";
import { getLocale,getTranslations } from "next-intl/server";
import { NextRequest,NextResponse } from "next/server";

async function publicProfileMatches(read: (from: number, to: number) => PromiseLike<{ data: Record<string, unknown>[] | null; error: unknown }>) {
  const visible: Record<string, unknown>[] = [];
  for (let from = 0; visible.length < 24; from += 100) {
    const result = await read(from, from + 99);
    if (result.error) throw new Error("search_unavailable");
    const rows = result.data ?? [];
    const privateIds = await getPrivateProfileIds(rows.map(row => String(row.user_id)));
    visible.push(...rows.filter(row => row.display_name && !privateIds.has(String(row.user_id))));
    if (rows.length < 100) break;
  }
  return { data: visible.slice(0, 24) };
}

export async function GET(req: NextRequest) {
  const raw  = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const type = req.nextUrl.searchParams.get("type")?.trim() ?? "all";
  if (raw.length < 2) return NextResponse.json({ results: [] });
  if (raw.length > 100) return NextResponse.json({ results: [] });

  // Strip PostgREST filter-syntax chars that could break the .or() string structure
  const q    = raw.replace(/[(),]/g, " ").trim();
  const like = `%${q}%`;
  const catalog=await getTranslations("MarketplaceCatalog"),market=await getTranslations("MarketplaceOffer"),locale=await getLocale();
  const geoFilter=placeSearchFilter(raw);
  const categoryCandidates=marketplaceSearchCategories(q,catalog).map(value=>`"${value.replace(/["\\]/g,'')}"`).join(",");

  const wantListings = true;
  const wantProfiles = true;
  const wantCompanies = true;
  const cateringProfileValues = wantProfiles ? getCateringProfileSearchValues(raw) : [];
  const animalValues = wantProfiles ? animalProfileSearchValues(raw) : [];
  const searchCateringCompanies = wantCompanies && isCateringSearchQuery(raw);
  const safetyMedicalValues = wantProfiles ? safetyMedicalProfileValues(raw) : [];
  const searchSafetyMedicalCompanies = wantCompanies && safetyMedicalSearchTerms(raw);

  const [listingsRes, profilesRes, companiesRes, cateringProfileResults, cateringCompaniesRes, animalProfilesRes, animalRoleProfilesRes, animalCompaniesRes, safetyMedicalProfilesRes, safetyMedicalRoleProfilesRes, safetyMedicalCompaniesRes] = await Promise.all([
    wantListings
      ? Promise.all(["location", "vehicle", "prop", "job", "creator", "animal"].map(kind => db.from("listings")
          .select("place_country_code,place_region_id,place_city_id,place_city_name,place_region_name,place_status,id,title,city,type,category,price,image_url,price_negotiable:metadata->price_negotiable,price_on_request:metadata->price_on_request,rental_type:metadata->>rental_type,marketplace:metadata->marketplace")
          .eq("published", true).eq("type", kind)
          .or(`title.ilike.${like},city.ilike.${like},category.ilike.${like},description.ilike.${like}${categoryCandidates?`,and(type.in.(prop,vehicle),category.in.(${categoryCandidates}))`:""}${geoFilter?`,${geoFilter}`:""}`)
          .order("created_at", { ascending: false }).order("id").limit(type === kind || (type === "profile" && kind === "creator") ? 24 : 6)))
        .then(results => { if (results.some(result => result.error)) throw new Error("search_unavailable"); return { data: results.flatMap(result => result.data ?? []) }; })
      : Promise.resolve({ data: [] }),

    wantProfiles
      ? publicProfileMatches((from, to) => db
          .from("profiles")
          .select("place_country_code,place_region_id,place_city_id,place_city_name,place_region_name,place_status,user_id, display_name, location, role, positions, avatar_url, available")
          .or(`display_name.ilike.${like},role.ilike.${like},location.ilike.${like},bio.ilike.${like}${geoFilter?`,${geoFilter}`:""}`)
          .not("display_name", "is", null)
          .neq("display_name", "").order("user_id").range(from, to))
      : Promise.resolve({ data: [] }),

    wantCompanies
      ? db
          .from("companies")
          .select("place_country_code,place_region_id,place_city_id,place_city_name,place_region_name,place_status,id, slug, name, city, logo_url, categories")
          .eq("published", true)
          .or(`name.ilike.${like},city.ilike.${like},description.ilike.${like}${geoFilter?`,${geoFilter}`:""}`)
          .limit(type === "all" ? 4 : 24)
      : Promise.resolve({ data: [] }),

    cateringProfileValues.length
      ? Promise.all(cateringProfileValues.map((position) => publicProfileMatches((from, to) => db
          .from("profiles")
          .select("place_country_code,place_region_id,place_city_id,place_city_name,place_region_name,place_status,user_id, display_name, location, role, positions, avatar_url, available")
          .contains("positions", [position])
          .not("display_name", "is", null)
          .neq("display_name", "").order("user_id").range(from, to))))
      : Promise.resolve([]),

    searchCateringCompanies
      ? db.from("companies")
          .select("place_country_code,place_region_id,place_city_id,place_city_name,place_region_name,place_status,id, slug, name, city, logo_url, categories")
          .eq("published", true)
          .contains("categories", [CATERING_COMPANY_CATEGORY.id])
          .limit(type === "all" ? 8 : 24)
      : Promise.resolve({ data: [] }),
    animalValues.length ? publicProfileMatches((from, to) => db.from("profiles").select("place_country_code,place_region_id,place_city_id,place_city_name,place_region_name,place_status,user_id, display_name, location, role, positions, avatar_url, available").overlaps("positions", animalValues).order("user_id").range(from, to)) : Promise.resolve({data: []}),
    animalValues.length ? publicProfileMatches((from, to) => db.from("profiles").select("place_country_code,place_region_id,place_city_id,place_city_name,place_region_name,place_status,user_id, display_name, location, role, positions, avatar_url, available").in("role", animalValues).order("user_id").range(from, to)) : Promise.resolve({data: []}),
    wantCompanies && animalCompanySearchFilter(raw) ? db.from("companies").select("place_country_code,place_region_id,place_city_id,place_city_name,place_region_name,place_status,id, slug, name, city, logo_url, categories").eq("published",true).or(animalCompanySearchFilter(raw)).limit(24) : Promise.resolve({data: []}),
    safetyMedicalValues.length ? publicProfileMatches((from, to) => db.from("profiles").select("place_country_code,place_region_id,place_city_id,place_city_name,place_region_name,place_status,user_id, display_name, location, role, positions, avatar_url, available").overlaps("positions", safetyMedicalValues).order("user_id").range(from, to)) : Promise.resolve({data: []}),
    safetyMedicalValues.length ? publicProfileMatches((from, to) => db.from("profiles").select("place_country_code,place_region_id,place_city_id,place_city_name,place_region_name,place_status,user_id, display_name, location, role, positions, avatar_url, available").in("role", safetyMedicalValues).order("user_id").range(from, to)) : Promise.resolve({data: []}),
    searchSafetyMedicalCompanies ? db.from("companies").select("place_country_code,place_region_id,place_city_id,place_city_name,place_region_name,place_status,id, slug, name, city, logo_url, categories").eq("published", true).contains("categories", [SAFETY_MEDICAL_COMPANY_CATEGORY_ID]).limit(24) : Promise.resolve({data: []}),
  ]);

  for (const result of [companiesRes, cateringCompaniesRes, animalCompaniesRes, safetyMedicalCompaniesRes]) {
    if ("error" in result && result.error) throw new Error("search_unavailable");
  }

  const listings = (listingsRes.data ?? []).map((l: Record<string, unknown>) => ({
    id: l.id as string,
    title: l.title as string,
    subtitle: placeDisplay(placeReadFields(String(l.city??""),l,locale),String(l.city??""),locale),
    type: l.type as string,
    price: (l.price as number) ?? 0,
    priceLabel: ["prop","vehicle","location"].includes(String(l.type)) ? listingPriceLabel((l.price as number) ?? 0,l,"/Tag",locale,market) : undefined,
    image: l.image_url as string | null,
    available: null as boolean | null,
  }));

  type ProfileSearchRow = { user_id: string; display_name: string | null; location: string | null; role: string | null; positions: string[] | null; avatar_url: string | null; available: boolean | null };
  const profileById = new Map<string, ProfileSearchRow>();
  for (const profile of [...(profilesRes.data ?? []), ...(animalProfilesRes.data ?? []), ...(animalRoleProfilesRes.data ?? []), ...(safetyMedicalProfilesRes.data ?? []), ...(safetyMedicalRoleProfilesRes.data ?? []), ...cateringProfileResults.flatMap((result) => result.data ?? [])] as ProfileSearchRow[]) {
    if (profile?.user_id) profileById.set(profile.user_id, profile);
  }
  const profileRows = [...profileById.values()];
  const privateProfileIds = await getPrivateProfileIds(profileRows.map((profile) => profile.user_id));
  const profiles = profileRows
    .filter((profile) => !privateProfileIds.has(profile.user_id))
    .filter((p: Record<string, unknown>) => p.display_name)
    .map((p: Record<string, unknown>) => ({
      id: p.user_id as string,
      title: p.display_name as string,
      subtitle: [(p.role ?? (p.positions as string[])?.[0]), placeDisplay(placeReadFields(String(p.location??""),p,locale),String(p.location??""),locale)].filter(Boolean).join(" · "),
      type: "profile",
      price: 0,
      image: p.avatar_url as string | null,
      available: p.available as boolean | null,
    }));

  const companyById = new Map<string, Record<string, unknown>>();
  for (const company of [...(companiesRes.data ?? []), ...(animalCompaniesRes.data ?? []), ...(cateringCompaniesRes.data ?? []), ...(safetyMedicalCompaniesRes.data ?? [])] as Record<string, unknown>[]) {
    const id = String(company.slug ?? company.id ?? "");
    if (id) companyById.set(id, company);
  }
  const companies = [...companyById.values()].map((c: Record<string, unknown>) => ({
    id: (c.slug ?? c.id) as string,
    title: c.name as string,
    subtitle: placeDisplay(placeReadFields(String(c.city??""),c,locale),String(c.city??""),locale),
    type: "company",
    price: 0,
    image: c.logo_url as string | null,
    available: null as boolean | null,
  }));

  const allResults = [...listings, ...profiles, ...companies];
  const availableTypes = [...new Set(allResults.map(row => row.type === "creator" ? "profile" : row.type))];
  const results = type === "all" ? allResults : allResults.filter(row => row.type === type || (type === "profile" && row.type === "creator"));
  return NextResponse.json({ results, availableTypes }, { headers: { "Cache-Control": "private, no-store" } });
}
