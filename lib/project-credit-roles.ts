import { departments, type Department } from "@/lib/departments";
import { normalizeOccupation } from "@/lib/gripTaxonomy";

type OccupationMatch = { department: Department; role: string };
const exact = new Map<string, OccupationMatch[]>();
const aliases = new Map<string, OccupationMatch[]>();
function indexRole(index: Map<string, OccupationMatch[]>, value: string, match: OccupationMatch) {
  const key = normalizeOccupation(value);
  const entries = index.get(key) ?? [];
  if (!entries.some(entry => entry.department.id === match.department.id && entry.role === match.role)) entries.push(match);
  index.set(key, entries);
}
for (const department of departments) {
  for (const role of department.roles) {
    const match = { department, role };
    indexRole(exact, role, match);
    for (const alias of department.roleAliases?.[role] ?? []) indexRole(aliases, alias, match);
  }
}

// Exact legacy credit titles observed in the existing public directory. These
// are department aliases only: keep the original job wording and qualifiers.
const legacyDepartments: Record<string, string> = {
  "Produktionspraktikantin": "produktion",
  "Set-AL-Assistenz": "produktion",
  "Kostümbildassistentin": "kostuem",
  "Szenenbildassistenz": "art",
  "Standby Art Director / On-set Props": "art",
  "Studio Props on Set / On-set Dresser": "art",
  "Assistant Property Master": "art",
  "Props on Set / On-set Dresser": "art",
  "Supervising Set Dresser": "art",
  "Set Dresser (Estonia)": "art",
  "Additional Stand-by Construction": "art",
  "Set Dresser Assistant": "art",
  "Decorator": "art",
  "Carpenter": "art",
  "Assistant Art Director / On-set Props & Dresser": "art",
  "Construction Crew": "art",
  "Carpenter / On-set Dresser": "art",
};
for (const [role, departmentId] of Object.entries(legacyDepartments)) {
  const department = departments.find(item => item.id === departmentId);
  if (department) indexRole(aliases, role, { department, role });
}

/** Notes and character names are member content, never evidence for a department. */
export function splitProjectCreditRole(value: string) {
  const noteIndex = value.indexOf("||");
  const roleAndCharacter = noteIndex < 0 ? value : value.slice(0, noteIndex);
  const characterIndex = roleAndCharacter.indexOf(" — ");
  return {
    role: (characterIndex < 0 ? roleAndCharacter : roleAndCharacter.slice(0, characterIndex)).trim(),
    character: characterIndex < 0 ? "" : roleAndCharacter.slice(characterIndex + 3).trim(),
    note: noteIndex < 0 ? "" : value.slice(noteIndex + 2).trim(),
  };
}

export function resolveProjectCreditRole(value: string): OccupationMatch | null {
  const key = normalizeOccupation(splitProjectCreditRole(value).role);
  const candidates = exact.get(key) ?? aliases.get(key) ?? [];
  // Multiple departments really use some titles. Keep them unassigned until the
  // member supplies an unambiguous occupation rather than guessing from a word.
  if (new Set(candidates.map(candidate => candidate.department.id)).size !== 1) return null;
  return candidates[0] ?? null;
}

export function groupProjectCredits<T extends { role: string }>(credits: readonly T[]) {
  const groups = new Map<string, { department: Department | null; members: T[] }>();
  for (const credit of credits) {
    const department = resolveProjectCreditRole(credit.role)?.department ?? null;
    const key = department?.id ?? "unassigned";
    if (!groups.has(key)) groups.set(key, { department, members: [] });
    groups.get(key)!.members.push(credit);
  }
  const order = ["cast", ...departments.map(department => department.id)];
  return [...groups.values()].sort((a, b) =>
    (a.department ? order.indexOf(a.department.id) : order.length) - (b.department ? order.indexOf(b.department.id) : order.length));
}
