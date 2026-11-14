import "server-only";
import { getTranslations } from "next-intl/server";
import { departments, getDepartmentRoleLabel, getDeptLabel } from "@/lib/departments";
import { occupationChoices } from "@/lib/primary-occupation";
import { placeCatalog, placeCandidatesForLabel } from "@/lib/places/catalog";
import { publicMapPoint } from "@/lib/places/public-map-point";
import { GenieError } from "@/lib/genie-error";
import type { CrewNear } from "@/lib/genie-search";
import { COUNTRY_CODES } from "@/lib/places/countries";

export const DIRECTORY_SEARCH_SCHEMA = { type: "array", maxItems: 3, items: { type: "object", additionalProperties: false,
  properties: {
    directory: { type: "string", enum: ["marketplace", "locations"] },
    query: { type: "string" }, city: { type: "string" },
    countryCode: { type: "string", enum: ["", ...COUNTRY_CODES] },
  }, required: ["directory", "query", "city", "countryCode"],
} };

export const DIRECTORY_SEARCH_INSTRUCTIONS = `For requests to find objects, vehicles or equipment, use directorySearches with directory=marketplace. For shooting spaces, studios or filming locations use directory=locations. These filtered searches, like crewSearches, are read-only navigation, not database lookups. Use at most 3 searches total across both arrays. Use [] when no search was requested. Do not replace a specific search with an unfiltered catalogue link.
query contains a short search term for the requested object/space (prefer the singular noun); exclude command words, city, country and unrequested details. city contains only the requested town, never a country. countryCode is the explicit country as ISO code, otherwise empty. Keep these fields separate. Do not invent categories or result IDs.
Examples: 'zeig mir ein Boot in Berlin' => directorySearches=[{directory:'marketplace',query:'Boot',city:'Berlin',countryCode:''}]. 'zeig mir ein Studio in der Schweiz' => directorySearches=[{directory:'locations',query:'Studio',city:'',countryCode:'CH'}]. A generic studio request includes both film and photo studios. Country names in any supported language map to their ISO code (Schweiz/Switzerland/Svizzera/Suisse => CH); never put the country name in query or city.
A fresh complete request replaces previous search filters. In particular the studio-in-Switzerland example after the Berlin boat example must clear Berlin and Boot. Only carry forward context for explicit refinements such as 'instead in Hamburg' or 'the same in Austria'. Ask a brief clarification if the requested directory or place is ambiguous. Do not invent GPS/profile access. Radius searches are supported only for crew; for other directories explain that an exact city/country search is available, and ask before substituting it for a radius request.
Reply briefly with what search is being offered and its actual filters, in the user's supported language. Never claim an item exists, was found, is available, or that results were inspected. Do not claim anything was saved, sent or booked.`;

export async function directorySearchLinks(value: unknown, locale: string) {
  if (!Array.isArray(value) || value.length > 3) throw new GenieError("failed", 502);
  if (!value.length) return [];
  const destinationText = await getTranslations({ locale, namespace: "Genie.destinations" });
  const countries = new Intl.DisplayNames([locale], { type: "region" });
  return value.map(search => {
    if (!search || typeof search !== "object" || Array.isArray(search)
      || Object.keys(search).some(key => !["directory", "query", "city", "countryCode"].includes(key))
      || !["marketplace", "locations"].includes(search.directory)
      || [search.query, search.city, search.countryCode].some(item => typeof item !== "string" || /[\u0000-\u001f<>\\]/.test(item))
      || search.query.length > 150 || search.city.length > 120
      || (search.countryCode && !(COUNTRY_CODES as readonly string[]).includes(search.countryCode))) throw new GenieError("failed", 502);
    const query = search.query.trim(), city = search.city.trim(), country = search.countryCode;
    if (!query && !city && !country) throw new GenieError("search_unresolved", 422);
    const params = new URLSearchParams({ genie: "1" });
    if (query) params.set("q", query);
    if (city) params.set("cityText", city);
    if (country) params.set("country", country);
    const label = [destinationText(search.directory), query, city, country ? countries.of(country) : ""].filter(Boolean).join(" · ");
    return { href: `${search.directory === "marketplace" ? "/props" : "/locations"}?${params}`, label: label.slice(0, 100) };
  });
}

export const CREW_SEARCH_SCHEMA = { type: "array", maxItems: 3, items: { type: "object", additionalProperties: false,
  properties: {
    departmentId: { type: "string", enum: departments.map(dept => dept.id) },
    role: { type: "string" }, city: { type: "string" }, countryCode: { type: "string" },
    radiusKm: { type: "integer", minimum: 0, maximum: 200 },
  }, required: ["departmentId", "role", "city", "countryCode", "radiusKm"],
} };

