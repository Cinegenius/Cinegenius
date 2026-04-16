"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Building2, MapPin, Search, CheckCircle, LayoutGrid, LayoutList,
  ChevronRight, X, Camera, Volume2, Wrench, Shirt,
  Package, Film, Monitor, Users, Sparkles, Megaphone, Car,
  Lightbulb, ArrowRight, SlidersHorizontal, ChevronDown, Globe, Zap,
} from "lucide-react";
import { COMPANY_CATEGORIES, COMPANY_CATEGORY_BY_ID } from "@/lib/companyCategories";

const PAGE_SIZE = 24;

type Company = {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  description: string;
  city: string;
  categories: string[];
  services: string[];
  verified: boolean;
  created_at: string;
};

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
};

// ── Two-panel groupings ───────────────────────────────────────────
const COMPANY_GROUPS: { id: string; label: string; Icon: LucideIcon; categoryIds: string[] }[] = [
  {
    id: "verleih", label: "Verleih", Icon: Package,
    categoryIds: ["lichtverleih", "kameraverleih", "tonverleih", "grip-verleih", "fahrzeugverleih"],
  },
  {
    id: "studio", label: "Studio & Produktion", Icon: Film,
    categoryIds: ["tonstudio", "filmproduktion", "fotostudio"],
  },
  {
    id: "post", label: "Post & Digital", Icon: Monitor,
    categoryIds: ["postproduktion", "vfx-studio", "werbeagentur"],
  },
  {
    id: "ausstattung", label: "Ausstattung", Icon: Shirt,
    categoryIds: ["kostumfundus", "requisite"],
  },
  {
    id: "agenturen", label: "Agenturen & Services", Icon: Users,
    categoryIds: ["casting-agentur", "location-agentur"],
  },
];

