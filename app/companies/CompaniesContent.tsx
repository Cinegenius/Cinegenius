"use client";

import DirectoryMap from "@/components/DirectoryMap";
import DirectoryViewControls, { type DirectoryView } from "@/components/DirectoryViewControls";
import FloatingMapToggle from "@/components/FloatingMapToggle";
import { useDirectoryMap } from "@/lib/use-directory-map";
import type { DirectoryCompany as Company } from "@/lib/company-directory";
import PlaceFilters from "@/components/PlaceFilters";

import { placeSearchMatches, placeOptions, matchesPlace, placeDisplay, canonicalFilterValue } from "@/lib/places/core";
import { animalCategoryLabel, animalCompanySearchText, isAnimalCompany } from "@/lib/animal-taxonomy";

import { useViewState } from "@/lib/use-view-state";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import CompanyLogo from "@/components/CompanyLogo";
import { useTranslations, useLocale } from "next-intl";
import type { LucideIcon } from "lucide-react";
import {
  Building2, MapPin, Search, CheckCircle,
  ChevronRight, X, Camera, Volume2, Wrench, Shirt,
  Package, Film, Monitor, Users, Sparkles, Megaphone, Car,
  Lightbulb, Globe, Zap, ChevronDown, Utensils,
} from "lucide-react";
import { COMPANY_CATEGORIES, COMPANY_CATEGORY_BY_ID } from "@/lib/companyCategories";
import { CATERING_COMPANY_CATEGORY, getCateringCompanySearchTerms, normalizeCateringCompanyDetails } from "@/lib/catering-taxonomy";
import { safetyMedicalCompanyCategoryLabel } from "@/lib/safety-medical-taxonomy";
import MobileBrowseControls, { MobileFilterField, MobileFilterSelect, type BrowseChip } from "@/components/MobileBrowseControls";
import { taxonomyLabel } from "@/lib/departments";


const PAGE_SIZE = 24;

// ── Category icons ────────────────────────────────────────────────
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  "lichtverleih":     Lightbulb,
  "kameraverleih":    Camera,
  "tonverleih":       Volume2,
  "grip-verleih":     Wrench,
  "tonstudio":        Volume2,
  "kostumfundus":     Shirt,
  "requisite":        Package,
  "filmproduktion":   Film,
  "postproduktion":   Monitor,
  "casting-agentur":  Users,
  "location-agentur": MapPin,
  "vfx-studio":       Sparkles,
  "fotostudio":       Camera,
  "werbeagentur":     Megaphone,
  "fahrzeugverleih":  Car,
  [CATERING_COMPANY_CATEGORY.id]: Utensils,
};

function cateringSearchText(company: Company): string {
  const details = normalizeCateringCompanyDetails(company.catering_details);
  return [
    ...details.serviceTypes, details.serviceAreas, String(details.capacity ?? ""),
    ...details.dietaryOptions, ...details.mobileEquipment,
    ...(company.categories.includes(CATERING_COMPANY_CATEGORY.id) ? getCateringCompanySearchTerms() : []),
  ].join(" ").toLocaleLowerCase("de");
}

