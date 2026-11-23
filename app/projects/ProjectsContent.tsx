"use client";
import BrowseGeography,{ CountrySelect } from "@/components/BrowseGeography";
import { prioritizeGeographically } from "@/lib/browse-geography";
import { useBrowseGeography } from "@/lib/use-browse-geography";


import MobileBrowseControls,{ MobileFilterField,MobileFilterSelect,type BrowseChip } from "@/components/MobileBrowseControls";
import ProjectBrowseResults from "@/components/ProjectBrowseResults";
import NativeProjectResults from "./NativeProjectResults";
import { useNativeAppAppearance } from "@/lib/use-native-app-appearance";
import DirectoryViewControls from "@/components/DirectoryViewControls";
import { UNASSIGNED_COUNTRY } from "@/lib/places/core";
import { PROJECT_CATEGORIES,projectCategoryForType,type ProjectCategoryId } from "@/lib/project-category-filter";
import { projectTypeLabel } from "@/lib/project-type-labels";
import { projectBrowseSelection,sortProjects,type BrowseProject,type ProjectSort } from "@/lib/projects-browse";
import { useViewState } from "@/lib/use-view-state";
import { Clapperboard,LayoutGrid,LayoutList } from "lucide-react";
import { useLocale,useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect,useMemo } from "react";

