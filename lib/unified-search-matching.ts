import { departments, getDepartmentRoleFormLabels, getDeptLabel } from "./departments";
import { occupationCatalogue } from "./primary-occupation";
import { placeCandidatesForLabel, placeReadFields } from "./places/catalog";
import { countryCode, placeKey, placeCitySearchAliases } from "./places/core";
import { publicMapPoint } from "./places/public-map-point";
import { withinCrewRadius } from "./genie-search";
import { DEPARTMENTS as marketplaceDepartments, deptValues, groupValues, marketplaceCategory, SEARCH_SYNONYMS } from "./marketplaceCategories";
import continents from "./places/continents.json" with { type: "json" };
import type { SearchPlace, SearchWish } from "./unified-search";
import { isWholeAreaQuery } from "./unified-search-areas";
import { departmentHeadTerms, isDepartmentHeadsQuery } from "./unified-search-production";
import { cateringSearch, CATERING_SEARCH_TERMS } from "./unified-search-catering";
import { searchTextKey, occupationTextKey } from "./search-text-key";
import { searchConcept, searchJargon, vocabularyDepartment, vocabularyRole } from "./unified-search-vocabulary";

// Country group facts: Unicode CLDR supplemental/territoryContainment.json (UN M49).
// https://github.com/unicode-org/cldr-json/blob/main/cldr-json/cldr-core/supplemental/territoryContainment.json
export const continentCountries = (code: string): string[] => continents[code as keyof typeof continents] ?? [];
export const searchKey = searchTextKey;

/** Search interpretation only, never a stored identity update. Prefer a current
 * city name to historical aliases (e.g. Berlin vs North Canton's former name). */
export function searchCityCandidates(label: string, country = "") {
  const candidates = placeCandidatesForLabel(label, country), key = searchKey(label);
  const current = candidates.filter(city => [city.name, ...Object.values(city.names)].some(name => searchKey(name) === key));
  return current.length ? current : candidates;
}

/** Search aliases only; never rewrite a person's saved occupations. */
const synonyms: Record<string, string[]> = {
  ob: ["Oberbeleuchter", "Gaffer"], oberbeleuchter: ["Oberbeleuchter", "Gaffer"], gaffer: ["Gaffer", "Oberbeleuchter"],
  fahrer: ["Fahrer", "Driver"], driver: ["Driver", "Fahrer"],
  produktionsfahrer: ["Produktionsfahrer", "Production Driver"],
  beleuchter: ["Beleuchter", "Electrician", "Lighting Technician"],
  boot: ["Boot", "Boat", "Schiff", "Yacht"], boat: ["Boat", "Boot", "Yacht"],
  auto: ["Auto", "PKW", "Car"], car: ["Car", "Auto", "PKW"],
  studio: ["Studio"], kostum: ["Kostüm", "Costume"], kostuem: ["Kostüm", "Costume"], costume: ["Costume", "Kostüm"],
  polizei: ["Polizei", "Police", "Polizia", "Policía", "Policie", "Rendőrség", "Politie", "Polis", "Streifenwagen", "Streifenpolizist"],
};

const cameraPeople = ["Director of Photography (DoP)", "Kameramann", "Camera Operator"];
const crewSynonyms: Record<string, string[]> = {
  kameramann: cameraPeople, kameramanner: cameraPeople, kamerafrau: cameraPeople, kamerafrauen: cameraPeople,
  cameraman: cameraPeople, cameramen: cameraPeople, camerawoman: cameraPeople, cinematographer: cameraPeople,
};
// Gender punctuation is not part of an occupation. Keep the original labels in
// returned terms so stored IDs/positions and member-written text are untouched.
export const occupationKey = occupationTextKey;
const occupationKeys = (value: string) => {
  const key = occupationKey(value);
  return [key, ...(key.endsWith("innen") ? [key.slice(0, -5)] : key.endsWith("in") ? [key.slice(0, -2)] : [])];
};

