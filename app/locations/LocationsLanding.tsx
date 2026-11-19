"use client";

import { TranslatedText } from "@/components/ContentTranslation";

import BrowseGeography from "@/components/BrowseGeography";
import { prioritizeGeographically } from "@/lib/browse-geography";
import { useBrowseGeography } from "@/lib/use-browse-geography";

import EmptyState from "@/components/EmptyState";
import FavoriteButton from "@/components/FavoriteButton";
import FloatingMapToggle from "@/components/FloatingMapToggle";
import ListingImage from "@/components/ListingImage";
import MobileBrowseControls,{ MobileFilterField,MobileFilterSelect,type BrowseChip } from "@/components/MobileBrowseControls";
import DirectoryResults from "@/components/DirectoryResults";
import DirectoryViewControls, { type DirectoryView } from "@/components/DirectoryViewControls";
import BrowseSelect from "@/components/BrowseSelect";
import PageHeader from "@/components/PageHeader";
import DirectoryPage from "@/components/DirectoryPage";
import PlaceFilters,{ EMPTY_PLACE_FILTERS,type PlaceFilterValue } from "@/components/PlaceFilters";
import { locationCategoryLabel } from "@/lib/location-category-labels";
import { hasCoordinates,inMapBounds,locationDistanceKm,type MapBounds } from "@/lib/location-map";
import {
DEFAULT_LOCATION_LANDING_FILTERS,filterLandingLocations,locationLandingCategoryOptions,
locationLandingParams,readLocationLandingFilters,type LocationLandingFilters,
} from "@/lib/locations-landing-filters";
import { browsePlaceOptions as placeOptions, UNASSIGNED_COUNTRY } from "@/lib/places/core";
import { useNearbyLocation } from "@/lib/use-nearby-location";
import { useViewState } from "@/lib/use-view-state";
import { useViewUrl } from "@/lib/use-view-url";
import { ArrowRight,ChevronDown,MapPin,Navigation,Plus,Share2 } from "lucide-react";
import { useLocale,useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect,useMemo,useRef,useState } from "react";

export type LocationCard = {
  id: string; title: string; type: string; city: string; price: number;
  priceOnRequest: boolean; priceLabel: string;
  instantBook?: boolean; verified?: boolean;
  lat: number | null; lng: number | null; metadata?: Record<string, unknown>;
  image: string; rating: number; reviews: number;
  focalPoint?: { x: number; y: number } | null;
  place_country_code?: string | null; place_region_id?: string | null; place_city_id?: string | null;
  place_city_name?: string | null; place_region_name?: string | null; place_status?: string | null;
};

