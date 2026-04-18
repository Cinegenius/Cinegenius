"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Search, Clapperboard, Calendar, Users, X, ChevronDown,
  LayoutList, LayoutGrid, Film, MapPin, ArrowUpDown,
  Camera, Zap, Music, FileVideo, Building2, Radio, Tv,
} from "lucide-react";

const CATEGORY_CHIPS = [
  { label: "Film & Serie",    keywords: ["spielfilm", "kurzfilm", "serie", "film"],                                               icon: Film },
  { label: "Werbung",         keywords: ["werbefilm", "werbung", "commercial", "spot", "imagefilm"],                              icon: Tv },
  { label: "Foto & Shooting", keywords: ["foto", "shooting", "fotografie", "editorial", "portrait", "kampagne"],                 icon: Camera },
  { label: "Social Media",    keywords: ["social", "tiktok", "instagram", "reel", "youtube", "content", "podcast", "influencer"],icon: Zap },
  { label: "Musikvideo",      keywords: ["musikvideo", "musik", "konzert", "band", "artist"],                                    icon: Music },
  { label: "Dokumentation",   keywords: ["dokumentation", "dokumentar", "reportage", "doku"],                                    icon: FileVideo },
  { label: "Corporate",       keywords: ["corporate", "business", "imagevideo", "erklärvideo", "employer", "unternehmen"],       icon: Building2 },
  { label: "Event & Live",    keywords: ["event", "live", "festival", "sport", "konferenz", "messe"],                            icon: Radio },
];

type Project = {
  id: string;
  title: string;
  year: number | null;
  type: string | null;
  director: string | null;
  poster_url: string | null;
  crew_count: number;
};

const TYPE_COLORS: Record<string, string> = {
  Spielfilm:     "bg-purple-500/15 text-purple-300 border-purple-500/30",
  Kurzfilm:      "bg-blue-500/15 text-blue-300 border-blue-500/30",
  Serie:         "bg-green-500/15 text-green-300 border-green-500/30",
  Dokumentation: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  Werbefilm:     "bg-pink-500/15 text-pink-300 border-pink-500/30",
  Musikvideo:    "bg-red-500/15 text-red-300 border-red-500/30",
  Corporate:     "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
};

