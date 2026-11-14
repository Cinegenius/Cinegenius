import { departments, getDepartmentRoleLabel } from "./departments";
import { occupationCatalogue } from "./primary-occupation";
import { placeCandidatesForLabel, placeReadFields } from "./places/catalog";
import { countryCode, placeKey, placeCitySearchAliases } from "./places/core";
import { publicMapPoint } from "./places/public-map-point";
import { withinCrewRadius } from "./genie-search";
import { DEPARTMENTS as marketplaceDepartments, deptValues, groupValues, SEARCH_SYNONYMS } from "./marketplaceCategories";
import continents from "./places/continents.json" with { type: "json" };
import type { SearchPlace, SearchWish } from "./unified-search";

// Country group facts: Unicode CLDR supplemental/territoryContainment.json (UN M49).
// https://github.com/unicode-org/cldr-json/blob/main/cldr-json/cldr-core/supplemental/territoryContainment.json
export const continentCountries = (code: string): string[] => continents[code as keyof typeof continents] ?? [];
export const searchKey = (value: unknown) => String(value ?? "").normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/ß/g, "ss").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** Search aliases only; never rewrite a person's saved occupations. */
const synonyms: Record<string, string[]> = {
  ob: ["Oberbeleuchter", "Gaffer"], oberbeleuchter: ["Oberbeleuchter", "Gaffer"], gaffer: ["Gaffer", "Oberbeleuchter"],
  fahrer: ["Fahrer", "Driver"], driver: ["Driver", "Fahrer"],
  produktionsfahrer: ["Produktionsfahrer", "Production Driver"],
  beleuchter: ["Beleuchter", "Electrician", "Lighting Technician"],
  boot: ["Boot", "Boat", "Schiff", "Yacht"], boat: ["Boat", "Boot", "Yacht"],
  auto: ["Auto", "PKW", "Car"], car: ["Car", "Auto", "PKW"],
  studio: ["Studio"], kostum: ["Kostüm", "Costume"],
};

const cameraPeople = ["Director of Photography (DoP)", "Kameramann", "Camera Operator"];
const crewSynonyms: Record<string, string[]> = {
  kameramann: cameraPeople, kameramanner: cameraPeople, kamerafrau: cameraPeople, kamerafrauen: cameraPeople,
  cameraman: cameraPeople, cameramen: cameraPeople, camerawoman: cameraPeople, cinematographer: cameraPeople,
};
// Gender punctuation is not part of an occupation. Keep the original labels in
// returned terms so stored IDs/positions and member-written text are untouched.
const occupationKey = (value: string) => searchKey(value.replace(/(?:\*|:|\/)innen\b/giu, "").replace(/(?:\*|:|\/)in\b/giu, "").replace(/\*frau\b/giu, ""));
const occupationKeys = (value: string) => {
  const key = occupationKey(value);
  return [key, ...(key.endsWith("innen") ? [key.slice(0, -5)] : key.endsWith("in") ? [key.slice(0, -2)] : [])];
};

export function wishSearchTerms(wish: SearchWish, locale = "de", taxonomy?: (key: string) => string): string[] {
  const crew = wish.area === "crew" || wish.area === "all";
  const terms = wish.query ? [...((crew && crewSynonyms[searchKey(wish.query)]) || synonyms[searchKey(wish.query)] || [wish.query])] : [];
  const requested = [...terms];
  if (crew) {
    const dept = departments.find(d => d.id === wish.department);
    const roles = occupationCatalogue.filter(role => !dept || role.departmentId === dept.id).map(role => {
      const department = departments.find(d => d.id === role.departmentId)!;
      const label = getDepartmentRoleLabel(department.id, role.label, locale, undefined, taxonomy);
      return { ...role, aliases: [...new Set([...role.aliases, label])] };
    });
    if (!requested.length && dept) terms.push(...roles.flatMap(role => role.aliases));
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
  const values: string[] = [...(SEARCH_SYNONYMS[query.trim().toLowerCase()] ?? [])];
  for (const department of marketplaceDepartments) {
    if ([department.id, department.label, t(`categories.${department.id}`)].some(label => searchKey(label) === key)) values.push(...deptValues(department));
    for (const group of department.groups) {
      if ([group.id, group.label, t(`subcategories.${group.id}`)].some(label => searchKey(label) === key)) values.push(...groupValues(group));
    }
  }
  return [...new Set(values)];
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
  const candidates = placeCandidatesForLabel(place.city, place.country);
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
