"use client";

import { useViewUrl } from "@/lib/use-view-url";
import { useViewState } from "@/lib/use-view-state";
import { listingPriceLabel } from "@/lib/listing-price";


import { useState, useMemo, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import Image from "@/components/MediaImage";
import dynamicImport from "next/dynamic";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useUser, useAuth } from "@clerk/nextjs";
import { Heart } from "lucide-react";

import {
  MapPin, CheckCircle, Search, Zap, LayoutList,
  Map, Navigation, SlidersHorizontal, X, Share2, Film,
} from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { useTranslations } from "next-intl";
import MobileBrowseControls, { MobileFilterField, MobileFilterSelect, type BrowseChip } from "@/components/MobileBrowseControls";
const LocationMap = dynamicImport(() => import("@/components/LocationMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-bg-secondary flex items-center justify-center rounded-xl border border-border">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-text-muted text-sm">Karte wird geladen…</p>
      </div>
    </div>
  ),
});

// Kick off Leaflet download immediately when this module loads — by the time
// the user switches to map view, the bundle is already in the browser cache.
if (typeof window !== "undefined") {
  void import("leaflet");
}

const locationTypes = [
  "All Types", "Wohnen", "Villa", "Büro", "Industrie",
  "Natur", "Gastronomie", "Studio", "Fotostudio", "Speziallocation",
];

const PAGE_SIZE = 24;

type Location = {
  id: string; title: string; type: string; city: string; price: number;
  priceUnit: string; rating: number; reviews: number; image: string;
  tags: string[]; instantBook: boolean; verified: boolean;
  sqft: number; capacity: number; lat: number; lng: number; isReal?: boolean;
  focalPoint?: { x: number; y: number } | null; description?: string;
  ownerId?: string;
  metadata?: Record<string, unknown>;
};

function parseLocationMeta(desc: string): { lage?: string; hasPower: boolean } {
  const metaLine = desc.split("\n\n")[0] ?? desc;
  const lage = metaLine.match(/Lage: ([^·\n]+)/)?.[1]?.trim();
  const hasPower = metaLine.includes("Stromanschluss vorhanden");
  return { lage, hasPower };
}

function getDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type ViewMode = "split" | "list" | "map";

