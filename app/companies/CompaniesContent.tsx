"use client";
import { useDiscoveryPlaceLabels } from "@/lib/use-discovery-place-labels";
import NativeBrowsePlaceFilters from "@/components/app/NativeBrowsePlaceFilters";
import { matchesBrowsePlace } from "@/lib/browse-radius";
import { useNativeBrowseRadius } from "@/lib/use-native-browse-radius";
import { companyMatchesService } from "@/lib/company-service-filter";
import BrowseGeography from "@/components/BrowseGeography";
import { prioritizeGeographically } from "@/lib/browse-geography";
import { useBrowseGeography } from "@/lib/use-browse-geography";


import DirectoryMap from "@/components/DirectoryMap";
import DirectoryResults from "@/components/DirectoryResults";
import DirectoryViewControls,{ type DirectoryView } from "@/components/DirectoryViewControls";
import FloatingMapToggle from "@/components/FloatingMapToggle";
import PlaceFilters from "@/components/PlaceFilters";
import type { DirectoryCompany as Company } from "@/lib/company-directory";
import { useDirectoryMap } from "@/lib/use-directory-map";

import { animalCategoryLabel,animalCompanySearchText,isAnimalCompany } from "@/lib/animal-taxonomy";
import { canonicalFilterValue,placeDisplay,browsePlaceOptions as placeOptions, UNASSIGNED_COUNTRY,placeSearchMatches } from "@/lib/places/core";

import { useViewState } from "@/lib/use-view-state";

import CompanyLogo from "@/components/CompanyLogo";
import MobileBrowseControls,{ type BrowseChip } from "@/components/MobileBrowseControls";
import { CATERING_COMPANY_CATEGORY,getCateringCompanySearchTerms,normalizeCateringCompanyDetails } from "@/lib/catering-taxonomy";
import { COMPANY_CATEGORIES,COMPANY_CATEGORY_BY_ID } from "@/lib/companyCategories";
import { taxonomyLabel } from "@/lib/departments";
import { safetyMedicalCompanyCategoryLabel } from "@/lib/safety-medical-taxonomy";
import {
Building2,
CheckCircle,
MapPin
} from "lucide-react";
import { useLocale,useTranslations } from "next-intl";
import Link from "next/link";
import { useCallback,useEffect,useMemo,useRef } from "react";


const PAGE_SIZE = 24;

// ── Category icons ────────────────────────────────────────────────


function cateringSearchText(company: Company): string {
  const details = normalizeCateringCompanyDetails(company.catering_details);
  return [
    ...details.serviceTypes, details.serviceAreas, String(details.capacity ?? ""),
    ...details.dietaryOptions, ...details.mobileEquipment,
    ...(company.categories.includes(CATERING_COMPANY_CATEGORY.id) ? getCateringCompanySearchTerms() : []),
  ].join(" ").toLocaleLowerCase("de");
}

