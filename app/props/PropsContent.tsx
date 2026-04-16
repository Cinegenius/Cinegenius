"use client";

import React, { useState, useMemo, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Search, Package, X, SlidersHorizontal, Truck, MapPin, ChevronDown,
  LayoutGrid, List, Euro, CheckCircle, ArrowUpDown,
  Camera, Lightbulb, Wrench, Mic, Shirt, Sparkles, Layers, Car, Zap,
  Monitor, Building2, Briefcase, Palette, Scissors,
  Home, Utensils, Shield, Wine, FlaskConical, Hotel, ChefHat, HeartPulse,
} from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { DEPARTMENTS, SCENES, SEARCH_SYNONYMS, deptValues, groupValues } from "@/lib/marketplaceCategories";
import { deptColors } from "@/lib/departments";

// ── Icon maps ─────────────────────────────────────────────────────
const ICON_MAP: Record<string, LucideIcon> = {
  Camera, Lightbulb, Wrench, Mic, Shirt, Sparkles, Layers, Car, Zap,
  Monitor, Building2, Briefcase, Palette, Scissors, Package,
};

const SCENE_ICON_MAP: Record<string, LucideIcon> = {
  Home, Utensils, Shield, Wine, FlaskConical, Hotel, ChefHat, HeartPulse,
  Car, Shirt, Briefcase, Package,
};

const PAGE_SIZE = 24;
const CONDITIONS = ["Neuwertig", "Sehr gut", "Gut", "Akzeptabel"];

type Prop = {
  id: string; title: string; category: string; vendor: string; location: string;
  dailyRate: number; image: string; condition: string; era: string | null;
  delivery: boolean; rentalType?: "miete" | "kauf"; description?: string; isReal?: boolean;
  type?: string;
};

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

// ─── FilterDropdown (identical pattern to CreatorsContent) ────────

