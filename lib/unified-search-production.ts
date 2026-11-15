import { occupationCatalogue } from "./primary-occupation";
import { departments, getDepartmentRoleLabel } from "./departments";
import { isDepartmentHeadsQuery, isProductionCrewQuery } from "./unified-search-areas";
import type { SearchWish } from "./unified-search";
export { DEPARTMENT_HEADS_QUERY, isDepartmentHeadsQuery, PRODUCTION_CREW_QUERY, isProductionCrewQuery } from "./unified-search-areas";
const key = (value: string) => value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().trim();

// Explicit catalogue roles only. An assistant/trainee or a genre in someone's
// biography is not evidence that they lead a department. Saved roles stay untouched.
const leadLabels = new Set([
  "Produktionsleiter (PL)", "Herstellungsleiter (HL)", "Line Producer", "Location Manager",
  "Regisseur/in", "1st AD", "Director of Photography (DoP)",
  "Gaffer (Oberbeleuchter)", "Key Grip", "Tonmeister / Sound Mixer", "Production Sound Mixer", "Filmtonmeister*in",
  "Production Designer", "Szenenbildner*in", "Props Master (Chef-Requisiteur)",
  "Costume Designer", "Costume Supervisor", "Head of Make-up & Hair", "Chefmaskenbildner / Dept. Head Make-up",
  "Hair/Makeup Designer", "Makeup Designer", "Catering-Leitung",
]);
export const departmentHeadRoles = occupationCatalogue.filter(role => leadLabels.has(role.label));
export const departmentHeadSegments = [...new Set(departmentHeadRoles.map(role => role.departmentId))];
// A general shoot is a choice across the complete shared catalogue, not a
// claim that every department or a department-head qualification is required.
export const productionCrewSegments = departments.map(department => department.id);
export function crewSearchSegments(wish: SearchWish): string[] {
  if (wish.department || !["crew", "all"].includes(wish.area)) return [];
  return isProductionCrewQuery(wish.query) ? productionCrewSegments : isDepartmentHeadsQuery(wish.query) ? departmentHeadSegments : [];
}
export function productionCrewTerms(segment: string, locale = "de", taxonomy?: (key: string) => string) {
  return [...new Set(occupationCatalogue.filter(role => role.departmentId === segment).flatMap(role => [...role.aliases, getDepartmentRoleLabel(role.departmentId, role.label, locale, undefined, taxonomy)]))];
}
const productionRolesBySegment = new Map<string, Map<string, typeof occupationCatalogue[number]>>();
for (const role of occupationCatalogue) {
  for (const segment of [role.departmentId, ""]) {
    let index = productionRolesBySegment.get(segment);
    if (!index) { index = new Map(); productionRolesBySegment.set(segment, index); }
    for (const alias of role.aliases) if (!index.has(key(alias))) index.set(key(alias), role);
  }
}
export function matchingProductionRole(row: Record<string, unknown>, segment?: string) {
  const values = [row.role, ...(Array.isArray(row.positions) ? row.positions : [])].filter((value): value is string => typeof value === "string").map(key);
  const index = productionRolesBySegment.get(segment ?? "");
  for (const value of values) {
    const match = index?.get(value);
    if (match) return match;
  }
  return undefined;
}
export function departmentHeadTerms(locale = "de", taxonomy?: (key: string) => string, segment?: string) {
  return [...new Set(departmentHeadRoles.filter(role => !segment || role.departmentId === segment).flatMap(role => [...role.aliases, getDepartmentRoleLabel(role.departmentId, role.label, locale, undefined, taxonomy)]))];
}
export function matchingDepartmentHead(row: Record<string, unknown>, segment?: string) {
  const values = [row.role, ...(Array.isArray(row.positions) ? row.positions : [])].filter((value): value is string => typeof value === "string").map(key);
  for (const value of values) {
    const match = departmentHeadRoles.find(role => (!segment || role.departmentId === segment) && role.aliases.some(alias => value === key(alias)));
    if (match) return match;
  }
  return undefined;
}
