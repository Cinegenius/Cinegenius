"use client";

import BrowseGeography from "@/components/BrowseGeography";
import MobileBrowseControls,{ MobileFilterField,MobileFilterSelect,type BrowseChip } from "@/components/MobileBrowseControls";
import PageHeader from "@/components/PageHeader";
import PlaceFilters from "@/components/PlaceFilters";
import { prioritizeGeographically } from "@/lib/browse-geography";
import { taxonomyLabel } from "@/lib/departments";
import { FILM_DEPARTMENTS } from "@/lib/filmRoles";
import { normalizeGripDepartmentId,normalizeGripRoleId } from "@/lib/gripTaxonomy";
import { canonicalJobPayType,jobDateLabel,jobFacts,jobPayLabel,jobRateLabel,type BrowseJob as Job } from "@/lib/job-metadata";
import { jobOccupation } from "@/lib/job-occupation";
import { matchesPlace,placeDisplay,placeOptions,placeSearchMatches } from "@/lib/places/core";
import { normalizedCatalogueSearch,projectTypeLabel } from "@/lib/project-type-labels";
import { useBrowseGeography } from "@/lib/use-browse-geography";
import { useViewState } from "@/lib/use-view-state";
import { useViewUrl } from "@/lib/use-view-url";
import { ArrowUpRight,Briefcase,Calendar,MapPin } from "lucide-react";
import { useLocale,useTranslations } from "next-intl";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense,useMemo } from "react";

const PAGE_SIZE = 24;


