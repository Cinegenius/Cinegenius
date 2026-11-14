import "server-only";
import { db } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import { profileAccessFor } from "@/lib/profile-privacy-server";
import { projectProfilePrivacy } from "@/lib/profile-privacy";
import { getDeptLabel, departments, taxonomyLabel } from "@/lib/departments";
import { placeReadFields } from "@/lib/places/catalog";
import { countryCode, PLACE_COLUMNS, placeDisplay } from "@/lib/places/core";
import { publicProjectMedia } from "@/lib/project-media-rights";
import { listingPriceLabel } from "@/lib/listing-price";
import { COMPANY_CATEGORIES } from "@/lib/companyCategories";
import { containsLiteral, exactLiteral, filterLiteral, isOccupationWish, matchesWishPlaces, searchKey, wishMarketplaceCategories, wishSearchTerms } from "@/lib/unified-search-matching";
import { SEARCH_AREAS, type SearchArea, type SearchGroup, type SearchPlan, type SearchResult, type SearchWish } from "@/lib/unified-search";

type Row = Record<string, unknown>;
const PAGE = 60;
const VISIBLE = 12;
const LISTING_AREAS: Partial<Record<SearchArea, string[]>> = { marketplace: ["prop", "vehicle"], locations: ["location"], jobs: ["job"], animals: ["animal"] };

export async function searchWishLabel(wish: SearchWish, locale: string) {
  const t = await getTranslations({ locale, namespace: "UnifiedSearch" });
  const animals = await getTranslations({ locale, namespace: "FilmAnimals" });
  const taxonomy = await getTranslations({ locale, namespace: "Taxonomy" });
  const dept = departments.find(d => d.id === wish.department);
  const names = new Intl.DisplayNames([locale], { type: "region" });
  const title = wish.query || (dept ? getDeptLabel(dept, locale, animals, taxonomy) : "");
  const places = wish.places.map(p => {
    const label = [p.city, p.country ? names.of(p.country) : "", p.continent ? names.of(p.continent) : ""].filter(Boolean).join(", ");
    return p.radiusKm ? t("withinRadius", { place: label, radius: p.radiusKm }) : label;
  }).filter(Boolean);
  return [title, places.join(" / ")].filter(Boolean).join(" · ");
}

function queryFor(area: SearchArea, wish: SearchWish, terms: string[], categories: string[]) {
  const patterns = (columns: string[]) => terms.flatMap(term => columns.map(column => `${column}.ilike.${containsLiteral(term)}`));
  const kinds = LISTING_AREAS[area];
  if (kinds) {
    const filters = patterns(["title", "description", "category", ...(area === "marketplace"
      ? ["metadata->>vehicle_subtype", "metadata->>make", "metadata->>model", "metadata->marketplace->>brand", "metadata->marketplace->>model"] : [])]);
    if (area === "marketplace" && categories.length) filters.push(`category.in.(${categories.map(filterLiteral).join(",")})`);
    return db.from("privacy_visible_listings").select(`${PLACE_COLUMNS},id,user_id,title,city,type,category,price,image_url,price_negotiable:metadata->price_negotiable,price_on_request:metadata->price_on_request,rental_type:metadata->>rental_type,marketplace:metadata->marketplace`)
      .eq("published", true).in("type", kinds).or(filters.join(",")).order("id");
  }
  if (area === "crew") {
    const filters = isOccupationWish(wish, terms)
      ? terms.map(term => `role.ilike.${exactLiteral(term)}`)
      : patterns(["display_name", "role", "bio"]);
    if (terms.length) filters.push(`positions.ov.{${terms.map(filterLiteral).join(",")}}`);
    return db.from("profiles").select(`${PLACE_COLUMNS},user_id,display_name,role,positions,bio,location,avatar_url,available`)
      .not("display_name", "is", null).neq("display_name", "").or(filters.join(",")).order("user_id");
  }
  if (area === "companies") {
    const filters = patterns(["name", "description"]);
    if (categories.length) filters.push(`categories.ov.{${categories.map(filterLiteral).join(",")}}`);
    if (terms.length) filters.push(`services.ov.{${terms.map(filterLiteral).join(",")}}`);
    return db.from("companies").select(`${PLACE_COLUMNS},id,slug,name,city,logo_url`)
      .eq("published", true).or(filters.join(",")).order("id");
  }
  // Published projects and private working copies are separate tables.
  if (area === "projects") return db.from("projects").select(`${PLACE_COLUMNS},id,title,description,poster_url,metadata,created_by`)
    .or(patterns(["title", "description", "director"]).join(",")).order("id");
  if (area === "organizations") return db.from("organizations").select(`${PLACE_COLUMNS},id,slug,name,city,logo_url`)
    .eq("moderation_status", "approved").or(patterns(["name", "description"]).join(",")).order("id");
  return db.from("organization_entries").select(`${PLACE_COLUMNS},id,slug,title,city,image_url,organization:organizations!inner(slug,moderation_status)`)
    .in("moderation_status", ["approved", "ended"]).eq("organization.moderation_status", "approved")
    .or(patterns(["title", "summary", "description"]).join(",")).order("id");
}