// ─── FilterDropdown ───────────────────────────────────────────────
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
        {active ? value : label}
        {active
          ? <span onClick={(e) => { e.stopPropagation(); onChange(""); setOpen(false); }} className="hover:text-red-400 transition-colors ml-0.5"><X size={10} /></span>
          : <ChevronDown size={11} className={`transition-transform ${open ? "rotate-180" : ""}`} />}
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-bg-elevated border border-border rounded-xl shadow-xl overflow-hidden min-w-[160px] max-h-64 overflow-y-auto">
          {options.map((opt) => (
            <button key={opt} onClick={() => { onChange(opt); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-white/[0.04] ${value === opt ? "text-gold font-medium" : "text-text-secondary"}`}>
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Two-panel category picker ────────────────────────────────────
function CompanyCategoryPanel({
  activeGroupId, setActiveGroupId,
  selectedCategoryId,
  onSelectCategory,
  onClose,
}: {
  activeGroupId: string; setActiveGroupId: (id: string) => void;
  selectedCategoryId: string | null;
  onSelectCategory: (catId: string | null) => void;
  onClose: () => void;
}) {
  const activeGroup = COMPANY_GROUPS.find((g) => g.id === activeGroupId) ?? COMPANY_GROUPS[0];
  const selectedCat = selectedCategoryId ? COMPANY_CATEGORY_BY_ID[selectedCategoryId] : null;
  const selectedInActiveGroup = activeGroup.categoryIds.includes(selectedCategoryId ?? "");

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-bg-elevated">
      {/* Mobile: horizontal group scroll + categories below */}
      <div className="sm:hidden">
        <div className="flex overflow-x-auto gap-1.5 p-3 border-b border-border bg-bg-secondary" style={{ scrollbarWidth: "none" }}>
          {COMPANY_GROUPS.map(({ id, label, Icon, categoryIds }) => {
            const isActive = id === activeGroupId;
            const hasSelected = categoryIds.includes(selectedCategoryId ?? "");
            return (
              <button key={id}
                onClick={() => setActiveGroupId(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border shrink-0 transition-all ${
                  isActive ? "bg-gold/10 border-gold/30 text-gold" : "border-border text-text-muted"
                }`}>
                <Icon size={11} className={isActive ? "text-gold" : "text-text-muted"} />
                {label}
                {hasSelected && <span className="w-3 h-3 rounded-full bg-gold text-bg-primary text-[8px] font-bold flex items-center justify-center">✓</span>}
              </button>
            );
          })}
        </div>
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gold">{activeGroup.label}</h3>
            {selectedInActiveGroup && selectedCategoryId && (
              <button onClick={() => onSelectCategory(null)} className="text-[10px] text-text-muted hover:text-red-400">Löschen</button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {activeGroup.categoryIds.map((catId) => {
              const cat = COMPANY_CATEGORY_BY_ID[catId];
              if (!cat) return null;
              const Icon = CATEGORY_ICONS[catId] ?? Building2;
              const isSelected = selectedCategoryId === catId;
              return (
                <button key={catId}
                  onClick={() => { onSelectCategory(isSelected ? null : catId); onClose(); }}
                  className={`text-left px-3 py-2.5 rounded-lg text-xs border transition-all ${
                    isSelected ? `${cat.bg} ${cat.color} font-semibold` : "border-border/60 text-text-muted"
                  }`}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Icon size={11} className={isSelected ? cat.color : "text-text-muted"} />
                    <span className="font-medium leading-tight">{cat.label}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Desktop: two-panel */}
      <div className="hidden sm:flex" style={{ minHeight: 260 }}>
        <div className="w-52 shrink-0 border-r border-border overflow-y-auto bg-bg-secondary">
          {COMPANY_GROUPS.map(({ id, label, Icon, categoryIds }) => {
            const isActive = id === activeGroupId;
            const hasSelected = categoryIds.includes(selectedCategoryId ?? "");
            return (
              <button key={id}
                onMouseEnter={() => setActiveGroupId(id)}
                onClick={() => setActiveGroupId(id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-left text-xs transition-colors border-b border-border/40 last:border-0 ${
                  isActive ? "bg-gold/10 text-gold font-semibold" : "text-text-muted hover:text-text-secondary hover:bg-white/[0.02]"
                }`}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={`w-6 h-6 rounded-md border flex items-center justify-center shrink-0 ${isActive ? "bg-gold/15 border-gold/30" : "bg-bg-elevated border-border"}`}>
                    <Icon size={11} className={isActive ? "text-gold" : "text-text-muted"} />
                  </span>
                  <span className="truncate">{label}</span>
                </div>
                {hasSelected && <span className="w-3.5 h-3.5 rounded-full bg-gold text-bg-primary text-[8px] font-bold flex items-center justify-center shrink-0">✓</span>}
              </button>
            );
          })}
        </div>
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gold">{activeGroup.label}</h3>
            {selectedInActiveGroup && selectedCategoryId && (
              <button onClick={() => onSelectCategory(null)} className="text-[10px] text-text-muted hover:text-red-400 transition-colors">Auswahl löschen</button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {activeGroup.categoryIds.map((catId) => {
              const cat = COMPANY_CATEGORY_BY_ID[catId];
              if (!cat) return null;
              const Icon = CATEGORY_ICONS[catId] ?? Building2;
              const isSelected = selectedCategoryId === catId;
              return (
                <button key={catId}
                  onClick={() => { onSelectCategory(isSelected ? null : catId); onClose(); }}
                  className={`text-left px-3 py-2.5 rounded-lg text-xs border transition-all ${
                    isSelected ? `${cat.bg} ${cat.color} font-semibold` : "border-border/60 text-text-muted hover:text-text-secondary hover:border-border hover:bg-white/[0.02]"
                  }`}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Icon size={11} className={isSelected ? cat.color : "text-text-muted"} />
                    <span className="font-medium leading-tight">{cat.label}</span>
                  </div>
                  <div className="text-[10px] opacity-50">{cat.examples}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────
export default function CompaniesContent({ initialCompanies }: { initialCompanies: Company[] }) {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [activeGroupId, setActiveGroupId] = useState(COMPANY_GROUPS[0].id);
  const [panelOpen, setPanelOpen] = useState(false);
  const [cityFilter, setCityFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState(1);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!panelOpen) return;
    const h = (e: MouseEvent) => { if (panelRef.current && !panelRef.current.contains(e.target as Node)) setPanelOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [panelOpen]);

  const availableCities = useMemo(() => {
    const cities = initialCompanies.map((c) => c.city?.split(",")[0]?.trim()).filter(Boolean) as string[];
    return [...new Set(cities)].sort();
  }, [initialCompanies]);

  const filtered = useMemo(() => {
    let result = initialCompanies;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q) ||
        c.services.some((s) => s.toLowerCase().includes(q))
      );
    }
    if (selectedCategory) result = result.filter((c) => c.categories.includes(selectedCategory));
    if (cityFilter) result = result.filter((c) => c.city?.toLowerCase().includes(cityFilter.toLowerCase()));
    if (countryFilter) {
      if (countryFilter === "Remote") result = result.filter((c) => c.city?.toLowerCase().includes("remote"));
      else result = result.filter((c) => c.city?.toLowerCase().includes(countryFilter.toLowerCase()));
    }
    if (verifiedOnly) result = result.filter((c) => c.verified);
    return result;
  }, [initialCompanies, search, selectedCategory, cityFilter, countryFilter, verifiedOnly]);

  useEffect(() => setPage(1), [filtered]);

  const paginated = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = paginated.length < filtered.length;

  const clearAll = () => {
    setSearch(""); setSelectedCategory(null); setCityFilter("");
    setCountryFilter(""); setVerifiedOnly(false); setPage(1);
  };

  const selectedCat = selectedCategory ? COMPANY_CATEGORY_BY_ID[selectedCategory] : null;
  const hasAnyFilter = Boolean(search || selectedCategory || cityFilter || countryFilter || verifiedOnly);
  const hasCatFilter = Boolean(selectedCategory);

  return (
    <div className="min-h-screen bg-bg-primary">

      {/* ── Filter Bar ───────────────────────────────────── */}
      <div className="bg-bg-secondary border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 space-y-2">

          {/* Row 1: Search + View toggle */}
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 bg-bg-elevated border border-border rounded-lg px-3 focus-within:border-gold/50 transition-colors">
              <Search size={14} className="text-text-muted shrink-0" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Firma, Leistung, Stichwort..."
                className="bg-transparent border-none py-2 text-sm w-full focus:outline-none" />
              {search && <button onClick={() => setSearch("")} className="text-text-muted hover:text-text-primary transition-colors"><X size={12} /></button>}
            </div>
            <div className="flex bg-bg-elevated border border-border rounded-lg overflow-hidden shrink-0">
              <button onClick={() => setViewMode("grid")}
                className={`flex items-center justify-center w-9 h-9 transition-colors ${viewMode === "grid" ? "bg-gold text-bg-primary" : "text-text-muted hover:text-text-primary"}`}>
                <LayoutGrid size={14} />
              </button>
              <button onClick={() => setViewMode("list")}
                className={`flex items-center justify-center w-9 h-9 transition-colors border-l border-border ${viewMode === "list" ? "bg-gold text-bg-primary" : "text-text-muted hover:text-text-primary"}`}>
                <LayoutList size={14} />
              </button>
            </div>
          </div>

          {/* Row 2: Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>

            <div className="w-px h-6 bg-border shrink-0" />

            {/* Kategorie trigger */}
            <div ref={panelRef} className="relative shrink-0">
              <button onClick={() => setPanelOpen((v) => !v)}
                className={`flex items-center gap-2 h-9 px-3 rounded-lg text-xs font-medium border transition-all ${
                  panelOpen || hasCatFilter ? "bg-gold/10 border-gold/30 text-gold" : "border-border text-text-muted hover:text-text-secondary hover:border-border"
                }`}>
                <SlidersHorizontal size={12} />
                Kategorie
                {hasCatFilter
                  ? <span className="w-4 h-4 rounded-full bg-gold text-bg-primary text-[9px] font-bold flex items-center justify-center">✓</span>
                  : <ChevronDown size={11} className={`transition-transform ${panelOpen ? "rotate-180" : ""}`} />
                }
              </button>
            </div>

            {/* Stadt */}
            {availableCities.length > 0 && (
              <FilterDropdown icon={MapPin} label="Stadt" value={cityFilter} options={availableCities} onChange={setCityFilter} />
            )}

            {/* Land */}
            <FilterDropdown icon={Globe} label="Land" value={countryFilter} options={["Deutschland", "Österreich", "Schweiz"]} onChange={setCountryFilter} />

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
              Verifiziert
            </button>

            {hasAnyFilter && (
              <>
                <div className="w-px h-6 bg-border shrink-0" />
                <button onClick={clearAll} className="h-9 px-3 text-xs text-text-muted hover:text-red-400 transition-colors whitespace-nowrap shrink-0 border border-border rounded-lg hover:border-red-400/40">
                  Löschen
                </button>
              </>
            )}

            <Link href="/company-setup" className="hidden sm:flex items-center h-9 px-3 bg-gold text-bg-primary text-xs font-semibold rounded-lg hover:bg-gold-light transition-colors whitespace-nowrap shrink-0">
              + Firma eintragen
            </Link>
          </div>

          {/* Category panel */}
          {panelOpen && (
            <CompanyCategoryPanel
              activeGroupId={activeGroupId}
              setActiveGroupId={setActiveGroupId}
              selectedCategoryId={selectedCategory}
              onSelectCategory={(catId) => { setSelectedCategory(catId); setPage(1); }}
              onClose={() => setPanelOpen(false)}
            />
          )}

          {/* Row 4: Active chips */}
          {(hasCatFilter || cityFilter || countryFilter || verifiedOnly) && (
            <div className="flex flex-wrap gap-1.5 items-center">
              {selectedCat && (
                <span className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border font-medium ${selectedCat.bg} ${selectedCat.color}`}>
                  {selectedCat.label}
                  <button onClick={() => setSelectedCategory(null)} className="hover:opacity-70 ml-0.5"><X size={9} /></button>
                </span>
              )}
              {cityFilter && (
                <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border font-medium bg-bg-elevated border-border text-text-secondary">
                  <MapPin size={9} /> {cityFilter}
                  <button onClick={() => setCityFilter("")} className="hover:opacity-70 ml-0.5"><X size={9} /></button>
                </span>
              )}
              {countryFilter && (
                <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border font-medium bg-bg-elevated border-border text-text-secondary">
                  <Globe size={9} /> {countryFilter}
                  <button onClick={() => setCountryFilter("")} className="hover:opacity-70 ml-0.5"><X size={9} /></button>
                </span>
              )}
              {verifiedOnly && (
                <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border font-medium bg-gold/10 border-gold/30 text-gold">
                  <CheckCircle size={9} /> Verifiziert
                  <button onClick={() => setVerifiedOnly(false)} className="hover:opacity-70 ml-0.5"><X size={9} /></button>
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
        <p className="text-sm text-text-muted mb-5">
          <span className="font-semibold text-text-primary">{filtered.length}</span> Unternehmen
          {selectedCat && <> in <span className={`font-semibold ${selectedCat.color}`}>{selectedCat.label}</span></>}
        </p>

        {paginated.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-bg-secondary border border-border flex items-center justify-center mx-auto mb-5">
              <Building2 size={28} className="text-text-muted opacity-40" />
            </div>
            {hasAnyFilter ? (
              <>
                <p className="text-text-primary font-semibold mb-1">Keine Unternehmen gefunden</p>
                <p className="text-text-muted text-sm mb-5">Versuche andere Filter oder erweitere die Suche.</p>
                <button onClick={clearAll} className="px-5 py-2.5 border border-border rounded-xl text-sm text-text-secondary hover:border-gold hover:text-gold transition-colors">
                  Filter zurücksetzen
                </button>
              </>
            ) : (
              <>
                <p className="text-text-primary font-semibold mb-1">Noch keine Unternehmen eingetragen</p>
                <p className="text-text-muted text-sm mb-5 max-w-xs mx-auto">Sei das erste Unternehmen und werde von tausenden Filmschaffenden gefunden.</p>
                <Link href="/company-setup" className="inline-flex items-center gap-2 px-5 py-2.5 bg-gold text-bg-primary font-semibold rounded-xl text-sm hover:bg-gold-light transition-colors">
                  Jetzt Firmenprofil erstellen <ArrowRight size={14} />
                </Link>
              </>
            )}
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
            {paginated.map((company) => <CompanyCard key={company.id} company={company} />)}
          </div>
        ) : (
          <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
            <div className="divide-y divide-border">
              {paginated.map((company) => <CompanyListRow key={company.id} company={company} />)}
            </div>
          </div>
        )}

        {hasMore && (
          <div className="mt-8 text-center">
            <button onClick={() => setPage((p) => p + 1)}
              className="px-6 py-2.5 border border-border rounded-xl text-sm text-text-secondary hover:border-gold hover:text-gold transition-colors">
              Mehr laden · {filtered.length - paginated.length} weitere
            </button>
          </div>
        )}

        {/* CTA — minimal, no duplicate button */}
        <p className="mt-10 text-center text-xs text-text-muted">
          Noch nicht dabei?{" "}
          <Link href="/company-setup" className="text-gold hover:underline font-medium">
            Kostenloses Firmenprofil erstellen →
          </Link>
        </p>
      </div>
    </div>
  );
}

// ─── Grid card ────────────────────────────────────────────────────
function CompanyCard({ company }: { company: Company }) {
  const cats = company.categories.slice(0, 2).map((id) => COMPANY_CATEGORY_BY_ID[id]).filter(Boolean);
  return (
    <Link href={`/companies/${company.slug}`}
      className="card-hover group block bg-bg-secondary border border-border rounded-2xl p-4">
      {/* Header: logo + name + city */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-12 h-12 rounded-xl bg-bg-elevated border border-border flex items-center justify-center shrink-0 overflow-hidden">
          {company.logo_url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={company.logo_url} alt={company.name} className="w-full h-full object-contain p-1" />
            : <Building2 size={20} className="text-text-muted opacity-40" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <h3 className="font-semibold text-sm text-text-primary group-hover:text-gold transition-colors line-clamp-2 leading-snug">{company.name}</h3>
            {company.verified && <CheckCircle size={13} className="text-gold shrink-0 mt-0.5" />}
          </div>
          {company.city && (
            <div className="flex items-center gap-1 text-[11px] text-text-muted mt-0.5">
              <MapPin size={9} /><span className="truncate">{company.city}</span>
            </div>
          )}
        </div>
      </div>
      {/* Categories */}
      {cats.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2.5">
          {cats.map((cat) => (
            <span key={cat.id} className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${cat.bg} ${cat.color}`}>{cat.label}</span>
          ))}
          {company.categories.length > 2 && (
            <span className="px-2 py-0.5 text-[10px] font-medium rounded-full border border-border text-text-muted">+{company.categories.length - 2}</span>
          )}
        </div>
      )}
      {/* Description */}
      {company.description && <p className="text-[11px] text-text-muted line-clamp-2 leading-relaxed">{company.description}</p>}
    </Link>
  );
}

// ─── List row ─────────────────────────────────────────────────────
function CompanyListRow({ company }: { company: Company }) {
  const cats = company.categories.slice(0, 3).map((id) => COMPANY_CATEGORY_BY_ID[id]).filter(Boolean);
  return (
    <Link href={`/companies/${company.slug}`}
      className="flex items-center gap-4 px-5 py-4 hover:bg-bg-elevated transition-colors group">
      <div className="w-10 h-10 rounded-xl bg-bg-elevated border border-border flex items-center justify-center shrink-0 overflow-hidden">
        {company.logo_url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={company.logo_url} alt="" className="w-full h-full object-cover" />
          : <Building2 size={18} className="text-text-muted" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-semibold text-sm text-text-primary group-hover:text-gold transition-colors truncate">{company.name}</span>
          {company.verified && <CheckCircle size={12} className="text-gold shrink-0" />}
        </div>
        <div className="flex items-center gap-1 text-xs text-text-muted"><MapPin size={10} /><span>{company.city}</span></div>
      </div>
      <div className="hidden sm:flex items-center gap-1.5 flex-wrap justify-end">
        {cats.map((cat) => (
          <span key={cat.id} className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${cat.bg} ${cat.color}`}>{cat.label}</span>
        ))}
      </div>
      <ChevronRight size={14} className="text-text-muted shrink-0 group-hover:text-gold transition-colors" />
    </Link>
  );
}