function LocationsInner({ serverListings }: { serverListings: Location[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("locations");
  const { user } = useUser();
  const { isSignedIn } = useAuth();

  const allLocations = useMemo(() => serverListings, [serverListings]);

  const [liveRatings, setLiveRatings] = useState<Record<string, { avg: number; count: number }>>({});
  const [myRatings, setMyRatings] = useState<Record<string, number>>({});
  const [eligible, setEligible] = useState<Set<string>>(new Set());
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  useEffect(() => {
    const ids = serverListings.map(l => l.id).join(",");
    if (!ids) return;
    fetch(`/api/listing-ratings?ids=${ids}`)
      .then(r => r.json())
      .then(({ ratings, myRatings: my, eligible: elig }) => {
        setLiveRatings(ratings ?? {});
        setMyRatings(my ?? {});
        setEligible(new Set(elig ?? []));
      })
      .catch(() => {});
  }, [serverListings]);

  useEffect(() => {
    if (!isSignedIn) return;
    const ids = serverListings.map(l => l.id).join(",");
    if (!ids) return;
    fetch(`/api/favorites?ids=${ids}`)
      .then(r => r.json())
      .then(({ favorited }) => setFavorites(new Set(favorited ?? [])))
      .catch(() => {});
  }, [serverListings, isSignedIn]);

  const handleFavorite = async (e: React.MouseEvent, listingId: string) => {
    e.preventDefault(); e.stopPropagation();
    if (!isSignedIn) return;
    const wasFav = favorites.has(listingId);
    setFavorites((prev) => {
      const next = new Set(prev);
      if (wasFav) next.delete(listingId);
      else next.add(listingId);
      return next;
    });
    try {
      await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing_id: listingId }),
      });
    } catch {
      setFavorites((prev) => {
        const next = new Set(prev);
        if (wasFav) next.add(listingId);
        else next.delete(listingId);
        return next;
      });
    }
  };

  const handleRate = async (listingId: string, ownerId: string | undefined, star: number) => {
    if (!user) return;
    const prev = myRatings[listingId];
    setMyRatings(m => ({ ...m, [listingId]: star }));
    setLiveRatings(r => {
      const cur = r[listingId] ?? { avg: 0, count: 0 };
      const newCount = prev ? cur.count : cur.count + 1;
      const newSum = prev ? cur.avg * cur.count - prev + star : cur.avg * cur.count + star;
      return { ...r, [listingId]: { avg: Math.round((newSum / newCount) * 10) / 10, count: newCount } };
    });
    try {
      await fetch("/api/listing-ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing_id: listingId, owner_id: ownerId, rating: star }),
      });
    } catch {
      setMyRatings(m => { const n = { ...m }; if (prev) n[listingId] = prev; else delete n[listingId]; return n; });
    }
  };

  const [query, setQuery] = useViewState("locations.query", () => searchParams.get("q") ?? "");
  const [activeType, setActiveType] = useViewState("locations.activeType", () => searchParams.get("type") ?? "All Types");
  const [instantOnly, setInstantOnly] = useViewState("locations.instantOnly", () => searchParams.get("instant") === "1");
  const [verifiedOnly, setVerifiedOnly] = useViewState("locations.verifiedOnly", () => searchParams.get("verified") === "1");
  const [minPrice, setMinPrice] = useViewState("locations.minPrice", () => searchParams.get("min") ?? "");
  const [maxPrice, setMaxPrice] = useViewState("locations.maxPrice", () => searchParams.get("max") ?? "");
  const [lageFilter, setLageFilter] = useViewState("locations.lageFilter", () => searchParams.get("lage") ?? "Alle");
  const [powerOnly, setPowerOnly] = useViewState("locations.powerOnly", () => searchParams.get("power") === "1");
  const [sortKey, setSortKey] = useViewState("locations.sortKey", () => searchParams.get("sort") ?? "featured");
  const [viewMode, setViewMode] = useViewState<ViewMode>("locations.viewMode", "split");
  const [activeId, setActiveId] = useViewState<string | null>("locations.activeId", null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [radiusKm, setRadiusKm] = useViewState("locations.radiusKm", 50);
  const [copied, setCopied] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [pagination, setPagination] = useViewState("locations.pagination", { filterKey: "", visibleCount: PAGE_SIZE });
  const listRef = useRef<HTMLDivElement>(null);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filtered = useMemo(() => {
    let result = [...allLocations];

    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(
        (l) =>
          l.title.toLowerCase().includes(q) ||
          l.city.toLowerCase().includes(q) ||
          l.type.toLowerCase().includes(q) ||
          l.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    if (activeType !== "All Types") {
      result = result.filter((l) => l.type.toLowerCase().includes(activeType.toLowerCase()));
    }
    if (instantOnly) result = result.filter((l) => l.instantBook);
    if (verifiedOnly) result = result.filter((l) => l.verified);
    if (minPrice) result = result.filter((l) => l.price >= Number(minPrice));
    if (maxPrice) result = result.filter((l) => l.price <= Number(maxPrice));
    if (lageFilter !== "Alle") {
      result = result.filter((l) => {
        const structuredLage = l.metadata?.indoor_outdoor;
        const lage = structuredLage === "innen" ? "Innen" : structuredLage === "außen" ? "Außen" : structuredLage === "beides" ? "Innen & Außen" : l.description ? parseLocationMeta(l.description).lage : undefined;
        if (!lage) return true; // no meta = legacy listing, include
        if (lageFilter === "Innen") return lage === "Innen" || lage === "Innen & Außen";
        if (lageFilter === "Außen") return lage === "Außen" || lage === "Innen & Außen";
        if (lageFilter === "Innen & Außen") return lage === "Innen & Außen";
        return true;
      });
    }
    if (powerOnly) {
      result = result.filter((l) => {
        if (typeof l.metadata?.power_available === "boolean") return l.metadata.power_available;
        if (!l.description) return false;
        return parseLocationMeta(l.description).hasPower;
      });
    }

    if (userLocation) {
      result = result.filter((l) => {
        if (!l.lat || !l.lng) return false;
        return getDistanceKm(userLocation[0], userLocation[1], l.lat, l.lng) <= radiusKm;
      });
    }

    if (sortKey === "price-asc") result.sort((a, b) => a.price - b.price);
    if (sortKey === "price-desc") result.sort((a, b) => b.price - a.price);
    if (sortKey === "rating") result.sort((a, b) => b.rating - a.rating);

    return result;
  }, [allLocations, query, activeType, instantOnly, verifiedOnly, minPrice, maxPrice, lageFilter, powerOnly, sortKey, userLocation, radiusKm]);

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      setLocationError(t("geolocationUnsupported"));
      return;
    }
    setLocating(true);
    setLocationError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation([pos.coords.latitude, pos.coords.longitude]);
        setLocating(false);
      },
      () => {
        setLocationError(t("geolocationError"));
        setLocating(false);
      }
    );
  };

  const clearLocation = () => {
    setUserLocation(null);
    setLocationError("");
  };

  useEffect(() => {
    if (!activeId || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-id="${activeId}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeId]);

  const filterKey = JSON.stringify([query, activeType, instantOnly, verifiedOnly, minPrice, maxPrice, lageFilter, powerOnly, sortKey, userLocation, radiusKm]);
  const visibleCount = pagination.filterKey === filterKey ? pagination.visibleCount : PAGE_SIZE;
  const showMore = () => setPagination({ filterKey, visibleCount: visibleCount + PAGE_SIZE });

  const resetFilters = () => {
    setQuery(""); setActiveType("All Types");
    setInstantOnly(false); setVerifiedOnly(false);
    setMinPrice(""); setMaxPrice("");
    setLageFilter("Alle"); setPowerOnly(false);
    setSortKey("featured");
    setUserLocation(null);
    router.replace(pathname, { scroll: false });
  };

  const filterParams = new URLSearchParams();
  if (query) filterParams.set("q", query);
  if (activeType !== "All Types") filterParams.set("type", activeType);
  if (instantOnly) filterParams.set("instant", "1");
  if (verifiedOnly) filterParams.set("verified", "1");
  if (minPrice) filterParams.set("min", minPrice);
  if (maxPrice) filterParams.set("max", maxPrice);
  if (lageFilter !== "Alle") filterParams.set("lage", lageFilter);
  if (powerOnly) filterParams.set("power", "1");
  if (sortKey !== "featured") filterParams.set("sort", sortKey);
  useViewUrl(filterParams.size ? `${pathname}?${filterParams}` : pathname);

  const hasActiveFilters = query || activeType !== "All Types" || instantOnly || verifiedOnly || minPrice || maxPrice || userLocation || lageFilter !== "Alle" || powerOnly;
  const mobileChips: BrowseChip[] = [
    ...(activeType !== "All Types" ? [{ id: "type", label: activeType, onRemove: () => setActiveType("All Types") }] : []),
    ...(minPrice ? [{ id: "min", label: `ab ${minPrice} €`, onRemove: () => setMinPrice("") }] : []),
    ...(maxPrice ? [{ id: "max", label: `bis ${maxPrice} €`, onRemove: () => setMaxPrice("") }] : []),
    ...(lageFilter !== "Alle" ? [{ id: "lage", label: lageFilter, onRemove: () => setLageFilter("Alle") }] : []),
    ...(instantOnly ? [{ id: "instant", label: t("filterInstant"), onRemove: () => setInstantOnly(false) }] : []),
    ...(verifiedOnly ? [{ id: "verified", label: t("filterVerified"), onRemove: () => setVerifiedOnly(false) }] : []),
    ...(powerOnly ? [{ id: "power", label: t("filterPower"), onRemove: () => setPowerOnly(false) }] : []),
    ...(userLocation ? [{ id: "nearby", label: t("locateActive"), onRemove: clearLocation }] : []),
  ];

  return (
    <div className="flex min-h-[20rem] h-[calc(100dvh-25rem)] flex-col bg-bg-primary xl:min-h-[32rem] xl:h-[calc(100dvh-15rem)]">
      <MobileBrowseControls
        query={query}
        onQueryChange={setQuery}
        searchPlaceholder={t("searchPlaceholder")}
        sortValue={sortKey}
        sortOptions={[{ value: "featured", label: t("sortFeatured") }, { value: "price-asc", label: t("sortPriceAsc") }, { value: "price-desc", label: t("sortPriceDesc") }, { value: "rating", label: t("sortRating") }]}
        onSortChange={setSortKey}
        categoryLabel="Location-Typ"
        allCategoryLabel={t("filterAll") + " Locations"}
        categories={locationTypes.slice(1).map((value) => ({ value, label: value }))}
        categoryValue={activeType === "All Types" ? "" : activeType}
        onCategoryChange={(value) => setActiveType(value || "All Types")}
        resultSummary={t("results", { count: filtered.length })}
        filterCount={mobileChips.length}
        chips={mobileChips}
        onReset={resetFilters}
        resetLabel={t("resetFilters")}
        showResultsLabel={t("results", { count: filtered.length })}
      >
        <div className="grid grid-cols-2 gap-3">
          <MobileFilterField label="Preis ab (€)"><input inputMode="decimal" type="number" min="0" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} placeholder="Beliebig" /></MobileFilterField>
          <MobileFilterField label="Preis bis (€)"><input inputMode="decimal" type="number" min="0" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} placeholder="Beliebig" /></MobileFilterField>
        </div>
        <MobileFilterField label="Lage">
          <MobileFilterSelect value={lageFilter === "Alle" ? "" : lageFilter} onChange={(value) => setLageFilter(value || "Alle")} placeholder="Innen und außen" options={[{ value: "Innen", label: t("filterInnen") }, { value: "Außen", label: t("filterAussen") }, { value: "Innen & Außen", label: t("filterInnenAussen") }]} />
        </MobileFilterField>
        <div className="grid gap-1">
          {[
            [instantOnly, setInstantOnly, t("filterInstant")],
            [verifiedOnly, setVerifiedOnly, t("filterVerified")],
            [powerOnly, setPowerOnly, t("filterPower")],
          ].map(([checked, setter, label]) => (
            <label key={String(label)} className="flex min-h-11 items-center gap-3 text-sm text-text-secondary">
              <input type="checkbox" className="size-4 accent-gold" checked={checked as boolean} onChange={(event) => (setter as (next: boolean) => void)(event.target.checked)} />{label as string}
            </label>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={userLocation ? clearLocation : handleLocateMe} className="min-h-11 rounded-lg border border-border px-2 text-sm text-text-secondary">{userLocation ? t("locateActive") : t("locateMe")}</button>
          {userLocation && <MobileFilterField label={t("radiusLabel")}><select value={radiusKm} onChange={(event) => setRadiusKm(Number(event.target.value))}>{[10, 25, 50, 100, 200, 500].map((value) => <option key={value} value={value}>{value} km</option>)}</select></MobileFilterField>}
        </div>
      </MobileBrowseControls>
      {/* ── TOP BAR ── */}
      <div className="hidden xl:block browse-toolbar shrink-0">
        <div className="site-container space-y-2 py-2">

          {/* Row 1: Search + View toggle */}
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="flex-1 flex items-center gap-2 bg-bg-elevated border border-border rounded-lg px-3 focus-within:border-gold transition-colors">
              <Search size={14} className="text-text-muted shrink-0" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("searchPlaceholder")}
                className="bg-transparent border-none py-2.5 text-sm w-full focus:outline-none"
              />
              {query && (
                <button onClick={() => setQuery("")} className="text-text-muted hover:text-text-primary">
                  <X size={14} />
                </button>
              )}
            </div>

            {/* View toggle */}
            <div className="flex bg-bg-elevated border border-border rounded-lg overflow-hidden shrink-0">
              {([
                { mode: "list" as ViewMode, icon: LayoutList, label: t("viewList") },
                { mode: "split" as ViewMode, icon: MapPin, label: t("viewSplit"), hideOnMobile: true },
                { mode: "map" as ViewMode, icon: Map, label: t("viewMap") },
              ]).map(({ mode, icon: Icon, label, hideOnMobile }) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  title={label}
                  className={`${hideOnMobile ? "hidden sm:flex" : "flex"} items-center gap-1.5 h-9 px-2.5 text-xs font-medium transition-all border-r border-border last:border-r-0 ${
                    viewMode === mode
                      ? "bg-gold text-bg-primary"
                      : "text-text-muted hover:text-text-primary hover:bg-bg-hover"
                  }`}
                >
                  <Icon size={13} />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Row 2: Action buttons — horizontal scroll on mobile */}
          <div className="flex items-center gap-2 overflow-x-auto lg:overflow-visible pb-0.5" style={{ scrollbarWidth: "none" }}>
            {/* Locate me */}
            <button
              onClick={userLocation ? clearLocation : handleLocateMe}
              disabled={locating}
              className={`flex items-center gap-2 h-9 px-3 rounded-lg text-xs font-medium border transition-all shrink-0 ${
                userLocation
                  ? "bg-gold text-bg-primary border-gold"
                  : "border-border text-text-secondary hover:border-gold hover:text-gold"
              }`}
            >
              <Navigation size={13} className={locating ? "animate-spin" : ""} />
              {locating ? t("locating") : userLocation ? t("locateActive") : t("locateMe")}
            </button>

            {/* Radius */}
            {userLocation && (
              <div className="flex items-center gap-2 bg-bg-elevated border border-gold/30 rounded-lg h-9 px-3 shrink-0">
                <span className="text-xs text-text-muted">{t("radiusLabel")}</span>
                <select
                  value={radiusKm}
                  onChange={(e) => setRadiusKm(Number(e.target.value))}
                  className="bg-transparent border-none text-xs text-gold font-semibold focus:outline-none"
                >
                  {[10, 25, 50, 100, 200, 500].map((r) => (
                    <option key={r} value={r}>{r} km</option>
                  ))}
                </select>
              </div>
            )}

            {/* Filters toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 h-9 px-3 rounded-lg text-xs font-medium border transition-all shrink-0 ${
                showFilters || hasActiveFilters
                  ? "border-gold text-gold"
                  : "border-border text-text-secondary hover:border-gold hover:text-gold"
              }`}
            >
              <SlidersHorizontal size={13} />
              {t("filterBtn")}
              {hasActiveFilters && (
                <span className="w-4 h-4 bg-gold text-bg-primary text-[10px] rounded-full flex items-center justify-center font-bold">!</span>
              )}
            </button>

            {/* Share */}
            <button
              onClick={handleCopyLink}
              title="Copy shareable link"
              className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-medium border border-border text-text-secondary hover:border-gold hover:text-gold transition-all shrink-0"
            >
              <Share2 size={13} /> {copied ? t("copied") : t("shareBtn")}
            </button>

          </div>

          {/* Expandable filters */}
          {showFilters && (
            <div className="pt-3 border-t border-border flex flex-wrap gap-3 items-center animate-fade-in">
              <div className="flex flex-wrap gap-1.5">
                {locationTypes.map((t) => (
                  <button
                    key={t}
                    onClick={() => setActiveType(t)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${
                      activeType === t
                        ? "bg-gold text-bg-primary border-gold"
                        : "border-border text-text-secondary hover:border-gold hover:text-gold"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-text-muted">€</span>
                  <input type="number" placeholder="Min" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} className="text-xs py-1.5 px-2 w-20 bg-bg-elevated border border-border rounded-lg text-text-secondary focus:outline-none" />
                  <span className="text-xs text-text-muted">–</span>
                  <input type="number" placeholder="Max" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className="text-xs py-1.5 px-2 w-20 bg-bg-elevated border border-border rounded-lg text-text-secondary focus:outline-none" />
                </div>

                <div className="flex items-center gap-1">
                  {[
                    { val: "Alle", label: t("filterAll") },
                    { val: "Innen", label: t("filterInnen") },
                    { val: "Außen", label: t("filterAussen") },
                    { val: "Innen & Außen", label: t("filterInnenAussen") },
                  ].map(({ val, label }) => (
                    <button key={val} onClick={() => setLageFilter(val)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${
                        lageFilter === val ? "bg-gold text-bg-primary border-gold" : "border-border text-text-secondary hover:border-gold hover:text-gold"
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer text-xs text-text-secondary">
                  <input type="checkbox" className="accent-gold" checked={powerOnly} onChange={(e) => setPowerOnly(e.target.checked)} />
                  <Zap size={11} className="text-gold" /> {t("filterPower")}
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-xs text-text-secondary">
                  <input type="checkbox" className="accent-gold" checked={instantOnly} onChange={(e) => setInstantOnly(e.target.checked)} />
                  <Zap size={11} className="text-gold" /> {t("filterInstant")}
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-xs text-text-secondary">
                  <input type="checkbox" className="accent-gold" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} />
                  <CheckCircle size={11} className="text-success" /> {t("filterVerified")}
                </label>

                <select value={sortKey} onChange={(e) => setSortKey(e.target.value)} className="text-xs py-1.5 px-2 bg-bg-elevated border border-border rounded-lg text-text-secondary">
                  <option value="featured">{t("sortFeatured")}</option>
                  <option value="price-asc">{t("sortPriceAsc")}</option>
                  <option value="price-desc">{t("sortPriceDesc")}</option>
                  <option value="rating">{t("sortRating")}</option>
                </select>

                {hasActiveFilters && (
                  <button onClick={resetFilters} className="text-xs text-crimson-light hover:text-crimson flex items-center gap-1 transition-colors">
                    <X size={12} /> {t("resetFilters")}
                  </button>
                )}
              </div>
            </div>
          )}

          {locationError && (
            <p className="mt-2 text-xs text-crimson-light">{locationError}</p>
          )}
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 overflow-hidden flex">

        {/* ── LIST PANEL ── */}
        {viewMode !== "map" && (
          <div
            ref={listRef}
            className={`overflow-y-auto pb-[calc(56px+env(safe-area-inset-bottom,0px))] xl:pb-0 ${viewMode === "split" ? "w-full sm:w-[420px] shrink-0 sm:border-r border-border" : "flex-1"}`}
          >
            <div className="hidden xl:flex sticky top-0 z-10 bg-bg-primary/90 backdrop-blur-nav border-b border-border px-4 py-2.5 items-center justify-between">
              <p className="text-xs text-text-muted">
                <span className="text-text-primary font-semibold">{t("results", { count: filtered.length })}</span>
                {userLocation && <span className="text-gold"> {t("inRadius", { radius: radiusKm })}</span>}
                {query && <span className="text-gold"> für &ldquo;{query}&rdquo;</span>}
              </p>
            </div>

            {filtered.length === 0 ? (
              <EmptyState
                icon={Film}
                title={allLocations.length === 0 ? t("emptyTitle") : t("emptyTitleFiltered")}
                description={allLocations.length === 0 ? t("emptyDesc") : userLocation ? t("emptyDescRadius") : t("emptyDescFiltered")}
                action={allLocations.length === 0 ? { label: t("emptyAction"), onClick: () => window.location.href = "/inserat?group=drehorte" } : { label: t("emptyActionReset"), onClick: resetFilters }}
              />
            ) : (
              <div className={`${viewMode === "list" ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-6" : "space-y-3 p-3"}`}>
                {filtered.slice(0, visibleCount).map((loc) => (
                  viewMode === "split" ? (
                    <div
                      key={loc.id}
                      data-id={loc.id}
                      onMouseEnter={() => setActiveId(loc.id)}
                      onMouseLeave={() => setActiveId(null)}
                      className={`group rounded-xl border overflow-hidden transition-all cursor-pointer ${
                        activeId === loc.id
                          ? "border-gold shadow-[0_0_0_1px_var(--color-gold)]"
                          : "border-border hover:border-gold/50"
                      }`}
                    >
                      <Link href={`/locations/${loc.id}`} className="block bg-bg-secondary hover:bg-bg-elevated transition-colors">
                        <div className="relative aspect-video overflow-hidden bg-bg-elevated">
                          {loc.image
                            ? <Image src={loc.image} alt={loc.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" style={{ objectPosition: loc.focalPoint ? `${loc.focalPoint.x}% ${loc.focalPoint.y}%` : "50% 50%" }} sizes="420px" />
                            : <div className="w-full h-full flex items-center justify-center text-text-muted/30"><MapPin size={32} /></div>
                          }
                          <div className="absolute inset-0 bg-gradient-to-t from-bg-primary/60 to-transparent" />
                          <div className="absolute top-2 left-2 flex gap-1">
                            {loc.isReal && <span className="px-1.5 py-0.5 bg-success text-white text-[10px] font-bold rounded">NEU</span>}
                            {loc.instantBook && <span className="px-1.5 py-0.5 bg-gold text-bg-primary text-[10px] font-bold rounded">Instant</span>}
                          </div>
                          <div className="absolute top-2 right-2 flex items-center gap-1">
                            {loc.verified && <CheckCircle size={14} className="text-success drop-shadow" />}
                            {isSignedIn && (
                              <button type="button" onClick={(e) => handleFavorite(e, loc.id)}
                                className={`w-6 h-6 flex items-center justify-center rounded-full backdrop-blur-sm border transition-all ${favorites.has(loc.id) ? "bg-crimson/20 border-crimson/50 text-crimson-light" : "bg-bg-primary/60 border-border/50 text-text-muted hover:text-crimson-light"}`}>
                                <Heart size={11} className={favorites.has(loc.id) ? "fill-current" : ""} />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="p-3">
                          <h3 className="font-semibold text-text-primary text-sm leading-snug line-clamp-1 mb-0.5">{loc.title}</h3>
                          <p className="text-xs text-text-muted flex items-center gap-1 mb-1.5">
                            <MapPin size={10} /> {loc.city} · {loc.type}
                          </p>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm font-bold text-gold">
                              {listingPriceLabel(loc.price,loc.metadata)}

                            </span>
                          </div>
                          <div className="flex items-center justify-between pt-1.5 border-t border-border/30"
                            onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1 pointer-events-none">
                              {(liveRatings[loc.id]?.count ?? 0) > 0 ? (
                                <>
                                  <span className="text-gold text-[10px] font-bold">{liveRatings[loc.id].avg.toFixed(1)}</span>
                                  {[1,2,3,4,5].map((s) => (
                                    <span key={s} className={`text-[9px] ${s <= Math.round(liveRatings[loc.id].avg) ? "text-gold" : "text-text-muted/30"}`}>★</span>
                                  ))}
                                  <span className="text-[9px] text-text-muted">({liveRatings[loc.id].count})</span>
                                </>
                              ) : (
                                <span className="text-[9px] text-text-muted/60">Noch keine Bewertung</span>
                              )}
                            </div>
                            {eligible.has(loc.id) && !!user && user.id !== loc.ownerId && (
                              <div className="flex">
                                {[1,2,3,4,5].map((star) => (
                                  <button key={star} type="button"
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); void handleRate(loc.id, loc.ownerId, star); }}
                                    className="w-5 h-5 flex items-center justify-center text-xs touch-manipulation transition-transform active:scale-125 hover:scale-110"
                                    style={{ color: star <= (myRatings[loc.id] ?? 0) ? "#d4af37" : "rgba(255,255,255,0.2)" }}>
                                    ★
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </Link>
                    </div>
                  ) : (
                    <Link
                      key={loc.id}
                      href={`/locations/${loc.id}`}
                      suppressHydrationWarning
                      className="browse-card card-hover group overflow-hidden block"
                    >
                      <div className="relative overflow-hidden aspect-video bg-bg-elevated">
                        {loc.image
                          ? <Image src={loc.image} alt={loc.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" style={{ objectPosition: loc.focalPoint ? `${loc.focalPoint.x}% ${loc.focalPoint.y}%` : "50% 50%" }} sizes="(max-width:640px) 100vw,(max-width:1024px) 50vw,33vw" />
                          : <div className="w-full h-full flex items-center justify-center text-text-muted/20"><svg viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg></div>
                        }
                        <div className="absolute inset-0 bg-gradient-to-t from-bg-primary/70 to-transparent" />
                        <div className="absolute top-3 left-3 flex gap-1.5">
                          {loc.instantBook && <span className="px-2 py-0.5 bg-gold text-bg-primary text-xs font-semibold rounded">Instant</span>}
                          {loc.verified && <span className="px-2 py-0.5 bg-bg-primary/80 border border-border text-xs rounded flex items-center gap-1 text-text-secondary"><CheckCircle size={10} className="text-success" /> Verified</span>}
                        </div>
                        {isSignedIn && (
                          <button type="button" onClick={(e) => handleFavorite(e, loc.id)}
                            className={`absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full backdrop-blur-sm border transition-all ${favorites.has(loc.id) ? "bg-crimson/20 border-crimson/50 text-crimson-light" : "bg-bg-primary/60 border-border/50 text-text-muted hover:text-crimson-light"}`}>
                            <Heart size={13} className={favorites.has(loc.id) ? "fill-current" : ""} />
                          </button>
                        )}
                      </div>
                      <div className="p-4">
                        <h3 className="font-semibold text-text-primary text-sm mb-1">{loc.title}</h3>
                        <p className="text-xs text-text-muted mb-2 flex items-center gap-1"><MapPin size={11} /> {loc.city}</p>
                        <div className="flex items-center justify-between pt-2 border-t border-border mb-1.5">
                          <span className="text-xs text-text-muted">{loc.type}</span>
                          <span className="text-sm font-bold text-gold">{listingPriceLabel(loc.price,loc.metadata)}</span>
                        </div>
                        <div className="flex items-center justify-between pt-1.5 border-t border-border/30"
                          onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1 pointer-events-none">
                            {(liveRatings[loc.id]?.count ?? 0) > 0 ? (
                              <>
                                <span className="text-gold text-[10px] font-bold">{liveRatings[loc.id].avg.toFixed(1)}</span>
                                {[1,2,3,4,5].map((s) => (
                                  <span key={s} className={`text-[9px] ${s <= Math.round(liveRatings[loc.id].avg) ? "text-gold" : "text-text-muted/30"}`}>★</span>
                                ))}
                                <span className="text-[9px] text-text-muted">({liveRatings[loc.id].count})</span>
                              </>
                            ) : (
                              <span className="text-[9px] text-text-muted/60">Noch keine Bewertung</span>
                            )}
                          </div>
                          {eligible.has(loc.id) && !!user && user.id !== loc.ownerId && (
                            <div className="flex">
                              {[1,2,3,4,5].map((star) => (
                                <button key={star} type="button"
                                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); void handleRate(loc.id, loc.ownerId, star); }}
                                  className="w-5 h-5 flex items-center justify-center text-xs touch-manipulation transition-transform active:scale-125 hover:scale-110"
                                  style={{ color: star <= (myRatings[loc.id] ?? 0) ? "#d4af37" : "rgba(255,255,255,0.2)" }}>
                                  ★
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </Link>
                  )
                ))}
              </div>
            )}

            {visibleCount < filtered.length && (
              <div className="p-4 text-center">
                <button
                  onClick={showMore}
                  className="px-6 py-2.5 bg-bg-secondary border border-border rounded-lg text-sm text-text-secondary hover:border-gold hover:text-gold transition-colors"
                >
                  {t("loadMore", { count: filtered.length - visibleCount })}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── MAP PANEL ── */}
        {viewMode !== "list" && (
          <div className={`flex-1 p-3 bg-bg-primary ${viewMode === "split" ? "hidden sm:block" : ""}`}>
            <LocationMap
              locations={filtered}
              activeId={activeId}
              onHover={setActiveId}
              userLocation={userLocation}
              radiusKm={radiusKm}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function LocationsContent({ serverListings }: { serverListings: Location[] }) {
  return (
    <Suspense fallback={<div className="pt-16 min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" /></div>}>
      <LocationsInner serverListings={serverListings} />
    </Suspense>
  );
}
