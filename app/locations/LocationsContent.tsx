"use client";

import { useState, useMemo, useEffect, useRef, useCallback, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import dynamicImport from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import {
  MapPin, Star, CheckCircle, Search, Zap, LayoutList,
  Map, Navigation, SlidersHorizontal, X, Share2, Film,
} from "lucide-react";
import EmptyState from "@/components/EmptyState";
const LocationMap = dynamicImport(() => import("@/components/LocationMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-bg-secondary flex items-center justify-center rounded-xl border border-border">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-text-muted text-sm">Loading map...</p>
      </div>
    </div>
  ),
});

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
  description?: string;
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
  const searchParams = useSearchParams();

  const allLocations = useMemo(() => serverListings, [serverListings]);

  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [activeType, setActiveType] = useState(() => searchParams.get("type") ?? "All Types");
  const [instantOnly, setInstantOnly] = useState(() => searchParams.get("instant") === "1");
  const [verifiedOnly, setVerifiedOnly] = useState(() => searchParams.get("verified") === "1");
  const [minPrice, setMinPrice] = useState(() => searchParams.get("min") ?? "");
  const [maxPrice, setMaxPrice] = useState(() => searchParams.get("max") ?? "");
  const [lageFilter, setLageFilter] = useState(() => searchParams.get("lage") ?? "Alle");
  const [powerOnly, setPowerOnly] = useState(() => searchParams.get("power") === "1");
  const [sortKey, setSortKey] = useState(() => searchParams.get("sort") ?? "featured");
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [radiusKm, setRadiusKm] = useState(50);
  const [copied, setCopied] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const listRef = useRef<HTMLDivElement>(null);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const updateURL = useCallback((overrides: Record<string, string> = {}) => {
    const params = new URLSearchParams();
    const current = { q: query, type: activeType, instant: instantOnly ? "1" : "", verified: verifiedOnly ? "1" : "", min: minPrice, max: maxPrice, sort: sortKey, lage: lageFilter, power: powerOnly ? "1" : "", ...overrides };
    if (current.q) params.set("q", current.q);
    if (current.type && current.type !== "All Types") params.set("type", current.type);
    if (current.instant === "1") params.set("instant", "1");
    if (current.verified === "1") params.set("verified", "1");
    if (current.min) params.set("min", current.min);
    if (current.max) params.set("max", current.max);
    if (current.sort && current.sort !== "featured") params.set("sort", current.sort);
    const qs = params.toString();
    router.replace(qs ? `/locations?${qs}` : "/locations", { scroll: false });
  }, [query, activeType, instantOnly, verifiedOnly, minPrice, maxPrice, sortKey, router]);

  void updateURL;

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
        if (!l.description) return true;
        const { lage } = parseLocationMeta(l.description);
        if (!lage) return true; // no meta = legacy listing, include
        if (lageFilter === "Innen") return lage === "Innen" || lage === "Innen & Außen";
        if (lageFilter === "Außen") return lage === "Außen" || lage === "Innen & Außen";
        if (lageFilter === "Innen & Außen") return lage === "Innen & Außen";
        return true;
      });
    }
    if (powerOnly) {
      result = result.filter((l) => {
        if (!l.description) return true;
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
  }, [serverListings, query, activeType, instantOnly, verifiedOnly, minPrice, maxPrice, sortKey, userLocation, radiusKm]);

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation not supported by your browser.");
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
        setLocationError("Standort konnte nicht ermittelt werden. Bitte Zugriff erlauben.");
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

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [filtered]);

  const resetFilters = () => {
    setQuery(""); setActiveType("All Types");
    setInstantOnly(false); setVerifiedOnly(false);
    setMinPrice(""); setMaxPrice("");
    setLageFilter("Alle"); setPowerOnly(false);
    setUserLocation(null);
    router.replace("/locations", { scroll: false });
  };

  // Sync URL with filters
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (activeType !== "All Types") params.set("type", activeType);
      if (instantOnly) params.set("instant", "1");
      if (verifiedOnly) params.set("verified", "1");
      if (minPrice) params.set("min", minPrice);
      if (maxPrice) params.set("max", maxPrice);
      if (lageFilter !== "Alle") params.set("lage", lageFilter);
      if (powerOnly) params.set("power", "1");
      if (sortKey !== "featured") params.set("sort", sortKey);
      const qs = params.toString();
      router.replace(qs ? `/locations?${qs}` : "/locations", { scroll: false });
    }, 300);
    return () => clearTimeout(timer);
  }, [query, activeType, instantOnly, verifiedOnly, minPrice, maxPrice, lageFilter, powerOnly, sortKey, router]);

  const hasActiveFilters = query || activeType !== "All Types" || instantOnly || verifiedOnly || minPrice || maxPrice || userLocation || lageFilter !== "Alle" || powerOnly;

  return (
    <div className="pt-16 min-h-screen flex flex-col h-screen">
      {/* ── TOP BAR ── */}
      <div className="bg-bg-secondary border-b border-border py-3 px-4 shrink-0">
        <div className="max-w-full mx-auto space-y-2">

          {/* Row 1: Search + View toggle */}
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="flex-1 flex items-center gap-2 bg-bg-elevated border border-border rounded-lg px-3 focus-within:border-gold transition-colors">
              <Search size={15} className="text-text-muted shrink-0" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Stadt, Location-Name oder Typ..."
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
                { mode: "list" as ViewMode, icon: LayoutList, label: "Liste" },
                { mode: "split" as ViewMode, icon: MapPin, label: "Karte+Liste", hideOnMobile: true },
                { mode: "map" as ViewMode, icon: Map, label: "Karte" },
              ]).map(({ mode, icon: Icon, label, hideOnMobile }) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  title={label}
                  className={`${hideOnMobile ? "hidden sm:flex" : "flex"} items-center gap-1.5 px-2.5 py-2.5 text-xs font-medium transition-all border-r border-border last:border-r-0 ${
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
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
            {/* Locate me */}
            <button
              onClick={userLocation ? clearLocation : handleLocateMe}
              disabled={locating}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-all shrink-0 ${
                userLocation
                  ? "bg-gold text-bg-primary border-gold"
                  : "border-border text-text-secondary hover:border-gold hover:text-gold"
              }`}
            >
              <Navigation size={13} className={locating ? "animate-spin" : ""} />
              {locating ? "Suche..." : userLocation ? "Nähe ✓" : "In meiner Nähe"}
            </button>

            {/* Radius */}
            {userLocation && (
              <div className="flex items-center gap-2 bg-bg-elevated border border-gold/30 rounded-lg px-3 py-1.5 shrink-0">
                <span className="text-xs text-text-muted">Radius:</span>
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
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-all shrink-0 ${
                showFilters || hasActiveFilters
                  ? "border-gold text-gold"
                  : "border-border text-text-secondary hover:border-gold hover:text-gold"
              }`}
            >
              <SlidersHorizontal size={13} />
              Filter
              {hasActiveFilters && (
                <span className="w-4 h-4 bg-gold text-bg-primary text-[10px] rounded-full flex items-center justify-center font-bold">!</span>
              )}
            </button>

            {/* Share */}
            <button
              onClick={handleCopyLink}
              title="Copy shareable link"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-border text-text-secondary hover:border-gold hover:text-gold transition-all shrink-0"
            >
              <Share2 size={13} /> {copied ? "Kopiert!" : "Teilen"}
            </button>

            {/* Non-filmmaker CTA */}
            <Link
              href="/sign-up"
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-dashed border-border text-text-muted hover:border-gold hover:text-gold transition-all shrink-0"
            >
              <Film size={12} /> Location inserieren
            </Link>
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
                  {["Alle", "Innen", "Außen", "Innen & Außen"].map((opt) => (
                    <button key={opt} onClick={() => setLageFilter(opt)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${
                        lageFilter === opt ? "bg-gold text-bg-primary border-gold" : "border-border text-text-secondary hover:border-gold hover:text-gold"
                      }`}>
                      {opt}
                    </button>
                  ))}
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer text-xs text-text-secondary">
                  <input type="checkbox" className="accent-gold" checked={powerOnly} onChange={(e) => setPowerOnly(e.target.checked)} />
                  <Zap size={11} className="text-gold" /> Strom vorhanden
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-xs text-text-secondary">
                  <input type="checkbox" className="accent-gold" checked={instantOnly} onChange={(e) => setInstantOnly(e.target.checked)} />
                  <Zap size={11} className="text-gold" /> Sofortbuchung
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-xs text-text-secondary">
                  <input type="checkbox" className="accent-gold" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} />
                  <CheckCircle size={11} className="text-success" /> Verifiziert
                </label>

                <select value={sortKey} onChange={(e) => setSortKey(e.target.value)} className="text-xs py-1.5 px-2 bg-bg-elevated border border-border rounded-lg text-text-secondary">
                  <option value="featured">Empfohlen</option>
                  <option value="price-asc">Preis ↑</option>
                  <option value="price-desc">Preis ↓</option>
                  <option value="rating">Beste Bewertung</option>
                </select>

                {hasActiveFilters && (
                  <button onClick={resetFilters} className="text-xs text-crimson-light hover:text-crimson flex items-center gap-1 transition-colors">
                    <X size={12} /> Zurücksetzen
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
            className={`overflow-y-auto ${viewMode === "split" ? "w-full sm:w-[420px] shrink-0 sm:border-r border-border" : "flex-1"}`}
          >
            <div className="sticky top-0 z-10 bg-bg-primary/90 backdrop-blur-nav border-b border-border px-4 py-2.5 flex items-center justify-between">
              <p className="text-xs text-text-muted">
                <span className="text-text-primary font-semibold">{filtered.length}</span> {filtered.length !== 1 ? "Drehorte" : "Drehort"}
                {userLocation && <span className="text-gold"> im Umkreis von {radiusKm} km</span>}
                {query && <span className="text-gold"> für &ldquo;{query}&rdquo;</span>}
              </p>
            </div>

            {filtered.length === 0 ? (
              <EmptyState
                icon={Film}
                title="Keine Drehorte gefunden"
                description={userLocation ? "Keine Drehorte in diesem Umkreis — vergrößere den Radius oder entferne Filter." : "Versuche eine andere Suche oder entferne aktive Filter."}
                action={{ label: "Filter zurücksetzen", onClick: resetFilters }}
              />
            ) : (
              <div className={`p-3 ${viewMode === "list" ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-6" : "space-y-2"}`}>
                {filtered.slice(0, visibleCount).map((loc) => (
                  viewMode === "split" ? (
                    <div
                      key={loc.id}
                      data-id={loc.id}
                      onMouseEnter={() => setActiveId(loc.id)}
                      onMouseLeave={() => setActiveId(null)}
                      className={`group rounded-xl border overflow-hidden transition-all cursor-pointer ${
                        activeId === loc.id
                          ? "border-gold shadow-gold"
                          : "border-border hover:border-gold/50"
                      }`}
                    >
                      <Link href={`/locations/${loc.id}`} className="flex gap-3 p-3 bg-bg-secondary hover:bg-bg-elevated transition-colors">
                        <div className="relative w-20 h-20 rounded-lg overflow-hidden shrink-0">
                          <Image src={loc.image} alt={loc.title} fill className="object-cover group-hover:scale-110 transition-transform duration-500" sizes="300px" />
                          {loc.isReal && (
                            <div className="absolute top-1 left-1 bg-success text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                              NEU
                            </div>
                          )}
                          {loc.instantBook && (
                            <div className="absolute bottom-0 left-0 right-0 bg-gold text-bg-primary text-xs text-center py-0.5 font-semibold">
                              Instant
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-1 mb-0.5">
                            <h3 className="font-semibold text-text-primary text-sm leading-snug line-clamp-1">{loc.title}</h3>
                            {loc.verified && <CheckCircle size={12} className="text-success shrink-0 mt-0.5" />}
                          </div>
                          <p className="text-xs text-text-muted flex items-center gap-1 mb-1.5">
                            <MapPin size={10} /> {loc.city}
                          </p>
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <Star size={11} className="text-gold fill-gold" />
                            <span className="text-xs text-text-secondary">{loc.rating}</span>
                            <span className="text-xs text-text-muted">({loc.reviews})</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-text-muted">{loc.sqft.toLocaleString()} sqft</span>
                            <span className="text-sm font-bold text-gold">
                              ${loc.price.toLocaleString()}
                              <span className="text-text-muted font-normal text-xs">/{loc.priceUnit}</span>
                            </span>
                          </div>
                        </div>
                      </Link>
                    </div>
                  ) : (
                    <Link
                      key={loc.id}
                      href={`/locations/${loc.id}`}
                      suppressHydrationWarning
                      className="card-hover group rounded-xl border border-border bg-bg-secondary overflow-hidden block"
                    >
                      <div className="relative overflow-hidden aspect-video">
                        <Image src={loc.image} alt={loc.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" sizes="(max-width:640px) 100vw,(max-width:1024px) 50vw,33vw" />
                        <div className="absolute inset-0 bg-gradient-to-t from-bg-primary/70 to-transparent" />
                        <div className="absolute top-3 left-3 flex gap-1.5">
                          {loc.instantBook && <span className="px-2 py-0.5 bg-gold text-bg-primary text-xs font-semibold rounded">Instant</span>}
                          {loc.verified && <span className="px-2 py-0.5 bg-bg-primary/80 border border-border text-xs rounded flex items-center gap-1 text-text-secondary"><CheckCircle size={10} className="text-success" /> Verified</span>}
                        </div>
                      </div>
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="font-semibold text-text-primary text-sm">{loc.title}</h3>
                          <div className="flex items-center gap-1 shrink-0">
                            <Star size={11} className="text-gold fill-gold" />
                            <span className="text-xs text-text-secondary">{loc.rating}</span>
                          </div>
                        </div>
                        <p className="text-xs text-text-muted mb-3 flex items-center gap-1"><MapPin size={11} /> {loc.city}</p>
                        <div className="flex items-center justify-between pt-3 border-t border-border">
                          <span className="text-xs text-text-muted">{loc.type}</span>
                          <span className="text-sm font-bold text-gold">${loc.price.toLocaleString()}<span className="text-text-muted font-normal text-xs">/{loc.priceUnit}</span></span>
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
                  onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
                  className="px-6 py-2.5 bg-bg-secondary border border-border rounded-lg text-sm text-text-secondary hover:border-gold hover:text-gold transition-colors"
                >
                  Mehr laden · {filtered.length - visibleCount} weitere Drehorte
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
