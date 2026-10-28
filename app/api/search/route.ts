import { getTranslations, getLocale } from "next-intl/server";
import { marketplaceSearchCategories } from "@/lib/marketplaceCategories";
import { animalProfileSearchValues, animalCompanySearchFilter } from "@/lib/animal-taxonomy";
import { listingPriceLabel } from "@/lib/listing-price";
import { db } from "@/lib/db";
import { getPrivateProfileIds } from "@/lib/trust";
import { NextRequest, NextResponse } from "next/server";
import {
  CATERING_COMPANY_CATEGORY,
  getCateringProfileSearchValues,
  isCateringSearchQuery,
} from "@/lib/catering-taxonomy";

export async function GET(req: NextRequest) {
  const raw  = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const type = req.nextUrl.searchParams.get("type")?.trim() ?? "all";
  if (raw.length < 2) return NextResponse.json({ results: [] });
  if (raw.length > 100) return NextResponse.json({ results: [] });

  // Strip PostgREST filter-syntax chars that could break the .or() string structure
  const q    = raw.replace(/[(),]/g, " ").trim();
  const like = `%${q}%`;
  const catalog=await getTranslations("MarketplaceCatalog"),market=await getTranslations("MarketplaceOffer"),locale=await getLocale();
  const categoryCandidates=marketplaceSearchCategories(q,catalog).map(value=>`"${value.replace(/["\\]/g,'')}"`).join(",");

  const wantListings = type === "all" || ["location", "vehicle", "prop", "job", "creator", "animal"].includes(type);
  const wantProfiles = type === "all" || type === "profile";
  const wantCompanies = type === "all" || type === "company";
  const cateringProfileValues = wantProfiles ? getCateringProfileSearchValues(raw) : [];
  const animalValues = wantProfiles ? animalProfileSearchValues(raw) : [];
  const searchCateringCompanies = wantCompanies && isCateringSearchQuery(raw);

  const [listingsRes, profilesRes, companiesRes, cateringProfileResults, cateringCompaniesRes, animalProfilesRes, animalRoleProfilesRes, animalCompaniesRes] = await Promise.all([
    wantListings
      ? (() => {
          let q2 = db
            .from("listings")
            .select("id, title, city, type, category, price, image_url, price_negotiable:metadata->price_negotiable, price_on_request:metadata->price_on_request, rental_type:metadata->>rental_type, marketplace:metadata->marketplace")
            .eq("published", true)
            .or(`title.ilike.${like},city.ilike.${like},category.ilike.${like},description.ilike.${like}${categoryCandidates?`,and(type.in.(prop,vehicle),category.in.(${categoryCandidates}))`:""}`)
            .order("created_at", { ascending: false });
          if (type !== "all") q2 = q2.eq("type", type);
          return q2.limit(type === "all" ? 12 : 24);
        })()
      : Promise.resolve({ data: [] }),

    wantProfiles
      ? db
          .from("profiles")
          .select("user_id, display_name, location, role, positions, avatar_url, available")
          .or(`display_name.ilike.${like},role.ilike.${like},location.ilike.${like},bio.ilike.${like}`)
          .not("display_name", "is", null)
          .neq("display_name", "")
          .limit(type === "all" ? 8 : 24)
      : Promise.resolve({ data: [] }),

    wantCompanies
      ? db
          .from("companies")
          .select("id, slug, name, city, logo_url, categories")
          .eq("published", true)
          .or(`name.ilike.${like},city.ilike.${like},description.ilike.${like}`)
          .limit(type === "all" ? 4 : 24)
      : Promise.resolve({ data: [] }),

    cateringProfileValues.length
      ? Promise.all(cateringProfileValues.map((position) => db
          .from("profiles")
          .select("user_id, display_name, location, role, positions, avatar_url, available")
          .contains("positions", [position])
          .not("display_name", "is", null)
          .neq("display_name", "")
          .limit(type === "all" ? 8 : 24)))
      : Promise.resolve([]),

    searchCateringCompanies
      ? db.from("companies")
          .select("id, slug, name, city, logo_url, categories")
          .eq("published", true)
          .contains("categories", [CATERING_COMPANY_CATEGORY.id])
          .limit(type === "all" ? 8 : 24)
      : Promise.resolve({ data: [] }),
    animalValues.length ? db.from("profiles").select("user_id, display_name, location, role, positions, avatar_url, available").overlaps("positions", animalValues).limit(24) : Promise.resolve({data: []}),
    animalValues.length ? db.from("profiles").select("user_id, display_name, location, role, positions, avatar_url, available").in("role", animalValues).limit(24) : Promise.resolve({data: []}),
    wantCompanies && animalCompanySearchFilter(raw) ? db.from("companies").select("id, slug, name, city, logo_url, categories").eq("published",true).or(animalCompanySearchFilter(raw)).limit(24) : Promise.resolve({data: []}),
  ]);

  const listings = (listingsRes.data ?? []).map((l: Record<string, unknown>) => ({
    id: l.id as string,
    title: l.title as string,
    subtitle: (l.city as string) ?? "",
    type: l.type as string,
    price: (l.price as number) ?? 0,
    priceLabel: ["prop","vehicle","location"].includes(String(l.type)) ? listingPriceLabel((l.price as number) ?? 0,l,"/Tag",locale,market) : undefined,
    image: l.image_url as string | null,
    available: null as boolean | null,
  }));

  type ProfileSearchRow = { user_id: string; display_name: string | null; location: string | null; role: string | null; positions: string[] | null; avatar_url: string | null; available: boolean | null };
  const profileById = new Map<string, ProfileSearchRow>();
  for (const profile of [...(profilesRes.data ?? []), ...(animalProfilesRes.data ?? []), ...(animalRoleProfilesRes.data ?? []), ...cateringProfileResults.flatMap((result) => result.data ?? [])] as ProfileSearchRow[]) {
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
      subtitle: [(p.role ?? (p.positions as string[])?.[0]), p.location].filter(Boolean).join(" · "),
      type: "profile",
      price: 0,
      image: p.avatar_url as string | null,
      available: p.available as boolean | null,
    }));

  const companyById = new Map<string, Record<string, unknown>>();
  for (const company of [...(companiesRes.data ?? []), ...(animalCompaniesRes.data ?? []), ...(cateringCompaniesRes.data ?? [])] as Record<string, unknown>[]) {
    const id = String(company.slug ?? company.id ?? "");
    if (id) companyById.set(id, company);
  }
  const companies = [...companyById.values()].map((c: Record<string, unknown>) => ({
    id: (c.slug ?? c.id) as string,
    title: c.name as string,
    subtitle: (c.city as string) ?? "",
    type: "company",
    price: 0,
    image: c.logo_url as string | null,
    available: null as boolean | null,
  }));

  return NextResponse.json({ results: [...listings, ...profiles, ...companies] });
}