export const CREW_SEARCH_INSTRUCTIONS = `You may prepare read-only crew searches using crewSearches. Never claim to have inspected, matched or counted actual profiles. Output [] for non-search requests. For each requested occupation return a separate search (maximum 3), carrying forward only the user's stated city and refinements from this conversation. Do not claim people are suitable/available without their confirmed facts. For a request for a compatible gaffer, prepare a gaffer search in the same requested area, and ask for dates/requirements if suitability is unclear.
departmentId must be from: ${departments.map(dept => `${dept.id} (${dept.label})`).join("; ")}.
role is an exact canonical title or common German/English synonym; empty means the whole department. For general cameramen/camera crew use department kamera and empty role unless a specific position was requested. Known camera/light titles: ${departments.filter(dept => ["kamera", "licht"].includes(dept.id)).flatMap(dept => dept.roles).join("; ")}.
city is only the city explicitly requested, or empty. countryCode is the explicitly specified ISO country or empty; never guess. radiusKm=0 means in that city; for 'near' use 50 km unless the user specifies another radius (1–200 km). Include the chosen radius in your reply so it is transparent. Ask for a place if 'near me' has no stated city: you cannot access GPS or profile location. For no city use radiusKm=0. No external links, IDs of people or precise private addresses.
These searches are navigation proposals only, not content mutations. Shared workplace/schedule changes are not enabled in this web endpoint yet: explain this honestly; never claim to have moved a break, informed members or saved a plan. A schedule change needs a selected project/day, edit rights, conflict detection, explicit confirmation and a shared server acknowledgement.`;

export function resolveCrewNear(id: string, radius: string, locale: string): CrewNear | null {
  if (!/^[1-9]\d{0,2}$/.test(radius) || Number(radius) > 200) return null;
  const city = placeCatalog.cities.find(entry => entry.id === id);
  if (!city) return null;
  const point = publicMapPoint({ place_city_id: city.id, place_country_code: city.country, place_status: "verified" });
  return point.lat !== null && point.lng !== null ? { id, name: city.names[locale] ?? city.name, lat: point.lat, lng: point.lng, radius: Number(radius) } : null;
}

export async function crewSearchLinks(value: unknown, locale: string) {
  if (!Array.isArray(value) || value.length > 3) throw new GenieError("failed", 502);
  if (!value.length) return [];
  const [t, animals, taxonomy] = await Promise.all([getTranslations({ locale, namespace: "Genie" }), getTranslations({ locale, namespace: "FilmAnimals" }), getTranslations({ locale, namespace: "Taxonomy" })]);
  return value.map(search => {
    if (!search || typeof search !== "object" || Object.keys(search).some(key => !["departmentId", "role", "city", "countryCode", "radiusKm"].includes(key))
      || [search.departmentId, search.role, search.city, search.countryCode].some(item => typeof item !== "string" || item.length > 150 || /[\u0000-\u001f<>]/.test(item))
      || !Number.isInteger(search.radiusKm) || search.radiusKm < 0 || search.radiusKm > 200
      || (search.countryCode && !/^[A-Z]{2}$/.test(search.countryCode)) || (!search.city && search.radiusKm)) throw new GenieError("failed", 502);
    const dept = departments.find(item => item.id === search.departmentId);
    if (!dept) throw new GenieError("failed", 502);
    const role = search.role ? occupationChoices([search.role]).filter(item => item.departmentId === dept.id) : [];
    if (search.role && role.length !== 1) throw new GenieError("search_unresolved", 422);
    const params = new URLSearchParams({ genie: "1", department: dept.id });
    if (role.length) params.set("role", role[0].roleId);
    let place = search.city.trim();
    if (search.radiusKm) {
      const candidates = placeCandidatesForLabel(place, search.countryCode);
      if (candidates.length !== 1) throw new GenieError("search_unresolved", 422);
      const near = resolveCrewNear(candidates[0].id, String(search.radiusKm), locale);
      if (!near) throw new GenieError("search_unresolved", 422);
      params.set("near", near.id); params.set("radius", String(near.radius));
      place = t("searchNear", { city: near.name, radius: near.radius });
    } else if (place) params.set("cityText", place);
    if (search.countryCode) params.set("country", search.countryCode);
    const title = role.length ? getDepartmentRoleLabel(dept.id, role[0].label, locale, animals, taxonomy) : getDeptLabel(dept, locale, animals, taxonomy);
    return { href: `/creators?${params}`, label: `${title}${place ? ` · ${place}` : ""}`.slice(0, 100) };
  });
}
