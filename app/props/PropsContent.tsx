"use client";
import { useDiscoveryPlaceLabels } from "@/lib/use-discovery-place-labels";
import NativeMarketplaceFilterChoices from "@/components/app/NativeMarketplaceFilterChoices";
import NativeBrowsePlaceFilters from "@/components/app/NativeBrowsePlaceFilters";
import { inBrowseRadius, matchesBrowsePlace } from "@/lib/browse-radius";
import { useNativeBrowseRadius } from "@/lib/use-native-browse-radius";
import { currencyOptions, isCurrencyCode, listingCurrency } from "@/lib/currency";

import { TranslatedText } from "@/components/ContentTranslation";

import { marketplaceBrowseDepartments } from "@/lib/browse-facets";
import BrowseGeography from "@/components/BrowseGeography";
import { prioritizeGeographically } from "@/lib/browse-geography";
import { useBrowseGeography } from "@/lib/use-browse-geography";


import DirectoryMap from "@/components/DirectoryMap";
import DirectoryResults from "@/components/DirectoryResults";
import DirectoryViewControls,{ type DirectoryView } from "@/components/DirectoryViewControls";
import FloatingMapToggle from "@/components/FloatingMapToggle";
import { useDirectoryMap } from "@/lib/use-directory-map";

import PlaceFilters,{ EMPTY_PLACE_FILTERS } from "@/components/PlaceFilters";
import { browsePlaceOptions as placeOptions, UNASSIGNED_COUNTRY,placeSearchMatches } from "@/lib/places/core";

import { listingPriceLabel } from "@/lib/listing-price";
import { marketplaceCategoryLabel } from "@/lib/marketplace-offer";
import { useViewState } from "@/lib/use-view-state";
import { useViewUrl } from "@/lib/use-view-url";


import ListingImage from "@/components/ListingImage";

import EmptyState from "@/components/EmptyState";
import MobileBrowseControls,{ MobileFilterField,MobileFilterSelect,type BrowseChip } from "@/components/MobileBrowseControls";
import { MARKETPLACE_PAGE_SIZE,marketplaceCardData,marketplaceCategorySelection,readMarketplaceBrowseState,type MarketplaceOfferFilter,type MarketplaceSort } from "@/lib/marketplace-browse";
import { localizedMarketplaceDepartments,marketplaceMatches,marketplaceSearchCategories,marketplaceSearchTerms } from "@/lib/marketplaceCategories";
import { useAuth,useUser } from "@clerk/nextjs";
import { Heart,MapPin,Package,Star } from "lucide-react";
import { useLocale,useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname,useSearchParams } from "next/navigation";
import React,{ Suspense,useEffect,useMemo,useRef,useState } from "react";

type Prop = {
  [key: string]: unknown;
  id: string; title: string; category: string; vendor: string; location: string;
  dailyRate: number; image: string; condition: string; era: string | null;
  delivery: boolean; rentalType?: "miete" | "kauf" | "beides" | "dienstleistung"; focalPoint?: { x: number; y: number } | null;
  description?: string; isReal?: boolean; type?: string; meta?: Record<string, unknown> | null;
  ownerId?: string;
  lat?: number | null; lng?: number | null;
};

type RatingData = { avg: number; count: number } | undefined;

// ─── Prop card ────────────────────────────────────────────────────

