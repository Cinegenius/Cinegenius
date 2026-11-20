import { createHash } from "node:crypto";
import { isDiscoverySeed, validDiscoveryCursor, type DiscoveryCursor } from "./discovery-seed";
import { nativeDiscoveryPlan } from "./native-smart-discovery";
import { occupationFormFromCrew } from "@/lib/occupation-form";
import "server-only";
import { profileOccupationPreview, selectedCrewOccupations, type OccupationProfile } from "@/lib/crew-occupations";
import { marketplaceCategory } from "@/lib/marketplaceCategories";
import { db } from "@/lib/db";
import { getTranslations } from "next-intl/server";
import { profileAccessFor } from "@/lib/profile-privacy-server";
import { projectProfilePrivacy } from "@/lib/profile-privacy";
import { getDeptLabel, departments, taxonomyLabel } from "@/lib/departments";
import { placeReadFields } from "@/lib/places/catalog";
import { publicMapPoint } from "@/lib/places/public-map-point";
import { readPublicLocationArea } from "@/lib/location-privacy";
import { countryCode, PLACE_COLUMNS, placeDisplay } from "@/lib/places/core";
import { publicProjectMedia } from "@/lib/project-media-rights";
import { listingPriceLabel } from "@/lib/listing-price";
import { COMPANY_CATEGORIES } from "@/lib/companyCategories";
import { containsLiteral, exactLiteral, filterLiteral, isOccupationWish, matchesWishPlaces, searchKey, wishMarketplaceCategories, wishSearchTerms } from "@/lib/unified-search-matching";
import { compareNearby, nearbyDistance, nearbyOrigins } from "@/lib/unified-search-nearby";
import { isDepartmentHeadsQuery, matchingDepartmentHead, departmentHeadTerms, isProductionCrewQuery, matchingProductionRole, productionCrewTerms, crewSearchSegments } from "@/lib/unified-search-production";
import { matchesSearchRequirements, searchMatchScore } from "@/lib/unified-search-requirements";
import { cateringSearch, matchesCateringSearch } from "@/lib/unified-search-catering";
import { searchQueryTitle } from "@/lib/unified-search-areas";
import { SEARCH_AREAS, type SearchArea, type SearchGroup, type SearchPlan, type SearchResult, type SearchWish, type NearbyCursor, type SearchRankCursor } from "@/lib/unified-search";

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
  const evidence = !!(wish.requirements?.length || wish.exclude?.length);
  const patterns = (columns: string[]) => terms.flatMap(term => columns.map(column => `${column}.ilike.${containsLiteral(term)}`));
  const kinds = LISTING_AREAS[area];
  const filtered = <T extends { or: (filters: string) => T }>(query: T, filters: string[]) => filters.length ? query.or(filters.join(",")) : query;
  if (kinds) {
    const facts = area === "animals" ? ",training_level:metadata->>training_level,special_skills:metadata->>special_skills" : area === "marketplace" ? ",vehicle_subtype:metadata->>vehicle_subtype,make:metadata->>make,model:metadata->>model" : "";
    const filters = patterns(["title", "description", "category", ...(area === "marketplace"
      ? ["metadata->>vehicle_subtype", "metadata->>make", "metadata->>model", "metadata->marketplace->>brand", "metadata->marketplace->>model"] : area === "animals" ? ["metadata->>special_skills"] : [])]);
    if (area === "marketplace" && categories.length) filters.push(`category.in.(${categories.map(filterLiteral).join(",")})`);
    return filtered(db.from("privacy_visible_listings").select(`${PLACE_COLUMNS},id,user_id,title,city,type,category,price,image_url,price_negotiable:metadata->price_negotiable,price_on_request:metadata->price_on_request,rental_type:metadata->>rental_type,marketplace:metadata->marketplace${evidence ? `,description${facts}` : ""}${map && area === "locations" ? ",location_area:metadata->location_area" : ""}`)
      .eq("published", true).in("type", kinds), filters).order("id");
  }
  if (area === "crew") {
    const filters = isOccupationWish(wish, terms)
      ? terms.map(term => `role.ilike.${exactLiteral(term)}`)
      : patterns(["display_name", "role", "bio"]);
    if (terms.length) filters.push(`positions.ov.{${terms.map(filterLiteral).join(",")}}`);
    return filtered(db.from("profiles").select(`${PLACE_COLUMNS},user_id,display_name,role,positions,crew,bio,location,avatar_url,available`)
      .not("display_name", "is", null).neq("display_name", ""), filters).order("user_id");
  }
  if (area === "companies") {
    const filters = patterns(["name", "description"]);
    if (categories.length) filters.push(`categories.ov.{${categories.map(filterLiteral).join(",")}}`);
    if (terms.length) filters.push(`services.ov.{${terms.map(filterLiteral).join(",")}}`);
    return filtered(db.from("companies").select(`${PLACE_COLUMNS},id,slug,name,city,logo_url${evidence || cateringSearch(wish.query) ? ",description,categories,services" : ""}${cateringSearch(wish.query) ? ",catering_details" : ""}`)
      .eq("published", true), filters).order("id");
  }
  // Published projects and private working copies are separate tables.
  if (area === "projects") return filtered(db.from("projects").select(`${PLACE_COLUMNS},id,title,description,poster_url,metadata,created_by`), patterns(["title", "description", "director"])).order("id");
  if (area === "organizations") return filtered(db.from("organizations").select(`${PLACE_COLUMNS},id,slug,name,city,logo_url${evidence ? ",description" : ""}`)
    .eq("moderation_status", "approved"), patterns(["name", "description"])).order("id");
  return filtered(db.from("organization_entries").select(`${PLACE_COLUMNS},id,slug,title,city,image_url,organization:organizations!inner(slug,moderation_status)${evidence ? ",summary,description" : ""}`)
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

type ResultPage = SearchGroup & { listPage?: SearchGroup };
type ProfilePage = { data: Row[]; error: null; privacy: Awaited<ReturnType<typeof profileAccessFor>> };
type ReadProfilePage = (offset: number) => Promise<ProfilePage>;
async function readGroup(plan: SearchPlan, wishIndex: number, area: SearchArea, offset: number, locale: string, viewerId: string | null, signal: AbortSignal, view: "list" | "map" | "combined", nearbyAfter?: NearbyCursor, segment?: string, rankAfter?: SearchRankCursor, readProfilePage?: ReadProfilePage, discoverySeed?: string, discoveryAfter?: DiscoveryCursor): Promise<ResultPage> {
  const wish = plan.searches[wishIndex];
  const taxonomy = await getTranslations({ locale, namespace: "Taxonomy" });
  const productionCrew = area === "crew" && !wish.department && isProductionCrewQuery(wish.query);
  const terms = segment ? productionCrew ? productionCrewTerms(segment, locale, taxonomy) : departmentHeadTerms(locale, taxonomy, segment) : wishSearchTerms({ ...wish, area }, locale, taxonomy);
  const catalog = await getTranslations({ locale, namespace: "MarketplaceCatalog" });
  const market = await getTranslations({ locale, namespace: "MarketplaceOffer" });
  const ui = await getTranslations({ locale });
  const categories = area === "marketplace" ? wishMarketplaceCategories(wish.query, catalog) : area === "companies"
    ? COMPANY_CATEGORIES.filter(category => [category.id, category.label, taxonomyLabel(category.label, ui)].some(label => terms.some(term => searchKey(label).includes(searchKey(term))))).map(category => category.id) : [];
  const group: ResultPage = { area, wishIndex, label: await searchWishLabel(wish, locale), results: [], nextOffset: null };
  if (segment) {
    group.segment = segment;
    const dept = departments.find(item => item.id === segment)!;
    group.label = `${getDeptLabel(dept, locale, undefined, taxonomy)} · ${group.label}`;
  }
  const heads = area === "crew" && !wish.department && isDepartmentHeadsQuery(wish.query);
  const catering = area === "companies" && !wish.department ? cateringSearch(wish.query) : null;
  const limit = view !== "list" ? PAGE * 3 : VISIBLE;
  const origins = nearbyOrigins(wish);
  const shuffled = Boolean(discoverySeed && area === "crew");
  const ranked = plan.version === 2 || shuffled;
  const allowNearby = origins.length > 0 && !wish.places.some(place => place.radiusKm > 0) && (offset === 0 || !!nearbyAfter || ranked);
  const requestedOffset = offset;
  if (nearbyAfter || ranked) offset = 0;
  type Candidate = NearbyCursor & { row: Row; origin: string };
  const nearest: Candidate[] = [];
  const local: (Candidate & SearchRankCursor & { discoveryKey?: string })[] = [];
  let localExists = false;
  const compareRank = (a: SearchRankCursor & { discoveryKey?: string }, b: SearchRankCursor & { discoveryKey?: string }) => shuffled
    ? (a.discoveryKey! < b.discoveryKey! ? -1 : a.discoveryKey! > b.discoveryKey! ? 1 : a.id.localeCompare(b.id))
    : b.score - a.score || compareNearby(a, b);
  const afterRank = shuffled ? discoveryAfter ? { score: 0, distanceKm: 20050, id: discoveryAfter.id, discoveryKey: discoveryAfter.key } : undefined : rankAfter;
  const toResult = (input: Row): SearchResult => {
    let row = input;
    if (area === "projects") row = publicProjectMedia(row);
    const place = placeDisplay(placeReadFields(String(row.location ?? row.city ?? ""), row, locale), String(row.location ?? row.city ?? ""), locale);
    const organization = Array.isArray(row.organization) ? row.organization[0] : row.organization;
    const occupations = area === "crew" ? profileOccupationPreview(row as OccupationProfile).map(title => taxonomyLabel(title, ui, occupationFormFromCrew(row.crew))) : [];
    const role = area === "crew" ? occupations.join(" · ") : row.role;
    const result: SearchResult = {
      id: String(area === "crew" ? row.user_id : area === "news" ? `${(organization as Row)?.slug}/${row.slug}` : row.slug || row.id),
      sourceId: String(area === "crew" ? row.user_id : row.id),
      title: String(row.display_name ?? row.name ?? row.title ?? ""),
      subtitle: area === "crew" ? [role, place].filter(Boolean).join(" · ") : place,
      type: area === "crew" ? "profile" : area === "companies" ? "company" : area === "organizations" ? "organization" : area === "projects" ? "project" : area === "news" ? "news" : String(row.type),
      price: typeof row.price === "number" ? row.price : 0,
      image: String(row.avatar_url ?? row.logo_url ?? row.poster_url ?? row.image_url ?? "") || null,
      available: typeof row.available === "boolean" ? row.available : null,
    };
    // Only public, canonical search facts leave the permission-projected row.
    if (area === "crew") {
      const profile = row as OccupationProfile;
      // This row has already passed projectProfilePrivacy. Do not parse the
      // joined subtitle: member-written occupations can contain separators.
      result.crewPreview = { occupation: occupations[0] ?? "", place: place.split(",").map(part => part.trim()).filter(Boolean).join(", ") };
      result.facets = { departments: [...new Set(selectedCrewOccupations(profile.positions ?? [], profile.crew?.occupations, profile.role, profile.crew?.primaryOccupation).map(role => role.departmentId))] };
      if (terms.length && [row.role, ...(Array.isArray(row.positions) ? row.positions : [])]
        .some(role => typeof role === "string" && terms.some(term => searchKey(term) === searchKey(role)))) result.evidence = "role";
    } else if (area === "marketplace") {
      const category = marketplaceCategory(row.category, result.type);
      if (category) result.facets = { marketplace: category.department };
    }
    if (!result.evidence && terms.some(term => [row.title, row.name].some(title => typeof title === "string" && searchKey(title).includes(searchKey(term))))) result.evidence = "title";
    if (wish.requirements?.length || catering) result.evidence = "requirements";
    if (["prop", "vehicle", "location"].includes(result.type)) result.priceLabel = listingPriceLabel(result.price, row, "/Tag", locale, market);
    if (view !== "list") {
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
    const shared = productionCrew && readProfilePage ? await readProfilePage(offset) : null;
    const { data, error } = shared ?? await queryFor(area, wish, productionCrew ? [] : terms, categories, view !== "list").range(offset, offset + PAGE - 1).abortSignal(signal);
    if (error) throw new Error("search_unavailable");
    const rows = (data ?? []) as unknown as Row[];
    const privacy = area === "crew" ? shared?.privacy ?? await profileAccessFor(rows.map(row => String(row.user_id)), viewerId, { signal, throwOnError: true }) : null;
    for (let i = 0; i < rows.length; i++) {
      let row = rows[i];
      if (area === "crew") {
        const access = privacy!.get(String(row.user_id));
        if (!access?.profile || (wish.places.length && !access.location)) continue;
        row = projectProfilePrivacy(row, access);
      }
      if (heads && !matchingDepartmentHead(row, segment)) continue;
      if (productionCrew && !matchingProductionRole(row, segment)) continue;
      if (catering && !matchesCateringSearch(row, catering)) continue;
      if (!matchesSearchRequirements(row, wish)) continue;
      row = geographyRow(row, area);
      if (matchesWishPlaces(row, wish)) {
        localExists = true;
        // Local matches always win, even if records changed between nearby pages.
        nearest.length = 0;
        if (ranked) {
          const distance = nearbyDistance(row, origins);
          const candidate = { row, score: searchMatchScore(row, terms), distanceKm: distance?.distanceKm ?? 20050, origin: distance?.origin ?? "", id: String(area === "crew" ? row.user_id : row.id) };
          const rankedCandidate = { ...candidate, ...(shuffled ? { discoveryKey: createHash("sha256").update(discoverySeed!).update("\0").update(candidate.id).digest("hex") } : {}) };
          if (!afterRank || compareRank(rankedCandidate, afterRank) > 0) {
            local.push(rankedCandidate); local.sort(compareRank);
            if (local.length > limit + 1) local.pop();
          }
          continue;
        }
        group.results.push(toResult(row));
        if (group.results.length === limit) {
          group.nextOffset = offset + i + 1;
          return group;
        }
      } else if (allowNearby && !localExists) {
        const distance = nearbyDistance(row, origins);
        if (distance) keepNearest({ ...distance, id: String(row.user_id && area === "crew" ? row.user_id : row.id), row });
      }
    }
    offset += rows.length;
    if (rows.length < PAGE) break;
    // Prove the absence of local results and inspect all eligible candidates
    // before claiming nearest. A request timeout is an error, never an empty or
    // arbitrarily ordered fallback. Non-geographic browsing stays bounded.
    if (!ranked && !wish.places.length && pass >= 2) { group.nextOffset = offset; return group; }
  }
  if (ranked && localExists) {
    group.results = local.slice(0, limit).map(candidate => toResult(candidate.row));
    if (local.length > limit) {
      const { score, distanceKm, id } = local[limit - 1];
      if (shuffled) group.discoveryCursor = { key: local[limit - 1].discoveryKey!, id };
      else group.rankCursor = { score, distanceKm, id };
      group.nextOffset = requestedOffset + limit;
    }
    if (view === "combined") {
      const more = local.length > VISIBLE, last = local[VISIBLE - 1];
      group.listPage = { ...group, results: group.results.slice(0, VISIBLE), nextOffset: more ? VISIBLE : null,
        rankCursor: more ? { score: last.score, distanceKm: last.distanceKm, id: last.id } : undefined };
    }
    return group;
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
    if (view === "combined") {
      const more = nearest.length > VISIBLE, last = nearest[VISIBLE - 1];
      group.listPage = { ...group, results: group.results.slice(0, VISIBLE), nextOffset: more ? VISIBLE : null,
        nearbyCursor: more ? { distanceKm: last.distanceKm, id: last.id } : undefined };
    }
  }
  return group;
}

export type SearchCursor = { wishIndex: number; area: SearchArea; offset: number; segment?: string; rank?: SearchRankCursor; nearby?: NearbyCursor; discovery?: DiscoveryCursor };
export function validSearchCursor(plan: SearchPlan, cursor: SearchCursor, discoverySeed?: string) {
  const wish = plan.searches[cursor.wishIndex];
  const shuffled = Boolean(discoverySeed && cursor.area === "crew");
  if (cursor.discovery !== undefined && (!shuffled || cursor.rank || cursor.nearby || !validDiscoveryCursor(cursor.discovery))) return false;
  if (shuffled && cursor.offset > 0 && !cursor.discovery) return false;
  const segments = crewSearchSegments(wish);
  if (cursor.segment !== undefined && (plan.version !== 2 || cursor.area !== "crew" || !segments.includes(cursor.segment))) return false;
  if (plan.version === 2 && cursor.area === "crew" && segments.length && !cursor.segment) return false;
  if (cursor.rank !== undefined) {
    const rank = cursor.rank;
    if (plan.version !== 2 || cursor.nearby || !rank || typeof rank !== "object" || Array.isArray(rank) || Object.keys(rank).some(key => !["score", "distanceKm", "id"].includes(key))
      || !Number.isInteger(rank.score) || rank.score < 0 || rank.score > 3 || !Number.isFinite(rank.distanceKm) || rank.distanceKm < 0 || rank.distanceKm > 20050 || typeof rank.id !== "string" || !rank.id || rank.id.length > 200) return false;
  }
  return plan.version !== 2 || cursor.offset === 0 || !!cursor.nearby || !!cursor.rank;
}
export async function executeUnifiedSearch(plan: SearchPlan, locale: string, viewerId: string | null, signal: AbortSignal, cursor?: SearchCursor, view: "list" | "map" | "combined" = "list", discoverySeed?: string) {
  if (discoverySeed !== undefined && (!isDiscoverySeed(discoverySeed) || JSON.stringify(plan) !== JSON.stringify(nativeDiscoveryPlan()))) throw new Error("invalid_request");
  const tasks: SearchCursor[] = cursor ? [cursor] : plan.searches.flatMap((wish, wishIndex) =>
    (wish.area === "all" ? SEARCH_AREAS : [wish.area]).flatMap(area => plan.version === 2 && area === "crew" && crewSearchSegments(wish).length
      ? crewSearchSegments(wish).map(segment => ({ wishIndex, area, offset: 0, segment })) : [{ wishIndex, area, offset: 0 }]));
  // General production searches share at most four profile pages within this
  // request. Do not download the same people once per department or send an
  // unbounded catalogue-alias URL. Rights stay request/account scoped; matching
  // and place projection still happen only after the privacy check above.
  const profilePages = new Map<number, Promise<ProfilePage>>();
  const readProfilePage: ReadProfilePage = offset => {
    const existing = profilePages.get(offset);
    if (existing) return existing;
    const page = (async (): Promise<ProfilePage> => {
      const { data, error } = await queryFor("crew", { area: "crew", query: "Crew", department: "", places: [] }, [], [])
        .range(offset, offset + PAGE - 1).abortSignal(signal);
      if (error) throw new Error("search_unavailable");
      const rows = (data ?? []) as unknown as Row[];
      const privacy = await profileAccessFor(rows.map(row => String(row.user_id)), viewerId, { signal, throwOnError: true });
      return { data: rows, error: null, privacy };
    })();
    profilePages.set(offset, page);
    if (profilePages.size > 4) profilePages.delete(profilePages.keys().next().value!);
    return page;
  };
  const pages: ResultPage[] = new Array(tasks.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(tasks.length, 4) }, async () => {
    while (next < tasks.length) {
      const index = next++, task = tasks[index];
      pages[index] = await readGroup(plan, task.wishIndex, task.area, task.offset, locale, viewerId, signal, view, task.nearby, task.segment, task.rank, readProfilePage, discoverySeed, task.discovery);
    }
  }));
  const groups = pages.map(({ listPage, ...group }) => view === "combined" && listPage ? listPage : group);
  return { groups, ...(view === "combined" ? { mapGroups: pages.map(page => { const group = { ...page }; delete group.listPage; return group; }) } : {}) };
}