function JobsInner({ serverJobs }: { serverJobs: Job[] }) {
  const ui = useTranslations(), t = useTranslations("jobs"), copy = useTranslations("JobsRefresh"), locale = useLocale();
  const params = useSearchParams();
  const [query, setQuery] = useViewState("jobs.query", () => params.get("q") ?? "");
  const [selectedDeptId, setSelectedDeptId] = useViewState<string | null>("jobs.selectedDeptId", () => normalizeGripDepartmentId(params.get("dept")));
  const [selectedRoleId, setSelectedRoleId] = useViewState<string | null>("jobs.selectedRoleId", () => normalizeGripRoleId(params.get("role")));
  const [activeType, setActiveType] = useViewState("jobs.activeType", () => params.get("type") ?? "");
  const [urgentOnly, setUrgentOnly] = useViewState("jobs.urgentOnly", () => params.get("urgent") === "1");
  const [storedPay, setPayTypeFilter] = useViewState("jobs.payTypeFilter", () => params.get("pay") ?? "");
  const payTypeFilter = String(canonicalJobPayType(storedPay));
  const [jobTypeFilter, setJobTypeFilter] = useViewState("jobs.jobTypeFilter", () => params.get("employment") ?? "alle");
  const [cityFilter, setCityFilter] = useViewState("jobs.cityFilter", () => params.get("city") ?? "");
  const [cityText, setCityText] = useViewState("jobs.cityText", () => params.get("cityText") ?? "");
  const [countryFilter, setCountryFilter] = useViewState("jobs.countryFilter", () => params.get("country") ?? "");
  const [regionFilter, setRegionFilter] = useViewState("jobs.regionFilter", () => params.get("region") ?? "");
  const [sortKey, setSortKey] = useViewState("jobs.sortKey", () => params.get("sort") ?? "newest");
  const [pagination, setPagination] = useViewState("jobs.pagination", { filterKey: "", visibleCount: PAGE_SIZE });
  const geography = useBrowseGeography(sortKey === "newest" && !countryFilter && !regionFilter && !cityFilter && !cityText);
  const allJobs = useMemo(() => serverJobs.map(job => ({ ...job, facts: jobFacts(job), occupation: jobOccupation(job) })), [serverJobs]);
  const selectedDepartment = FILM_DEPARTMENTS.find(row => row.id === selectedDeptId);
  const departments = FILM_DEPARTMENTS.filter(row => allJobs.some(job => job.occupation?.department === row.id || job.category === row.label)).map(row => ({ value: row.id, label: taxonomyLabel(row.label, ui) })).sort((a, b) => a.label.localeCompare(b.label, locale));
  const roles = [...new Map((selectedDepartment ? selectedDepartment.roles : FILM_DEPARTMENTS.flatMap(row => row.roles)).map(role => [role.id, { value: role.id, label: taxonomyLabel(role.label, ui) }])).values()].filter(role => allJobs.some(job => job.occupation?.role === role.value));
  const types = [...new Set(allJobs.map(job => job.facts.projectType).filter(Boolean))].map(value => ({ value, label: projectTypeLabel(value, ui) }));
  const payTypes = [...new Set<string>(allJobs.map(job => canonicalJobPayType(job.facts.payType)).filter(Boolean))].map(value => ({ value, label: jobPayLabel(value, ui) }));
  const employments = [{ value: "freelance", label: t("filterFreelance") }, { value: "festanstellung", label: t("filterFulltime") }, { value: "praktikum", label: t("filterInternship") }];
  const sorts = [{ value: "newest", label: geography.preferred ? ui("BrowseGeography.recommended") : t("sortNewest") }, { value: "rate", label: t("sortRateDesc") }, { value: "urgent", label: t("sortUrgent") }];
  const updatePlaceFilters = (value: { country: string; region: string; city: string }) => { setCountryFilter(value.country); setRegionFilter(value.region); setCityFilter(value.city); if (value.city) setCityText(""); };
  const changeDepartment = (value: string) => { setSelectedDeptId(value || null); setSelectedRoleId(null); };
  const url = new URLSearchParams();
  for (const [key, value] of Object.entries({ q: query, dept: selectedDeptId, role: selectedRoleId, type: activeType, pay: payTypeFilter, employment: jobTypeFilter === "alle" ? "" : jobTypeFilter, city: cityFilter, cityText, country: countryFilter, region: regionFilter, sort: sortKey === "newest" ? "" : sortKey, urgent: urgentOnly ? "1" : "" })) if (value) url.set(key, value);
  useViewUrl(url.size ? `/jobs?${url}` : "/jobs");
  const preferred = geography.preferred, selectedDepartmentLabel = selectedDepartment?.label;
  const filtered = useMemo(() => {
    const needle = normalizedCatalogueSearch(query, locale);
    const rows = allJobs.filter(job => {
      const facts = job.facts;
      if (selectedDeptId && job.occupation?.department !== selectedDeptId && job.category !== selectedDepartmentLabel) return false;
      if (selectedRoleId && job.occupation?.role !== selectedRoleId) return false;
      if (activeType && facts.projectType !== activeType) return false;
      if (urgentOnly && !facts.urgent) return false;
      if (payTypeFilter && canonicalJobPayType(facts.payType) !== payTypeFilter) return false;
      if (jobTypeFilter !== "alle" && facts.jobType !== jobTypeFilter) return false;
      if (!matchesPlace(job, "country", countryFilter) || !matchesPlace(job, "region", regionFilter) || !matchesPlace(job, "city", cityFilter)) return false;
      if (cityText && !placeSearchMatches(job, cityText) && !normalizedCatalogueSearch(job.location, locale).includes(normalizedCatalogueSearch(cityText, locale))) return false;
      return !needle || [job.title, facts.company, facts.roleLabel, taxonomyLabel(facts.roleLabel, ui), facts.projectType, projectTypeLabel(facts.projectType, ui), facts.description, job.location].some(value => normalizedCatalogueSearch(value, locale).includes(needle)) || placeSearchMatches(job, query);
    });
    rows.sort((a, b) => {
      const time = (Date.parse(b.createdAt ?? "") || 0) - (Date.parse(a.createdAt ?? "") || 0);
      if (sortKey === "urgent") return Number(b.facts.urgent) - Number(a.facts.urgent) || time;
      if (sortKey === "rate" || sortKey === "rate-desc") {
        const amount = (job: typeof a) => (!job.facts.payType || canonicalJobPayType(job.facts.payType) === "Paid") && job.price ? job.price : -1;
        return amount(b) - amount(a) || time;
      }
      return time;
    });
    return prioritizeGeographically(rows, preferred);
  }, [allJobs, query, locale, selectedDeptId, selectedDepartmentLabel, selectedRoleId, activeType, urgentOnly, payTypeFilter, jobTypeFilter, countryFilter, regionFilter, cityFilter, cityText, sortKey, ui, preferred]);
  const clearAll = () => { setQuery(""); setSelectedDeptId(null); setSelectedRoleId(null); setActiveType(""); setUrgentOnly(false); setPayTypeFilter(""); setJobTypeFilter("alle"); setCityText(""); updatePlaceFilters({ country: "", region: "", city: "" }); };
  const chips: BrowseChip[] = [
    ...(selectedDeptId ? [{ id: "department", label: departments.find(row => row.value === selectedDeptId)?.label ?? selectedDeptId, onRemove: () => changeDepartment("") }] : []),
    ...(selectedRoleId ? [{ id: "role", label: roles.find(row => row.value === selectedRoleId)?.label ?? selectedRoleId, onRemove: () => setSelectedRoleId(null) }] : []),
    ...(activeType ? [{ id: "type", label: projectTypeLabel(activeType, ui), onRemove: () => setActiveType("") }] : []),
    ...(payTypeFilter ? [{ id: "pay", label: jobPayLabel(payTypeFilter, ui), onRemove: () => setPayTypeFilter("") }] : []),
    ...(jobTypeFilter !== "alle" ? [{ id: "employment", label: employments.find(row => row.value === jobTypeFilter)?.label ?? jobTypeFilter, onRemove: () => setJobTypeFilter("alle") }] : []),
    ...(urgentOnly ? [{ id: "urgent", label: t("filterUrgentLabel"), onRemove: () => setUrgentOnly(false) }] : []),
    ...(cityText ? [{ id: "cityText", label: cityText, onRemove: () => setCityText("") }] : []),
    ...(["country", "region", "city"] as const).flatMap(kind => { const value = { country: countryFilter, region: regionFilter, city: cityFilter }[kind]; return value ? [{ id: kind, label: kind === "country" ? (ui.has(`CountryNames.${value}`) ? ui(`CountryNames.${value}`) : value) : placeOptions(allJobs, kind, locale).find(row => row.value === value)?.label ?? value, onRemove: () => kind === "country" ? updatePlaceFilters({ country: "", region: "", city: "" }) : kind === "region" ? updatePlaceFilters({ country: countryFilter, region: "", city: "" }) : setCityFilter("") }] : []; }),
  ];
  const fields = [{ label: copy("role"), value: selectedRoleId ?? "", onChange: (value: string) => setSelectedRoleId(value || null), options: roles },
    { label: t("filterProjectType"), value: activeType, onChange: setActiveType, options: types },
    { label: t("filterPay"), value: payTypeFilter, onChange: setPayTypeFilter, options: payTypes },
    { label: copy("employment"), value: jobTypeFilter === "alle" ? "" : jobTypeFilter, onChange: (value: string) => setJobTypeFilter(value || "alle"), options: employments.filter(option => allJobs.some(job => job.facts.jobType === option.value)) }];
  const placeFields = <PlaceFilters rows={allJobs} value={{ country: countryFilter, region: regionFilter, city: cityFilter }} onChange={updatePlaceFilters} />;
  const urgentField = (urgentOnly || allJobs.some(job => job.facts.urgent)) && <label className="flex min-h-11 items-center gap-3 text-sm text-text-secondary"><input type="checkbox" className="size-4 accent-gold" checked={urgentOnly} onChange={event => setUrgentOnly(event.target.checked)} />{t("filterUrgentLabel")}</label>;
  const filterKey = `${url}:${geography.key}`, visibleCount = pagination.filterKey === filterKey ? pagination.visibleCount : PAGE_SIZE;

  return <main className="min-h-screen bg-bg-primary mobile-bottom-nav-clear">
    <PageHeader badge={t("heroBadge")} title={t("heroTitle")} titleHighlight={t("heroTitleHighlight")} description={copy("intro")} cta={{ label: t("postJobBtn"), href: "/inserat?group=jobs" }} />
    <MobileBrowseControls preference={<BrowseGeography geography={geography} />} query={query} onQueryChange={setQuery} searchPlaceholder={t("searchPlaceholder")} sortValue={sortKey} sortOptions={sorts} onSortChange={value => { geography.setEnabled(false); setSortKey(value); }}
      categoryLabel={t("filterDeptRole")} allCategoryLabel={ui("Ui.text_bc0b501bb3186b")} categories={departments} categoryValue={selectedDeptId ?? ""} onCategoryChange={changeDepartment}
      resultSummary={t("results", { count: filtered.length })} filterCount={chips.length} chips={chips} onReset={clearAll} resetLabel={t("emptyReset")} showResultsLabel={t("results", { count: filtered.length })}>
      {placeFields}
      {fields.map(field => <MobileFilterField key={field.label} label={field.label}><MobileFilterSelect {...field} placeholder={ui("common.all")} /></MobileFilterField>)}
      {urgentField}
    </MobileBrowseControls>
    <section className="site-container py-4 sm:py-6">


      {filtered.length === 0 ? <div className="browse-card p-6 text-center sm:p-10"><Briefcase size={28} className="mx-auto mb-3 text-text-muted" aria-hidden="true" /><h2 className="text-lg font-semibold">{allJobs.length ? t("emptyTitleFiltered") : t("emptyTitle")}</h2><p className="mt-2 text-sm text-text-secondary">{allJobs.length ? t("emptyDescFiltered") : t("emptyDesc")}</p><div className="mt-5 flex flex-wrap justify-center gap-3">{(chips.length > 0 || query) && <button className="min-h-11 rounded-xl border border-border px-4 text-sm" onClick={clearAll}>{t("emptyReset")}</button>}<Link className="inline-flex min-h-11 items-center rounded-xl bg-gold px-4 text-sm font-semibold text-bg-primary" href="/inserat?group=jobs">{t("postJobBtn")}</Link></div></div> : <div className="space-y-3">
        {filtered.slice(0, visibleCount).map(job => {
          const facts = job.facts, dates = jobDateLabel(job, locale);
          return <article key={job.id} className="browse-card group"><Link href={`/jobs/${job.id}`} className="block p-4 sm:p-5">
            <div className="flex items-start gap-3"><div className="hidden size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-bg-elevated sm:flex"><Briefcase size={18} className="text-text-muted" aria-hidden="true" /></div><div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3"><h2 className="break-words text-base font-semibold leading-snug text-text-primary group-hover:text-gold sm:text-lg">{job.title}</h2><ArrowUpRight size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-text-muted" /></div>
              <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-text-secondary sm:text-sm">{[facts.company, facts.roleLabel && facts.roleLabel !== job.title && taxonomyLabel(facts.roleLabel, ui), facts.projectType && projectTypeLabel(facts.projectType, ui), facts.jobType && employments.find(row => row.value === facts.jobType)?.label].filter(Boolean).join(" · ")}</p>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-text-secondary sm:text-sm">{job.location && <span className="inline-flex min-w-0 items-center gap-1.5"><MapPin size={14} aria-hidden="true" className="shrink-0 text-text-muted" />{placeDisplay(job, job.location, locale)}</span>}{dates && <span className="inline-flex min-w-0 items-center gap-1.5"><Calendar size={14} aria-hidden="true" className="shrink-0 text-text-muted" />{dates}</span>}</div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3 text-xs sm:text-sm"><span className="font-medium text-gold">{jobRateLabel(job, ui, locale)}</span><div className="flex flex-wrap items-center gap-3">{facts.urgent && <span className="text-text-secondary">{t("urgentBadge")}</span>}{job.createdAt && Number.isFinite(Date.parse(job.createdAt)) && <time dateTime={job.createdAt} className="text-xs text-text-muted">{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(job.createdAt))}</time>}</div></div>
            </div></div>
          </Link></article>;
        })}
      </div>}
      {visibleCount < filtered.length && <div className="mt-6 text-center"><button type="button" className="min-h-11 rounded-xl border border-border px-5 text-sm text-text-secondary" onClick={() => setPagination({ filterKey, visibleCount: visibleCount + PAGE_SIZE })}>{t("loadMore", { count: filtered.length - visibleCount })}</button></div>}
    </section>
  </main>;
}

export default function JobsContent({ serverJobs }: { serverJobs: Job[] }) {
  return <Suspense><JobsInner serverJobs={serverJobs} /></Suspense>;
}