/** Exact department names only: a specific job must retain its specialization. */
export function searchDepartment(query: string, locale = "de", taxonomy?: (key: string) => string) {
  const key = searchKey(query);
  return key ? departments.find(dept => [dept.id, dept.label, ...Object.values(dept.labels), getDeptLabel(dept, locale, undefined, taxonomy)]
    .some(label => searchKey(label) === key)) ?? vocabularyDepartment(query)
    ?? (searchConcept(query)?.query === "Kostüm" ? departments.find(dept => dept.id === "kostuem") : undefined) : undefined;
}

export function wishSearchTerms(wish: SearchWish, locale = "de", taxonomy?: (key: string) => string): string[] {
  if (wish.area === "crew" && !wish.department && isDepartmentHeadsQuery(wish.query)) return departmentHeadTerms(locale, taxonomy);
  if (wish.area === "companies" && !wish.department && cateringSearch(wish.query)) return CATERING_SEARCH_TERMS;
  if (!wish.department && isWholeAreaQuery(wish.area, wish.query)) return [];
  const crew = wish.area === "crew" || wish.area === "all";
  const concept = searchConcept(wish.query);
  const jargon = crew ? searchJargon(wish.query) : undefined;
  const role = crew ? vocabularyRole(wish.query) : undefined;
  const terms = wish.query ? [...(jargon?.terms || (role ? [role.label] : undefined)
    || (crew && crewSynonyms[searchKey(wish.query)]) || concept?.terms || synonyms[searchKey(wish.query)] || [wish.query])] : [];
  const requested = [...terms];
  if (crew) {
    const dept = departments.find(d => d.id === wish.department) ?? searchDepartment(wish.query, locale, taxonomy);
    const roles = occupationCatalogue.filter(role => !dept || role.departmentId === dept.id).map(role => {
      const department = departments.find(d => d.id === role.departmentId)!;
      const forms = getDepartmentRoleFormLabels(department.id, role.label, locale, undefined, taxonomy);
      return { ...role, aliases: [...new Set([...role.aliases, ...forms])] };
    });
    if (dept && (!requested.length || searchDepartment(wish.query, locale, taxonomy)?.id === dept.id)) terms.push(...roles.flatMap(role => role.aliases));
    for (const term of requested) {
      const keys = occupationKeys(term);
      // An exact occupation wins: Model must never expand to Model Maker or 3D Modeler.
      const exact = roles.filter(role => role.aliases.some(alias => keys.includes(occupationKey(alias))));
      const matches = exact.length ? exact : roles.filter(role => role.aliases.some(alias => {
        const key = occupationKey(alias);
        // Generic drivers refer to vehicles, not the unrelated dolly-grip craft.
        if (["fahrer", "driver"].includes(searchKey(term))) return role.departmentId !== "grip" && /fahrer|\bdrivers?\b/.test(key);
        return keys.some(needle => (` ${key} `).includes(` ${needle} `));
      }));
      terms.push(...matches.flatMap(role => role.aliases));
    }
  }
  return [...new Set(terms.filter(Boolean))];
}

/** Expand a requested category, never all siblings of a particular object.
 * A motorcycle keyword must not match every car stored under picture vehicles. */
export function wishMarketplaceCategories(query: string, t: (key: string) => string): string[] {
  const key = searchKey(query);
  const values: string[] = Object.entries(SEARCH_SYNONYMS).filter(([alias]) => searchKey(alias) === key).flatMap(([, values]) => values);
  const service = marketplaceCategory(query);
  if (service?.department === "dienstleistungen" && service.subcategory) {
    const group = marketplaceDepartments.find(dept => dept.id === service.department)?.groups.find(group => group.id === service.subcategory);
    if (group) values.push(...groupValues(group));
  }
  // Generic lamps include every actual light source, not just entries whose
  // descriptions contain "Lampe". Control desks/DMX nodes remain separate.
  for (const groupId of searchConcept(query)?.groups ?? []) {
    const group = marketplaceDepartments.flatMap(dept => dept.groups).find(group => group.id === groupId);
    if (group) values.push(...groupValues(group));
  }
  for (const department of marketplaceDepartments) {
    if ([department.id, department.label, t(`categories.${department.id}`)].some(label => searchKey(label) === key)) values.push(...deptValues(department));
    for (const group of department.groups) {
      if ([group.id, group.label, t(`subcategories.${group.id}`)].some(label => searchKey(label) === key)) values.push(...groupValues(group));
    }
  }
  return [...new Set(values)];
}