function FilterDropdown({
  icon: Icon, label, value, options, onChange,
}: {
  icon: React.ElementType; label: string; value: string;
  options: string[]; onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const active = !!value;
  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 h-9 px-3 rounded-lg text-xs font-medium border transition-all ${
          active
            ? "bg-gold/12 border-gold/30 text-gold"
            : open
            ? "bg-bg-elevated border-border text-text-secondary"
            : "border-border text-text-muted hover:text-text-secondary hover:border-border"
        }`}
      >
        <Icon size={11} />
        {active ? value : label}
        {active ? (
          <span onClick={(e) => { e.stopPropagation(); onChange(""); setOpen(false); }} className="hover:text-red-400 transition-colors ml-0.5">
            <X size={10} />
          </span>
        ) : (
          <ChevronDown size={11} className={`transition-transform ${open ? "rotate-180" : ""}`} />
        )}
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-bg-elevated border border-border rounded-xl shadow-xl overflow-hidden min-w-[140px] max-h-64 overflow-y-auto">
          {options.map((opt) => (
            <button key={opt} onClick={() => { onChange(opt); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-white/[0.04] ${
                value === opt ? "text-gold font-medium" : "text-text-secondary"
              }`}>
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Category two-panel ───────────────────────────────────────────

function CategoryPanel({
  activeDeptId, setActiveDeptId,
  selectedDept, selectedGroup, onSelectGroup,
  onClose,
}: {
  activeDeptId: string;
  setActiveDeptId: (id: string) => void;
  selectedDept: string | null;
  selectedGroup: { deptId: string; groupId: string } | null;
  onSelectGroup: (deptId: string, groupId: string | null) => void;
  onClose: () => void;
}) {
  const activeDept = DEPARTMENTS.find((d) => d.id === activeDeptId) ?? DEPARTMENTS[0];
  const colors = deptColors(activeDept.color);

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-bg-elevated">
      {/* Mobile */}
      <div className="sm:hidden">
        <div className="flex overflow-x-auto gap-1.5 p-3 border-b border-border bg-bg-secondary" style={{ scrollbarWidth: "none" }}>
          {DEPARTMENTS.map((dept) => {
            const Icon = ICON_MAP[dept.iconName] ?? Package;
            const c = deptColors(dept.color);
            const isActive = dept.id === activeDeptId;
            const isSelected = dept.id === selectedDept || selectedGroup?.deptId === dept.id;
            return (
              <button key={dept.id}
                onClick={() => { setActiveDeptId(dept.id); onSelectGroup(dept.id, null); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border shrink-0 transition-all ${
                  isSelected ? `${c.bg} ${c.text} border-transparent` : isActive ? `${c.bg} ${c.text} border-transparent` : "border-border text-text-muted"
                }`}>
                <Icon size={11} className={isActive ? c.text : "text-text-muted"} />
                {dept.label}
                {isSelected && <span className={`w-3 h-3 rounded-full flex items-center justify-center text-[8px] font-bold ${c.bg} ${c.text}`}>✓</span>}
              </button>
            );
          })}
        </div>
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className={`text-sm font-semibold ${colors.text}`}>{activeDept.label}</h3>
            {(selectedGroup?.deptId === activeDeptId || selectedDept === activeDeptId) && (
              <button onClick={() => onSelectGroup(activeDeptId, null)} className="text-[10px] text-text-muted hover:text-red-400">Löschen</button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {activeDept.groups.map((group) => {
              const isSelected = selectedGroup?.deptId === activeDeptId && selectedGroup.groupId === group.id;
              return (
                <button key={group.id} onClick={() => { onSelectGroup(activeDeptId, isSelected ? null : group.id); onClose(); }}
                  className={`text-left px-3 py-2.5 rounded-lg text-xs border transition-all ${
                    isSelected ? `${colors.bg} ${colors.border} ${colors.text} font-semibold` : "border-border/60 text-text-muted"
                  }`}>
                  <div className="font-medium">{group.label}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Desktop: two-panel */}
      <div className="hidden sm:flex" style={{ minHeight: 260 }}>
        <div className="w-44 shrink-0 border-r border-border overflow-y-auto bg-bg-secondary">
          {DEPARTMENTS.map((dept) => {
            const Icon = ICON_MAP[dept.iconName] ?? Package;
            const c = deptColors(dept.color);
            const isPreview = dept.id === activeDeptId;
            const isSelected = dept.id === selectedDept || selectedGroup?.deptId === dept.id;
            return (
              <button key={dept.id}
                onMouseEnter={() => setActiveDeptId(dept.id)}
                onClick={() => { setActiveDeptId(dept.id); onSelectGroup(dept.id, null); }}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-left text-xs transition-colors border-b border-border/40 last:border-0 ${
                  isPreview ? `${c.bg} ${c.text} font-semibold` : "text-text-muted hover:text-text-secondary hover:bg-white/[0.02]"
                }`}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={`w-6 h-6 rounded-md border flex items-center justify-center shrink-0 ${isPreview ? `${c.bg} ${c.border}` : "bg-bg-elevated border-border"}`}>
                    <Icon size={11} className={isPreview ? c.text : "text-text-muted"} />
                  </span>
                  <span className="truncate">{dept.label}</span>
                </div>
                {isSelected && <span className={`text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${c.bg} border ${c.border} ${c.text}`}>✓</span>}
              </button>
            );
          })}
        </div>
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className={`text-sm font-semibold ${colors.text}`}>{activeDept.label}</h3>
            {(selectedGroup?.deptId === activeDeptId || selectedDept === activeDeptId) && (
              <button onClick={() => onSelectGroup(activeDeptId, null)} className="text-[10px] text-text-muted hover:text-red-400 transition-colors">Auswahl löschen</button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {activeDept.groups.map((group) => {
              const isSelected = selectedGroup?.deptId === activeDeptId && selectedGroup.groupId === group.id;
              return (
                <button key={group.id} onClick={() => { onSelectGroup(activeDeptId, isSelected ? null : group.id); onClose(); }}
                  className={`text-left px-3 py-2.5 rounded-lg text-xs border transition-all ${
                    isSelected ? `${colors.bg} ${colors.border} ${colors.text} font-semibold` : "border-border/60 text-text-muted hover:text-text-secondary hover:border-border hover:bg-white/[0.02]"
                  }`}>
                  <div className="font-medium mb-0.5">{group.label}</div>
                  <div className="text-[10px] opacity-60">{group.items.length} Typen</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Prop card ────────────────────────────────────────────────────

function PropCard({ p, list }: { p: Prop; list?: boolean }) {
  const href = p.type === "vehicle" ? `/vehicles/${p.id}` : `/props/${p.id}`;

  if (list) {
    return (
      <Link href={href}
        suppressHydrationWarning
        className="card-hover group flex items-center gap-4 p-3 rounded-xl border border-border bg-bg-secondary"
        data-visible>
        <div className="relative w-20 h-20 rounded-lg overflow-hidden shrink-0 bg-bg-elevated border border-border">
          {p.image
            ? <img src={p.image} alt={p.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            : <div className="w-full h-full flex items-center justify-center text-text-muted/30"><svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg></div>
          }
          {p.isReal && <div className="absolute top-1 left-1 bg-gold text-bg-primary text-[9px] font-bold px-1.5 py-0.5 rounded">NEU</div>}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-text-primary text-sm mb-1 truncate">{p.title}</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-text-muted flex items-center gap-1"><MapPin size={9} />{p.location || p.vendor}</span>
            <span className="text-[10px] px-2 py-0.5 bg-bg-elevated border border-border text-text-muted rounded-full">{p.category}</span>
            {p.delivery && <span className="text-[10px] text-teal-400 flex items-center gap-0.5"><Truck size={9} /> Lieferung</span>}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-bold text-gold">
            {p.dailyRate > 0 ? `${p.dailyRate.toLocaleString()} €` : "Auf Anfrage"}
            {p.dailyRate > 0 && <span className="text-text-muted font-normal text-xs"> /Tag</span>}
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
          ? <img src={p.image} alt={p.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
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
              ? <p className="text-gold font-bold text-sm shrink-0">{p.dailyRate.toLocaleString()} €<span className="text-white/40 font-normal text-[10px]"> /Tag</span></p>
              : <p className="text-white/50 text-xs shrink-0">Auf Anfrage</p>}
          </div>
        </div>
      </div>
      <div className="px-3 py-2 flex items-center justify-between border-t border-border/50">
        <span className="text-[10px] text-text-muted">{p.condition}</span>
        {p.era && <span className="text-[10px] text-gold/70">{p.era}</span>}
        <span className="text-[10px] text-text-muted group-hover:text-gold transition-colors">Details →</span>
      </div>
    </Link>
  );
}

// ─── Main ─────────────────────────────────────────────────────────

function PropsInner({ serverListings }: { serverListings: Prop[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [selectedDept, setSelectedDept] = useState<string | null>(() => searchParams.get("dept") ?? null);
  const [selectedGroup, setSelectedGroup] = useState<{ deptId: string; groupId: string } | null>(() => {
    const d = searchParams.get("dept"); const g = searchParams.get("group");
    return d && g ? { deptId: d, groupId: g } : null;
  });
  const [selectedScene, setSelectedScene] = useState<string | null>(() => searchParams.get("scene") ?? null);
  const [activePanelDept, setActivePanelDept] = useState(DEPARTMENTS[0].id);
  const [panelOpen, setPanelOpen] = useState(false);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [rentalTypeFilter, setRentalTypeFilter] = useState<"alle" | "miete" | "kauf">("alle");
  const [locationFilter, setLocationFilter] = useState("");
  const [conditionFilter, setConditionFilter] = useState("");
  const [deliveryOnly, setDeliveryOnly] = useState(false);
  const [minRate, setMinRate] = useState("");
  const [maxRate, setMaxRate] = useState("");
  const [sortKey, setSortKey] = useState("featured");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Sync URL
  useEffect(() => {
    const t = setTimeout(() => {
      const p = new URLSearchParams();
      if (query) p.set("q", query);
      if (selectedScene) p.set("scene", selectedScene);
      if (selectedGroup) { p.set("dept", selectedGroup.deptId); p.set("group", selectedGroup.groupId); }
      else if (selectedDept) p.set("dept", selectedDept);
      if (conditionFilter) p.set("cond", conditionFilter);
      if (deliveryOnly) p.set("delivery", "1");
      if (minRate) p.set("min", minRate);
      if (maxRate) p.set("max", maxRate);
      if (sortKey !== "featured") p.set("sort", sortKey);
      const qs = p.toString();
      router.replace(qs ? `/props?${qs}` : "/props", { scroll: false });
    }, 300);
    return () => clearTimeout(t);
  }, [query, selectedScene, selectedDept, selectedGroup, conditionFilter, deliveryOnly, minRate, maxRate, sortKey, router]);

  // Available locations derived from real data
  const availableLocations = useMemo(() => {
    const cities = serverListings.map((p) => p.location?.split(",")[0]?.trim()).filter(Boolean) as string[];
    return [...new Set(cities)].sort();
  }, [serverListings]);

  const filtered = useMemo(() => {
    let r = [...serverListings];

    // ── Szenen-Filter ─────────────────────────────────────────────
    if (selectedScene) {
      const scene = SCENES.find((s) => s.id === selectedScene);
      if (scene) {
        const sceneVals = scene.keywords.map((k) => k.toLowerCase());
        r = r.filter((p) => sceneVals.includes(p.category?.toLowerCase() ?? ""));
      }
    }

    // ── Kategorie-Filter (dept / group) — exakter Match ──────────
    if (!selectedScene) {
      if (selectedGroup) {
        const dept = DEPARTMENTS.find((d) => d.id === selectedGroup.deptId);
        const group = dept?.groups.find((g) => g.id === selectedGroup.groupId);
        if (group) {
          const groupVals = groupValues(group).map((v) => v.toLowerCase());
          const legacyVals = (dept?.legacyValues ?? []).map((v) => v.toLowerCase());
          r = r.filter((p) => {
            const cat = p.category?.toLowerCase() ?? "";
            return groupVals.includes(cat) || legacyVals.includes(cat);
          });
        }
      } else if (selectedDept) {
        const dept = DEPARTMENTS.find((d) => d.id === selectedDept);
        if (dept) {
          const vals = deptValues(dept).map((v) => v.toLowerCase());
          r = r.filter((p) => vals.includes(p.category?.toLowerCase() ?? ""));
        }
      }
    }

    if (rentalTypeFilter !== "alle") {
      r = r.filter((p) => (p.rentalType ?? "miete") === rentalTypeFilter);
    }

    // ── Suche mit Synonymen ───────────────────────────────────────
    if (query.trim()) {
      const q = query.toLowerCase().trim();
      const words = q.split(/\s+/);
      const synonymCats = words.flatMap((w) => SEARCH_SYNONYMS[w] ?? []);

      r = r.filter((p) => {
        const title = p.title.toLowerCase();
        const cat = p.category?.toLowerCase() ?? "";
        const loc = p.location?.toLowerCase() ?? "";

        // Direkte Treffer
        if (title.includes(q) || cat.includes(q) || loc.includes(q)) return true;

        // Synonym-Treffer: Kategorie muss einem Synonym-Wert entsprechen
        if (synonymCats.length > 0 && synonymCats.some((sc) => cat === sc)) return true;

        return false;
      });
    }

    if (locationFilter) r = r.filter((p) => p.location?.toLowerCase().includes(locationFilter.toLowerCase()));
    if (conditionFilter) r = r.filter((p) => p.condition === conditionFilter);
    if (deliveryOnly) r = r.filter((p) => p.delivery);
    if (minRate) r = r.filter((p) => p.dailyRate >= Number(minRate));
    if (maxRate) r = r.filter((p) => p.dailyRate <= Number(maxRate));
    if (sortKey === "price-asc") r.sort((a, b) => a.dailyRate - b.dailyRate);
    if (sortKey === "price-desc") r.sort((a, b) => b.dailyRate - a.dailyRate);
    return r;
  }, [serverListings, selectedScene, selectedDept, selectedGroup, query, locationFilter, conditionFilter, deliveryOnly, minRate, maxRate, sortKey]);

  useEffect(() => setVisibleCount(PAGE_SIZE), [filtered]);

  const handleSelectGroup = (deptId: string, groupId: string | null) => {
    setSelectedScene(null); // Szene aufheben wenn Kategorie gewählt
    if (groupId === null) {
      setSelectedGroup(null);
      setSelectedDept(deptId);
    } else {
      setSelectedGroup({ deptId, groupId });
      setSelectedDept(null);
    }
  };

  const handleSelectScene = (sceneId: string | null) => {
    setSelectedScene(sceneId);
    if (sceneId) { setSelectedDept(null); setSelectedGroup(null); } // Kategorie aufheben wenn Szene gewählt
  };

  const clearCategory = () => { setSelectedDept(null); setSelectedGroup(null); };
  const clearAll = () => {
    clearCategory(); setSelectedScene(null); setQuery(""); setLocationFilter(""); setConditionFilter("");
    setDeliveryOnly(false); setMinRate(""); setMaxRate(""); setSortKey("featured");
    setRentalTypeFilter("alle");
    router.replace("/props", { scroll: false });
  };

  const hasAnyFilter = Boolean(selectedScene || selectedDept || selectedGroup || query || locationFilter || conditionFilter || deliveryOnly || minRate || maxRate || rentalTypeFilter !== "alle");
  const hasCategoryFilter = Boolean(selectedDept || selectedGroup);

  // Active category label + colors
  const activeDeptData = selectedGroup
    ? DEPARTMENTS.find((d) => d.id === selectedGroup.deptId)
    : selectedDept
    ? DEPARTMENTS.find((d) => d.id === selectedDept)
    : null;
  const activeGroupData = selectedGroup
    ? activeDeptData?.groups.find((g) => g.id === selectedGroup.groupId)
    : null;
  const chipColors = activeDeptData ? deptColors(activeDeptData.color) : null;

  const secondaryFilterCount = [
    deliveryOnly,
    sortKey !== "featured",
    !!locationFilter,
    !!conditionFilter,
    !!(minRate || maxRate),
    rentalTypeFilter !== "alle",
    !!selectedScene,
  ].filter(Boolean).length;

  return (
    <div className="min-h-screen">

      {/* ── Filter Bar ───────────────────────────────────── */}
      <div className="bg-bg-secondary border-b border-border">
        <div className="px-4 py-3 space-y-3">

          {/* Single main row */}
          <div className="flex items-center gap-2">

            {/* Search */}
            <div className="flex-1 flex items-center gap-2 bg-bg-elevated border border-border rounded-lg px-3 focus-within:border-gold/50 transition-colors min-w-0">
              <Search size={14} className="text-text-muted shrink-0" />
              <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Kamera, Requisite, Kostüm…"
                className="bg-transparent border-none py-2 text-sm w-full focus:outline-none" />
              {query && <button onClick={() => setQuery("")} className="text-text-muted hover:text-text-primary transition-colors shrink-0"><X size={12} /></button>}
            </div>

            {/* Kategorie & Typ */}
            <button
              onClick={() => { setPanelOpen((v) => !v); setFilterPanelOpen(false); }}
              className={`flex items-center gap-2 h-9 px-3 rounded-lg text-xs font-medium border transition-all shrink-0 ${
                panelOpen || hasCategoryFilter
                  ? "bg-gold/12 border-gold/30 text-gold"
                  : "border-border text-text-muted hover:text-text-secondary"
              }`}
            >
              <Layers size={11} />
              <span className="hidden sm:inline">Kategorie</span>
              {hasCategoryFilter
                ? <span className="bg-gold text-bg-primary text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">✓</span>
                : <ChevronDown size={11} className={`transition-transform ${panelOpen ? "rotate-180" : ""}`} />
              }
            </button>

            {/* Filter panel trigger */}
            <button
              onClick={() => { setFilterPanelOpen((v) => !v); setPanelOpen(false); }}
              className={`flex items-center gap-2 h-9 px-3 rounded-lg text-xs font-medium border transition-all shrink-0 ${
                filterPanelOpen || secondaryFilterCount > 0
                  ? "bg-gold/12 border-gold/30 text-gold"
                  : "border-border text-text-muted hover:text-text-secondary"
              }`}
            >
              <SlidersHorizontal size={11} />
              <span className="hidden sm:inline">Filter</span>
              {secondaryFilterCount > 0
                ? <span className="bg-gold text-bg-primary text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{secondaryFilterCount}</span>
                : <ChevronDown size={11} className={`transition-transform ${filterPanelOpen ? "rotate-180" : ""}`} />
              }
            </button>

            {/* Grid / List toggle */}
            <div className="flex bg-bg-elevated border border-border rounded-lg overflow-hidden shrink-0">
              <button onClick={() => setViewMode("grid")} className={`flex items-center justify-center w-9 h-9 transition-colors ${viewMode === "grid" ? "bg-gold text-bg-primary" : "text-text-muted hover:text-text-primary"}`}><LayoutGrid size={14} /></button>
              <button onClick={() => setViewMode("list")} className={`flex items-center justify-center w-9 h-9 transition-colors border-l border-border ${viewMode === "list" ? "bg-gold text-bg-primary" : "text-text-muted hover:text-text-primary"}`}><List size={14} /></button>
            </div>

            <Link href="/dashboard/new-listing" className="hidden sm:flex items-center h-9 px-3 bg-gold text-bg-primary text-xs font-semibold rounded-lg hover:bg-gold-light transition-colors whitespace-nowrap shrink-0">
              + Eintragen
            </Link>
          </div>

          {/* Category panel — inline on all screen sizes */}
          {panelOpen && (
            <CategoryPanel
              activeDeptId={activePanelDept}
              setActiveDeptId={setActivePanelDept}
              selectedDept={selectedDept}
              selectedGroup={selectedGroup}
              onSelectGroup={handleSelectGroup}
              onClose={() => setPanelOpen(false)}
            />
          )}

          {/* Secondary filter panel */}
          {filterPanelOpen && (
            <div className="p-4 bg-bg-elevated border border-border rounded-xl space-y-4">

              {/* Szenen */}
              <div>
                <p className="text-[10px] uppercase tracking-widest text-text-muted font-semibold mb-2">Szene</p>
                <div className="flex flex-wrap gap-1.5">
                  {SCENES.map((scene) => {
                    const Icon = SCENE_ICON_MAP[scene.iconName] ?? Package;
                    const isActive = selectedScene === scene.id;
                    return (
                      <button key={scene.id} onClick={() => handleSelectScene(isActive ? null : scene.id)} title={scene.description}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                          isActive ? "bg-gold text-bg-primary border-gold" : "border-border text-text-muted hover:border-gold/40 hover:text-text-secondary"
                        }`}>
                        <Icon size={11} />{scene.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="h-px bg-border" />

              {/* Second row: Angebotstyp + Sortierung */}
              <div className="flex flex-wrap gap-6">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-text-muted font-semibold mb-2">Angebotstyp</p>
                  <div className="flex gap-1.5">
                    {(["alle", "miete", "kauf"] as const).map((t) => (
                      <button key={t} onClick={() => setRentalTypeFilter(t)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          rentalTypeFilter === t ? "bg-gold/12 border-gold/30 text-gold" : "border-border text-text-muted hover:text-text-secondary"
                        }`}>
                        {t === "alle" ? "Alle" : t === "miete" ? "Mieten" : "Kaufen"}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-text-muted font-semibold mb-2">Sortierung</p>
                  <div className="flex gap-1.5">
                    {[{ value: "featured", label: "Empfohlen" }, { value: "price-asc", label: "Preis ↑" }, { value: "price-desc", label: "Preis ↓" }].map((o) => (
                      <button key={o.value} onClick={() => setSortKey(o.value)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          sortKey === o.value ? "bg-gold/12 border-gold/30 text-gold" : "border-border text-text-muted hover:text-text-secondary"
                        }`}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="h-px bg-border" />

              {/* Third row: Lieferung + Stadt + Zustand + Preis */}
              <div className="flex flex-wrap gap-x-6 gap-y-3 items-end">
                {/* Lieferung */}
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-text-muted font-semibold mb-2">Lieferung</p>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <div onClick={() => setDeliveryOnly((v) => !v)}
                      className={`w-8 h-4.5 rounded-full transition-colors relative cursor-pointer ${deliveryOnly ? "bg-gold" : "bg-border"}`}>
                      <span className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all ${deliveryOnly ? "left-4" : "left-0.5"}`} />
                    </div>
                    <span className="text-xs text-text-muted">Nur mit Lieferung</span>
                  </label>
                </div>

                {/* Stadt */}
                {availableLocations.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-text-muted font-semibold mb-2">Stadt</p>
                    <FilterDropdown icon={MapPin} label="Alle Städte" value={locationFilter} options={availableLocations} onChange={setLocationFilter} />
                  </div>
                )}

                {/* Zustand */}
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-text-muted font-semibold mb-2">Zustand</p>
                  <FilterDropdown icon={CheckCircle} label="Alle" value={conditionFilter} options={CONDITIONS} onChange={setConditionFilter} />
                </div>

                {/* Preis */}
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-text-muted font-semibold mb-2">Preis / Tag</p>
                  <FilterDropdown icon={Euro} label="Alle Preise"
                    value={minRate || maxRate ? `${minRate || "0"} – ${maxRate || "∞"} €` : ""}
                    options={["bis 50 €", "bis 100 €", "bis 250 €", "bis 500 €", "ab 500 €"]}
                    onChange={(v) => {
                      if (v === "bis 50 €") { setMinRate(""); setMaxRate("50"); }
                      else if (v === "bis 100 €") { setMinRate(""); setMaxRate("100"); }
                      else if (v === "bis 250 €") { setMinRate(""); setMaxRate("250"); }
                      else if (v === "bis 500 €") { setMinRate(""); setMaxRate("500"); }
                      else if (v === "ab 500 €") { setMinRate("500"); setMaxRate(""); }
                      else { setMinRate(""); setMaxRate(""); }
                    }}
                  />
                </div>
              </div>

              {secondaryFilterCount > 0 && (
                <button onClick={clearAll} className="text-[11px] text-text-muted hover:text-red-400 transition-colors underline underline-offset-2">
                  Alle Filter löschen
                </button>
              )}
            </div>
          )}

          {/* Active filter chips */}
          {(hasCategoryFilter || selectedScene || conditionFilter || deliveryOnly || rentalTypeFilter !== "alle") && (
            <div className="flex flex-wrap gap-1.5 items-center">
              {selectedScene && (() => {
                const scene = SCENES.find((s) => s.id === selectedScene);
                const SceneIcon = scene ? (SCENE_ICON_MAP[scene.iconName] ?? Package) : Package;
                return scene ? (
                  <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border font-medium bg-gold/10 border-gold/30 text-gold">
                    <SceneIcon size={9} /> {scene.label}
                    <button onClick={() => handleSelectScene(null)} className="hover:opacity-70 ml-0.5"><X size={9} /></button>
                  </span>
                ) : null;
              })()}
              {activeDeptData && chipColors && !selectedScene && (
                <span className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border font-medium ${chipColors.bg} ${chipColors.border} ${chipColors.text}`}>
                  {activeGroupData ? `${activeDeptData.label} › ${activeGroupData.label}` : activeDeptData.label}
                  <button onClick={clearCategory} className="hover:opacity-70 ml-0.5"><X size={9} /></button>
                </span>
              )}
              {conditionFilter && (
                <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border font-medium bg-bg-elevated border-border text-text-secondary">
                  {conditionFilter}
                  <button onClick={() => setConditionFilter("")} className="hover:opacity-70 ml-0.5"><X size={9} /></button>
                </span>
              )}
              {rentalTypeFilter !== "alle" && (
                <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border font-medium bg-gold/10 border-gold/30 text-gold">
                  {rentalTypeFilter === "miete" ? "Mieten" : "Kaufen"}
                  <button onClick={() => setRentalTypeFilter("alle")} className="hover:opacity-70 ml-0.5"><X size={9} /></button>
                </span>
              )}
              {deliveryOnly && (
                <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border font-medium bg-teal-500/10 border-teal-500/20 text-teal-400">
                  <Truck size={9} /> Lieferung
                  <button onClick={() => setDeliveryOnly(false)} className="hover:opacity-70 ml-0.5"><X size={9} /></button>
                </span>
              )}
              <button onClick={clearAll} className="text-[11px] text-text-muted hover:text-red-400 transition-colors underline underline-offset-2 ml-1">
                Alle löschen
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Results ──────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-5">
          <p className="text-sm text-text-muted">
            <span className="text-text-primary font-semibold">{filtered.length}</span> Artikel gefunden
            {query && <span className="text-gold"> für &ldquo;{query}&rdquo;</span>}
            {selectedScene && (() => {
              const scene = SCENES.find((s) => s.id === selectedScene);
              return scene ? <span className="text-text-muted"> · Szene: {scene.label}</span> : null;
            })()}
          </p>
          {hasAnyFilter && (
            <button onClick={clearAll} className="text-xs text-text-muted hover:text-red-400 transition-colors flex items-center gap-1">
              <X size={11} /> Alle Filter löschen
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={Package}
            title={selectedScene ? `Noch keine Artikel für Szene „${SCENES.find(s => s.id === selectedScene)?.label}"` : "Keine Artikel gefunden"}
            description={selectedScene ? "Diese Szene füllt sich, sobald Anbieter Artikel mit passender Kategorie inserieren." : "Versuche eine andere Suche oder wähle eine andere Kategorie."}
            action={{ label: "Alles anzeigen", onClick: clearAll }} />
        ) : (
          <>
            <div className={viewMode === "grid"
              ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
              : "space-y-2"}>
              {filtered.slice(0, visibleCount).map((p) => (
                <PropCard key={p.id} p={p} list={viewMode === "list"} />
              ))}
            </div>
            {filtered.length > visibleCount && (
              <div className="mt-10 text-center">
                <button onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
                  className="px-8 py-3 border border-border text-sm font-semibold text-text-secondary hover:border-gold hover:text-gold rounded-xl transition-all">
                  Mehr laden · {filtered.length - visibleCount} weitere
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function PropsContent({ serverListings }: { serverListings: Prop[] }) {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" /></div>}>
      <PropsInner serverListings={serverListings} />
    </Suspense>
  );
}
