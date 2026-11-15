import { occupationCatalogue } from "./primary-occupation";
import { getDepartmentRoleLabel } from "./departments";
export { DEPARTMENT_HEADS_QUERY, isDepartmentHeadsQuery } from "./unified-search-areas";
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