function PropCard({ p, list, ratingData, myRating, onRate, canRate, isFavorited, onFavorite }: {
  p: Prop; list?: boolean;
  ratingData?: RatingData; myRating?: number;
  onRate?: (star: number) => void; canRate?: boolean;
  isFavorited?: boolean; onFavorite?: (e: React.MouseEvent) => void;
}) {
  const uiText = useTranslations();
  const navigation = useTranslations("MarketplaceNavigation");
  const market = useTranslations("MarketplaceOffer"), locale = useLocale();
  const href = p.type === "vehicle" ? `/vehicles/${p.id}` : `/props/${p.id}`;
  const favorite = onFavorite && <button type="button" onClick={onFavorite} aria-label={navigation(isFavorited ? "removeFavorite" : "saveFavorite")} aria-pressed={!!isFavorited}
    className={`directory-entry-favorite flex min-h-11 min-w-11 items-center justify-center rounded-full border transition-colors ${isFavorited ? "border-crimson/50 bg-crimson/20 text-crimson-light" : "border-border bg-bg-primary/70 text-text-muted hover:text-crimson-light"}`}>
    <Heart size={17} aria-hidden="true" className={isFavorited ? "fill-current" : ""} />
  </button>;

  return <article className={`directory-entry ${list ? "" : "browse-card"}`} data-visible>
    <Link href={href} className="directory-entry-link">
      <div className="directory-entry-photo">
        {p.image ? <ListingImage src={p.image} alt="" fill mediaSize="thumbnail" loading="lazy"
          sizes={list ? "64px" : "(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"}
          className="object-cover" style={{ objectPosition: p.focalPoint ? `${p.focalPoint.x}% ${p.focalPoint.y}%` : "50% 66%" }} />
          : <div className="flex h-full items-center justify-center text-text-muted"><Package size={24} aria-hidden="true" /></div>}
      </div>
      <div className="directory-entry-body bg-bg-secondary">
        <h3 className="directory-entry-title" title={p.title}><TranslatedText kind="listing" id={p.id} field="title">{p.title}</TranslatedText></h3>
        <p className="directory-entry-place"><MapPin size={11} aria-hidden="true" /><span title={p.location || p.vendor}>{p.location || p.vendor}</span></p>
        <p className="directory-entry-price font-bold">{listingPriceLabel(p.dailyRate, { ...p.meta, rental_type: p.rentalType }, "/Tag", locale, market)}</p>
      </div>
    </Link>
    {favorite}
    {!list && ((ratingData?.count ?? 0) > 0 || canRate) && <div className="border-t border-border/50 px-3 py-2">
      {ratingData && ratingData.count > 0 && <span className="flex items-center gap-1 text-xs text-text-muted"><Star size={12} aria-hidden="true" className="text-gold" />{ratingData.avg.toLocaleString(locale, { maximumFractionDigits: 1 })} ({ratingData.count.toLocaleString(locale)})</span>}
      {canRate && <div className="flex max-w-full flex-wrap">
        {[1,2,3,4,5].map(star => <button key={star} type="button" aria-label={uiText("Ui.text_ce0d0c38532e69", { value1: star })} aria-pressed={myRating === star}
          onClick={() => onRate?.(star)} className={`flex min-h-11 min-w-11 items-center justify-center ${star <= (myRating ?? 0) ? "text-gold" : "text-text-muted"}`}>
          <Star size={14} aria-hidden="true" className={star <= (myRating ?? 0) ? "fill-current" : ""} />
        </button>)}
      </div>}
    </div>}
  </article>;
}

type PropsContentProps = { serverListings: Prop[]; serverError?: boolean; facetRows: Array<{ category: string; type: string; rentalType: string }>; initialDepartment?: string };
type RatingState = { owner: string; ratings: Record<string, { avg: number; count: number }>; mine: Record<string, number>; eligible: Set<string> };