function MapLoading() {
  const t = useTranslations();
  return <div role="status" className="flex h-full items-center justify-center rounded-xl border border-border bg-bg-secondary text-sm text-text-muted">{t("Ui.text_8cd626fb7674ab")}</div>;
}
const LocationMap = dynamic(() => import("@/components/LocationMap"), { ssr: false, loading: MapLoading });
export default function LocationsLanding({ allLocations, totalCount, initialFilters = DEFAULT_LOCATION_LANDING_FILTERS }: { allLocations: LocationCard[]; totalCount: number; initialFilters?: LocationLandingFilters }) {
  const uiText = useTranslations();

  const locale = useLocale();
  const t = useTranslations("locations");
  const categoryText = useTranslations("menu");
  const [filters, setFilters] = useViewState("locations.landing.filters", () => ({ ...initialFilters }));
  const [pagination, setPagination] = useViewState("locations.landing.pagination", { filterKey: "", visibleCount: 24 });
  const [viewMode, setViewMode] = useViewState<DirectoryView | "split">("locations.landing.view", "grid");
  // Preserve saved legacy split views as the shared map/list mode.
  const effectiveView: DirectoryView = viewMode === "map" || viewMode === "split" ? "map" : viewMode === "list" ? "list" : "grid";
  const [browseBounds, setBrowseBounds] = useViewState<MapBounds | null>("locations.landing.bounds", null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const nearby = useNearbyLocation();
  const searchParams = useSearchParams();
  const [nearbyBounds, setNearbyBounds] = useState<MapBounds | null>(null);
  const [nearbyViewportRevision, setNearbyViewportRevision] = useState(0);
  const mapBounds = nearby.coordinates ? nearbyBounds : browseBounds;
  const setMapBounds = nearby.coordinates ? setNearbyBounds : setBrowseBounds;
  const clearLocation = () => { nearby.clear(); setNearbyBounds(null); setBrowseBounds(null); };
  const locateMe = nearby.locate;
  const [radiusKm, setRadiusKm] = useViewState("locations.landing.radius", 50);
  const genieLaunch = searchParams.get("genie") === "1" ? searchParams.toString() : "";
  const appliedGenieLaunch = useRef("");
  useEffect(() => {
    if (!genieLaunch) { appliedGenieLaunch.current = ""; return; }
    if (appliedGenieLaunch.current === genieLaunch) return;
    appliedGenieLaunch.current = genieLaunch;
    setFilters(readLocationLandingFilters(Object.fromEntries(new URLSearchParams(genieLaunch))));
    setPagination({ filterKey: "", visibleCount: 24 });
    setBrowseBounds(null); setNearbyBounds(null); nearby.clear(); setActiveId(null);
  }, [genieLaunch, setFilters, setPagination, setBrowseBounds, nearby.clear]);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current); }, []);
  const shareSearch = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch { setCopied(false); }
  };
  const resultsRef = useRef<HTMLDivElement>(null);
  const updateFilters = (patch: Partial<LocationLandingFilters>) => setFilters(current => ({ ...current, ...patch }));
  const resetFilters = () => { setFilters({ ...DEFAULT_LOCATION_LANDING_FILTERS }); setMapBounds(null); clearLocation(); };
  const changePlaces = (next: PlaceFilterValue) => updateFilters({ ...next, ...(next.city ? { cityText: "" } : {}) });
  const categoryLabel = (value: string) => locationCategoryLabel(value, categoryText);
  const categories = locationLandingCategoryOptions(allLocations, categoryLabel, locale);
  const geography = useBrowseGeography(filters.sort === "featured" && !filters.country && !filters.region && !filters.city && !filters.cityText && !nearby.coordinates);
  const matching = useMemo(() => prioritizeGeographically(filterLandingLocations(allLocations, filters, value => locationCategoryLabel(value, categoryText)), geography.preferred), [allLocations, filters, categoryText, geography.preferred]);
  const mapLocations = useMemo(() => matching.filter(row => !nearby.coordinates || (hasCoordinates(row) && locationDistanceKm(nearby.coordinates, [row.lat, row.lng]) <= radiusKm)), [matching, nearby.coordinates, radiusKm]);
  const filtered = useMemo(() => effectiveView === "map" && mapBounds ? mapLocations.filter(row => inMapBounds(row, mapBounds)) : mapLocations, [effectiveView, mapLocations, mapBounds]);
  const updateMapBounds = (next: MapBounds) => {
    if (mapBounds && mapBounds.south === next.south && mapBounds.north === next.north && mapBounds.west === next.west && mapBounds.east === next.east) return;
    setMapBounds(next);
    if (nearby.coordinates) setNearbyViewportRevision(current => current + 1);
  };
  const params = locationLandingParams(filters);
  const urlParams = params.toString();
  const filterKey = JSON.stringify([urlParams, effectiveView === "map" ? nearby.coordinates ? nearbyViewportRevision : mapBounds : null, nearby.coordinates ? nearby.session : null, radiusKm, geography.key]);
  const visibleCount = pagination.filterKey === filterKey ? pagination.visibleCount : 24;
  const locations = filtered.slice(0, visibleCount);
  useViewUrl(urlParams ? `/locations?${urlParams}` : "/locations");
  const sortOptions = [
    { value: "featured", label: geography.preferred ? uiText("BrowseGeography.recommended") : t("sortFeatured") }, { value: "price-asc", label: t("sortPriceAsc") },
    { value: "price-desc", label: t("sortPriceDesc") }, { value: "rating", label: t("sortRating") },
  ];
  const chips: BrowseChip[] = [
    ...(nearby.coordinates ? [{id: "nearby", label: `${t("locateActive")} · ${t("inRadius", {radius: radiusKm})}`, onRemove: () => clearLocation()}] : []),
    ...(filters.lage ? [{id: "lage", label: t(filters.lage === "Innen" ? "filterInnen" : filters.lage === "Außen" ? "filterAussen" : "filterInnenAussen"), onRemove: () => updateFilters({lage: ""})}] : []),
    ...([['power', 'filterPower'], ['instant', 'filterInstant'], ['verified', 'filterVerified']] as const).flatMap(([key,label]) => filters[key] ? [{id: key, label: t(label), onRemove: () => updateFilters({[key]: ""})}] : []),
    ...(effectiveView === "map" && mapBounds ? [{ id: "map-area", label: uiText("locationMap.areaActive"), onRemove: () => setMapBounds(null) }] : []),
    ...(filters.type ? [{ id: "type", label: categoryLabel(filters.type), onRemove: () => updateFilters({ type: "" }) }] : []),
    ...(["country", "region", "city"] as const).flatMap(kind => filters[kind] ? [{
      id: kind, label: filters[kind] === UNASSIGNED_COUNTRY ? uiText("Places.countryUnassigned") : placeOptions(allLocations, kind, locale).find(option => option.value === filters[kind])?.label ?? filters[kind],
      onRemove: () => updateFilters(kind === "country" ? EMPTY_PLACE_FILTERS : kind === "region" ? { region: "", city: "" } : { city: "" }),
    }] : []),
    ...(filters.cityText ? [{ id: "city-text", label: `${uiText("Places.city")}: ${filters.cityText}`, onRemove: () => updateFilters({ cityText: "" }) }] : []),
    ...(filters.min ? [{ id: "min", label: uiText("Ui.text_c6e3466f40cb9d", { value1: filters.min }), onRemove: () => updateFilters({ min: "" }) }] : []),
    ...(filters.max ? [{ id: "max", label: uiText("Ui.text_f47e415aff7a38", { value1: filters.max }), onRemove: () => updateFilters({ max: "" }) }] : []),
  ];

  const chooseView = (mode: DirectoryView) => setViewMode(mode);
  const viewControls = <DirectoryViewControls value={effectiveView} onChange={chooseView} />;

  const additionalFilters = () => <>
    <MobileFilterField label={uiText("Ui.text_295029201d603e")}>
      <MobileFilterSelect label={uiText("Ui.text_295029201d603e")} value={filters.lage} onChange={value => updateFilters({lage: value})} placeholder={t("filterAll")} options={[{value: "Innen", label: t("filterInnen")}, {value: "Außen", label: t("filterAussen")}, {value: "Innen & Außen", label: t("filterInnenAussen")}].filter(option => filterLandingLocations(allLocations, { ...DEFAULT_LOCATION_LANDING_FILTERS, lage: option.value }, categoryLabel).length > 0)} />
    </MobileFilterField>
    <div className="flex flex-wrap gap-x-5 gap-y-1">
      {([['power', 'filterPower'], ['instant', 'filterInstant'], ['verified', 'filterVerified']] as const).filter(([key]) => filters[key] || filterLandingLocations(allLocations, { ...DEFAULT_LOCATION_LANDING_FILTERS, [key]: '1' }, categoryLabel).length > 0).map(([key,label]) => <label key={key} className="flex min-h-11 items-center gap-3 text-sm text-text-secondary"><input type="checkbox" className="size-4 accent-gold" checked={filters[key] === "1"} onChange={event => updateFilters({[key]: event.target.checked ? "1" : ""})} />{t(label)}</label>)}
    </div>
    <div className="flex flex-wrap items-end gap-3">
      <button type="button" disabled={nearby.locating} onClick={nearby.coordinates ? clearLocation : locateMe} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm text-text-secondary disabled:opacity-60"><Navigation size={16} aria-hidden="true" />{t(nearby.locating ? "locating" : nearby.coordinates ? "locateActive" : "locateMe")}</button>
      {nearby.coordinates && <MobileFilterField label={t("radiusLabel")}><BrowseSelect label={t("radiusLabel")} value={String(radiusKm)} onChange={value => setRadiusKm(Number(value))} triggerClassName="browse-filter-select" options={[10,25,50,100,200,500].map(value => ({value: String(value), label: uiText.markup("Ui.text_6b06beb2a825c0", {value1: () => String(value)})}))} /></MobileFilterField>}
      <button type="button" onClick={shareSearch} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm text-text-secondary"><Share2 size={16} aria-hidden="true" />{t(copied ? "copied" : "shareBtn")}</button>
    </div>
    {nearby.error && <p role="alert" className="text-sm text-text-secondary">{t(nearby.error)}</p>}
  </>;

  const mapPanel = <aside aria-label={t("viewMap")} className="locations-discovery-map directory-map-frame">
          <LocationMap locations={mapLocations} visibleCount={filtered.length} onBoundsChange={updateMapBounds} activeId={activeId} onHover={setActiveId} userLocation={nearby.coordinates} radiusKm={radiusKm} appliedBounds={mapBounds} onApplyBounds={setMapBounds} />
        </aside>;

  return (
    <DirectoryPage area="locations">
      <PageHeader
        withBackdrop={false}
        optimizeImage
        badge={t("landingBadge")}
        title={t("heroTitle")}
        titleHighlight={t("heroTitleHighlight")}
        description={totalCount > 0 ? uiText("Ui.text_7c639bc99b8569", { value1: String(t("results", { count: totalCount })), value2: String(t("heroDesc")) }) : t("heroDesc")}
        cta={{ label: t("heroCta"), href: "/inserat?group=drehorte" }}
      >

      </PageHeader>

      <MobileBrowseControls nativeCategoryKind="place" preference={<BrowseGeography geography={geography} />}
        query={filters.q} onQueryChange={value => updateFilters({ q: value })} searchPlaceholder={t("searchPlaceholder")}
        sortValue={filters.sort} sortOptions={sortOptions} onSortChange={value => { geography.setEnabled(false); updateFilters({ sort: value }); }}
        categoryLabel={t("categoryLabel")} allCategoryLabel={t("allLocations")} categories={categories}
        categoryValue={filters.type} onCategoryChange={value => updateFilters({ type: value })}
        viewControls={viewControls}
        resultCount={filtered.length} resultSummary={t("results", { count: filtered.length })} filterCount={chips.length + (filters.q ? 1 : 0)} chips={chips}
        onReset={resetFilters} resetLabel={t("resetFilters")} showResultsLabel={t("showResults", { count: filtered.length })}
      >
        <PlaceFilters rows={allLocations} value={filters} onChange={changePlaces} />
        <div className="grid grid-cols-2 gap-3">
          <MobileFilterField label={uiText("Ui.text_84381d6fa4d29d")}><input aria-label={uiText("Ui.text_84381d6fa4d29d")} type="number" inputMode="decimal" min="0" step="0.01" value={filters.min} onChange={event => updateFilters({ min: event.target.value })} placeholder={uiText("Ui.text_d0c50fd56cbce3")} /></MobileFilterField>
          <MobileFilterField label={uiText("Ui.text_f7abc502297a74")}><input aria-label={uiText("Ui.text_f7abc502297a74")} type="number" inputMode="decimal" min="0" step="0.01" value={filters.max} onChange={event => updateFilters({ max: event.target.value })} placeholder={uiText("Ui.text_d0c50fd56cbce3")} /></MobileFilterField>
        </div>
        {additionalFilters()}
      </MobileBrowseControls>

      <div id="locations-discover" ref={resultsRef} className="site-container mobile-bottom-nav-clear scroll-mt-24 space-y-10 py-6 sm:space-y-10">

        <DirectoryResults view={effectiveView} map={mapPanel}>
        {(allLocations.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-bg-elevated"><MapPin size={24} aria-hidden="true" className="text-text-muted" /></div>
            <p className="mb-1 font-semibold text-text-primary">{t("emptyTitle")}</p>
            <p className="mb-6 text-sm text-text-muted">{t("emptyDesc")}</p>
            <Link href="/inserat?group=drehorte" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-bg-primary"><Plus size={14} aria-hidden="true" />{t("emptyAction")}</Link>
          </div>
        ) : (
          <section aria-label={t("landingDiscover")} className="min-w-0">
            {filtered.length === 0 ? <EmptyState icon={MapPin} title={t("emptyTitleFiltered")} description={t("emptyDescFiltered")} action={{ label: t("emptyActionReset"), onClick: resetFilters }} /> : <div className={effectiveView === "grid" ? "directory-cards" : "directory-list"}>
              {locations.map(location => (
                <article key={location.id} data-id={location.id} className={`directory-entry ${effectiveView === "grid" ? "browse-card" : ""}`}>
                  <Link href={`/locations/${location.id}`} onMouseEnter={() => setActiveId(location.id)} onMouseLeave={() => setActiveId(null)} onFocus={() => setActiveId(location.id)} onBlur={() => setActiveId(null)} className={`directory-entry-link ${activeId === location.id ? "ring-1 ring-gold" : ""}`}>
                    <div className="directory-entry-photo">
                      {location.image ? <ListingImage src={location.image} alt="" fill mediaSize="thumbnail"
                        sizes={effectiveView === "grid" ? "(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw" : "64px"}
                        className="object-cover" style={location.focalPoint ? { objectPosition: `${location.focalPoint.x}% ${location.focalPoint.y}%` } : undefined} />
                        : <div className="flex h-full items-center justify-center text-text-muted"><MapPin size={24} aria-hidden="true" /></div>}
                    </div>
                    <div className="directory-entry-body">
                      <h3 className="directory-entry-title" title={location.title}><TranslatedText kind="listing" id={location.id} field="title">{location.title}</TranslatedText></h3>
                      {location.city && <p className="directory-entry-place"><MapPin size={11} aria-hidden="true" /><span title={location.city}>{location.city}</span></p>}
                      <p className="directory-entry-price">{location.priceLabel}</p>
                    </div>
                  </Link>
                  <FavoriteButton listingId={location.id} listingType="location" listingTitle={location.title} listingCity={location.city} listingPrice={location.price} listingImage={location.image} className="directory-entry-favorite" />
                </article>
              ))}
            </div>}
            {filtered.length > locations.length && (
              <div className="mt-6 text-center"><button type="button" onClick={() => setPagination({ filterKey, visibleCount: visibleCount + 24 })} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-bg-elevated px-5 py-3 text-sm font-semibold text-text-primary transition-colors hover:border-gold/50 hover:text-gold">{t("landingMore")}<ChevronDown size={14} aria-hidden="true" /></button></div>
            )}
          </section>
        ))}
        </DirectoryResults>

        {allLocations.length > 0 && (
          <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-border bg-bg-elevated p-6 sm:flex-row sm:items-center sm:p-8">
            <div><p className="mb-1 text-lg font-bold text-text-primary">{t("heroCta")}</p><p className="text-sm text-text-muted">{t("heroDesc")}</p></div>
            <Link href="/inserat?group=drehorte" className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-gold px-6 py-3 text-sm font-bold text-bg-primary transition-colors hover:bg-gold-light">{t("heroCta")}<ArrowRight size={14} aria-hidden="true" /></Link>
          </div>
        )}
      </div>
      <FloatingMapToggle mapActive={effectiveView === "map"} onToggle={() => { chooseView(effectiveView === "map" ? "list" : "map"); requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })); }} />
    </DirectoryPage>
  );
}
