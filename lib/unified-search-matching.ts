import { departments, getDepartmentRoleLabel } from "./departments";
import { occupationCatalogue } from "./primary-occupation";
import { placeCandidatesForLabel, placeReadFields } from "./places/catalog";
import { countryCode, placeKey, placeCitySearchAliases } from "./places/core";
import { publicMapPoint } from "./places/public-map-point";
import { withinCrewRadius } from "./genie-search";
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

export function wishSearchTerms(wish: SearchWish, locale = "de", taxonomy?: (key: string) => string): string[] {
  const terms = wish.query ? [...(synonyms[searchKey(wish.query)] ?? [wish.query])] : [];
  const requested = [...terms];
  if (wish.area === "crew" || wish.area === "all") {
    const dept = departments.find(d => d.id === wish.department);
    for (const role of occupationCatalogue) {
      if (dept && role.departmentId !== dept.id) continue;
      const department = departments.find(d => d.id === role.departmentId)!;
      const label = getDepartmentRoleLabel(department.id, role.label, locale, undefined, taxonomy);
      if ((!requested.length && dept) || [...role.aliases, label].some(alias => requested.some(term => searchKey(alias).includes(searchKey(term))))) {
        terms.push(...role.aliases);
      }
    }
  }
  return [...new Set(terms.filter(Boolean))];
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
export const containsLiteral = (value: string) => filterLiteral(`%${value.replace(/[\\%_*]/g, "\\$&")}%`);
