import "server-only";
import { db } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import { profileAccessFor } from "@/lib/profile-privacy-server";
import { projectProfilePrivacy } from "@/lib/profile-privacy";
import { getDeptLabel, getDepartmentRoleLabel, departments, taxonomyLabel } from "@/lib/departments";
import { placeReadFields } from "@/lib/places/catalog";
import { publicMapPoint } from "@/lib/places/public-map-point";
import { readPublicLocationArea } from "@/lib/location-privacy";
import { countryCode, PLACE_COLUMNS, placeDisplay } from "@/lib/places/core";
import { publicProjectMedia } from "@/lib/project-media-rights";
import { listingPriceLabel } from "@/lib/listing-price";
import { COMPANY_CATEGORIES } from "@/lib/companyCategories";
import { containsLiteral, exactLiteral, filterLiteral, isOccupationWish, matchesWishPlaces, searchKey, wishMarketplaceCategories, wishSearchTerms } from "@/lib/unified-search-matching";
import { compareNearby, nearbyDistance, nearbyOrigins } from "@/lib/unified-search-nearby";
import { isDepartmentHeadsQuery, matchingDepartmentHead } from "@/lib/unified-search-production";
import { cateringSearch, matchesCateringSearch } from "@/lib/unified-search-catering";
import { searchQueryTitle } from "@/lib/unified-search-areas";
import { SEARCH_AREAS, type SearchArea, type SearchGroup, type SearchPlan, type SearchResult, type SearchWish, type NearbyCursor } from "@/lib/unified-search";

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
  const title = searchQueryTitle(wish, t) || (dept ? getDeptLabel(dept, locale, animals, taxonomy) : "");
  const places = wish.places.map(p => {
    const label = [p.city, p.country ? names.of(p.country) : "", p.continent ? names.of(p.continent) : ""].filter(Boolean).join(", ");
    return p.radiusKm ? t("withinRadius", { place: label, radius: p.radiusKm }) : label;
  }).filter(Boolean);
  return [title, places.join(" / ")].filter(Boolean).join(" · ");
}