type SortKey = "year_desc" | "year_asc" | "title_asc" | "crew_desc";

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
          active ? "bg-gold/12 border-gold/30 text-gold" : open ? "bg-bg-elevated border-border text-text-secondary" : "border-border text-text-muted hover:text-text-secondary"
        }`}>
        <Icon size={11} />
        {active ? value : label}
        {active
          ? <span onClick={(e) => { e.stopPropagation(); onChange(""); setOpen(false); }} className="hover:text-red-400 transition-colors ml-0.5"><X size={10} /></span>
          : <ChevronDown size={11} className={`transition-transform ${open ? "rotate-180" : ""}`} />}
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-bg-elevated border border-border rounded-xl shadow-xl overflow-hidden min-w-[150px] max-h-64 overflow-y-auto">
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

// ─── Main ─────────────────────────────────────────────────────────
export default function ProjectsContent({ projects: allProjects }: { projects: Project[] }) {
  const [query, setQuery] = useState("");
  const [categoryChip, setCategoryChip] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [directorFilter, setDirectorFilter] = useState("");
  const [sort, setSort] = useState<SortKey>("year_desc");
  const [view, setView] = useState<"list" | "grid">("list");

  // Derive available filter options from data
  const availableTypes = useMemo(() => {
    const types = allProjects.map((p) => p.type).filter(Boolean) as string[];
    return [...new Set(types)].sort();
  }, [allProjects]);

  const availableYears = useMemo(() => {
    const years = allProjects.map((p) => p.year).filter(Boolean) as number[];
    return [...new Set(years)].sort((a, b) => b - a).map(String);
  }, [allProjects]);

  const availableDirectors = useMemo(() => {
    const dirs = allProjects.map((p) => p.director).filter(Boolean) as string[];
    return [...new Set(dirs)].sort();
  }, [allProjects]);

  const filtered = useMemo(() => {
    let list = allProjects;
    if (categoryChip) {
      const chip = CATEGORY_CHIPS.find((c) => c.label === categoryChip);
      if (chip) {
        list = list.filter((p) =>
          chip.keywords.some((kw) => (p.type ?? "").toLowerCase().includes(kw))
        );
      }
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((p) => p.title.toLowerCase().includes(q) || (p.director ?? "").toLowerCase().includes(q));
    }
    if (typeFilter) list = list.filter((p) => p.type === typeFilter);
    if (yearFilter) list = list.filter((p) => String(p.year) === yearFilter);
    if (directorFilter) list = list.filter((p) => p.director === directorFilter);
    list = [...list].sort((a, b) => {
      if (sort === "year_desc") return (b.year ?? 0) - (a.year ?? 0);
      if (sort === "year_asc")  return (a.year ?? 0) - (b.year ?? 0);
      if (sort === "title_asc") return a.title.localeCompare(b.title, "de");
      if (sort === "crew_desc") return b.crew_count - a.crew_count;
      return 0;
    });
    return list;
  }, [allProjects, query, typeFilter, yearFilter, directorFilter, sort]);

  const clearAll = () => { setQuery(""); setCategoryChip(null); setTypeFilter(""); setYearFilter(""); setDirectorFilter(""); };
  const hasAnyFilter = Boolean(query || categoryChip || typeFilter || yearFilter || directorFilter);

  return (
    <div className="min-h-screen bg-bg-primary">

      {/* ── Category Chips ───────────────────────────────── */}
      <div className="bg-bg-secondary border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
          {CATEGORY_CHIPS.map(({ label, icon: Icon }) => {
            const active = categoryChip === label;
            return (
              <button
                key={label}
                onClick={() => setCategoryChip(active ? null : label)}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all text-xs font-semibold whitespace-nowrap ${
                  active
                    ? "bg-gold border-gold text-bg-primary shadow-sm"
                    : "border-gold/30 bg-gold/10 text-gold hover:bg-gold/20 hover:border-gold/60"
                }`}
              >
                <Icon size={11} />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Filter Bar ───────────────────────────────────── */}
      <div className="bg-bg-secondary border-b border-border">
        <div className="px-4 py-2 space-y-2">

          {/* Row 1: Search + View toggle */}
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 bg-bg-elevated border border-border rounded-lg px-3 focus-within:border-gold/50 transition-colors">
              <Search size={14} className="text-text-muted shrink-0" />
              <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Titel oder Regisseur suchen..."
                className="bg-transparent border-none py-2 text-sm w-full focus:outline-none" />
              {query && <button onClick={() => setQuery("")} className="text-text-muted hover:text-text-primary transition-colors"><X size={12} /></button>}
            </div>
            <div className="flex bg-bg-elevated border border-border rounded-lg overflow-hidden shrink-0">
              <button onClick={() => setView("list")} className={`flex items-center justify-center w-9 h-9 transition-colors ${view === "list" ? "bg-gold text-bg-primary" : "text-text-muted hover:text-text-primary"}`}><LayoutList size={14} /></button>
              <button onClick={() => setView("grid")} className={`flex items-center justify-center w-9 h-9 transition-colors border-l border-border ${view === "grid" ? "bg-gold text-bg-primary" : "text-text-muted hover:text-text-primary"}`}><LayoutGrid size={14} /></button>
            </div>
          </div>

          {/* Row 2: Filters */}
          <div className="flex items-center gap-2 overflow-x-auto lg:overflow-visible pb-0.5" style={{ scrollbarWidth: "none" }}>
            <SortDropdown
              value={sort}
              options={[
                { value: "year_desc", label: "Neueste zuerst" },
                { value: "year_asc",  label: "Älteste zuerst" },
                { value: "title_asc", label: "A → Z" },
                { value: "crew_desc", label: "Meiste Crew" },
              ]}
              onChange={(v) => setSort(v as SortKey)}
            />
            <Link href="/dashboard/projects/new" className="hidden sm:flex items-center h-9 px-3 bg-gold text-bg-primary text-xs font-semibold rounded-lg hover:bg-gold-light transition-colors whitespace-nowrap shrink-0">
              + Projekt erstellen
            </Link>

            <div className="w-px h-6 bg-border shrink-0" />

            {availableTypes.length > 0 && (
              <FilterDropdown icon={Film} label="Projekttyp" value={typeFilter} options={availableTypes} onChange={setTypeFilter} />
            )}
            {availableYears.length > 0 && (
              <FilterDropdown icon={Calendar} label="Jahr" value={yearFilter} options={availableYears} onChange={setYearFilter} />
            )}
            {availableDirectors.length > 0 && (
              <FilterDropdown icon={MapPin} label="Regie" value={directorFilter} options={availableDirectors} onChange={setDirectorFilter} />
            )}
            {hasAnyFilter && (
              <button onClick={clearAll} className="h-9 px-3 text-xs text-text-muted hover:text-red-400 transition-colors whitespace-nowrap border border-border rounded-lg hover:border-red-400/40 shrink-0">
                Löschen
              </button>
            )}
          </div>

          {/* Active chips */}
          {(typeFilter || yearFilter || directorFilter) && (
            <div className="flex flex-wrap gap-1.5 items-center">
              {typeFilter && (
                <span className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border font-medium ${TYPE_COLORS[typeFilter] ?? "bg-gold/10 border-gold/30 text-gold"}`}>
                  {typeFilter}
                  <button onClick={() => setTypeFilter("")} className="hover:opacity-70 ml-0.5"><X size={9} /></button>
                </span>
              )}
              {yearFilter && (
                <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border font-medium bg-bg-elevated border-border text-text-secondary">
                  <Calendar size={9} /> {yearFilter}
                  <button onClick={() => setYearFilter("")} className="hover:opacity-70 ml-0.5"><X size={9} /></button>
                </span>
              )}
              {directorFilter && (
                <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border font-medium bg-bg-elevated border-border text-text-secondary">
                  {directorFilter}
                  <button onClick={() => setDirectorFilter("")} className="hover:opacity-70 ml-0.5"><X size={9} /></button>
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
          <span className="font-semibold text-text-primary">{filtered.length}</span> {filtered.length === 1 ? "Projekt" : "Projekte"} gefunden
        </p>

        {filtered.length === 0 && (
          <div className="text-center py-20">
            <Clapperboard size={32} className="mx-auto mb-3 text-text-muted opacity-30" />
            <p className="text-text-muted mb-3">Keine Projekte gefunden</p>
            {hasAnyFilter && (
              <button onClick={clearAll} className="text-xs text-gold hover:underline">Filter zurücksetzen</button>
            )}
          </div>
        )}

        {/* List view */}
        {view === "list" && filtered.length > 0 && (
          <>
            {/* Mobile: simple card list */}
            <div className="sm:hidden space-y-2">
              {filtered.map((project) => (
                <Link key={project.id} href={`/projects/${project.id}`}
                  className="flex items-center gap-3 p-4 bg-bg-secondary border border-border rounded-xl hover:border-gold/40 transition-colors group">
                  <div className="w-10 h-13 rounded shrink-0 bg-bg-elevated border border-border overflow-hidden flex items-center justify-center">
                    {project.poster_url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={project.poster_url} alt="" className="w-full h-full object-cover" />
                      : <Clapperboard size={14} className="text-text-muted" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text-primary group-hover:text-gold transition-colors truncate">{project.title}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {project.type && (
                        <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${TYPE_COLORS[project.type] ?? "bg-gold/10 text-gold border-gold/20"}`}>{project.type}</span>
                      )}
                      {project.year && <span className="text-xs text-text-muted flex items-center gap-1"><Calendar size={10} />{project.year}</span>}
                    </div>
                    {project.director && <p className="text-xs text-text-muted mt-0.5 truncate">{project.director}</p>}
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="text-xs text-text-muted flex items-center gap-1"><Users size={11} />{project.crew_count}</span>
                  </div>
                </Link>
              ))}
            </div>

            {/* Desktop: full table */}
            <div className="hidden sm:block bg-bg-secondary border border-border rounded-2xl overflow-hidden">
              <div className="grid grid-cols-[2fr_80px_120px_1fr_64px] gap-4 px-5 py-3 border-b border-border bg-bg-elevated">
                {[
                  { label: "Titel", key: "title_asc" as SortKey },
                  { label: "Jahr",  key: "year_desc" as SortKey },
                  { label: "Typ",   key: null },
                  { label: "Regie", key: null },
                  { label: "Crew",  key: "crew_desc" as SortKey },
                ].map(({ label, key }) => (
                  <button key={label} onClick={() => key && setSort(key)}
                    className={`text-[10px] uppercase tracking-widest font-semibold text-left transition-colors flex items-center gap-1 ${
                      key && sort === key ? "text-gold" : "text-text-muted hover:text-text-secondary"
                    } ${!key ? "cursor-default" : ""}`}>
                    {label}
                    {key && sort === key && (sort.endsWith("asc") ? <ChevronDown size={10} className="rotate-180" /> : <ChevronDown size={10} />)}
                  </button>
                ))}
              </div>
              <div className="divide-y divide-border">
                {filtered.map((project) => (
                  <Link key={project.id} href={`/projects/${project.id}`}
                    className="grid grid-cols-[2fr_80px_120px_1fr_64px] gap-4 px-5 py-3.5 hover:bg-bg-elevated transition-colors group items-center">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-10 rounded shrink-0 bg-bg-elevated border border-border overflow-hidden flex items-center justify-center">
                        {project.poster_url
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={project.poster_url} alt="" className="w-full h-full object-cover" />
                          : <Clapperboard size={13} className="text-text-muted" />
                        }
                      </div>
                      <span className="text-sm font-semibold text-text-primary group-hover:text-gold transition-colors truncate">{project.title}</span>
                    </div>
                    <span className="text-sm text-text-secondary flex items-center gap-1">
                      <Calendar size={12} className="text-text-muted shrink-0" />{project.year ?? "—"}
                    </span>
                    <div>
                      {project.type
                        ? <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${TYPE_COLORS[project.type] ?? "bg-gold/10 text-gold border-gold/20"}`}>{project.type}</span>
                        : <span className="text-text-muted text-xs">—</span>
                      }
                    </div>
                    <span className="text-sm text-text-secondary truncate">{project.director ?? "—"}</span>
                    <span className="text-sm text-text-secondary flex items-center gap-1">
                      <Users size={12} className="text-text-muted shrink-0" />{project.crew_count}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Grid view */}
        {view === "grid" && filtered.length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((project) => (
              <Link key={project.id} href={`/projects/${project.id}`}
                className="card-hover group p-5 bg-bg-secondary border border-border rounded-2xl">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-12 h-16 rounded-lg overflow-hidden bg-bg-elevated border border-border shrink-0 flex items-center justify-center">
                    {project.poster_url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={project.poster_url} alt={project.title} className="w-full h-full object-cover object-top" />
                      : <Clapperboard size={18} className="text-text-muted" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="font-semibold text-text-primary group-hover:text-gold transition-colors leading-tight mb-1.5 line-clamp-2">{project.title}</h2>
                    <div className="flex items-center gap-2 flex-wrap">
                      {project.type && (
                        <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${TYPE_COLORS[project.type] ?? ""}`}>{project.type}</span>
                      )}
                      {project.year && (
                        <span className="flex items-center gap-1 text-xs text-text-muted"><Calendar size={10} /> {project.year}</span>
                      )}
                    </div>
                  </div>
                </div>
                {project.director && <p className="text-xs text-text-muted mb-2">Regie: {project.director}</p>}
                <div className="flex items-center gap-1 text-xs text-text-muted">
                  <Users size={11} /> {project.crew_count} {project.crew_count === 1 ? "Person" : "Personen"}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