// ─── FilterDropdown ───────────────────────────────────────────────
function FilterDropdown({
  icon: Icon, label, value, options, onChange, optionLabel = (value: string) => value,
}: {
  icon: React.ElementType; label: string; value: string;
  options: string[]; onChange: (v: string) => void; optionLabel?: (value: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  const active = !!value;
  return (
    <div ref={ref} className="relative shrink-0">
      <button onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 h-9 px-3 rounded-lg text-xs font-medium border transition-all ${
          active ? "bg-gold/10 border-gold/30 text-gold" : open ? "bg-bg-elevated border-border text-text-secondary" : "border-border text-text-muted hover:text-text-secondary"
        }`}>
        <Icon size={11} />
        {active ? optionLabel(value) : label}
        {active
          ? <span onClick={(e) => { e.stopPropagation(); onChange(""); setOpen(false); }} className="hover:text-red-400 transition-colors ml-0.5"><X size={10} /></span>
          : <ChevronDown size={11} className={`transition-transform ${open ? "rotate-180" : ""}`} />}
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-bg-elevated border border-border rounded-xl shadow-xl overflow-hidden min-w-[160px] max-h-64 overflow-y-auto">
          {options.map((opt) => (
            <button key={opt} onClick={() => { onChange(opt); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-white/[0.04] ${value === opt ? "text-gold font-medium" : "text-text-secondary"}`}>
              {optionLabel(opt)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────
export default function CompaniesContent({ initialCompanies }: { initialCompanies: Company[] }) {
  const uiText = useTranslations();

  const locale = useLocale();
  const t = useTranslations("companies");
  const animals = useTranslations("FilmAnimals");
  const safetyMedical = useTranslations("SafetyMedical");
  const companyCategoryLabel = useCallback((id: string, fallback: string) => safetyMedicalCompanyCategoryLabel(id, animalCategoryLabel(id, fallback, animals), safetyMedical), [animals, safetyMedical]);

  const [search, setSearch] = useViewState("companies.search", "");
  const [selectedCategory, setSelectedCategory] = useViewState<string | null>("companies.selectedCategory", null);
  const [cityFilter, setCityFilter] = useViewState("companies.cityFilter", "");
  const [countryFilter, setCountryFilter] = useViewState("companies.countryFilter", "");
  const [regionFilter, setRegionFilter] = useViewState("companies.regionFilter", "");
  const [verifiedOnly, setVerifiedOnly] = useViewState("companies.verifiedOnly", false);
  const [sortKey, setSortKey] = useViewState("companies.sortKey", "newest");
  const [viewMode, setViewMode] = useViewState<DirectoryView>("companies.viewMode", "grid");
  const [pageState, setPageState] = useViewState("companies.pageState", { filterKey: "", page: 1 });

  useEffect(() => {
    const country=canonicalFilterValue(countryFilter,initialCompanies,"country"),city=canonicalFilterValue(cityFilter,initialCompanies,"city");
    if(country!==countryFilter||city!==cityFilter)queueMicrotask(()=>{setCountryFilter(country);setCityFilter(city);});
  },[countryFilter,cityFilter,initialCompanies,setCountryFilter,setCityFilter]);
  const cityOptions = useMemo(() => placeOptions(initialCompanies, "city", locale, countryFilter), [initialCompanies,locale,countryFilter]);
  const countryOptions = useMemo(() => placeOptions(initialCompanies, "country", locale), [initialCompanies,locale]);
  const regionOptions = useMemo(() => placeOptions(initialCompanies, "region", locale), [initialCompanies,locale]);
  const availableCities = cityOptions.map(o => o.value);
  const availableCountries = countryOptions.map(o => o.value);
  const cityLabel = (value: string) => cityOptions.find(o => o.value === value)?.label ?? value;
  const countryLabel = (value: string) => countryOptions.find(o => o.value === value)?.label ?? value;
  const regionLabel = (value: string) => regionOptions.find(option => option.value === value)?.label ?? value;

  const filtered = useMemo(() => {
    let result = initialCompanies;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        (c.city.toLowerCase().includes(q) || placeSearchMatches(c,q)) ||
        c.services.some((s) => s.toLowerCase().includes(q)) ||
        c.categories.some((id) => (COMPANY_CATEGORY_BY_ID[id]?.label ?? id).toLowerCase().includes(q)) ||
        cateringSearchText(c).includes(q) || (isAnimalCompany(c.categories) && animalCompanySearchText(c.animal_details, c.categories).toLowerCase().includes(q))
      );
    }
    if (selectedCategory) result = result.filter((c) => c.categories.includes(selectedCategory));
    if (cityFilter) result = result.filter((c) => matchesPlace(c, "city", cityFilter));
    if (regionFilter) result = result.filter(row => matchesPlace(row, "region", regionFilter));
    if (countryFilter) result = result.filter(c => matchesPlace(c, "country", countryFilter));
    if (verifiedOnly) result = result.filter((c) => c.verified);
    if (sortKey === "newest") result = [...result].sort((a, b) => b.created_at.localeCompare(a.created_at));
    if (sortKey === "name") result = [...result].sort((a, b) => a.name.localeCompare(b.name, locale));
    return result;
  }, [initialCompanies, search, selectedCategory, cityFilter, countryFilter, regionFilter, verifiedOnly, sortKey, locale]);

  const filterKey = JSON.stringify([search, selectedCategory, cityFilter, countryFilter, regionFilter, verifiedOnly, sortKey]);
  const map = useDirectoryMap("companies", filterKey, filtered, viewMode === "map");
  const resultsRef = useRef<HTMLDivElement>(null);
  const mapItems = useMemo(() => filtered.map(company => ({
    id: company.id, title: company.name, city: placeDisplay(company, company.city, locale),
    subtitle: company.categories.map(id => taxonomyLabel(companyCategoryLabel(id, COMPANY_CATEGORY_BY_ID[id]?.label ?? id), uiText)).join(" · "),
    href: `/companies/${company.slug}`, image: company.logo_url ?? "", lat: company.lat, lng: company.lng,
  })), [filtered, locale, companyCategoryLabel, uiText]);
  const resultKey = JSON.stringify([filterKey, viewMode === "map" ? map.bounds : null]);
  const page = pageState.filterKey === resultKey ? pageState.page : 1;
  const resetPage = () => setPageState({ filterKey: resultKey, page: 1 });
  const changePage = (next: number | ((current: number) => number)) =>
    setPageState({ filterKey: resultKey, page: typeof next === "function" ? next(page) : next });

  const paginated = map.rows.slice(0, page * PAGE_SIZE);
  const hasMore = paginated.length < map.rows.length;

  const clearAll = () => {
    setSearch(""); setSelectedCategory(null); setCityFilter("");
    setCountryFilter(""); setRegionFilter(""); setVerifiedOnly(false); setSortKey("newest"); map.setBounds(null); resetPage();
  };

  const selectedCat = selectedCategory ? COMPANY_CATEGORY_BY_ID[selectedCategory] : null;
  const hasAnyFilter = Boolean(regionFilter || search || selectedCategory || cityFilter || countryFilter || verifiedOnly || (viewMode === "map" && map.bounds));
  const hasCatFilter = Boolean(selectedCategory);
  const mobileChips: BrowseChip[] = [
    ...(selectedCat ? [{ id: "category", label: taxonomyLabel(companyCategoryLabel(selectedCat.id, selectedCat.label), uiText), onRemove: () => setSelectedCategory(null) }] : []),
    ...(cityFilter ? [{ id: "city", label: cityLabel(cityFilter), onRemove: () => setCityFilter("") }] : []),
    ...(countryFilter ? [{ id: "country", label: countryLabel(countryFilter), onRemove: () => setCountryFilter("") }] : []),
    ...(regionFilter ? [{ id: "region", label: regionLabel(regionFilter), onRemove: () => setRegionFilter("") }] : []),
    ...(verifiedOnly ? [{ id: "verified", label: t("filterVerified"), onRemove: () => setVerifiedOnly(false) }] : []),
  ];

  return (
    <div className="min-h-screen bg-bg-primary mobile-bottom-nav-clear">

      <FloatingMapToggle mapActive={viewMode === "map"} onToggle={() => {
        setViewMode(viewMode === "map" ? "list" : "map");
        requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
      }} />
      <MobileBrowseControls
        query={search}
        onQueryChange={setSearch}
        searchPlaceholder={t("searchPlaceholder")}
        sortValue={sortKey}
        sortOptions={[{ value: "newest", label: uiText("jobs.sortNewest") }, { value: "name", label: uiText("Ui.text_7ed96629073e83") }]}
        onSortChange={setSortKey}
        categoryLabel={t("filterCategory")}
        allCategoryLabel={uiText("Ui.text_aecf68fa0908cc")}
        categories={COMPANY_CATEGORIES.map((category) => ({ value: category.id, label: taxonomyLabel(companyCategoryLabel(category.id, category.label), uiText) }))}
        categoryValue={selectedCategory ?? ""}
        onCategoryChange={(value) => setSelectedCategory(value || null)}
        resultSummary={`${map.rows.length} ${t("resultsCount")}`}
        viewControls={<DirectoryViewControls value={viewMode} onChange={setViewMode} />}
        filterCount={mobileChips.length}
        chips={mobileChips}
        onReset={clearAll}
        resetLabel={t("resetFilters")}
        showResultsLabel={uiText("Ui.text_4d89b095821660", { value1: String(map.rows.length) })}
      >
        <PlaceFilters rows={initialCompanies} value={{country:countryFilter,region:regionFilter,city:cityFilter}} onChange={value => {setCountryFilter(value.country);setRegionFilter(value.region);setCityFilter(value.city);}} />
        <label className="flex min-h-11 items-center gap-3 text-sm text-text-secondary"><input type="checkbox" className="size-4 accent-gold" checked={verifiedOnly} onChange={(event) => setVerifiedOnly(event.target.checked)} />{t("filterVerified")}</label>
      </MobileBrowseControls>

      {/* ── Filter Bar ───────────────────────────────────── */}
      <div className="hidden xl:block browse-toolbar">
        <div className="site-container py-2 space-y-2">

          {/* Row 1: Search + View toggle */}
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 bg-bg-elevated border border-border rounded-lg px-3 focus-within:border-gold/50 transition-colors">
              <Search size={14} className="text-text-muted shrink-0" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder={t("searchPlaceholder")}
                className="bg-transparent border-none py-2.5 text-sm w-full focus:outline-none" />
              {search && <button onClick={() => setSearch("")} className="text-text-muted hover:text-text-primary transition-colors"><X size={12} /></button>}
            </div>
            <DirectoryViewControls value={viewMode} onChange={setViewMode} />
          </div>

          {/* Row 2: Filters */}
          <div className="flex items-center gap-2 overflow-x-auto lg:overflow-visible pb-0.5" style={{ scrollbarWidth: "none" }}>

            {/* Verifiziert toggle */}
            <button
              onClick={() => setVerifiedOnly((v) => !v)}
              className={`flex items-center gap-2 h-9 px-3 rounded-lg text-xs font-medium border transition-all shrink-0 ${
                verifiedOnly ? "bg-gold/10 border-gold/30 text-gold" : "border-border text-text-muted hover:text-text-secondary"
              }`}
            >
              <div className={`w-7 h-4 rounded-full transition-colors relative shrink-0 ${verifiedOnly ? "bg-gold" : "bg-border"}`}>
                <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${verifiedOnly ? "left-3.5" : "left-0.5"}`} />
              </div>
              <Zap size={11} />
              {t("filterVerified")}
            </button>

            <div className="w-px h-6 bg-border shrink-0" />

            {/* Stadt */}
            {(availableCities.length > 0 || availableCountries.length > 0) && (
              <PlaceFilters rows={initialCompanies} value={{country:countryFilter,region:regionFilter,city:cityFilter}} onChange={value => {setCountryFilter(value.country);setRegionFilter(value.region);setCityFilter(value.city);}} />
            )}

            {/* Land */}


            {hasAnyFilter && (
              <>
                <div className="w-px h-6 bg-border shrink-0" />
                <button onClick={clearAll} className="h-9 px-3 text-xs text-text-muted hover:text-red-400 transition-colors whitespace-nowrap shrink-0 border border-border rounded-lg hover:border-red-400/40">
                  {t("clearFilter")}
                </button>
              </>
            )}

          </div>

          {/* Active chips */}
          {(hasCatFilter || cityFilter || countryFilter || regionFilter || verifiedOnly) && (
            <div className="flex flex-wrap gap-1.5 items-center">
              {selectedCat && (
                <span className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border font-medium ${selectedCat.bg} ${selectedCat.color}`}>
                  {taxonomyLabel(selectedCat.label, uiText)}
                  <button onClick={() => setSelectedCategory(null)} className="hover:opacity-70 ml-0.5"><X size={9} /></button>
                </span>
              )}
              {cityFilter && (
                <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border font-medium bg-bg-elevated border-border text-text-secondary">
                  <MapPin size={9} /> {cityLabel(cityFilter)}
                  <button onClick={() => setCityFilter("")} className="hover:opacity-70 ml-0.5"><X size={9} /></button>
                </span>
              )}
              {countryFilter && (
                <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border font-medium bg-bg-elevated border-border text-text-secondary">
                  <Globe size={9} /> {countryLabel(countryFilter)}
                  <button onClick={() => setCountryFilter("")} className="hover:opacity-70 ml-0.5"><X size={9} /></button>
                </span>
              )}
              {regionFilter && <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border font-medium bg-bg-elevated border-border text-text-secondary"><MapPin size={9} />{regionLabel(regionFilter)}<button type="button" aria-label={uiText("Ui.text_efae3eb968ceb3", { value1: String(t("clearFilter")), value2: String(regionLabel(regionFilter)) })} onClick={() => setRegionFilter("")} className="hover:opacity-70 ml-0.5"><X size={9} /></button></span>}
              {verifiedOnly && (
                <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border font-medium bg-gold/10 border-gold/30 text-gold">
                  <CheckCircle size={9} /> {t("filterVerified")}
                  <button onClick={() => setVerifiedOnly(false)} className="hover:opacity-70 ml-0.5"><X size={9} /></button>
                </span>
              )}
              <button onClick={clearAll} className="text-[11px] text-text-muted hover:text-red-400 transition-colors underline underline-offset-2 ml-1">
                {t("clearAllFilters")}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Results ──────────────────────────────────────── */}
      <div className="site-container py-3 sm:py-6">
        <div className="flex gap-8 items-start">

          {/* Sidebar */}
          <aside className="cat-sidebar w-44 shrink-0 sticky top-20">
            <p className="text-[11px] uppercase tracking-widest text-text-muted font-semibold mb-3 px-2">{uiText("props.categoryBtn")}</p>
            <nav className="space-y-0.5">
              <button
                onClick={() => { setSelectedCategory(null); resetPage(); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all text-left ${
                  !selectedCategory
                    ? "bg-gold/10 text-gold font-semibold border-l-2 border-gold pl-[10px]"
                    : "text-text-secondary hover:text-text-primary hover:bg-bg-secondary"
                }`}
              >{uiText.rich("Ui.text_532c17f15dfbaf", { part1: () => (<Building2 size={14} className={!selectedCategory ? "text-gold" : "text-text-muted"} />) })}</button>
              {[...COMPANY_CATEGORIES].sort((a, b) => a.label.localeCompare(b.label, locale)).map((cat) => {
                const Icon = CATEGORY_ICONS[cat.id] ?? Building2;
                const isActive = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => { setSelectedCategory(isActive ? null : cat.id); resetPage(); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all text-left ${
                      isActive
                        ? "bg-gold/10 text-gold font-semibold border-l-2 border-gold pl-[10px]"
                        : "text-text-secondary hover:text-text-primary hover:bg-bg-secondary"
                    }`}
                  >
                    <Icon size={14} className={isActive ? "text-gold" : "text-text-muted"} />
                    <span className="min-w-0 break-words leading-snug">{taxonomyLabel(companyCategoryLabel(cat.id, cat.label), uiText)}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Main content */}
          <div ref={resultsRef} className="flex-1 min-w-0 scroll-mt-24">

            {/* Mobile category pills */}
            <div className="cat-pills gap-2 overflow-x-auto pb-3 mb-4" style={{ scrollbarWidth: "none" }}>
              <button
                onClick={() => { setSelectedCategory(null); resetPage(); }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0 border transition-all ${
                  !selectedCategory ? "bg-gold/10 text-gold border-gold/40" : "border-border text-text-muted hover:border-gold/30 hover:text-text-primary"
                }`}
              >{uiText("common.all")}</button>
              {[...COMPANY_CATEGORIES].sort((a, b) => a.label.localeCompare(b.label, locale)).map((cat) => {
                const isActive = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => { setSelectedCategory(isActive ? null : cat.id); resetPage(); }}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0 border transition-all ${
                      isActive ? "bg-gold/10 text-gold border-gold/40" : "border-border text-text-muted hover:border-gold/30 hover:text-text-primary"
                    }`}
                  >
                    {taxonomyLabel(companyCategoryLabel(cat.id, cat.label), uiText)}
                  </button>
                );
              })}
            </div>

            <p className="hidden xl:block text-sm text-text-muted mb-5">
              <span className="font-semibold text-text-primary">{map.rows.length}</span> {t("resultsCount", { count: map.rows.length })}
              {selectedCat && <>{uiText.rich("Ui.text_3aa0bce7c8c5d4", { value2: () => (taxonomyLabel(companyCategoryLabel(selectedCat.id, selectedCat.label), uiText)), part1: chunks => (<span className={`font-semibold ${selectedCat.color}`}>{chunks}</span>) })}</>}
            </p>

            {viewMode === "map" && <DirectoryMap kind="companies" items={mapItems} bounds={map.bounds} onBoundsChange={map.setBounds} />}
            {paginated.length === 0 ? (
              <div className="py-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-bg-secondary border border-border flex items-center justify-center mx-auto mb-5">
                  <Building2 size={28} className="text-text-muted opacity-40" />
                </div>
                {hasAnyFilter ? (
                  <>
                    <p className="text-text-primary font-semibold mb-1">{t("emptyFilteredTitle")}</p>
                    <p className="text-text-muted text-sm mb-5">{t("emptyFilteredDesc")}</p>
                    <button onClick={clearAll} className="px-5 py-2.5 border border-border rounded-xl text-sm text-text-secondary hover:border-gold hover:text-gold transition-colors">
                      {t("resetFilters")}
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-text-primary font-semibold mb-1">{t("emptyTitle")}</p>
                    <p className="text-text-muted text-sm mb-5 max-w-xs mx-auto">{t("emptyDesc")}</p>
                  </>
                )}
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {paginated.map((company) => <CompanyCard key={company.id} company={company} />)}
              </div>
            ) : (
              <div className="browse-card overflow-hidden">
                <div className="divide-y divide-border">
                  {paginated.map((company) => <CompanyListRow key={company.id} company={company} />)}
                </div>
              </div>
            )}

            {hasMore && (
              <div className="mt-8 text-center">
                <button onClick={() => changePage((p) => p + 1)}
                  className="px-6 py-2.5 border border-border rounded-xl text-sm text-text-secondary hover:border-gold hover:text-gold transition-colors">
                  {t("loadMore", { count: map.rows.length - paginated.length })}
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Grid card ────────────────────────────────────────────────────
function CompanyCard({ company }: { company: Company }) {
  const locale = useLocale();
  const animals = useTranslations("FilmAnimals");
  const safetyMedical = useTranslations("SafetyMedical");
  const categoryLabel = (id: string, fallback: string) => safetyMedicalCompanyCategoryLabel(id, animalCategoryLabel(id, fallback, animals), safetyMedical);
  const cats = company.categories.slice(0, 2).map((id) => COMPANY_CATEGORY_BY_ID[id]).filter(Boolean);
  return (
    <Link href={`/companies/${company.slug}`}
      className="browse-card card-hover group flex min-w-0 flex-col p-3 sm:h-full">
      <div className="mb-2 flex min-w-0 items-start gap-3">
        <CompanyLogo src={company.logo_url} name={company.name} className="h-16 w-28 shrink-0 sm:h-14 sm:w-24" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <h3 className="line-clamp-2 font-semibold text-sm text-text-primary group-hover:text-gold transition-colors break-words leading-snug [overflow-wrap:anywhere]">{company.name}</h3>
            {company.verified && <CheckCircle size={13} className="text-gold shrink-0 mt-0.5" />}
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-text-muted">
            {company.city && <><MapPin size={9} className="shrink-0" /><span className="truncate">{placeDisplay(company, company.city, locale)}</span></>}
          </div>
        </div>
      </div>
      {/* Categories */}
      <div className="mb-2.5 flex flex-wrap content-start gap-1 overflow-hidden">
        {cats.map((cat) => (
          <span key={cat.id} title={categoryLabel(cat.id, cat.label)} className={`block max-w-full truncate whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cat.bg} ${cat.color}`}>{categoryLabel(cat.id, cat.label)}</span>
        ))}
        {company.categories.length > 2 && (
          <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-text-muted">+{company.categories.length - 2}</span>
        )}
      </div>
      {/* Description */}
      <p className="mt-2 empty:mt-0 text-[11px] text-text-muted line-clamp-2 leading-relaxed sm:mt-auto">{company.description || ""}</p>
    </Link>
  );
}

// ─── List row ─────────────────────────────────────────────────────
function CompanyListRow({ company }: { company: Company }) {
  const locale = useLocale();
  const animals = useTranslations("FilmAnimals");
  const safetyMedical = useTranslations("SafetyMedical");
  const categoryLabel = (id: string, fallback: string) => safetyMedicalCompanyCategoryLabel(id, animalCategoryLabel(id, fallback, animals), safetyMedical);
  const cats = company.categories.slice(0, 3).map((id) => COMPANY_CATEGORY_BY_ID[id]).filter(Boolean);
  return (
    <Link href={`/companies/${company.slug}`}
      className="flex items-center gap-4 px-5 py-4 hover:bg-bg-elevated transition-colors group">
      <CompanyLogo src={company.logo_url} name={company.name} className="h-10 w-10 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-semibold text-sm text-text-primary group-hover:text-gold transition-colors break-words [overflow-wrap:anywhere]">{company.name}</span>
          {company.verified && <CheckCircle size={12} className="text-gold shrink-0" />}
        </div>
        <div className="flex items-center gap-1 text-xs text-text-muted"><MapPin size={10} /><span>{placeDisplay(company, company.city, locale)}</span></div>
      </div>
      <div className="hidden sm:flex items-center gap-1.5 flex-wrap justify-end">
        {cats.map((cat) => (
          <span key={cat.id} className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${cat.bg} ${cat.color}`}>{categoryLabel(cat.id, cat.label)}</span>
        ))}
      </div>
      <ChevronRight size={14} className="text-text-muted shrink-0 group-hover:text-gold transition-colors" />
    </Link>
  );
}
