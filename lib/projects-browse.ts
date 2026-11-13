export type BrowseProject = {
  place_country_code?: string | null;
  id: string;
  title: string;
  year: number | null;
  type: string | null;
  director: string | null;
  poster_url: string | null;
  crew_count: number;
  updated_at: string | null;
  created_at: string | null;
};

export type ProjectSort = "recent" | "year_desc" | "year_asc" | "title_asc" | "crew_desc";

export function sortProjects(projects: readonly BrowseProject[], sort: ProjectSort, locale: string): BrowseProject[] {
  const collator = new Intl.Collator(locale, { sensitivity: "base", numeric: true });
  const updatedTime = (project: BrowseProject) => Date.parse(project.updated_at ?? project.created_at ?? "") || 0;
  return [...projects].sort((a, b) => {
    let result = 0;
    if (sort === "recent") result = updatedTime(b) - updatedTime(a);
    if (sort === "year_desc" || sort === "year_asc") {
      // Unknown years belong last in both directions.
      if (a.year === null && b.year !== null) return 1;
      if (b.year === null && a.year !== null) return -1;
      result = sort === "year_desc" ? (b.year ?? 0) - (a.year ?? 0) : (a.year ?? 0) - (b.year ?? 0);
    }
    if (sort === "crew_desc") result = b.crew_count - a.crew_count;
    return result || collator.compare(a.title, b.title) || a.id.localeCompare(b.id);
  });
}