export const needsMarketplaceEvidence = (query: string) => !!searchConcept(query);

/** SQL first selects possible matches; verify actual words before ranking,
 * pagination and map projection. "Hut" must not match "Schutz", and the English
 * noun "hat" must not match the German auxiliary verb in a description. */
export function matchesMarketplaceConcept(row: Record<string, unknown>, query: string): boolean {
  const concept = searchConcept(query);
  if (!concept) return true;
  const category = marketplaceCategory(String(row.category ?? ""));
  if (category?.subcategory && concept.groups?.includes(category.subcategory)) return true;
  const title = [row.title, row.category].filter(value => typeof value === "string").join(" ");
  const matches = (text: string, term: string) => {
    const needle = searchKey(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (!needle) return false;
    // Unsegmented CJK text uses substrings; alphabetic words need boundaries.
    const alphabetic = /[\p{Script=Latin}\p{Script=Cyrillic}]/u.test(needle);
    const prefix = ["hut", "hute", "lampe", "leuchte"].includes(needle) ? "[\\p{L}]*" : "";
    const suffix = ["lampe", "leuchte"].includes(needle) ? "n?" : "";
    return alphabetic ? new RegExp(`(?:^|[^\\p{L}\\p{N}\\p{M}])${prefix}${needle}${suffix}(?=$|[^\\p{L}\\p{N}\\p{M}])`, "u").test(searchKey(text)) : searchKey(text).includes(needle);
  };
  return (concept.terms ?? [concept.query]).some(term => matches(title, term)
    || (searchKey(term) !== "hat" && matches(String(row.description ?? ""), term)));
}

export function isOccupationWish(wish: SearchWish, terms: string[]) {
  return !!wish.department || occupationCatalogue.some(role => role.aliases.some(alias => terms.includes(alias)));
}

export function matchesSearchPlace(row: Record<string, unknown>, place: SearchPlace): boolean {
  const legacy = String(row.location ?? row.city ?? "");
  const fields = placeReadFields(legacy, row);
  const country = String(fields.place_country_code ?? "") || countryCode(String(row.country ?? ""));
  if (place.country && country !== place.country) return false;
  if (place.continent && !continentCountries(place.continent).includes(country)) return false;
  if (!place.city) return true;
  const candidates = searchCityCandidates(place.city, place.country);
  if (place.radiusKm) {
    if (candidates.length !== 1) return false;
    const center = publicMapPoint({ place_city_id: candidates[0].id, place_country_code: candidates[0].country, place_status: "verified" });
    const point = publicMapPoint({ ...fields, city: legacy });
    return center.lat !== null && center.lng !== null && withinCrewRadius(point, {
      id: candidates[0].id, name: place.city, lat: center.lat, lng: center.lng, radius: place.radiusKm,
    });
  }
  if (fields.place_city_id && candidates.some(city => city.id === fields.place_city_id)) return true;
  const names = [place.city, ...placeCitySearchAliases(place.city)].map(placeKey);
  return [fields.place_city_name, legacy.split(",")[0]].some(value => names.includes(placeKey(String(value ?? ""))));
}

export function matchesWishPlaces(row: Record<string, unknown>, wish: SearchWish): boolean {
  return !wish.places.length || wish.places.some(place => matchesSearchPlace(row, place));
}

/** Escape filter literals, including wildcard syntax. Never concatenate a raw query. */
export const filterLiteral = (value: string) => JSON.stringify(value);
export const exactLiteral = (value: string) => filterLiteral(value.replace(/[\\%_*]/g, "\\$&"));
export const containsLiteral = (value: string) => filterLiteral(`%${value.replace(/[\\%_*]/g, "\\$&")}%`);
