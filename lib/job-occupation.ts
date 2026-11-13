import { FILM_DEPARTMENTS } from "@/lib/filmRoles";
import { jobFacts, type BrowseJob } from "@/lib/job-metadata";

const key = (value: string) => value.normalize("NFKC").trim().toLowerCase();
/** Exact catalogue matches only. An assistant must not become a head of department. */
export function jobOccupation(job: BrowseJob): { department: string; role: string } | null {
  const role = key(jobFacts(job).roleLabel), category = key(job.category ?? "");
  if (!role) return null;
  const matches = FILM_DEPARTMENTS.flatMap(department => department.roles
    .filter(item => [item.id, item.label, item.labelEn ?? "", ...(item.aliases ?? [])].some(label => label && key(label) === role))
    .map(item => ({ department: department.id, departmentLabel: department.label, role: item.id })));
  const scoped = matches.filter(item => key(item.department) === category || key(item.departmentLabel) === category);
  return scoped.length === 1 ? scoped[0] : matches.length === 1 ? matches[0] : null;
}
