import { browsePlaceOptions, matchesPlace } from "./places/core";
import { normalizedCatalogueSearch, projectTypeLabel, projectTypeOptions } from "./project-type-labels";

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

type ProjectBrowseFilters = {
  query: string;
  country: string;
  type: string;
  year: string;
  director: string;
};

/** Shared by the website and native view: each facet honors all other filters. */
export function projectBrowseSelection(
  projects: readonly BrowseProject[], filters: ProjectBrowseFilters, locale: string, translate: (key: string) => string,
) {
  const needle = normalizedCatalogueSearch(filters.query, locale);
  const searched = projects.filter(project => !needle || [project.title, project.director ?? "", project.type ?? "", projectTypeLabel(project.type ?? "", translate)]
    .some(value => normalizedCatalogueSearch(value, locale).includes(needle)));
  const matches = (project: BrowseProject, selected: ProjectBrowseFilters, except?: keyof ProjectBrowseFilters) =>
    (except === "country" || matchesPlace(project, "country", selected.country)) &&
    (except === "type" || !selected.type || project.type === selected.type) &&
    (except === "year" || !selected.year || String(project.year) === selected.year) &&
    (except === "director" || !selected.director || project.director === selected.director);
  // Resolve against the other filters first. An obsolete director must not
  // suppress all results or hide valid options after another filter changes.
  const directors = [...new Set(searched.filter(project => matches(project, filters, "director"))
    .flatMap(project => project.director?.trim() ? [project.director] : []))]
    .sort((a, b) => a.localeCompare(b, locale)).map(value => ({ value, label: value }));
  const director = directors.some(option => option.value === filters.director) ? filters.director : "";
  const selected = { ...filters, director };
  const forFacet = (facet: keyof ProjectBrowseFilters) => searched.filter(project => matches(project, selected, facet));
  return {
    director,
    directors,
    types: projectTypeOptions(forFacet("type").flatMap(project => project.type?.trim() ? [project.type] : []), translate, locale),
    years: [...new Set(forFacet("year").flatMap(project => project.year === null ? [] : [project.year]))]
      .sort((a, b) => b - a).map(value => ({ value: String(value), label: String(value) })),
    countries: browsePlaceOptions(forFacet("country"), "country", locale),
    projects: searched.filter(project => matches(project, selected)),
  };
}

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