function queryFor(area: SearchArea, wish: SearchWish, terms: string[], categories: string[], map = false) {
  const patterns = (columns: string[]) => terms.flatMap(term => columns.map(column => `${column}.ilike.${containsLiteral(term)}`));
  const kinds = LISTING_AREAS[area];
  const filtered = <T extends { or: (filters: string) => T }>(query: T, filters: string[]) => filters.length ? query.or(filters.join(",")) : query;
  if (kinds) {
    const filters = patterns(["title", "description", "category", ...(area === "marketplace"
      ? ["metadata->>vehicle_subtype", "metadata->>make", "metadata->>model", "metadata->marketplace->>brand", "metadata->marketplace->>model"] : [])]);
    if (area === "marketplace" && categories.length) filters.push(`category.in.(${categories.map(filterLiteral).join(",")})`);
    return filtered(db.from("privacy_visible_listings").select(`${PLACE_COLUMNS},id,user_id,title,city,type,category,price,image_url,price_negotiable:metadata->price_negotiable,price_on_request:metadata->price_on_request,rental_type:metadata->>rental_type,marketplace:metadata->marketplace${map && area === "locations" ? ",location_area:metadata->location_area" : ""}`)
      .eq("published", true).in("type", kinds), filters).order("id");
  }
  if (area === "crew") {
    const filters = isOccupationWish(wish, terms)
      ? terms.map(term => `role.ilike.${exactLiteral(term)}`)
      : patterns(["display_name", "role", "bio"]);
    if (terms.length) filters.push(`positions.ov.{${terms.map(filterLiteral).join(",")}}`);
    return filtered(db.from("profiles").select(`${PLACE_COLUMNS},user_id,display_name,role,positions,bio,location,avatar_url,available`)
      .not("display_name", "is", null).neq("display_name", ""), filters).order("user_id");
  }
  if (area === "companies") {
    const filters = patterns(["name", "description"]);
    if (categories.length) filters.push(`categories.ov.{${categories.map(filterLiteral).join(",")}}`);
    if (terms.length) filters.push(`services.ov.{${terms.map(filterLiteral).join(",")}}`);
    return filtered(db.from("companies").select(`${PLACE_COLUMNS},id,slug,name,city,logo_url${cateringSearch(wish.query) ? ",description,categories,services,catering_details" : ""}`)
      .eq("published", true), filters).order("id");
  }
  // Published projects and private working copies are separate tables.
  if (area === "projects") return filtered(db.from("projects").select(`${PLACE_COLUMNS},id,title,description,poster_url,metadata,created_by`), patterns(["title", "description", "director"])).order("id");
  if (area === "organizations") return filtered(db.from("organizations").select(`${PLACE_COLUMNS},id,slug,name,city,logo_url`)
    .eq("moderation_status", "approved"), patterns(["name", "description"])).order("id");
  return filtered(db.from("organization_entries").select(`${PLACE_COLUMNS},id,slug,title,city,image_url,organization:organizations!inner(slug,moderation_status)`)
    .in("moderation_status", ["approved", "ended"]).eq("organization.moderation_status", "approved"), patterns(["title", "summary", "description"])).order("id");
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

async function readGroup(plan: SearchPlan, wishIndex: number, area: SearchArea, offset: number, locale: string, viewerId: string | null, signal: AbortSignal, view: "list" | "map", nearbyAfter?: NearbyCursor): Promise<SearchGroup> {
  const wish = plan.searches[wishIndex];
  const taxonomy = await getTranslations({ locale, namespace: "Taxonomy" });
  const terms = wishSearchTerms({ ...wish, area }, locale, taxonomy);
  const catalog = await getTranslations({ locale, namespace: "MarketplaceCatalog" });
  const market = await getTranslations({ locale, namespace: "MarketplaceOffer" });
  const ui = await getTranslations({ locale });
  const categories = area === "marketplace" ? wishMarketplaceCategories(wish.query, catalog) : area === "companies"
    ? COMPANY_CATEGORIES.filter(category => [category.id, category.label, taxonomyLabel(category.label, ui)].some(label => terms.some(term => searchKey(label).includes(searchKey(term))))).map(category => category.id) : [];
  const group: SearchGroup = { area, wishIndex, label: await searchWishLabel(wish, locale), results: [], nextOffset: null };
  const heads = area === "crew" && !wish.department && isDepartmentHeadsQuery(wish.query);
  const catering = area === "companies" && !wish.department ? cateringSearch(wish.query) : null;
  const limit = view === "map" ? PAGE * 3 : VISIBLE;
  const origins = nearbyOrigins(wish);
  const allowNearby = origins.length > 0 && (offset === 0 || !!nearbyAfter);
  const requestedOffset = offset;
  if (nearbyAfter) offset = 0;
  type Candidate = NearbyCursor & { row: Row; origin: string };
  const nearest: Candidate[] = [];
  const toResult = (input: Row): SearchResult => {
    let row = input;
    if (area === "projects") row = publicProjectMedia(row);
    const place = placeDisplay(placeReadFields(String(row.location ?? row.city ?? ""), row, locale), String(row.location ?? row.city ?? ""), locale);
    const organization = Array.isArray(row.organization) ? row.organization[0] : row.organization;
    const headRole = heads ? matchingDepartmentHead(row) : undefined;
    const role = headRole ? getDepartmentRoleLabel(headRole.departmentId, headRole.label, locale, undefined, taxonomy) : row.role;
    const result: SearchResult = {
      id: String(area === "crew" ? row.user_id : area === "news" ? `${(organization as Row)?.slug}/${row.slug}` : row.slug || row.id),
      title: String(row.display_name ?? row.name ?? row.title ?? ""),
      subtitle: area === "crew" ? [role, place].filter(Boolean).join(" · ") : place,
      type: area === "crew" ? "profile" : area === "companies" ? "company" : area === "organizations" ? "organization" : area === "projects" ? "project" : area === "news" ? "news" : String(row.type),
      price: typeof row.price === "number" ? row.price : 0,
      image: String(row.avatar_url ?? row.logo_url ?? row.poster_url ?? row.image_url ?? "") || null,
      available: typeof row.available === "boolean" ? row.available : null,
    };
    if (["prop", "vehicle", "location"].includes(result.type)) result.priceLabel = listingPriceLabel(result.price, row, "/Tag", locale, market);
    if (view === "map") {
      // Never geocode private fields or use an offer's exact coordinates. Crew
      // map opt-out is already projected above; locations expose only their area.
      const areaPoint = area === "locations" ? readPublicLocationArea({ location_area: row.location_area }) : null;
      const point = areaPoint ?? publicMapPoint(row);
      result.mapPoint = point.lat !== null && point.lng !== null
        ? { lat: point.lat, lng: point.lng, ...(areaPoint ? { radiusMeters: areaPoint.radius_meters } : {}) } : null;
    }
    return result;
  };
  const keepNearest = (candidate: Candidate) => {
    // One result page plus a lookahead, regardless of the catalogue size. The
    // city-centre distance + stable ID cursor avoids retaining/skipping N pages.
    if (nearbyAfter && compareNearby(candidate, nearbyAfter) <= 0) return;
    let start = 0, end = nearest.length;
    while (start < end) {
      const middle = (start + end) >>> 1;
      if (compareNearby(nearest[middle], candidate) < 0) start = middle + 1;
      else end = middle;
    }
    nearest.splice(start, 0, candidate);
    if (nearest.length > limit + 1) nearest.pop();
  };
  for (let pass = 0; ; pass++) {
    signal.throwIfAborted();
    const { data, error } = await queryFor(area, wish, terms, categories, view === "map").range(offset, offset + PAGE - 1).abortSignal(signal);
    if (error) throw new Error("search_unavailable");
    const rows = (data ?? []) as unknown as Row[];
    const privacy = area === "crew" ? await profileAccessFor(rows.map(row => String(row.user_id)), viewerId, { signal, throwOnError: true }) : null;
    for (let i = 0; i < rows.length; i++) {
      let row = rows[i];
      if (area === "crew") {
        const access = privacy!.get(String(row.user_id));
        if (!access?.profile || (wish.places.length && !access.location)) continue;
        row = projectProfilePrivacy(row, access);
      }
      if (heads && !matchingDepartmentHead(row)) continue;
      if (catering && !matchesCateringSearch(row, catering)) continue;
      row = geographyRow(row, area);
      if (matchesWishPlaces(row, wish)) {
        // Local matches always win, even if records changed between nearby pages.
        nearest.length = 0;
        group.results.push(toResult(row));
        if (group.results.length === limit) {
          group.nextOffset = offset + i + 1;
          return group;
        }
      } else if (allowNearby && !group.results.length) {
        const distance = nearbyDistance(row, origins);
        if (distance) keepNearest({ ...distance, id: String(row.user_id && area === "crew" ? row.user_id : row.id), row });
      }
    }
    offset += rows.length;
    if (rows.length < PAGE) break;
    // Prove the absence of local results and inspect all eligible candidates
    // before claiming nearest. A request timeout is an error, never an empty or
    // arbitrarily ordered fallback. Non-geographic browsing stays bounded.
    if (!wish.places.length && pass >= 2) { group.nextOffset = offset; return group; }
  }
  if (!group.results.length && allowNearby) {
    group.nearby = true;
    group.results = nearest.slice(0, limit).map(candidate => ({ ...toResult(candidate.row), nearby: {
      distanceKm: Math.round(candidate.distanceKm), origin: candidate.origin,
    } }));
    if (nearest.length > limit) {
      const last = nearest[limit - 1];
      group.nextOffset = requestedOffset + limit;
      group.nearbyCursor = { distanceKm: last.distanceKm, id: last.id };
    }
  }
  return group;
}

export type SearchCursor = { wishIndex: number; area: SearchArea; offset: number; nearby?: NearbyCursor };
export async function executeUnifiedSearch(plan: SearchPlan, locale: string, viewerId: string | null, signal: AbortSignal, cursor?: SearchCursor, view: "list" | "map" = "list") {
  const tasks: SearchCursor[] = cursor ? [cursor] : plan.searches.flatMap((wish, wishIndex) =>
    (wish.area === "all" ? SEARCH_AREAS : [wish.area]).map(area => ({ wishIndex, area, offset: 0 })));
  const groups: SearchGroup[] = new Array(tasks.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(tasks.length, 4) }, async () => {
    while (next < tasks.length) {
      const index = next++, task = tasks[index];
      groups[index] = await readGroup(plan, task.wishIndex, task.area, task.offset, locale, viewerId, signal, view, task.nearby);
    }
  }));
  return { groups };
}
