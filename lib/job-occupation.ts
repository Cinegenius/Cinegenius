import { FILM_DEPARTMENTS } from "@/lib/filmRoles";
import { departments, FILM_TO_PROFILE_DEPARTMENT, getDepartmentRoleSearchTerms, resolveDepartmentRole } from "@/lib/departments";
import { normalizeOccupation } from "@/lib/gripTaxonomy";
import { jobFacts, type BrowseJob } from "@/lib/job-metadata";

const key = (value: string) => value.normalize("NFKC").trim().toLowerCase();
type OccupationMatch = { department: string; departmentLabel: string; role: string };
const exactMatches = new Map<string, OccupationMatch[]>();
const aliasMatches = new Map<string, OccupationMatch[]>();
function add(index: Map<string, OccupationMatch[]>, value: string, match: OccupationMatch) {
  if (!value) return;
  const previous = index.get(value) ?? [];
  if (!previous.some(item => item.department === match.department && item.role === match.role)) index.set(value, [...previous, match]);
}
// Catalogue identities and alias lookups are stable for this bundle. Build once,
// rather than walking every department and title again for each job result.
for (const department of FILM_DEPARTMENTS) {
  const profileDepartment = departments.find(item => item.id === FILM_TO_PROFILE_DEPARTMENT[department.id]);
  for (const role of department.roles) {
    const match = { department: department.id, departmentLabel: department.label, role: role.id };
    for (const label of [role.id, role.label, role.labelEn ?? "", ...(role.aliases ?? [])]) add(exactMatches, key(label), match);
    const canonical = profileDepartment && resolveDepartmentRole(profileDepartment.id, role.label);
    if (profileDepartment && canonical) {
      for (const alias of getDepartmentRoleSearchTerms(profileDepartment, canonical)) add(aliasMatches, normalizeOccupation(alias), match);
    }
  }
}

/** Exact catalogue matches only. An assistant must not become a head of department. */
export function jobOccupation(job: BrowseJob): { department: string; role: string } | null {
  const label = jobFacts(job).roleLabel, role = key(label), category = key(job.category ?? "");
  if (!role) return null;
  // Preserve explicit job IDs before trying the shared, curated profile aliases.
  const matches = exactMatches.get(role) ?? aliasMatches.get(normalizeOccupation(label)) ?? [];
  const scoped = matches.filter(item => key(item.department) === category || key(item.departmentLabel) === category);
  return scoped.length === 1 ? scoped[0] : matches.length === 1 ? matches[0] : null;
}
