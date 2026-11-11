"use client";
import { useRef, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import Image from "@/components/MediaImage";
import Link from "next/link";
import { Search, MapPin, Star, ArrowRight, Plus, ChevronDown, X } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import PlaceFilters, { EMPTY_PLACE_FILTERS, type PlaceFilterValue } from "@/components/PlaceFilters";
import MobileBrowseControls, { MobileFilterField, type BrowseChip } from "@/components/MobileBrowseControls";
import { locationCategoryLabel } from "@/lib/location-category-labels";
import { placeOptions } from "@/lib/places/core";
import { useViewState } from "@/lib/use-view-state";
import { useViewUrl } from "@/lib/use-view-url";
import {
  DEFAULT_LOCATION_LANDING_FILTERS, filterLandingLocations, locationLandingCategoryOptions,
  locationLandingParams, type LocationLandingFilters,
} from "@/lib/locations-landing-filters";

export type LocationCard = {
  id: string; title: string; type: string; city: string; price: number;
  priceOnRequest: boolean; priceLabel: string;
  image: string; rating: number; reviews: number;
  focalPoint?: { x: number; y: number } | null;
  place_country_code?: string | null; place_region_id?: string | null; place_city_id?: string | null;
  place_city_name?: string | null; place_region_name?: string | null; place_status?: string | null;
};

export default function LocationsLanding({ allLocations, totalCount, initialFilters = DEFAULT_LOCATION_LANDING_FILTERS }: { allLocations: LocationCard[]; totalCount: number; initialFilters?: LocationLandingFilters }) {
  const uiText = useTranslations();

  const locale = useLocale();
  const t = useTranslations("locations");
  const categoryText = useTranslations("menu");
  const [filters, setFilters] = useViewState("locations.landing.filters", () => ({ ...initialFilters }));
  const [pagination, setPagination] = useViewState("locations.landing.pagination", { filterKey: "", visibleCount: 24 });
  const resultsRef = useRef<HTMLDivElement>(null);
  const updateFilters = (patch: Partial<LocationLandingFilters>) => setFilters(current => ({ ...current, ...patch }));
  const resetFilters = () => setFilters({ ...DEFAULT_LOCATION_LANDING_FILTERS });
  const changePlaces = (next: PlaceFilterValue) => updateFilters({ ...next, ...(next.city ? { cityText: "" } : {}) });
  const categoryLabel = (value: string) => locationCategoryLabel(value, categoryText);
  const categories = locationLandingCategoryOptions(allLocations, categoryLabel, locale, filters.type);
  const filtered = filterLandingLocations(allLocations, filters, categoryLabel);
  const params = locationLandingParams(filters);
  const filterKey = params.toString();
  const visibleCount = pagination.filterKey === filterKey ? pagination.visibleCount : 24;
  const locations = filtered.slice(0, visibleCount);
  useViewUrl(filterKey ? `/locations?${filterKey}` : "/locations");
  const sortOptions = [
    { value: "featured", label: t("sortFeatured") }, { value: "price-asc", label: t("sortPriceAsc") },
    { value: "price-desc", label: t("sortPriceDesc") }, { value: "rating", label: t("sortRating") },
  ];
  const chips: BrowseChip[] = [
    ...(filters.type ? [{ id: "type", label: categoryLabel(filters.type), onRemove: () => updateFilters({ type: "" }) }] : []),
    ...(["country", "region", "city"] as const).flatMap(kind => filters[kind] ? [{
      id: kind, label: placeOptions(allLocations, kind, locale).find(option => option.value === filters[kind])?.label ?? filters[kind],
      onRemove: () => updateFilters(kind === "country" ? EMPTY_PLACE_FILTERS : kind === "region" ? { region: "", city: "" } : { city: "" }),
    }] : []),
    ...(filters.cityText ? [{ id: "city-text", label: `${uiText("Places.city")}: ${filters.cityText}`, onRemove: () => updateFilters({ cityText: "" }) }] : []),
    ...(filters.min ? [{ id: "min", label: uiText("Ui.text_c6e3466f40cb9d", { value1: filters.min }), onRemove: () => updateFilters({ min: "" }) }] : []),
    ...(filters.max ? [{ id: "max", label: uiText("Ui.text_f47e415aff7a38", { value1: filters.max }), onRemove: () => updateFilters({ max: "" }) }] : []),
  ];
  const hasFilters = chips.length > 0 || !!filters.q;
  const selectClass = "min-h-11 w-full min-w-0 appearance-none rounded-lg border border-border bg-bg-primary pl-3 pr-9 text-sm text-text-primary focus:border-gold focus:outline-none";
  const priceClass = "min-h-11 w-full min-w-0 rounded-lg border border-border bg-bg-primary px-3 text-sm text-text-primary focus:border-gold focus:outline-none";

  function handleSearch(event: FormEvent) {
    event.preventDefault();
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      <PageHeader
        optimizeImage
        badge={t("landingBadge")}
        title={t("heroTitle")}
        titleHighlight={t("heroTitleHighlight")}
        description={totalCount > 0 ? uiText("Ui.text_7c639bc99b8569", { value1: String(t("results", { count: totalCount })), value2: String(t("heroDesc")) }) : t("heroDesc")}
        ctaSecondary={{ label: t("landingAll"), href: "#locations-discover" }}
        cta={{ label: t("heroCta"), href: "/inserat?group=drehorte" }}
      >
        <form action="/locations" method="get" onSubmit={handleSearch} className="hidden max-w-2xl xl:block">
          {[...params].filter(([key]) => key !== "q").map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />)}
          <div className="flex items-center gap-2 rounded-xl border border-border bg-bg-elevated p-1.5 transition-colors focus-within:border-gold/50">
            <div className="flex min-w-0 flex-1 items-center gap-2 px-3">
              <Search size={15} aria-hidden="true" className="shrink-0 text-text-muted" />
              <input
                type="search"
                name="q"
                aria-label={t("searchPlaceholder")}
                placeholder={t("searchPlaceholder")}
                value={filters.q}
                onChange={event => updateFilters({ q: event.target.value })}
                className="min-h-11 min-w-0 flex-1 bg-transparent py-2 text-sm text-text-primary outline-none placeholder:text-text-muted"
                autoComplete="off"
              />
              {filters.q && (
                <button type="button" onClick={() => updateFilters({ q: "" })} aria-label={t("landingClear")} className="min-h-11 min-w-11 text-text-muted transition-colors hover:text-text-primary">×</button>
              )}
            </div>
            <button type="submit" className="min-h-11 shrink-0 rounded-lg bg-gold px-4 py-2.5 text-sm font-bold text-bg-primary transition-colors hover:bg-gold-light">
              {t("landingSearch")} <ArrowRight size={14} aria-hidden="true" className="ml-1 inline" />
            </button>
          </div>
        </form>
      </PageHeader>

      <MobileBrowseControls
        query={filters.q} onQueryChange={value => updateFilters({ q: value })} searchPlaceholder={t("searchPlaceholder")}
        sortValue={filters.sort} sortOptions={sortOptions} onSortChange={value => updateFilters({ sort: value })}
        categoryLabel={t("categoryLabel")} allCategoryLabel={t("allLocations")} categories={categories}
        categoryValue={filters.type} onCategoryChange={value => updateFilters({ type: value })}
        resultSummary={t("results", { count: filtered.length })} filterCount={chips.length + (filters.q ? 1 : 0)} chips={chips}
        onReset={resetFilters} resetLabel={t("resetFilters")} showResultsLabel={t("showResults", { count: filtered.length })}
      >
        <PlaceFilters rows={allLocations} value={filters} onChange={changePlaces} scope="locations" />
        <div className="grid grid-cols-2 gap-3">
          <MobileFilterField label={uiText("Ui.text_84381d6fa4d29d")}><input aria-label={uiText("Ui.text_84381d6fa4d29d")} type="number" inputMode="decimal" min="0" step="0.01" value={filters.min} onChange={event => updateFilters({ min: event.target.value })} placeholder={uiText("Ui.text_d0c50fd56cbce3")} /></MobileFilterField>
          <MobileFilterField label={uiText("Ui.text_f7abc502297a74")}><input aria-label={uiText("Ui.text_f7abc502297a74")} type="number" inputMode="decimal" min="0" step="0.01" value={filters.max} onChange={event => updateFilters({ max: event.target.value })} placeholder={uiText("Ui.text_d0c50fd56cbce3")} /></MobileFilterField>
        </div>
      </MobileBrowseControls>

      <div className="hidden xl:block browse-toolbar">
        <div className="site-container space-y-3 py-4">
          <div className="grid min-w-0 grid-cols-5 items-end gap-3">
            <label className="relative flex min-w-0 flex-col gap-1 text-xs text-text-muted"><span>{t("categoryLabel")}</span><select className={selectClass} value={filters.type} onChange={event => updateFilters({ type: event.target.value })}><option value="">{t("allLocations")}</option>{categories.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select><ChevronDown size={16} aria-hidden="true" className="pointer-events-none absolute bottom-3.5 right-3" /></label>
            <div className="col-span-3 min-w-0"><PlaceFilters rows={allLocations} value={filters} onChange={changePlaces} scope="locations" /></div>
            <label className="relative flex min-w-0 flex-col gap-1 text-xs text-text-muted"><span>{uiText("creators.sort")}</span><select className={selectClass} value={filters.sort} onChange={event => updateFilters({ sort: event.target.value })}>{sortOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select><ChevronDown size={16} aria-hidden="true" className="pointer-events-none absolute bottom-3.5 right-3" /></label>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex w-40 min-w-0 flex-col gap-1 text-xs text-text-muted"><span>{uiText("Ui.text_84381d6fa4d29d")}</span><input className={priceClass} type="number" inputMode="decimal" min="0" step="0.01" value={filters.min} onChange={event => updateFilters({ min: event.target.value })} placeholder={uiText("Ui.text_d0c50fd56cbce3")} /></label>
            <label className="flex w-40 min-w-0 flex-col gap-1 text-xs text-text-muted"><span>{uiText("Ui.text_f7abc502297a74")}</span><input className={priceClass} type="number" inputMode="decimal" min="0" step="0.01" value={filters.max} onChange={event => updateFilters({ max: event.target.value })} placeholder={uiText("Ui.text_d0c50fd56cbce3")} /></label>
            {hasFilters && <button type="button" onClick={resetFilters} className="min-h-11 rounded-lg border border-border px-4 text-sm text-text-secondary hover:border-gold hover:text-gold">{t("resetFilters")}</button>}
            {chips.map(chip => <span key={chip.id} className="inline-flex min-w-0 items-center gap-1 rounded-full border border-border bg-bg-secondary pl-3 text-xs text-text-secondary"><span className="min-w-0 break-words">{chip.label}</span><button type="button" aria-label={uiText("Ui.text_f10fe7a27ce274", { value1: chip.label })} onClick={chip.onRemove} className="flex min-h-11 min-w-11 shrink-0 items-center justify-center"><X size={14} /></button></span>)}
          </div>
        </div>
      </div>

      <div id="locations-discover" ref={resultsRef} className="site-container mobile-bottom-nav-clear scroll-mt-24 space-y-10 py-8 sm:space-y-14 sm:py-10">
        {allLocations.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-bg-elevated"><MapPin size={24} aria-hidden="true" className="text-text-muted" /></div>
            <p className="mb-1 font-semibold text-text-primary">{t("emptyTitle")}</p>
            <p className="mb-6 text-sm text-text-muted">{t("emptyDesc")}</p>
            <Link href="/inserat?group=drehorte" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-bg-primary"><Plus size={14} aria-hidden="true" />{t("emptyAction")}</Link>
          </div>
        ) : (
          <section aria-labelledby="locations-discover-title">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 id="locations-discover-title" className="text-xl font-bold text-text-primary sm:text-2xl">{t("landingDiscover")}</h2>
              <span className="hidden text-sm text-text-muted xl:inline">{t("results", { count: filtered.length })}</span>
            </div>
            {filtered.length === 0 ? <EmptyState icon={MapPin} title={t("emptyTitleFiltered")} description={t("emptyDescFiltered")} action={{ label: t("emptyActionReset"), onClick: resetFilters }} /> : <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {locations.map(location => (
                <Link key={location.id} href={`/locations/${location.id}`} className="browse-card group flex min-w-0 flex-col transition-colors hover:border-gold/50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold">
                  <div className="relative aspect-video w-full overflow-hidden bg-bg-elevated">
                    {location.image ? (
                      <Image
                        src={location.image}
                        alt={location.title}
                        fill
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        mediaSize="thumbnail"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        style={location.focalPoint ? { objectPosition: `${location.focalPoint.x * 100}% ${location.focalPoint.y * 100}%` } : undefined}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center"><MapPin size={28} aria-hidden="true" className="text-text-muted" /></div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <h3 className="line-clamp-2 min-h-12 text-base font-semibold leading-6 text-text-primary transition-colors group-hover:text-gold">{location.title}</h3>
                    <p className="mt-2 break-words text-sm text-text-muted">{location.type ? locationCategoryLabel(location.type, categoryText) : t("landingBadge")}</p>
                    {location.city && <p className="mt-1 flex items-start gap-1.5 text-sm text-text-secondary"><MapPin size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-text-muted" /><span className="min-w-0 break-words">{location.city}</span></p>}
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4">
                      {location.rating > 0 ? (
                        <span className="flex items-center gap-1 text-xs text-text-muted"><Star size={12} aria-hidden="true" className="fill-gold text-gold" />{location.rating.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}<span>({location.reviews.toLocaleString(locale)})</span></span>
                      ) : (
                        <span title={t("landingNoReviews")} className="text-xs text-text-muted">{t("newBadge")}</span>
                      )}
                      <span className="break-words text-sm font-bold text-gold">{location.priceLabel}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>}
            {filtered.length > locations.length && (
              <div className="mt-6 text-center"><button type="button" onClick={() => setPagination({ filterKey, visibleCount: visibleCount + 24 })} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-bg-elevated px-5 py-3 text-sm font-semibold text-text-primary transition-colors hover:border-gold/50 hover:text-gold">{t("landingMore")}<ChevronDown size={14} aria-hidden="true" /></button></div>
            )}
          </section>
        )}

        {allLocations.length > 0 && (
          <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-border bg-bg-elevated p-6 sm:flex-row sm:items-center sm:p-8">
            <div><p className="mb-1 text-lg font-bold text-text-primary">{t("heroCta")}</p><p className="text-sm text-text-muted">{t("heroDesc")}</p></div>
            <Link href="/inserat?group=drehorte" className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-gold px-6 py-3 text-sm font-bold text-bg-primary transition-colors hover:bg-gold-light">{t("heroCta")}<ArrowRight size={14} aria-hidden="true" /></Link>
          </div>
        )}
      </div>
    </div>
  );
}
