"use client";

import React, { useState, useMemo, useEffect, useRef, Suspense } from "react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Search, Package, X, Truck, MapPin, ChevronDown,
  LayoutGrid, List, CheckCircle, ArrowUpDown, Plus,
  Camera, Lightbulb, Wrench, Mic, Shirt, Sparkles, Layers, Car, Zap,
  Monitor, Building2, Briefcase, Palette, Scissors, Users,
} from "lucide-react";
import { useTranslations } from "next-intl";
import EmptyState from "@/components/EmptyState";
import { DEPARTMENTS, SEARCH_SYNONYMS, deptValues } from "@/lib/marketplaceCategories";
import { deptColors } from "@/lib/departments";

// ── Icon maps ─────────────────────────────────────────────────────
const DEPT_ICON_MAP: Record<string, LucideIcon> = {
  kamera:               Camera,
  licht:                Lightbulb,
  grip:                 Wrench,
  ton:                  Mic,
  kostuem:              Shirt,
  maske:                Sparkles,
  requisiten:           Package,
  szenenbild:           Palette,
  fahrzeuge:            Car,
  sfx:                  Zap,
  "virtual-production": Monitor,
  post:                 Scissors,
  studio:               Building2,
  produktion:           Briefcase,
};

const PAGE_SIZE = 24;

type Prop = {
  id: string; title: string; category: string; vendor: string; location: string;
  dailyRate: number; image: string; condition: string; era: string | null;
  delivery: boolean; rentalType?: "miete" | "kauf"; focalPoint?: { x: number; y: number } | null;
  description?: string; isReal?: boolean; type?: string; meta?: Record<string, unknown> | null;
  ownerId?: string;
};

type RatingData = { avg: number; count: number } | undefined;

