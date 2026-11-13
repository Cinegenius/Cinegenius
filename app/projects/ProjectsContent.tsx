"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Clapperboard, LayoutGrid, LayoutList, Search, X } from "lucide-react";
import ProjectBrowseResults from "@/components/ProjectBrowseResults";
import MobileBrowseControls, { MobileFilterField, MobileFilterSelect, type BrowseChip } from "@/components/MobileBrowseControls";
import { useViewState } from "@/lib/use-view-state";
import { PROJECT_CATEGORIES, projectCategoryForType, type ProjectCategoryId } from "@/lib/project-category-filter";
import { normalizedCatalogueSearch, projectTypeLabel, projectTypeOptions } from "@/lib/project-type-labels";
import { sortProjects, type BrowseProject, type ProjectSort } from "@/lib/projects-browse";

export default function ProjectsContent({ projects, category = null }: { projects: BrowseProject[]; category?: ProjectCategoryId | null }) {
  const t = useTranslations("projects");
  const ui = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [query, setQuery] = useViewState("projects.query", "");
  const [typeFilter, setTypeFilter] = useViewState("projects.typeFilter", "");
  const [yearFilter, setYearFilter] = useViewState("projects.yearFilter", "");
  const [directorFilter, setDirectorFilter] = useViewState("projects.directorFilter", "");
  const [sort, setSort] = useViewState<ProjectSort>("projects.sort", "year_desc");
  const [view, setView] = useViewState<"list" | "grid">("projects.view", "list");
  const categories = PROJECT_CATEGORIES.map(item => ({ value: item.id, label: t(item.labelKey) }));
  const categoryProjects = useMemo(() => category ? projects.filter(project => projectCategoryForType(project.type) === category) : projects, [projects, category]);
  const types = projectTypeOptions(categoryProjects.flatMap(project => project.type ? [project.type] : []), ui, locale);
  const years = [...new Set(categoryProjects.flatMap(project => project.year === null ? [] : [project.year]))].sort((a, b) => b - a).map(value => ({ value: String(value), label: String(value) }));
  const directors = [...new Set(categoryProjects.flatMap(project => project.director ? [project.director] : []))].sort((a, b) => a.localeCompare(b, locale)).map(value => ({ value, label: value }));
  const sortOptions = [
    { value: "recent", label: t("sortRecent") },
    { value: "year_desc", label: t("sortNewest") },
    { value: "year_asc", label: t("sortOldest") },
    { value: "title_asc", label: t("sortAlpha") },
    { value: "crew_desc", label: t("sortCrew") },
  ];
  const filtered = useMemo(() => {
    const needle = normalizedCatalogueSearch(query, locale);
    return sortProjects(categoryProjects.filter(project =>
      (!needle || [project.title, project.director ?? "", project.type ?? "", projectTypeLabel(project.type ?? "", ui)].some(value => normalizedCatalogueSearch(value, locale).includes(needle)))
      && (!typeFilter || project.type === typeFilter)
      && (!yearFilter || String(project.year) === yearFilter)
      && (!directorFilter || project.director === directorFilter)), sort, locale);
  }, [categoryProjects, query, typeFilter, yearFilter, directorFilter, sort, locale, ui]);

  const changeCategory = (value: string) => router.push(value ? `/projects/${value}` : "/projects", { scroll: false });
  const reset = () => { setQuery(""); setTypeFilter(""); setYearFilter(""); setDirectorFilter(""); };
  const chips: BrowseChip[] = [
    ...(typeFilter ? [{ id: "type", label: projectTypeLabel(typeFilter, ui), onRemove: () => setTypeFilter("") }] : []),
    ...(yearFilter ? [{ id: "year", label: yearFilter, onRemove: () => setYearFilter("") }] : []),
    ...(directorFilter ? [{ id: "director", label: directorFilter, onRemove: () => setDirectorFilter("") }] : []),
  ];
  const hasFilters = Boolean(query || chips.length);
  const views = <div className="flex shrink-0 rounded-xl border border-border bg-bg-elevated p-1" role="group" aria-label={ui("locations.viewLabel")}>
    {([{ value: "list", icon: LayoutList, label: ui("locations.viewList") }, { value: "grid", icon: LayoutGrid, label: ui("Ui.text_2cc48b15f4ffeb") }] as const).map(({ value, icon: Icon, label }) => <button type="button" key={value} aria-label={label} title={label} aria-pressed={view === value} onClick={() => setView(value)} className={`flex h-11 w-11 items-center justify-center rounded-lg transition-colors ${view === value ? "bg-gold/10 text-gold" : "text-text-muted hover:text-text-primary"}`}><Icon size={18} aria-hidden="true" /></button>)}
  </div>;
  const fields = [{ label: t("filterType"), value: typeFilter, options: types, onChange: setTypeFilter }, { label: t("filterYear"), value: yearFilter, options: years, onChange: setYearFilter }, { label: t("filterDirector"), value: directorFilter, options: directors, onChange: setDirectorFilter }];

  return <div className="mobile-bottom-nav-clear bg-bg-primary">
    <MobileBrowseControls query={query} onQueryChange={setQuery} searchPlaceholder={t("searchPlaceholder")}
      sortValue={sort} sortOptions={sortOptions} onSortChange={value => setSort(value as ProjectSort)}
      categoryLabel={ui("props.categoryBtn")} allCategoryLabel={ui("common.allProjects")} categories={categories} categoryValue={category ?? ""} onCategoryChange={changeCategory}
      resultSummary={t("resultsCount", { count: filtered.length })} viewControls={views} filterCount={chips.length} chips={chips} onReset={reset} resetLabel={t("resetFilters")} showResultsLabel={ui("Ui.text_52ca04e867ebdc", { value1: String(filtered.length) })}>
      {fields.map(field => <MobileFilterField key={field.label} label={field.label}><MobileFilterSelect value={field.value} onChange={field.onChange} options={field.options} placeholder={ui("common.all")} label={field.label} /></MobileFilterField>)}
    </MobileBrowseControls>

    <div className="site-container pb-8 pt-4 sm:pb-12">
      <div className="browse-toolbar mb-6 hidden space-y-4 p-4 xl:block">
        <div className="flex items-center gap-3">
          <label className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-xl border border-border bg-bg-elevated px-3">
            <Search size={18} className="shrink-0 text-text-muted" aria-hidden="true" />
            <span className="sr-only">{t("searchPlaceholder")}</span>
            <input className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-text-muted" placeholder={t("searchPlaceholder")} value={query} onChange={event => setQuery(event.target.value)} />
            {query && <button type="button" className="flex h-11 w-11 shrink-0 items-center justify-center text-text-muted" aria-label={ui("locations.landingClear")} onClick={() => setQuery("")}><X size={18} /></button>}
          </label>
          <label className="flex min-h-12 items-center gap-3 rounded-xl border border-border bg-bg-elevated px-3 text-sm">
            <span className="sr-only">{t("sortLabel")}</span><select className="min-h-11 bg-transparent outline-none" value={sort} onChange={event => setSort(event.target.value as ProjectSort)}>{sortOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
          </label>
          {views}
        </div>
        <div className="grid grid-cols-4 gap-3">
          <label className="min-w-0 text-xs text-text-muted">{ui("props.categoryBtn")}<select className="mt-1 block min-h-11 w-full rounded-xl border border-border bg-bg-elevated px-3 text-sm text-text-secondary" value={category ?? ""} onChange={event => changeCategory(event.target.value)}><option value="">{ui("common.allProjects")}</option>{categories.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          {fields.map(field => <label key={field.label} className="min-w-0 text-xs text-text-muted">{field.label}<select className="mt-1 block min-h-11 w-full rounded-xl border border-border bg-bg-elevated px-3 text-sm text-text-secondary" value={field.value} onChange={event => field.onChange(event.target.value)}><option value="">{ui("common.all")}</option>{field.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>)}
        </div>
        {hasFilters && <button type="button" className="min-h-11 text-sm text-gold hover:underline" onClick={reset}>{t("resetFilters")}</button>}
      </div>
      <div className="mb-4 hidden items-center justify-between gap-3 xl:flex"><p className="text-sm text-text-muted tabular-nums" role="status">{t("resultsCount", { count: filtered.length })}</p></div>
      {filtered.length === 0 ? <div className="browse-card px-5 py-10 text-center">
        <Clapperboard size={30} className="mx-auto mb-3 text-text-muted" aria-hidden="true" />
        <h2 className="text-lg font-semibold">{t("emptyTitle")}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-text-muted">{hasFilters ? t("emptyFiltered") : t("emptyCategory")}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          {hasFilters ? <button type="button" onClick={reset} className="min-h-11 rounded-xl border border-border px-4 text-sm text-gold">{t("resetFilters")}</button> : <Link className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm text-gold" href="/projects">{ui("common.allProjects")}</Link>}
          <Link className="inline-flex min-h-11 items-center rounded-xl bg-gold px-4 text-sm font-semibold text-bg-primary" href="/projects/neu">{t("addProject")}</Link>
        </div>
      </div> : <ProjectBrowseResults projects={filtered} view={view} />}
    </div>
  </div>;
}
