import "server-only";
import { getTranslations } from "next-intl/server";
import { departments, getDepartmentRoleLabel, getDeptLabel } from "@/lib/departments";
import { occupationChoices } from "@/lib/primary-occupation";
import { placeCatalog, placeCandidatesForLabel } from "@/lib/places/catalog";
import { publicMapPoint } from "@/lib/places/public-map-point";
import { GenieError } from "@/lib/genie-error";
import type { CrewNear } from "@/lib/genie-search";

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