export default function ProjectsContent({ projects, category = null }: { projects: BrowseProject[]; category?: ProjectCategoryId | null }) {
  const nativeAppearance = useNativeAppAppearance();
  const t = useTranslations("projects");
  const ui = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [query, setQuery] = useViewState("projects.query", "");
  const [typeFilter, setTypeFilter] = useViewState("projects.typeFilter", "");
  const [yearFilter, setYearFilter] = useViewState("projects.yearFilter", "");
  const [directorFilter, setDirectorFilter] = useViewState("projects.directorFilter", "");
  const [sort, setSort] = useViewState<ProjectSort>("projects.sort", "year_desc");
  const [country, setCountry] = useViewState("projects.country", "");
  const geography = useBrowseGeography(sort === "year_desc" && !country);
  const [view, setView] = useViewState<"list" | "grid">("projects.view", "list");
  const categories = PROJECT_CATEGORIES.filter(item => projects.some(project => projectCategoryForType(project.type) === item.id)).map(item => ({ value: item.id, label: t(item.labelKey) }));
  const categoryProjects = useMemo(() => category ? projects.filter(project => projectCategoryForType(project.type) === category) : projects, [projects, category]);
  const selection = useMemo(() => projectBrowseSelection(categoryProjects, {
    query, country, type: typeFilter, year: yearFilter, director: directorFilter,
  }, locale, ui), [categoryProjects, query, country, typeFilter, yearFilter, directorFilter, locale, ui]);
  const { types, years, directors, countries, director: activeDirector } = selection;
  useEffect(() => {
    if (directorFilter !== activeDirector) setDirectorFilter(activeDirector);
  }, [directorFilter, activeDirector, setDirectorFilter]);
  const sortOptions = [
    { value: "recent", label: t("sortRecent") },
    { value: "year_desc", label: geography.preferred ? ui("BrowseGeography.recommended") : t("sortNewest") },
    { value: "year_asc", label: t("sortOldest") },
    { value: "title_asc", label: t("sortAlpha") },
    { value: "crew_desc", label: t("sortCrew") },
  ];
  const filtered = useMemo(() => prioritizeGeographically(sortProjects(selection.projects, sort, locale), geography.preferred), [selection.projects, sort, locale, geography.preferred]);

  const changeCategory = (value: string) => { setTypeFilter(""); setYearFilter(""); setDirectorFilter(""); router.push(value ? `/projects/${value}` : "/projects/alle", { scroll: false }); };
  const reset = () => { setQuery(""); setTypeFilter(""); setYearFilter(""); setDirectorFilter(""); setCountry(""); if (category) router.push("/projects/alle", { scroll: false }); };
  const chips: BrowseChip[] = [
    ...(category ? [{ id: "category", label: categories.find(item => item.value === category)?.label ?? category, onRemove: () => changeCategory("") }] : []),
    ...(country ? [{ id: "country", label: country === UNASSIGNED_COUNTRY ? ui("Places.countryUnassigned") : (ui.has(`CountryNames.${country}`) ? ui(`CountryNames.${country}`) : country), onRemove: () => setCountry("") }] : []),
    ...(typeFilter ? [{ id: "type", label: projectTypeLabel(typeFilter, ui), onRemove: () => setTypeFilter("") }] : []),
    ...(yearFilter ? [{ id: "year", label: yearFilter, onRemove: () => setYearFilter("") }] : []),
    ...(activeDirector ? [{ id: "director", label: activeDirector, onRemove: () => setDirectorFilter("") }] : []),
  ];
  const hasFilters = Boolean(query || chips.length);
  const views = <div className="flex shrink-0 rounded-xl border border-border bg-bg-elevated p-1" role="group" aria-label={ui("locations.viewLabel")}>
    {([{ value: "list", icon: LayoutList, label: ui("locations.viewList") }, { value: "grid", icon: LayoutGrid, label: ui("Ui.text_2cc48b15f4ffeb") }] as const).map(({ value, icon: Icon, label }) => <button type="button" key={value} aria-label={label} title={label} aria-pressed={view === value} onClick={() => setView(value)} className={`flex h-11 w-11 items-center justify-center rounded-lg transition-colors ${view === value ? "bg-gold/10 text-gold" : "text-text-muted hover:text-text-primary"}`}><Icon size={18} aria-hidden="true" /></button>)}
  </div>;
  const fields = [{ label: t("filterType"), value: typeFilter, options: types, onChange: setTypeFilter }, { label: t("filterYear"), value: yearFilter, options: years, onChange: setYearFilter }, { label: t("filterDirector"), value: activeDirector, options: directors, onChange: setDirectorFilter }];

  return <div className="mobile-bottom-nav-clear">
      <MobileBrowseControls nativeMoreCategory nativeFilterArea="projects" placeFilters={<CountrySelect popup value={country} onChange={value => { geography.setEnabled(false); setCountry(value); }} codes={countries.map(option => option.value)} />} nativePlaceFilters={<><p className="mb-3 text-sm text-text-muted">{ui("BrowseFilters.projectPlaceUnavailable")}</p><CountrySelect popup value={country} onChange={value => { geography.setEnabled(false); setCountry(value); }} codes={countries.map(option => option.value)} /></>} nativeCategory={{label:t("filterType"),value:typeFilter,options:types,onChange:setTypeFilter}} nativeCategoryKind="projectType" preference={<BrowseGeography geography={geography} />} query={query} onQueryChange={setQuery} searchPlaceholder={t("searchPlaceholder")}
      sortValue={sort} sortOptions={sortOptions} onSortChange={value => { geography.setEnabled(false); setSort(value as ProjectSort); }}
      categoryLabel={ui("props.categoryBtn")} allCategoryLabel={ui("common.allProjects")} categories={categories} categoryValue={category ?? ""} onCategoryChange={changeCategory}
      nativeViewControls={<DirectoryViewControls value={view} onChange={value => { if (value !== "map") setView(value); }} unavailable={{map:ui("NativeBrowse.projectMapUnavailable")}} />}
      resultCount={filtered.length} resultSummary={t("resultsCount", { count: filtered.length })} viewControls={views} filterCount={chips.length} chips={chips} onReset={reset} resetLabel={t("resetFilters")} showResultsLabel={ui("Ui.text_52ca04e867ebdc", { value1: String(filtered.length) })}>

      {fields.map(field => <MobileFilterField key={field.label} label={field.label}><MobileFilterSelect value={field.value} onChange={field.onChange} options={field.options} placeholder={ui("common.all")} label={field.label} /></MobileFilterField>)}
    </MobileBrowseControls>

    <div className="site-container pb-8 pt-4 sm:pb-12">


      {filtered.length === 0 ? <div className="browse-card px-5 py-10 text-center">
        <Clapperboard size={30} className="mx-auto mb-3 text-text-muted" aria-hidden="true" />
        <h2 className="text-lg font-semibold">{t("emptyTitle")}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-text-muted">{hasFilters ? t("emptyFiltered") : t("emptyCategory")}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          {hasFilters ? <button type="button" onClick={reset} className="min-h-11 rounded-xl border border-border px-4 text-sm text-gold">{t("resetFilters")}</button> : <Link className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm text-gold" href="/projects">{ui("common.allProjects")}</Link>}
          <Link className="inline-flex min-h-11 items-center rounded-xl bg-gold px-4 text-sm font-semibold text-bg-primary" href="/projects/neu">{t("addProject")}</Link>
        </div>
      </div> : nativeAppearance ? <NativeProjectResults projects={filtered} view={view} /> : <ProjectBrowseResults projects={filtered} view={view} />}
    </div>
  </div>;
}