function geographyRow(row: Row, area: SearchArea): Row {
  if (area !== "projects") return row;
  const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata as Row : {};
  const details = metadata.project_details && typeof metadata.project_details === "object" ? metadata.project_details as Row : {};
  const location = typeof metadata.location === "string" ? metadata.location : "";
  // Production country and a project's primary location are distinct from its
  // shooting locations. Never attach a production country to an unrelated city.
  const fields = placeReadFields(location, row);
  return { ...row, ...fields, location,
    place_country_code: fields.place_country_code || countryCode(String(details.country ?? metadata.country ?? "")),
  };
}

async function readGroup(plan: SearchPlan, wishIndex: number, area: SearchArea, offset: number, locale: string, viewerId: string | null, signal: AbortSignal): Promise<SearchGroup> {
  const wish = plan.searches[wishIndex];
  const taxonomy = await getTranslations({ locale, namespace: "Taxonomy" });
  const terms = wishSearchTerms({ ...wish, area }, locale, taxonomy);
  const catalog = await getTranslations({ locale, namespace: "MarketplaceCatalog" });
  const market = await getTranslations({ locale, namespace: "MarketplaceOffer" });
  const ui = await getTranslations({ locale });
  const categories = area === "marketplace" ? wishMarketplaceCategories(wish.query, catalog) : area === "companies"
    ? COMPANY_CATEGORIES.filter(category => [category.id, category.label, taxonomyLabel(category.label, ui)].some(label => terms.some(term => searchKey(label).includes(searchKey(term))))).map(category => category.id) : [];
  const group: SearchGroup = { area, wishIndex, label: await searchWishLabel(wish, locale), results: [], nextOffset: null };
  for (let pass = 0; pass < 3; pass++) {
    signal.throwIfAborted();
    const { data, error } = await queryFor(area, wish, terms, categories).range(offset, offset + PAGE - 1).abortSignal(signal);
    if (error) throw new Error("search_unavailable");
    const rows = (data ?? []) as unknown as Row[];
    const privacy = area === "crew" ? await profileAccessFor(rows.map(row => String(row.user_id)), viewerId, { signal, throwOnError: true }) : null;
    for (let i = 0; i < rows.length; i++) {
      let row = rows[i];
      if (area === "crew") {
        const access = privacy!.get(String(row.user_id));
        if (!access?.profile) continue;
        // Location must be authorized before geographic matching, including counts.
        if (wish.places.length && !access.location) continue;
        row = projectProfilePrivacy(row, access);
      }
      row = geographyRow(row, area);
      if (!matchesWishPlaces(row, wish)) continue;
      if (area === "projects") row = publicProjectMedia(row);
      const place = placeDisplay(placeReadFields(String(row.location ?? row.city ?? ""), row, locale), String(row.location ?? row.city ?? ""), locale);
      const organization = Array.isArray(row.organization) ? row.organization[0] : row.organization;
      const result: SearchResult = {
        id: String(area === "crew" ? row.user_id : area === "news" ? `${(organization as Row)?.slug}/${row.slug}` : row.slug || row.id),
        title: String(row.display_name ?? row.name ?? row.title ?? ""),
        subtitle: area === "crew" ? [row.role, place].filter(Boolean).join(" · ") : place,
        type: area === "crew" ? "profile" : area === "companies" ? "company" : area === "organizations" ? "organization" : area === "projects" ? "project" : area === "news" ? "news" : String(row.type),
        price: typeof row.price === "number" ? row.price : 0,
        image: String(row.avatar_url ?? row.logo_url ?? row.poster_url ?? row.image_url ?? "") || null,
        available: typeof row.available === "boolean" ? row.available : null,
      };
      if (["prop", "vehicle", "location"].includes(result.type)) result.priceLabel = listingPriceLabel(result.price, row, "/Tag", locale, market);
      group.results.push(result);
      if (group.results.length === VISIBLE) {
        group.nextOffset = offset + i + 1;
        return group;
      }
    }
    offset += rows.length;
    if (rows.length < PAGE) return group;
  }
  // Continue scanning on explicit request; never pretend a bounded scan is exhaustive.
  group.nextOffset = offset;
  return group;
}

export type SearchCursor = { wishIndex: number; area: SearchArea; offset: number };
export async function executeUnifiedSearch(plan: SearchPlan, locale: string, viewerId: string | null, signal: AbortSignal, cursor?: SearchCursor) {
  const tasks = cursor ? [cursor] : plan.searches.flatMap((wish, wishIndex) =>
    (wish.area === "all" ? SEARCH_AREAS : [wish.area]).map(area => ({ wishIndex, area, offset: 0 })));
  const groups: SearchGroup[] = new Array(tasks.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(tasks.length, 4) }, async () => {
    while (next < tasks.length) {
      const index = next++, task = tasks[index];
      groups[index] = await readGroup(plan, task.wishIndex, task.area, task.offset, locale, viewerId, signal);
    }
  }));
  return { groups };
}