function PropsInner({ serverListings, serverError = false, facetRows, initialDepartment }: PropsContentProps) {
  const uiText = useTranslations(), locale = useLocale(), t = useTranslations("props");
  const navigation = useTranslations("MarketplaceNavigation"), catalog = useTranslations("MarketplaceCatalog");
  const pathname = usePathname(), searchParams = useSearchParams();
  const { user } = useUser(), { isSignedIn } = useAuth();
  const resultsRef = useRef<HTMLDivElement>(null);
  const owner = isSignedIn && user?.id ? user.id : "guest";
  const privateVendor = t("vendorPrivate");
  const departments = useMemo(() => marketplaceBrowseDepartments(localizedMarketplaceDepartments(catalog), facetRows), [catalog, facetRows]);
  const initialParameters = new URLSearchParams(searchParams.toString());
  if (!initialParameters.get("dept") && !initialParameters.get("sub") && initialDepartment) initialParameters.set("dept", initialDepartment);
  const initial = readMarketplaceBrowseState(initialParameters);
  const [placeFilters, setPlaceFilters] = useViewState("props.placeFilters", () => ({ country: searchParams.get("country") ?? "", region: searchParams.get("region") ?? "", city: searchParams.get("city") ?? "" }));
  const placeLabels = useDiscoveryPlaceLabels(placeFilters.city);
  const [radius, setRadius] = useNativeBrowseRadius("props", placeFilters.city);
  const [cityText, setCityText] = useViewState("props.cityText", () => searchParams.get("cityText")?.trim() ?? "");
  const [query, setQuery] = useViewState("marketplace.query", initial.query);
  const [department, setDepartment] = useViewState<string | null>("marketplace.selectedDept", initial.department);
  const [subcategory, setSubcategory] = useViewState("marketplace.subcategory", initial.subcategory);
  const [offer, setOffer] = useViewState<MarketplaceOfferFilter>("marketplace.rentalTypeFilter", initial.offer);
  const [currency, setCurrency] = useViewState("marketplace.currency", () => isCurrencyCode(searchParams.get("currency")) ? searchParams.get("currency")! : "");
  const [sort, setSort] = useViewState<MarketplaceSort>("marketplace.sortKey", initial.sort);
  const [view, setView] = useViewState<DirectoryView>("marketplace.viewMode", initial.view);
  const [pagination, setPagination] = useViewState("marketplace.pagination", { filterKey: "", visibleCount: MARKETPLACE_PAGE_SIZE });
  const genieLaunch = searchParams.get("genie") === "1" ? searchParams.toString() : "";
  const appliedGenieLaunch = useRef("");

  const selected = marketplaceCategorySelection(department, subcategory);
  const selectedDept = selected.department ? String(selected.department) : null;
  const selectedSub = String(selected.subcategory);
  const rentalTypeFilter = offer === "miete" || offer === "kauf" || offer === "dienstleistung" ? offer : "alle";
  const sortKey = sort === "price-asc" || sort === "price-desc" ? sort : "featured";
  const activeCurrency = isCurrencyCode(currency) ? currency : sortKey !== "featured" ? "EUR" : "";
  const geography = useBrowseGeography(sortKey === "featured" && !placeFilters.country && !placeFilters.region && !placeFilters.city && !cityText);
  const viewMode = view === "map" ? "map" : view === "list" ? "list" : "grid";
  const changeCategory = (nextDepartment: string | null, nextSubcategory?: string) => {
    const next = marketplaceCategorySelection(nextDepartment, nextSubcategory ?? "");
    setDepartment(next.department); setSubcategory(next.subcategory);
  };
  const updatePlaceFilters = (next: typeof placeFilters) => { setPlaceFilters(next); if (next.city) setCityText(""); };
  const activeDepartment = departments.find(row => row.id === selectedDept);
  const activeSubcategory = activeDepartment?.groups.find(row => row.id === selectedSub);
  const sortOptions = [{ value: "featured", label: geography.preferred ? uiText("BrowseGeography.recommended") : navigation("newest") }, { value: "price-asc", label: t("sortPriceAsc") }, { value: "price-desc", label: t("sortPriceDesc") }];
  const filterKey = JSON.stringify([placeFilters.country, placeFilters.region, placeFilters.city, cityText.trim(), selectedDept, selectedSub, query.trim(), rentalTypeFilter, sortKey, activeCurrency, geography.key, radius]);
  const requestKey = JSON.stringify([filterKey, locale]);
  const visibleCount = pagination.filterKey === filterKey ? pagination.visibleCount : MARKETPLACE_PAGE_SIZE;
  const currentPage = Math.max(1, Math.ceil(visibleCount / MARKETPLACE_PAGE_SIZE));
  const parameters = new URLSearchParams();
  if (activeCurrency) parameters.set("currency", activeCurrency);
  if (query) parameters.set("q", query);
  if (cityText) parameters.set("cityText", cityText);
  if (selectedDept) parameters.set("dept", selectedDept);
  if (selectedSub) parameters.set("sub", selectedSub);
  if (rentalTypeFilter !== "alle") parameters.set("offer", rentalTypeFilter);
  if (sortKey !== "featured") parameters.set("sort", sortKey);
  if (viewMode !== "grid") parameters.set("view", viewMode);
  for (const kind of ["country", "region", "city"] as const) if (placeFilters[kind]) parameters.set(kind, placeFilters[kind]);
  useViewUrl(parameters.size ? `${pathname}?${parameters}` : pathname);

  const filtered = useMemo(() => {
    const search = query.trim().toLocaleLowerCase(locale);
    const categories = search ? marketplaceSearchCategories(query, catalog) : [];
    const matchingDepartments = search ? departments.filter(row => row.label.toLocaleLowerCase(locale).includes(search) || row.id.includes(search)) : [];
    const rows = serverListings.filter(row => {
      if (activeCurrency && listingCurrency(row.meta) !== activeCurrency) return false;
      if ((selectedDept || selectedSub) && !marketplaceMatches(row.category, selectedDept, selectedSub || null, row.type)) return false;
      if (!matchesBrowsePlace(row,placeFilters,radius)) return false;
      if (cityText && !radius && !placeSearchMatches(row, cityText) && !row.location.toLocaleLowerCase(locale).includes(cityText.toLocaleLowerCase(locale))) return false;
      if (rentalTypeFilter !== "alle" && (row.rentalType ?? "miete") !== rentalTypeFilter && !(row.rentalType === "beides" && rentalTypeFilter !== "dienstleistung")) return false;
      if (!search) return true;
      return [row.title, row.location, row.description ?? "", marketplaceSearchTerms(row.category)].some(value => value.toLocaleLowerCase(locale).includes(search))
        || placeSearchMatches(row, search)
        || categories.some(category => marketplaceMatches(row.category, null, category, row.type))
        || matchingDepartments.some(category => marketplaceMatches(row.category, category.id, null));
    });
    if (sortKey === "price-asc") rows.sort((a, b) => a.dailyRate - b.dailyRate);
    if (sortKey === "price-desc") rows.sort((a, b) => b.dailyRate - a.dailyRate);
    return prioritizeGeographically(rows, geography.preferred);
  }, [serverListings, query, locale, catalog, departments, selectedDept, selectedSub, placeFilters, cityText, rentalTypeFilter, sortKey, activeCurrency, geography.preferred, radius]);
  const [remote, setRemote] = useState<{ key: string; rows: Prop[]; count: number; pages: number; complete?: boolean } | null>(null);
  const remoteRef = useRef(remote);
  useEffect(() => { remoteRef.current = remote; }, [remote]);
  const requestSerial = useRef(0);
  const [browseError, setBrowseError] = useState<string | null>(serverError ? requestKey : null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController(), serial = ++requestSerial.current;
    const timer = window.setTimeout(() => {
      setBrowseError(null);
      const previous = remoteRef.current;
      const pages = previous?.key === requestKey && previous.pages >= currentPage - 1 && currentPage > 1 ? [currentPage] : Array.from({ length: currentPage }, (_, index) => index + 1);
      const base = new URLSearchParams({ marketplace: "1", limit: String(MARKETPLACE_PAGE_SIZE), sort: sortKey });
      if(activeCurrency)base.set("currency",activeCurrency);
      if (geography.preferred) base.set("nearby", "1");
      for (const kind of ["country", "region", "city"] as const) if (placeFilters[kind] && !radius) base.set(kind, placeFilters[kind]);
      if (cityText && !radius) base.set("cityText", cityText);
      if (selectedDept) base.set("dept", selectedDept);
      if (selectedSub) base.set("sub", selectedSub);
      if (query.trim()) base.set("q", query.trim());
      if (rentalTypeFilter !== "alle") base.set("offer", rentalTypeFilter);
      if (viewMode === "map" || radius) {
        if (previous?.key === requestKey && previous.complete) return;
        base.set("limit", "100");
        const fullPoolSignal = AbortSignal.any([controller.signal,AbortSignal.timeout(35_000)]);
        void (async () => {
          const rows: Prop[] = [];
          for (let page = 1; ; page++) {
            fullPoolSignal.throwIfAborted();
            const params = new URLSearchParams(base); params.set("page", String(page));
            const response = await fetch(`/api/listings?${params}`, { signal: fullPoolSignal });
            if (!response.ok) throw new Error("listing_request_failed");
            const result = await response.json();
            if (!Array.isArray(result.data) || !Number.isSafeInteger(result.count) || result.count < 0) throw new Error("invalid_listing_response");
            if (controller.signal.aborted || serial !== requestSerial.current) return;
            rows.push(...result.data.map((row: Record<string, unknown>) => ({ ...marketplaceCardData(row), vendor: privateVendor })));
            const complete = result.data.length < 100 || page * 100 >= result.count;
            const eligible = rows.filter(row => inBrowseRadius(row, radius));
            setRemote({ key: requestKey, rows: [...new Map(eligible.map(row => [row.id, row])).values()], count: radius ? eligible.length : result.count, pages: Math.ceil(rows.length / MARKETPLACE_PAGE_SIZE), complete });
            if (complete) break;
          }
        })().catch(() => { if (!controller.signal.aborted && serial === requestSerial.current) setBrowseError(requestKey); });
        return;
      }
      void Promise.all(pages.map(async page => {
        const params = new URLSearchParams(base); params.set("page", String(page));
        const response = await fetch(`/api/listings?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error("listing_request_failed");
        const result = await response.json();
        if (!Array.isArray(result.data) || typeof result.count !== "number" || !Number.isFinite(result.count) || result.count < 0) throw new Error("invalid_listing_response");
        return result as { data: Record<string, unknown>[]; count: number };
      })).then(results => {
        if (controller.signal.aborted || serial !== requestSerial.current) return;
        const rows: Prop[] = results.flatMap(result => result.data.map(row => ({ ...marketplaceCardData(row), vendor: privateVendor })));
        setRemote(current => ({ key: requestKey, rows: [...new Map([...(pages[0] > 1 && current?.key === requestKey ? current.rows : []), ...rows].map(row => [row.id, row])).values()], count: results[0]?.count ?? 0, pages: currentPage }));
        setBrowseError(null);
      }).catch(() => { if (!controller.signal.aborted && serial === requestSerial.current) setBrowseError(requestKey); });
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [requestKey, currentPage, retry, sortKey, placeFilters, cityText, selectedDept, selectedSub, query, rentalTypeFilter, privateVendor, viewMode, geography.preferred, radius]);
  const hasRemote = remote?.key === requestKey;
  const failed = browseError === requestKey;
  const browseLoading = !failed && (!hasRemote || (viewMode === "map" || radius ? !remote.complete : remote.pages < currentPage));
  const resultRows = hasRemote ? remote.rows : filtered;
  const map = useDirectoryMap("marketplace", filterKey, resultRows, viewMode === "map");
  useEffect(() => {
    if (!genieLaunch) { appliedGenieLaunch.current = ""; return; }
    if (appliedGenieLaunch.current === genieLaunch) return;
    appliedGenieLaunch.current = genieLaunch;
    const params = new URLSearchParams(genieLaunch), next = readMarketplaceBrowseState(params);
    map.setBounds(null);
    setQuery(next.query); setDepartment(next.department); setSubcategory(next.subcategory);
    setOffer(next.offer); setSort(next.sort); setView(next.view);
    setCurrency(isCurrencyCode(params.get("currency")) ? params.get("currency")! : "");
    setCityText(params.get("cityText") ?? "");
    setPlaceFilters({ country: params.get("country") ?? "", region: "", city: "" });
    setPagination({ filterKey: "", visibleCount: MARKETPLACE_PAGE_SIZE });
  }, [genieLaunch, map.setBounds, setQuery, setDepartment, setSubcategory, setOffer, setSort, setView, setCurrency, setCityText, setPlaceFilters, setPagination]);
  const resultCount = hasRemote ? remote.count : filtered.length;
  const countNotice = !hasRemote || ((viewMode === "map" || radius) && !remote.complete)
    ? navigation(failed ? "filterError" : "loading") : undefined;
  const listCount = viewMode === "map" ? map.rows.length : resultCount;
  const visibleRows = map.rows.slice(0, visibleCount);
  const mapItems = useMemo(() => resultRows.map(row => ({
    id: row.id, title: row.title, city: row.location, subtitle: marketplaceCategoryLabel(row.category, catalog),
    href: row.type === "vehicle" ? `/vehicles/${encodeURIComponent(row.id)}` : `/props/${encodeURIComponent(row.id)}`,
    image: row.image, focalPoint: row.focalPoint, lat: row.lat, lng: row.lng,
    priceLabel: listingPriceLabel(row.dailyRate, { ...row.meta, rental_type: row.rentalType }, "/Tag", locale, key => uiText(`MarketplaceOffer.${key}`)),
  })), [resultRows, catalog, locale, uiText]);
  const visibleIds = visibleRows.map(row => row.id).sort().join(",");
  const [ratingState, setRatingState] = useState<RatingState>({ owner, ratings: {}, mine: {}, eligible: new Set() });
  const [favoriteState, setFavoriteState] = useState<{ owner: string; ids: Set<string> }>({ owner, ids: new Set() });
  const pendingFavorites = useRef(new Set<string>()), pendingRatings = useRef(new Set<string>());
  const [actionError, setActionError] = useState(false);
  const liveRatings = ratingState.owner === owner ? ratingState.ratings : {};
  const myRatings = ratingState.owner === owner ? ratingState.mine : {};
  const eligible = ratingState.owner === owner ? ratingState.eligible : new Set<string>();
  const favorites = favoriteState.owner === owner ? favoriteState.ids : new Set<string>();
  useEffect(() => {
    if (!visibleIds) return;
    const controller = new AbortController();
    void fetch(`/api/listing-ratings?${new URLSearchParams({ ids: visibleIds })}`, { signal: controller.signal, cache: "no-store" })
      .then(async response => { if (!response.ok) throw new Error("ratings_request_failed"); return response.json(); })
      .then(result => {
        if (controller.signal.aborted) return;
        setRatingState(current => {
          const ratings = { ...(result.ratings ?? {}) }, mine = { ...(result.myRatings ?? {}) };
          for (const id of visibleIds.split(",")) if (current.owner === owner && pendingRatings.current.has(`${owner}:${id}`)) {
            if (current.ratings[id]) ratings[id] = current.ratings[id];
            if (current.mine[id]) mine[id] = current.mine[id];
          }
          return { owner, ratings, mine, eligible: new Set(result.eligible ?? []) };
        });
      }).catch(() => {});
    return () => controller.abort();
  }, [visibleIds, owner]);
  useEffect(() => {
    if (!isSignedIn || owner === "guest" || !visibleIds) return;
    const controller = new AbortController();
    void fetch(`/api/favorites?${new URLSearchParams({ ids: visibleIds })}`, { signal: controller.signal, cache: "no-store" })
      .then(async response => { if (!response.ok) throw new Error("favorites_request_failed"); return response.json(); })
      .then(result => {
        if (controller.signal.aborted) return;
        setFavoriteState(current => {
          const ids = new Set<string>(result.favorited ?? []);
          for (const id of visibleIds.split(",")) if (current.owner === owner && pendingFavorites.current.has(`${owner}:${id}`)) {
            if (current.ids.has(id)) ids.add(id); else ids.delete(id);
          }
          return { owner, ids };
        });
      }).catch(() => {});
    return () => controller.abort();
  }, [visibleIds, owner, isSignedIn]);
  const handleFavorite = async (event: React.MouseEvent, id: string) => {
    event.preventDefault(); event.stopPropagation();
    const key = `${owner}:${id}`;
    if (!isSignedIn || owner === "guest" || pendingFavorites.current.has(key)) return;
    pendingFavorites.current.add(key); setActionError(false);
    const previous = favorites.has(id);
    const update = (value: boolean) => setFavoriteState(current => {
      if (current.owner !== owner) return current;
      const ids = new Set(current.ids); if (value) ids.add(id); else ids.delete(id);
      return { owner, ids };
    });
    setFavoriteState(current => {
      const ids = new Set(current.owner === owner ? current.ids : []); if (previous) ids.delete(id); else ids.add(id);
      return { owner, ids };
    });
    try {
      const response = await fetch("/api/favorites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listing_id: id, action: previous ? "remove" : "add" }) });
      if (!response.ok) throw new Error("favorite_save_failed");
      const result = await response.json();
      if (typeof result.isFavorited !== "boolean") throw new Error("invalid_favorite_response");
      update(result.isFavorited);
    } catch { update(previous); setActionError(true); }
    finally { pendingFavorites.current.delete(key); }
  };
  const handleRate = async (id: string, ownerId: string | undefined, star: number) => {
    const key = `${owner}:${id}`;
    if (!isSignedIn || !user || !eligible.has(id) || pendingRatings.current.has(key)) return;
    pendingRatings.current.add(key); setActionError(false);
    const previous = myRatings[id], previousSummary = liveRatings[id];
    setRatingState(current => {
      const summary = current.owner === owner ? current.ratings[id] ?? { avg: 0, count: 0 } : { avg: 0, count: 0 };
      const count = previous ? summary.count : summary.count + 1;
      const total = summary.avg * summary.count - (previous ?? 0) + star;
      return { ...current, owner, mine: { ...current.mine, [id]: star }, ratings: { ...current.ratings, [id]: { avg: Math.round(total / Math.max(count, 1) * 10) / 10, count } } };
    });
    try {
      const response = await fetch("/api/listing-ratings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listing_id: id, owner_id: ownerId, rating: star }) });
      if (!response.ok) throw new Error("rating_save_failed");
    } catch {
      setRatingState(current => {
        if (current.owner !== owner) return current;
        const mine = { ...current.mine }, ratings = { ...current.ratings };
        if (previous) mine[id] = previous; else delete mine[id];
        if (previousSummary) ratings[id] = previousSummary; else delete ratings[id];
        return { ...current, mine, ratings };
      });
      setActionError(true);
    } finally { pendingRatings.current.delete(key); }
  };
  const clearAll = () => {
    setRadius(null); setPlaceFilters(EMPTY_PLACE_FILTERS); setCityText(""); changeCategory(null); setQuery(""); setCurrency(""); setSort("featured"); setOffer("alle");
  };
  const chips: BrowseChip[] = [
    ...(activeCurrency ? [{id:"currency",label:activeCurrency,onRemove:()=>{setCurrency("");setSort("featured");}}] : []),
    ...(activeDepartment ? [{ id: "category", label: activeDepartment.label, onRemove: () => changeCategory(null) }] : []),
    ...(activeSubcategory ? [{ id: "subcategory", label: activeSubcategory.label, onRemove: () => changeCategory(null) }] : []),
    ...(cityText ? [{ id: "city-text", label: `${uiText("Places.city")}: ${cityText}`, onRemove: () => setCityText("") }] : []),
    ...(["country", "region", "city"] as const).flatMap(kind => placeFilters[kind] ? [{ id: `place-${kind}`, label: placeFilters[kind] === UNASSIGNED_COUNTRY ? uiText("Places.countryUnassigned") : placeLabels(kind, placeFilters[kind], placeOptions(facetRows, kind, locale).find(option => option.value === placeFilters[kind])?.label ?? placeFilters[kind]), onRemove: () => updatePlaceFilters(kind === "country" ? EMPTY_PLACE_FILTERS : kind === "region" ? { ...placeFilters, region: "", city: "" } : { ...placeFilters, city: "" }) }] : []),
    ...(rentalTypeFilter !== "alle" ? [{ id: "offer", label: navigation(rentalTypeFilter === "dienstleistung" ? "service" : rentalTypeFilter === "miete" ? "rent" : "buy"), onRemove: () => setOffer("alle") }] : []),
  ];
  const currencyField = <MobileFilterField label={uiText("Regional.currency")}><MobileFilterSelect value={activeCurrency} onChange={value => {setCurrency(value);if(!value)setSort("featured");}} placeholder={uiText("Regional.allCurrencies")} options={currencyOptions(locale)} /></MobileFilterField>;
  const categoryDetailField = activeDepartment && <MobileFilterField label={navigation("subcategory")}><MobileFilterSelect value={selectedSub} onChange={value => changeCategory(selectedDept, value)} placeholder={navigation("allInCategory", { category: activeDepartment.label })} options={activeDepartment.groups.map(row => ({ value: row.id, label: row.label }))} /></MobileFilterField>;
  const offerField = <MobileFilterField label={navigation("offerType")}><MobileFilterSelect value={rentalTypeFilter === "alle" ? "" : rentalTypeFilter} onChange={value => setOffer(value === "miete" || value === "kauf" || value === "dienstleistung" ? value : "alle")} placeholder={uiText("common.all")} options={[{ value: "miete", label: navigation("rent") }, { value: "kauf", label: navigation("buy") }, { value: "dienstleistung", label: navigation("service") }].filter(option => facetRows.some(row => row.rentalType === option.value || (row.rentalType === "beides" && option.value !== "dienstleistung")))} /></MobileFilterField>;
  const viewControls = <DirectoryViewControls value={viewMode} onChange={setView} />;
  return <div className="min-h-screen mobile-bottom-nav-clear">
    <FloatingMapToggle mapActive={viewMode === "map"} onToggle={() => { setView(viewMode === "map" ? "list" : "map"); requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })); }} />
      <MobileBrowseControls nativeCategoryPanel={<NativeMarketplaceFilterChoices options={departments.map(row => ({value:row.id,label:row.label}))} selected={selectedDept?[selectedDept]:[]} onChange={value => changeCategory(value===selectedDept?null:value)}>{categoryDetailField}</NativeMarketplaceFilterChoices>} nativeAdditionalFilters={<>{currencyField}{offerField}</>} nativePlaceFilters={<NativeBrowsePlaceFilters area="marketplace" rows={facetRows} value={placeFilters} onChange={value => {geography.setEnabled(false);updatePlaceFilters(value);}} radius={radius} onRadiusChange={setRadius} />} nativeFilterArea="marketplace" preference={<BrowseGeography geography={geography} />} query={query} onQueryChange={setQuery} searchPlaceholder={t("searchPlaceholder")} sortValue={sortKey} sortOptions={sortOptions} onSortChange={value => { geography.setEnabled(false); setSort(value as MarketplaceSort); }} categoryLabel={navigation("category")} allCategoryLabel={navigation("allCategories")} categories={departments.map(row => ({ value: row.id, label: row.label }))} categoryValue={selectedDept ?? ""} onCategoryChange={value => changeCategory(value || null)} categoryPlacement="filters" resultCount={!hasRemote || browseLoading || ((viewMode === "map" || radius) && !remote?.complete) ? null : resultCount} resultSummary={countNotice ?? (browseLoading ? navigation("loading") : t("results", { count: resultCount }))} viewControls={viewControls} filterCount={chips.length} chips={chips} onReset={clearAll} resetLabel={t("clearAllFilters")} showResultsLabel={t("results", { count: resultCount })}>
      {currencyField}<PlaceFilters rows={facetRows} value={placeFilters} onChange={value => { geography.setEnabled(false); updatePlaceFilters(value); }} />{categoryDetailField}{offerField}
    </MobileBrowseControls>

    <div ref={resultsRef} className="site-container scroll-mt-24 py-4 sm:py-6">

      {actionError && <p role="alert" className="mb-4 text-sm text-red-400">{uiText("System.requestFailed")}</p>}
      {failed && <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-bg-secondary p-4 text-sm text-text-secondary"><span>{navigation("filterError")}</span><button type="button" onClick={() => { setBrowseError(null); setRetry(value => value + 1); }} className="min-h-11 rounded-lg border border-border px-4 font-medium text-gold hover:border-gold">{navigation("retry")}</button></div>}
      {browseLoading && <p role="status" className="mb-4 text-sm text-text-muted">{navigation("loading")}</p>}
      <DirectoryResults view={viewMode} map={<DirectoryMap compact kind="marketplace" onShowAll={() => { map.setBounds(null); setView("list"); }} countNotice={countNotice} items={mapItems} bounds={map.bounds} onBoundsChange={map.setBounds} />}>
      <div aria-busy={browseLoading}>
        {visibleRows.length > 0 ? <>
          <div className={viewMode === "grid" ? "directory-cards" : "directory-list"}>{visibleRows.map(row => <PropCard key={row.id} p={row} list={viewMode !== "grid"} ratingData={liveRatings[row.id]} myRating={myRatings[row.id]} canRate={!!isSignedIn && !!user && user.id !== row.ownerId && eligible.has(row.id)} onRate={star => handleRate(row.id, row.ownerId, star)} isFavorited={favorites.has(row.id)} onFavorite={isSignedIn ? event => { void handleFavorite(event, row.id); } : undefined} />)}</div>
          {listCount > visibleCount && <div className="mt-8 text-center"><button type="button" disabled={browseLoading} onClick={() => setPagination({ filterKey, visibleCount: visibleCount + MARKETPLACE_PAGE_SIZE })} className="min-h-11 rounded-xl border border-border px-8 py-3 text-sm font-semibold text-text-secondary transition-colors hover:border-gold hover:text-gold disabled:opacity-50">{t("loadMore", { count: listCount - visibleCount })}</button></div>}
        </> : !failed && !browseLoading ? <EmptyState icon={Package} title={serverListings.length === 0 ? t("emptyTitle") : t("emptyTitleFiltered")} description={serverListings.length === 0 ? t("emptyDesc") : t("emptyDescFiltered")} action={chips.length || query ? { label: t("emptyReset"), onClick: clearAll } : undefined} /> : null}
      </div>
      </DirectoryResults>
    </div>
  </div>;
}

export default function PropsContent(props: PropsContentProps) {
  return <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" /></div>}><PropsInner {...props} /></Suspense>;
}