// ─── SortDropdown ────────────────────────────────────────────────
function SortDropdown({ value, options, onChange }: {
  value: string; options: { value: string; label: string }[]; onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  const label = options.find((o) => o.value === value)?.label ?? "Sortierung";
  return (
    <div ref={ref} className="relative shrink-0">
      <button onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 h-9 px-3 rounded-lg text-xs font-medium border border-border text-text-muted hover:text-text-secondary transition-all bg-bg-elevated">
        <ArrowUpDown size={11} />
        {label}
        <ChevronDown size={11} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-bg-elevated border border-border rounded-xl shadow-xl overflow-hidden min-w-[160px]">
          {options.map((o) => (
            <button key={o.value} onClick={() => { onChange(o.value); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-white/[0.04] ${value === o.value ? "text-gold font-medium" : "text-text-secondary"}`}>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Prop card ────────────────────────────────────────────────────

function PropCard({ p, list, ratingData, myRating, onRate, canRate }: {
  p: Prop; list?: boolean;
  ratingData?: RatingData; myRating?: number;
  onRate?: (star: number) => void; canRate?: boolean;
}) {
  const tc = useTranslations("common");
  const tp = useTranslations("props");
  const href = p.type === "vehicle" ? `/vehicles/${p.id}` : `/props/${p.id}`;

  if (list) {
    return (
      <Link href={href}
        suppressHydrationWarning
        className="card-hover group flex items-center gap-4 p-3 rounded-xl border border-border bg-bg-secondary"
        data-visible>
        <div className="relative w-20 h-20 rounded-lg overflow-hidden shrink-0 bg-bg-elevated border border-border">
          {p.image
            ? <img src={p.image} alt={p.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" style={{ objectPosition: p.focalPoint ? `${p.focalPoint.x}% ${p.focalPoint.y}%` : "50% 66%" }} />
            : <div className="w-full h-full flex items-center justify-center text-text-muted/30"><svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg></div>
          }
          {p.isReal && <div className="absolute top-1 left-1 bg-gold text-bg-primary text-[9px] font-bold px-1.5 py-0.5 rounded">NEU</div>}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-text-primary text-sm mb-1 truncate">{p.title}</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-text-muted flex items-center gap-1"><MapPin size={9} />{p.location || p.vendor}</span>
            <span className="text-[10px] px-2 py-0.5 bg-bg-elevated border border-border text-text-muted rounded-full">{p.category}</span>
            {p.delivery && <span className="text-[10px] text-teal-400 flex items-center gap-0.5"><Truck size={9} /> {tp("deliveryBadge")}</span>}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-bold text-gold">
            {p.dailyRate > 0 ? `${p.dailyRate.toLocaleString()} €` : tc("onRequest")}
            {p.dailyRate > 0 && <span className="text-text-muted font-normal text-xs"> {tc("perDay")}</span>}
          </p>
          <p className="text-[10px] text-text-muted mt-0.5">{p.condition}</p>
        </div>
      </Link>
    );
  }

  return (
    <Link href={href}
      suppressHydrationWarning
      className="card-hover group rounded-xl border border-border bg-bg-secondary overflow-hidden block"
      data-visible>
      <div className="relative aspect-[4/3] overflow-hidden bg-bg-elevated">
        {p.image
          ? <img src={p.image} alt={p.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" style={{ objectPosition: p.focalPoint ? `${p.focalPoint.x}% ${p.focalPoint.y}%` : "50% 66%" }} />
          : <div className="w-full h-full flex items-center justify-center text-text-muted/20"><svg viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg></div>
        }
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-start justify-between gap-1">
          <span className="px-2 py-0.5 bg-black/50 backdrop-blur-sm border border-white/10 text-white/70 text-[10px] rounded-full truncate max-w-[65%]">{p.category}</span>
          <div className="flex gap-1 shrink-0">
            {p.isReal && <span className="px-2 py-0.5 bg-gold text-bg-primary text-[10px] font-bold rounded-full">NEU</span>}
            {p.delivery && <span className="flex items-center gap-0.5 px-2 py-0.5 bg-teal-500/25 backdrop-blur-sm border border-teal-400/30 text-teal-300 text-[10px] rounded-full"><Truck size={8} /></span>}
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="font-semibold text-white text-sm line-clamp-1 mb-1.5">{p.title}</h3>
          <div className="flex items-center justify-between">
            <p className="text-white/50 text-xs flex items-center gap-1 truncate mr-2"><MapPin size={9} className="shrink-0" />{p.location || p.vendor}</p>
            {p.dailyRate > 0
              ? <p className="text-gold font-bold text-sm shrink-0">{p.dailyRate.toLocaleString()} €<span className="text-white/40 font-normal text-[10px]"> {tc("perDay")}</span></p>
              : <p className="text-white/50 text-xs shrink-0">{tc("onRequest")}</p>}
          </div>
        </div>
      </div>
      <div className="px-3 py-2 border-t border-border/50">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-text-muted">{p.condition}</span>
          {p.era && <span className="text-[10px] text-gold/70">{p.era}</span>}
          <span className="text-[10px] text-text-muted group-hover:text-gold transition-colors">{tp("detailsArrow")}</span>
        </div>
        {/* Rating strip */}
        <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-border/30"
          onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-1 pointer-events-none">
            {ratingData && ratingData.count > 0 ? (
              <>
                <span className="text-gold text-[10px] font-bold">{ratingData.avg.toFixed(1)}</span>
                {[1,2,3,4,5].map((s) => (
                  <span key={s} className={`text-[9px] ${s <= Math.round(ratingData.avg) ? "text-gold" : "text-text-muted/30"}`}>★</span>
                ))}
                <span className="text-[9px] text-text-muted">({ratingData.count})</span>
              </>
            ) : (
              <span className="text-[9px] text-text-muted/60">Noch keine Bewertung</span>
            )}
          </div>
          {canRate && (
            <div className="flex">
              {[1,2,3,4,5].map((star) => (
                <button key={star} type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRate?.(star); }}
                  className="w-5 h-5 flex items-center justify-center text-xs touch-manipulation transition-transform active:scale-125 hover:scale-110"
                  style={{ color: star <= (myRating ?? 0) ? "#d4af37" : "rgba(255,255,255,0.2)" }}>
                  ★
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

// ─── Main ─────────────────────────────────────────────────────────

function PropsInner({ serverListings }: { serverListings: Prop[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("props");
  const { user } = useUser();

  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [selectedDept, setSelectedDept] = useState<string | null>(() => searchParams.get("dept") ?? null);
  const [rentalTypeFilter, setRentalTypeFilter] = useState<"alle" | "miete" | "kauf">("alle");
  const [sortKey, setSortKey] = useState("featured");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [liveRatings, setLiveRatings] = useState<Record<string, { avg: number; count: number }>>({});
  const [myRatings, setMyRatings] = useState<Record<string, number>>({});

  // Batch-fetch listing ratings
  useEffect(() => {
    const ids = serverListings.map(l => l.id).join(",");
    if (!ids) return;
    fetch(`/api/listing-ratings?ids=${ids}`)
      .then(r => r.json())
      .then(({ ratings, myRatings: my }) => {
        setLiveRatings(ratings ?? {});
        setMyRatings(my ?? {});
      })
      .catch(() => {});
  }, [serverListings]);

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

  // Sync URL
  useEffect(() => {
    const timer = setTimeout(() => {
      const p = new URLSearchParams();
      if (query) p.set("q", query);
      if (selectedDept) p.set("dept", selectedDept);
      if (sortKey !== "featured") p.set("sort", sortKey);
      const qs = p.toString();
      router.replace(qs ? `/props?${qs}` : "/props", { scroll: false });
    }, 300);
    return () => clearTimeout(timer);
  }, [query, selectedDept, sortKey, router]);

  const filtered = useMemo(() => {
    let r = [...serverListings];

    if (selectedDept) {
      const dept = DEPARTMENTS.find((d) => d.id === selectedDept);
      if (dept) {
        const vals = deptValues(dept).map((v) => v.toLowerCase());
        r = r.filter((p) => vals.includes(p.category?.toLowerCase() ?? ""));
      }
    }

    if (rentalTypeFilter !== "alle") {
      r = r.filter((p) => (p.rentalType ?? "miete") === rentalTypeFilter);
    }

    if (query.trim()) {
      const q = query.toLowerCase().trim();
      const words = q.split(/\s+/);
      const synonymCats = words.flatMap((w) => SEARCH_SYNONYMS[w] ?? []);
      r = r.filter((p) => {
        const title = p.title.toLowerCase();
        const cat = p.category?.toLowerCase() ?? "";
        const loc = p.location?.toLowerCase() ?? "";
        if (title.includes(q) || cat.includes(q) || loc.includes(q)) return true;
        if (synonymCats.length > 0 && synonymCats.some((sc) => cat === sc)) return true;
        return false;
      });
    }

    if (sortKey === "price-asc") r.sort((a, b) => a.dailyRate - b.dailyRate);
    if (sortKey === "price-desc") r.sort((a, b) => b.dailyRate - a.dailyRate);
    return r;
  }, [serverListings, selectedDept, query, rentalTypeFilter, sortKey]);

  useEffect(() => setVisibleCount(PAGE_SIZE), [filtered]);

  const clearAll = () => {
    setSelectedDept(null); setQuery(""); setSortKey("featured"); setRentalTypeFilter("alle");
    router.replace("/props", { scroll: false });
  };

  const hasAnyFilter = Boolean(selectedDept || query || rentalTypeFilter !== "alle");

  const activeDeptData = selectedDept ? DEPARTMENTS.find((d) => d.id === selectedDept) : null;
  const chipColors = activeDeptData ? deptColors(activeDeptData.color) : null;

  return (
    <div className="min-h-screen">

      {/* ── Filter Bar ───────────────────────────────────────────── */}
      <div className="bg-transparent border-b border-border/30">
        <div className="px-4 py-2 space-y-2">

          {/* Main row */}
          <div className="flex items-center gap-2">

            {/* Search */}
            <div className="flex-1 flex items-center gap-2 bg-bg-elevated border border-border rounded-lg px-3 focus-within:border-gold/50 transition-colors min-w-0">
              <Search size={14} className="text-text-muted shrink-0" />
              <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder={t("searchPlaceholder")}
                className="bg-transparent border-none py-2.5 text-sm w-full focus:outline-none" />
              {query && <button onClick={() => setQuery("")} className="text-text-muted hover:text-text-primary transition-colors shrink-0"><X size={12} /></button>}
            </div>

            {/* Angebotstyp — visible on sm+ */}
            <div className="hidden sm:flex gap-1 shrink-0">
              {(["alle", "miete", "kauf"] as const).map((rt) => (
                <button key={rt} onClick={() => setRentalTypeFilter(rt)}
                  className={`h-9 px-3 rounded-lg text-xs font-medium border transition-all ${
                    rentalTypeFilter === rt
                      ? "bg-gold/12 border-gold/30 text-gold"
                      : "border-border text-text-muted hover:text-text-secondary"
                  }`}>
                  {rt === "alle" ? "Alle" : rt === "miete" ? "Mieten" : "Kaufen"}
                </button>
              ))}
            </div>

            {/* Sort */}
            <SortDropdown
              value={sortKey}
              options={[
                { value: "featured", label: t("sortFeatured") },
                { value: "price-asc", label: t("sortPriceAsc") },
                { value: "price-desc", label: t("sortPriceDesc") },
              ]}
              onChange={setSortKey}
            />

            {/* Grid / List */}
            <div className="flex bg-bg-elevated border border-border rounded-lg overflow-hidden shrink-0">
              <button onClick={() => setViewMode("grid")} className={`flex items-center justify-center w-9 h-9 transition-colors ${viewMode === "grid" ? "bg-gold text-bg-primary" : "text-text-muted hover:text-text-primary"}`}><LayoutGrid size={14} /></button>
              <button onClick={() => setViewMode("list")} className={`flex items-center justify-center w-9 h-9 transition-colors border-l border-border ${viewMode === "list" ? "bg-gold text-bg-primary" : "text-text-muted hover:text-text-primary"}`}><List size={14} /></button>
            </div>
          </div>

          {/* Mobile: Angebotstyp pills */}
          <div className="flex sm:hidden gap-1.5">
            {(["alle", "miete", "kauf"] as const).map((rt) => (
              <button key={rt} onClick={() => setRentalTypeFilter(rt)}
                className={`h-8 px-3 rounded-full text-xs font-medium border transition-all ${
                  rentalTypeFilter === rt
                    ? "bg-gold/12 border-gold/30 text-gold"
                    : "border-border text-text-muted"
                }`}>
                {rt === "alle" ? "Alle" : rt === "miete" ? "Mieten" : "Kaufen"}
              </button>
            ))}
          </div>

          {/* Active chips */}
          {(activeDeptData || rentalTypeFilter !== "alle") && (
            <div className="flex flex-wrap gap-1.5 items-center">
              {activeDeptData && chipColors && (
                <span className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border font-medium ${chipColors.bg} ${chipColors.border} ${chipColors.text}`}>
                  {activeDeptData.label}
                  <button onClick={() => setSelectedDept(null)} className="hover:opacity-70 ml-0.5"><X size={9} /></button>
                </span>
              )}
              {rentalTypeFilter !== "alle" && (
                <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border font-medium bg-gold/10 border-gold/30 text-gold">
                  {rentalTypeFilter === "miete" ? "Mieten" : "Kaufen"}
                  <button onClick={() => setRentalTypeFilter("alle")} className="hover:opacity-70 ml-0.5"><X size={9} /></button>
                </span>
              )}
              <button onClick={clearAll} className="text-[11px] text-text-muted hover:text-red-400 transition-colors underline underline-offset-2 ml-1">
                {t("clearAll")}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Results ──────────────────────────────────────── */}
      <div className="px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-8 items-start">

          {/* Sidebar */}
          <aside className="cat-sidebar w-44 shrink-0 sticky top-20">
            <p className="text-[11px] uppercase tracking-widest text-text-muted font-semibold mb-3 px-2">
              Kategorien
            </p>
            <nav className="space-y-0.5">
              <button
                onClick={() => setSelectedDept(null)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all text-left ${
                  !selectedDept
                    ? "bg-gold/10 text-gold font-semibold border-l-2 border-gold pl-[10px]"
                    : "text-text-secondary hover:text-text-primary hover:bg-bg-secondary"
                }`}
              >
                <Layers size={14} className={!selectedDept ? "text-gold" : "text-text-muted"} />
                Alle Artikel
              </button>
              {DEPARTMENTS.map((dept) => {
                const Icon = DEPT_ICON_MAP[dept.id] ?? Package;
                const isActive = selectedDept === dept.id;
                return (
                  <button
                    key={dept.id}
                    onClick={() => setSelectedDept(isActive ? null : dept.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all text-left ${
                      isActive
                        ? "bg-gold/10 text-gold font-semibold border-l-2 border-gold pl-[10px]"
                        : "text-text-secondary hover:text-text-primary hover:bg-bg-secondary"
                    }`}
                  >
                    <Icon size={14} className={isActive ? "text-gold" : "text-text-muted"} />
                    {dept.label}
                  </button>
                );
              })}
            </nav>
            <div className="mt-6 pt-5 border-t border-border">
              <a href="/inserat?group=marktplatz"
                className="flex items-center gap-2 px-3 py-2 text-sm text-gold hover:bg-gold/10 rounded-lg transition-colors font-medium">
                <Plus size={14} />
                Inserat erstellen
              </a>
            </div>
          </aside>

          {/* Main content */}
          <div className="flex-1 min-w-0">

            {/* Mobile department pills */}
            <div className="cat-pills gap-2 overflow-x-auto pb-3 mb-4" style={{ scrollbarWidth: "none" }}>
              <button onClick={() => setSelectedDept(null)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0 border transition-all ${
                  !selectedDept ? "bg-gold/10 text-gold border-gold/40" : "border-border text-text-muted hover:border-gold/30 hover:text-text-primary"
                }`}>
                Alle
              </button>
              {[...DEPARTMENTS].sort((a, b) => a.label.localeCompare(b.label, "de")).map((dept) => {
                const isActive = selectedDept === dept.id;
                return (
                  <button key={dept.id} onClick={() => setSelectedDept(isActive ? null : dept.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0 border transition-all ${
                      isActive ? "bg-gold/10 text-gold border-gold/40" : "border-border text-text-muted hover:border-gold/30 hover:text-text-primary"
                    }`}>
                    {dept.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between mb-5">
              <p className="text-sm text-text-muted">
                <span className="text-text-primary font-semibold">{t("results", { count: filtered.length })}</span>
                {query && <span className="text-gold"> für &ldquo;{query}&rdquo;</span>}
              </p>
              {hasAnyFilter && (
                <button onClick={clearAll} className="text-xs text-text-muted hover:text-red-400 transition-colors flex items-center gap-1">
                  <X size={11} /> {t("clearAllFilters")}
                </button>
              )}
            </div>

            {filtered.length === 0 ? (
              <EmptyState icon={Package}
                title={serverListings.length === 0 ? t("emptyTitle") : t("emptyTitleFiltered")}
                description={serverListings.length === 0 ? t("emptyDesc") : t("emptyDescFiltered")}
                action={serverListings.length === 0
                  ? { label: t("emptyPost"), onClick: () => { window.location.href = "/inserat?group=marktplatz"; } }
                  : { label: t("emptyReset"), onClick: clearAll }} />
            ) : (
              <>
                <div className={viewMode === "grid"
                  ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                  : "space-y-2"}>
                  {filtered.slice(0, visibleCount).map((p) => (
                    <PropCard key={p.id} p={p} list={viewMode === "list"}
                      ratingData={liveRatings[p.id]}
                      myRating={myRatings[p.id]}
                      canRate={!!user && user.id !== p.ownerId}
                      onRate={(star) => handleRate(p.id, p.ownerId, star)}
                    />
                  ))}
                </div>
                {filtered.length > visibleCount && (
                  <div className="mt-10 text-center">
                    <button onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
                      className="px-8 py-3 border border-border text-sm font-semibold text-text-secondary hover:border-gold hover:text-gold rounded-xl transition-all">
                      {t("loadMore", { count: filtered.length - visibleCount })}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

type VendorProfile = { id: string; name: string; location: string; avatar: string; verified: boolean };

function VendorSection({ vendors }: { vendors: VendorProfile[] }) {
  const t = useTranslations("props");
  if (!vendors.length) return null;
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-10">
      <div className="pt-8 border-t border-border/50">
        <div className="flex items-center gap-2 mb-4">
          <Users size={13} className="text-gold/60" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-text-secondary">{t("vendorSection")}</span>
          <span className="text-[11px] text-text-muted">· {vendors.length}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {vendors.map((v) => (
            <Link key={v.id} href={`/profile/${v.id}`}
              className="group inline-flex items-center gap-2.5 px-3 py-2 rounded-xl border border-border/50 bg-bg-elevated/40 hover:border-gold/40 hover:bg-bg-elevated transition-all duration-200">
              {v.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={v.avatar} alt={v.name} loading="lazy" className="w-8 h-8 rounded-full object-cover border border-border/40 shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-bg-secondary border border-border/40 flex items-center justify-center text-text-muted text-sm font-bold shrink-0">
                  {v.name[0]}
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <p className="text-sm font-semibold text-text-primary whitespace-nowrap group-hover:text-gold transition-colors">{v.name}</p>
                  {v.verified && <CheckCircle size={11} className="text-gold/60 shrink-0" />}
                </div>
                {v.location && <p className="text-[11px] text-text-muted whitespace-nowrap">{v.location.split(",")[0]}</p>}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function PropsContent({ serverListings, vendorProfiles = [] }: { serverListings: Prop[]; vendorProfiles?: VendorProfile[] }) {
  void vendorProfiles;
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" /></div>}>
      <PropsInner serverListings={serverListings} />
    </Suspense>
  );
}