// ─── FilterDropdown ───────────────────────────────────────────────


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
  const [radius, setRadius] = useNativeBrowseRadius("companies", cityFilter);
  const [verifiedOnly, setVerifiedOnly] = useViewState("companies.verifiedOnly", false);
  const [sortKey, setSortKey] = useViewState("companies.sortKey", "newest");
  const geography = useBrowseGeography(sortKey === "newest" && !countryFilter && !regionFilter && !cityFilter);
  const [viewMode, setViewMode] = useViewState<DirectoryView>("companies.viewMode", "grid");
  const [pageState, setPageState] = useViewState("companies.pageState", { filterKey: "", page: 1 });

  useEffect(() => {
    const country=canonicalFilterValue(countryFilter,initialCompanies,"country"),city=canonicalFilterValue(cityFilter,initialCompanies,"city");
    if(country!==countryFilter||city!==cityFilter)queueMicrotask(()=>{setCountryFilter(country);setCityFilter(city);});
  },[countryFilter,cityFilter,initialCompanies,setCountryFilter,setCityFilter]);
  const cityOptions = useMemo(() => placeOptions(initialCompanies, "city", locale, countryFilter), [initialCompanies,locale,countryFilter]);
  const countryOptions = useMemo(() => placeOptions(initialCompanies, "country", locale), [initialCompanies,locale]);
  const regionOptions = useMemo(() => placeOptions(initialCompanies, "region", locale), [initialCompanies,locale]);


  const placeLabels = useDiscoveryPlaceLabels(cityFilter);
  const cityLabel = (value: string) => placeLabels("city", value, cityOptions.find(o => o.value === value)?.label ?? value);
  const countryLabel = (value: string) => value === UNASSIGNED_COUNTRY ? uiText("Places.countryUnassigned") : placeLabels("country", value, countryOptions.find(o => o.value === value)?.label ?? value);
  const regionLabel = (value: string) => placeLabels("region", value, regionOptions.find(option => option.value === value)?.label ?? value);

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
    if (selectedCategory) result = result.filter((c) => companyMatchesService(c,selectedCategory));
    result = result.filter(c => matchesBrowsePlace(c,{country:countryFilter,region:regionFilter,city:cityFilter},radius));
    if (verifiedOnly) result = result.filter((c) => c.verified);
    if (sortKey === "newest") result = [...result].sort((a, b) => b.created_at.localeCompare(a.created_at));
    if (sortKey === "name") result = [...result].sort((a, b) => a.name.localeCompare(b.name, locale));
    return prioritizeGeographically(result, geography.preferred);
  }, [initialCompanies, search, selectedCategory, cityFilter, countryFilter, regionFilter, verifiedOnly, sortKey, locale, geography.preferred, radius]);

  const filterKey = JSON.stringify([search, selectedCategory, cityFilter, countryFilter, regionFilter, verifiedOnly, sortKey, geography.key, radius]);
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
    setRadius(null); setSearch(""); setSelectedCategory(null); setCityFilter("");
    setCountryFilter(""); setRegionFilter(""); setVerifiedOnly(false); setSortKey("newest"); map.setBounds(null); resetPage();
  };

  const selectedCat = selectedCategory ? COMPANY_CATEGORY_BY_ID[selectedCategory] : null;
  const hasAnyFilter = Boolean(regionFilter || search || selectedCategory || cityFilter || countryFilter || verifiedOnly || (viewMode === "map" && map.bounds));

  const mobileChips: BrowseChip[] = [
    ...(selectedCat ? [{ id: "category", label: taxonomyLabel(companyCategoryLabel(selectedCat.id, selectedCat.label), uiText), onRemove: () => setSelectedCategory(null) }] : []),
    ...(cityFilter ? [{ id: "city", label: cityLabel(cityFilter), onRemove: () => setCityFilter("") }] : []),
    ...(countryFilter ? [{ id: "country", label: countryLabel(countryFilter), onRemove: () => { setCountryFilter(""); setRegionFilter(""); setCityFilter(""); } }] : []),
    ...(regionFilter ? [{ id: "region", label: regionLabel(regionFilter), onRemove: () => { setRegionFilter(""); setCityFilter(""); } }] : []),
    ...(verifiedOnly ? [{ id: "verified", label: t("filterVerified"), onRemove: () => setVerifiedOnly(false) }] : []),
  ];

  return (
    <div className="min-h-screen mobile-bottom-nav-clear">

      <FloatingMapToggle mapActive={viewMode === "map"} onToggle={() => {
        setViewMode(viewMode === "map" ? "list" : "map");
        requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
      }} />
      <MobileBrowseControls nativePlaceFilters={<NativeBrowsePlaceFilters area="companies" rows={initialCompanies} value={{country:countryFilter,region:regionFilter,city:cityFilter}} onChange={value => {geography.setEnabled(false);setCountryFilter(value.country);setRegionFilter(value.region);setCityFilter(value.city);}} radius={radius} onRadiusChange={setRadius} />} nativeFilterArea="companies" placeFilters={<PlaceFilters rows={initialCompanies} value={{country:countryFilter,region:regionFilter,city:cityFilter}} onChange={value => {geography.setEnabled(false);setCountryFilter(value.country);setRegionFilter(value.region);setCityFilter(value.city);}} />} preference={<BrowseGeography geography={geography} />}
        query={search}
        onQueryChange={setSearch}
        searchPlaceholder={t("searchPlaceholder")}
        sortValue={sortKey}
        sortOptions={[{ value: "newest", label: geography.preferred ? uiText("BrowseGeography.recommended") : uiText("jobs.sortNewest") }, { value: "name", label: uiText("Ui.text_7ed96629073e83") }]}
        onSortChange={value => { geography.setEnabled(false); setSortKey(value); }}
        categoryLabel={t("filterCategory")}
        allCategoryLabel={uiText("Ui.text_aecf68fa0908cc")}
        categories={COMPANY_CATEGORIES.filter(category => initialCompanies.some(company => companyMatchesService(company,category.id))).map((category) => ({ value: category.id, label: taxonomyLabel(companyCategoryLabel(category.id, category.label), uiText) }))}
        categoryValue={selectedCategory ?? ""}
        onCategoryChange={(value) => setSelectedCategory(value || null)}
        resultCount={filtered.length} resultSummary={`${filtered.length} ${t("resultsCount")}`}
        viewControls={<DirectoryViewControls value={viewMode} onChange={setViewMode} />}
        filterCount={mobileChips.length}
        chips={mobileChips}
        onReset={clearAll}
        resetLabel={t("resetFilters")}
        showResultsLabel={uiText("Ui.text_4d89b095821660", { value1: String(filtered.length) })}
      >

        {(verifiedOnly || initialCompanies.some(company => company.verified)) && <label className="flex min-h-11 items-center gap-3 text-sm text-text-secondary"><input type="checkbox" className="size-4 accent-gold" checked={verifiedOnly} onChange={(event) => setVerifiedOnly(event.target.checked)} />{t("filterVerified")}</label>}
      </MobileBrowseControls>

      {/* ── Filter Bar ───────────────────────────────────── */}


      {/* ── Results ──────────────────────────────────────── */}
      <div className="site-container py-3 sm:py-6">
        <div className="flex gap-8 items-start">

          {/* Main content */}
          <div ref={resultsRef} className="flex-1 min-w-0 scroll-mt-24">

            <DirectoryResults view={viewMode} map={<DirectoryMap compact kind="companies" onShowAll={() => { map.setBounds(null); setViewMode("list"); }} items={mapItems} bounds={map.bounds} onBoundsChange={map.setBounds} />}>
            {paginated.length === 0 ? (
              <div className="py-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-bg-secondary border border-border flex items-center justify-center mx-auto mb-5">
                  <Building2 size={28} className="text-text-muted opacity-40" />
                </div>
                {hasAnyFilter ? (
                  <>
                    <p className="text-text-primary font-semibold mb-1">{t("emptyFilteredTitle")}</p>
                    <p className="text-text-muted text-sm mb-5">{t("emptyFilteredDesc")}</p>
                    <button onClick={clearAll} className="min-h-11 px-5 py-2.5 border border-border rounded-xl text-sm text-text-secondary hover:border-gold hover:text-gold transition-colors">
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
              <div className="directory-cards">
                {paginated.map((company) => <CompanyCard key={company.id} company={company} />)}
              </div>
            ) : (
              <div className="directory-list">
                  {paginated.map((company) => <CompanyListRow key={company.id} company={company} />)}
              </div>
            )}

            {hasMore && (
              <div className="mt-8 text-center">
                <button onClick={() => changePage((p) => p + 1)}
                  className="min-h-11 px-6 py-2.5 border border-border rounded-xl text-sm text-text-secondary hover:border-gold hover:text-gold transition-colors">
                  {t("loadMore", { count: map.rows.length - paginated.length })}
                </button>
              </div>
            )}
            </DirectoryResults>
          </div>
        </div>
      </div>
    </div>
  );
}

/** A logo stays whole; names and places share the same compact hierarchy in every view. */
function CompanyIdentity({ company }: { company: Company }) {
  const locale = useLocale();
  const t = useTranslations("common");
  return <div className="directory-entry-body">
    <div className="directory-company-title">
      <h3 className="directory-entry-title" title={company.name}>{company.name}</h3>
      {company.verified && <CheckCircle size={13} aria-label={t("verified")} />}
    </div>
    {company.city && <p className="directory-entry-place"><MapPin size={11} aria-hidden="true" /><span title={placeDisplay(company, company.city, locale)}>{placeDisplay(company, company.city, locale)}</span></p>}
  </div>;
}

function CompanyCard({ company }: { company: Company }) {
  return <article className="browse-card directory-entry directory-company">
    <Link href={`/companies/${company.slug}`} className="directory-entry-link">
      <CompanyLogo src={company.logo_url} name={company.name} className="directory-company-logo" />
      <CompanyIdentity company={company} />
    </Link>
  </article>;
}

function CompanyListRow({ company }: { company: Company }) {
  return <article className="directory-entry directory-company">
    <Link href={`/companies/${company.slug}`} className="directory-entry-link">
      <CompanyLogo src={company.logo_url} name={company.name} className="directory-company-logo" />
      <CompanyIdentity company={company} />
    </Link>
  </article>;
}
