"use client";

import { useState, useMemo, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  MapPin, Briefcase, Clock, Search, ChevronRight, Zap, SlidersHorizontal,
  ChevronDown, X, Users2, Clapperboard, Video, Lightbulb, Wrench, Mic,
  Sparkles, Shirt, Palette, Monitor, Share2, Play, Camera, Scissors,
  Film, Smartphone, Aperture, Globe, ArrowUpDown,
} from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { FILM_DEPARTMENTS, DEPT_KEYWORDS, ALL_ROLES } from "@/lib/filmRoles";
import CategoryHero from "@/components/CategoryHero";

// ── Department icon map ───────────────────────────────────────────
const DEPT_ICON_MAP: Record<string, LucideIcon> = {
  "vor-der-kamera":  Users2,
  "regie":           Clapperboard,
  "kamera":          Video,
  "licht":           Lightbulb,
  "grip":            Wrench,
  "ton":             Mic,
  "maske":           Sparkles,
  "kostuem":         Shirt,
  "szenenbild":      Palette,
  "produktion":      Briefcase,
  "post":            Monitor,
  "content-creation":Share2,
  "social-video":    Play,
  "fotografie":      Camera,
  "foto-post":       Scissors,
};

const PLATFORM_META: { id: string; label: string; Icon: LucideIcon }[] = [
  { id: "film",   label: "Film & TV",      Icon: Film },
  { id: "social", label: "Social Media",   Icon: Smartphone },
  { id: "photo",  label: "Fotografie",     Icon: Aperture },
];

const PROJECT_TYPES = [
  "Spielfilm", "Kurzfilm", "Werbung", "Musikvideo", "TV / Serie", "Dokumentarfilm", "Corporate",
  "Instagram / Reels", "TikTok", "YouTube", "UGC Content", "Brand Content",
  "Fashion Shooting", "Produkt-Shooting", "Event-Fotografie", "Portrait-Shooting", "Werbe-Fotografie",
];

const PAY_TYPES = ["Paid", "Deferred", "Ehrenamtlich", "Expenses Only"];

const PAGE_SIZE = 24;

type Job = {
  id: string; title: string; company?: string; projectType?: string;
  location: string; rate: string; union?: string; shootDates?: string;
  urgent?: boolean; tags: string[]; posted?: string;
  description?: string; isReal?: boolean; jobType?: "freelance" | "festanstellung" | "praktikum";
};

function parseJobDescription(raw: string): { roleLabel?: string; company?: string; projectType?: string; shootDates?: string; urgent?: boolean; payType?: string; description: string } {
  const lines = raw.split("\n\n");
  if (lines.length < 2) return { description: raw };
  const metaLine = lines[0];
  const description = lines.slice(1).join("\n\n");
  const roleLabel = metaLine.match(/Rolle: ([^·\n]+)/)?.[1]?.trim();
  const company = metaLine.match(/Produktion: ([^·]+)/)?.[1]?.trim();
  const projectType = metaLine.match(/Typ: ([^·]+)/)?.[1]?.trim() ?? metaLine.match(/Projekttyp: ([^·]+)/)?.[1]?.trim();
  const shootDates = metaLine.match(/Drehtage: ([^·]+)/)?.[1]?.trim();
  const urgent = metaLine.includes("⚡ Dringend");
  const payType = metaLine.match(/Vergütung: ([^·]+)/)?.[1]?.trim();
  return { roleLabel, company, projectType, shootDates, urgent, payType, description };
}

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
        <div className="absolute top-full left-0 mt-1 z-50 bg-bg-elevated border border-border rounded-xl shadow-xl overflow-hidden min-w-[180px]">
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

// ─── Two-panel dept/role picker ───────────────────────────────────
function JobDeptPanel({
  activeDeptId, setActiveDeptId,
  selectedDeptId, selectedRoleId,
  onSelectDept, onSelectRole, onClose,
}: {
  activeDeptId: string; setActiveDeptId: (id: string) => void;
  selectedDeptId: string | null; selectedRoleId: string | null;
  onSelectDept: (deptId: string) => void;
  onSelectRole: (deptId: string, roleId: string | null) => void;
  onClose: () => void;
}) {
  const activeDept = FILM_DEPARTMENTS.find((d) => d.id === activeDeptId) ?? FILM_DEPARTMENTS[0];

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-bg-elevated">
      {/* Mobile: horizontal dept scroll + roles below */}
      <div className="sm:hidden">
        <div className="flex overflow-x-auto gap-1.5 p-3 border-b border-border bg-bg-secondary scrollbar-hide">
          {FILM_DEPARTMENTS.map((dept) => {
            const Icon = DEPT_ICON_MAP[dept.id] ?? Briefcase;
            const isActive = dept.id === activeDeptId;
            const isSelected = selectedDeptId === dept.id;
            return (
              <button key={dept.id}
                onClick={() => { setActiveDeptId(dept.id); onSelectDept(dept.id); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border shrink-0 transition-all ${
                  isActive ? `${dept.bg} ${dept.color} border-transparent` : "border-border text-text-muted"
                }`}>
                <Icon size={11} className={isActive ? dept.color : "text-text-muted"} />
                {dept.label}
                {isSelected && <span className="w-3.5 h-3.5 rounded-full bg-gold text-bg-primary text-[8px] font-bold flex items-center justify-center">✓</span>}
              </button>
            );
          })}
        </div>
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className={`text-sm font-semibold ${activeDept.color}`}>{activeDept.label}</h3>
            {selectedDeptId === activeDeptId && (
              <button onClick={() => onSelectRole(activeDeptId, null)} className="text-[10px] text-text-muted hover:text-red-400 transition-colors">Löschen</button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {activeDept.roles.map((role) => {
              const isSelected = selectedDeptId === activeDeptId && selectedRoleId === role.id;
              return (
                <button key={role.id}
                  onClick={() => { onSelectRole(activeDeptId, isSelected ? null : role.id); onClose(); }}
                  className={`text-left px-3 py-2.5 rounded-lg text-xs border transition-all ${
                    isSelected ? `${activeDept.bg} ${activeDept.color} font-semibold` : "border-border/60 text-text-muted"
                  }`}>
                  <div className="font-medium leading-tight">{role.label}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Desktop: two-panel */}
      <div className="hidden sm:flex" style={{ minHeight: 300 }}>
        <div className="w-52 shrink-0 border-r border-border overflow-y-auto bg-bg-secondary">
          {PLATFORM_META.map(({ id: platform, label: platformLabel, Icon: PlatformIcon }) => {
            const depts = FILM_DEPARTMENTS.filter((d) => d.platform === platform);
            return (
              <div key={platform}>
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-primary/40 border-b border-border/50">
                  <PlatformIcon size={10} className="text-text-muted shrink-0" />
                  <span className="text-[9px] uppercase tracking-widest text-text-muted font-semibold">{platformLabel}</span>
                </div>
                {depts.map((dept) => {
                  const Icon = DEPT_ICON_MAP[dept.id] ?? Briefcase;
                  const isActive = dept.id === activeDeptId;
                  const isSelected = selectedDeptId === dept.id;
                  return (
                    <button key={dept.id}
                      onMouseEnter={() => setActiveDeptId(dept.id)}
                      onClick={() => onSelectDept(dept.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs transition-colors border-b border-border/30 last:border-0 ${
                        isActive ? `${dept.bg} font-semibold` : "text-text-muted hover:text-text-secondary hover:bg-white/[0.02]"
                      }`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border ${isActive ? dept.bg : "bg-bg-elevated border-border"}`}>
                          <Icon size={10} className={isActive ? dept.color : "text-text-muted"} />
                        </span>
                        <span className={`truncate ${isActive ? dept.color : ""}`}>{dept.label}</span>
                      </div>
                      {isSelected && <span className="w-3.5 h-3.5 rounded-full bg-gold text-bg-primary text-[8px] font-bold flex items-center justify-center shrink-0">✓</span>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className={`text-sm font-semibold ${activeDept.color}`}>{activeDept.label}</h3>
            {selectedDeptId === activeDeptId && (
              <button onClick={() => onSelectRole(activeDeptId, null)} className="text-[10px] text-text-muted hover:text-red-400 transition-colors">Auswahl löschen</button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {activeDept.roles.map((role) => {
              const isSelected = selectedDeptId === activeDeptId && selectedRoleId === role.id;
              return (
                <button key={role.id}
                  onClick={() => { onSelectRole(activeDeptId, isSelected ? null : role.id); onClose(); }}
                  className={`text-left px-3 py-2 rounded-lg text-xs border transition-all ${
                    isSelected ? `${activeDept.bg} ${activeDept.color} font-semibold` : "border-border/60 text-text-muted hover:text-text-secondary hover:border-border hover:bg-white/[0.02]"
                  }`}>
                  <div className="font-medium leading-tight">{role.label}</div>
                  {role.labelEn && <div className="text-[10px] opacity-50 mt-0.5">{role.labelEn}</div>}
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
function JobsInner({ serverJobs }: { serverJobs: Job[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const allJobs = useMemo(() => serverJobs, [serverJobs]);

  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(() => searchParams.get("dept") ?? null);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(() => searchParams.get("role") ?? null);
  const [activePanelDept, setActivePanelDept] = useState(FILM_DEPARTMENTS[0].id);
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeType, setActiveType] = useState(() => searchParams.get("type") ?? "");
  const [urgentOnly, setUrgentOnly] = useState(() => searchParams.get("urgent") === "1");
  const [payTypeFilter, setPayTypeFilter] = useState(() => searchParams.get("pay") ?? "");
  const [jobTypeFilter, setJobTypeFilter] = useState<"alle" | "freelance" | "festanstellung" | "praktikum">("alle");
  const [cityFilter, setCityFilter] = useState(() => searchParams.get("city") ?? "");
  const [countryFilter, setCountryFilter] = useState(() => searchParams.get("country") ?? "");
  const [sortKey, setSortKey] = useState(() => searchParams.get("sort") ?? "newest");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!panelOpen) return;
    const h = (e: MouseEvent) => { if (panelRef.current && !panelRef.current.contains(e.target as Node)) setPanelOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [panelOpen]);

  // Sync URL
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (selectedDeptId) params.set("dept", selectedDeptId);
      if (selectedRoleId) params.set("role", selectedRoleId);
      if (activeType) params.set("type", activeType);
      if (urgentOnly) params.set("urgent", "1");
      if (payTypeFilter) params.set("pay", payTypeFilter);
      if (cityFilter) params.set("city", cityFilter);
      if (countryFilter) params.set("country", countryFilter);
      if (sortKey !== "newest") params.set("sort", sortKey);
      const qs = params.toString();
      router.replace(qs ? `/jobs?${qs}` : "/jobs", { scroll: false });
    }, 300);
    return () => clearTimeout(timer);
  }, [query, selectedDeptId, selectedRoleId, activeType, urgentOnly, payTypeFilter, cityFilter, countryFilter, sortKey, router]);

  const availableCities = useMemo(() => {
    const cities = allJobs.map((j) => j.location?.split(",")[0]?.trim()).filter(Boolean) as string[];
    return [...new Set(cities)].sort();
  }, [allJobs]);

  const filtered = useMemo(() => {
    let result = [...allJobs];

    // Dept / role filter
    if (selectedRoleId && selectedDeptId) {
      const role = ALL_ROLES.find((r) => r.id === selectedRoleId);
      if (role) {
        const roleLabel = role.label.toLowerCase();
        const roleLabelEn = (role.labelEn ?? "").toLowerCase();
        const deptKeys = DEPT_KEYWORDS[selectedDeptId] ?? [];
        result = result.filter((j) => {
          const t = j.title.toLowerCase();
          if (t.includes(roleLabel) || (roleLabelEn && t.includes(roleLabelEn))) return true;
          if (j.description) {
            const meta = j.description.split("\n\n")[0] ?? "";
            const roleMeta = meta.match(/Rolle: ([^·\n]+)/)?.[1]?.toLowerCase() ?? "";
            if (roleMeta && (roleMeta.includes(roleLabel) || deptKeys.some((k) => roleMeta.includes(k)))) return true;
          }
          return false;
        });
      }
    } else if (selectedDeptId) {
      const keys = DEPT_KEYWORDS[selectedDeptId] ?? [];
      if (keys.length > 0) {
        result = result.filter((j) => {
          const t = j.title.toLowerCase();
          if (keys.some((k) => t.includes(k))) return true;
          if (j.description) {
            const meta = j.description.split("\n\n")[0] ?? "";
            const roleMeta = meta.match(/Rolle: ([^·\n]+)/)?.[1]?.toLowerCase() ?? "";
            if (roleMeta && keys.some((k) => roleMeta.includes(k))) return true;
          }
          return false;
        });
      }
    }

    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter((j) =>
        j.title.toLowerCase().includes(q) ||
        (j.company ?? "").toLowerCase().includes(q) ||
        j.location.toLowerCase().includes(q) ||
        j.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    if (activeType) result = result.filter((j) => j.projectType === activeType || (j.projectType ?? "").includes(activeType));
    if (urgentOnly) result = result.filter((j) => j.urgent);
    if (payTypeFilter) {
      result = result.filter((j) => {
        if (!j.isReal) return true;
        const parsed = parseJobDescription(j.description ?? "");
        return parsed.payType === payTypeFilter;
      });
    }
    if (jobTypeFilter !== "alle") result = result.filter((j) => (j.jobType ?? "freelance") === jobTypeFilter);
    if (cityFilter) result = result.filter((j) => j.location?.toLowerCase().includes(cityFilter.toLowerCase()));
    if (countryFilter) {
      if (countryFilter === "Remote") {
        result = result.filter((j) => j.location?.toLowerCase().includes("remote"));
      } else {
        result = result.filter((j) => j.location?.toLowerCase().includes(countryFilter.toLowerCase()));
      }
    }
    if (sortKey === "rate-desc") result = [...result].sort((a, b) => parseInt(b.rate) - parseInt(a.rate));
    if (sortKey === "urgent") result = [...result].sort((a, b) => (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0));
    return result;
  }, [allJobs, query, selectedDeptId, selectedRoleId, activeType, urgentOnly, payTypeFilter, jobTypeFilter, cityFilter, countryFilter, sortKey]);

  useEffect(() => setVisibleCount(PAGE_SIZE), [filtered]);

  const handleSelectDept = (deptId: string) => {
    setSelectedDeptId(deptId);
    setSelectedRoleId(null);
    setPanelOpen(false);
  };
  const handleSelectRole = (deptId: string, roleId: string | null) => {
    if (roleId === null) { setSelectedRoleId(null); setSelectedDeptId(deptId); }
    else { setSelectedDeptId(deptId); setSelectedRoleId(roleId); }
  };

  const clearAll = () => {
    setSelectedDeptId(null); setSelectedRoleId(null);
    setQuery(""); setActiveType(""); setUrgentOnly(false);
    setPayTypeFilter(""); setJobTypeFilter("alle");
    setCityFilter(""); setCountryFilter(""); setSortKey("newest");
    router.replace("/jobs", { scroll: false });
  };

  const hasAnyFilter = Boolean(selectedDeptId || selectedRoleId || query || activeType || urgentOnly || payTypeFilter || jobTypeFilter !== "alle" || cityFilter || countryFilter);
  const hasDeptFilter = Boolean(selectedDeptId || selectedRoleId);

  const activeDeptData = selectedDeptId ? FILM_DEPARTMENTS.find((d) => d.id === selectedDeptId) : null;
  const activeRoleData = selectedRoleId ? ALL_ROLES.find((r) => r.id === selectedRoleId) : null;

  return (
    <div className="pt-16 min-h-screen">
      <CategoryHero
        badge="Jobs & Ausschreibungen"
        title="Jobs in Film, Social Media"
        titleHighlight="& Fotografie"
        description={`${allJobs.length} offene Stellen — von der Kameraassistenz bis zum Social Media Manager.`}
        image="https://images.unsplash.com/photo-1616469829941-c7200edec809?w=1600&q=90"
        imagePosition="center 35%"
        overlay="left"
        height="sm"
        cta={{ label: "Job ausschreiben", href: "/inserat" }}
      />

      {/* ── Filter Bar ───────────────────────────────────── */}
      <div className="bg-bg-secondary border-b border-border">
        <div className="px-4 py-2 space-y-2">

          {/* Row 1: Search */}
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 bg-bg-elevated border border-border rounded-lg px-3 focus-within:border-gold/50 transition-colors">
              <Search size={14} className="text-text-muted shrink-0" />
              <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Rolle, Fähigkeit, Stichwort..."
                className="bg-transparent border-none py-2 text-sm w-full focus:outline-none" />
              {query && <button onClick={() => setQuery("")} className="text-text-muted hover:text-text-primary transition-colors"><X size={12} /></button>}
            </div>
          </div>

          {/* Row 2: Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
            <SortDropdown
              value={sortKey}
              options={[
                { value: "newest",    label: "Neueste zuerst" },
                { value: "rate-desc", label: "Gage (hoch → niedrig)" },
                { value: "urgent",    label: "Dringend zuerst" },
              ]}
              onChange={setSortKey}
            />

            <div className="w-px h-6 bg-border shrink-0" />

            {/* Bereich & Rolle trigger */}
            <div ref={panelRef} className="relative shrink-0">
              <button onClick={() => setPanelOpen((v) => !v)}
                className={`flex items-center gap-2 h-9 px-3 rounded-lg text-xs font-medium border transition-all ${
                  panelOpen || hasDeptFilter
                    ? "bg-gold/12 border-gold/30 text-gold"
                    : "border-border text-text-muted hover:text-text-secondary"
                }`}>
                <SlidersHorizontal size={11} />
                Bereich & Rolle
                {hasDeptFilter && <span className="bg-gold text-bg-primary text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">✓</span>}
                <ChevronDown size={11} className={`transition-transform ${panelOpen ? "rotate-180" : ""}`} />
              </button>
            </div>

            <div className="w-px h-5 bg-border shrink-0" />

            {/* Projekttyp */}
            <FilterDropdown icon={Film} label="Projekttyp" value={activeType} options={PROJECT_TYPES} onChange={setActiveType} />

            {/* Vergütung */}
            <FilterDropdown icon={Briefcase} label="Vergütung" value={payTypeFilter} options={PAY_TYPES} onChange={setPayTypeFilter} />

            {/* Stadt */}
            {availableCities.length > 0 && (
              <FilterDropdown icon={MapPin} label="Stadt" value={cityFilter} options={availableCities} onChange={setCityFilter} />
            )}

            {/* Land */}
            <FilterDropdown icon={Globe} label="Land" value={countryFilter} options={["Deutschland", "Österreich", "Schweiz", "Remote"]} onChange={setCountryFilter} />

            {/* Dringend toggle */}
            <label className="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer hover:text-text-secondary transition-colors select-none shrink-0">
              <div onClick={() => setUrgentOnly((v) => !v)}
                className={`w-7 h-4 rounded-full transition-colors relative cursor-pointer ${urgentOnly ? "bg-gold" : "bg-border"}`}>
                <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${urgentOnly ? "left-3.5" : "left-0.5"}`} />
              </div>
              <Zap size={10} className={urgentOnly ? "text-gold" : ""} />
              Dringend
            </label>

            {/* Job type toggle */}
            <div className="flex bg-bg-elevated border border-border rounded-lg overflow-hidden shrink-0">
              {(["alle", "freelance", "festanstellung", "praktikum"] as const).map((t) => (
                <button key={t} onClick={() => setJobTypeFilter(t)}
                  className={`h-9 px-2.5 text-[11px] font-medium transition-all border-r border-border last:border-r-0 ${
                    jobTypeFilter === t ? "bg-gold text-bg-primary" : "text-text-muted hover:text-text-secondary"
                  }`}>
                  {t === "alle" ? "Alle" : t === "freelance" ? "Freelance" : t === "festanstellung" ? "Festanstellung" : "Praktikum"}
                </button>
              ))}
            </div>

            {hasAnyFilter && (
              <button onClick={clearAll} className="h-9 px-3 text-xs text-text-muted hover:text-red-400 transition-colors whitespace-nowrap border border-border rounded-lg hover:border-red-400/40 shrink-0">
                Löschen
              </button>
            )}

            <Link href="/inserat" className="hidden sm:flex items-center h-9 px-3 bg-gold text-bg-primary text-xs font-semibold rounded-lg hover:bg-gold-light transition-colors whitespace-nowrap shrink-0">
              + Job ausschreiben
            </Link>
          </div>

          {/* Dept panel */}
          {panelOpen && (
            <JobDeptPanel
              activeDeptId={activePanelDept}
              setActiveDeptId={setActivePanelDept}
              selectedDeptId={selectedDeptId}
              selectedRoleId={selectedRoleId}
              onSelectDept={handleSelectDept}
              onSelectRole={handleSelectRole}
              onClose={() => setPanelOpen(false)}
            />
          )}

          {/* Row 4: Active chips */}
          {(hasDeptFilter || activeType || urgentOnly || payTypeFilter || jobTypeFilter !== "alle" || cityFilter || countryFilter) && (
            <div className="flex flex-wrap gap-1.5 items-center">
              {activeDeptData && (
                <span className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border font-medium ${activeDeptData.bg} ${activeDeptData.color}`}>
                  {activeRoleData ? `${activeDeptData.label} › ${activeRoleData.label}` : activeDeptData.label}
                  <button onClick={() => { setSelectedDeptId(null); setSelectedRoleId(null); }} className="hover:opacity-70 transition-opacity ml-0.5"><X size={9} /></button>
                </span>
              )}
              {activeType && (
                <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border font-medium bg-bg-elevated border-border text-text-secondary">
                  {activeType}
                  <button onClick={() => setActiveType("")} className="hover:opacity-70 ml-0.5"><X size={9} /></button>
                </span>
              )}
              {payTypeFilter && (
                <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border font-medium bg-bg-elevated border-border text-text-secondary">
                  {payTypeFilter}
                  <button onClick={() => setPayTypeFilter("")} className="hover:opacity-70 ml-0.5"><X size={9} /></button>
                </span>
              )}
              {urgentOnly && (
                <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border font-medium bg-gold/10 border-gold/30 text-gold">
                  <Zap size={9} /> Dringend
                  <button onClick={() => setUrgentOnly(false)} className="hover:opacity-70 ml-0.5"><X size={9} /></button>
                </span>
              )}
              {jobTypeFilter !== "alle" && (
                <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border font-medium bg-bg-elevated border-border text-text-secondary">
                  {jobTypeFilter === "freelance" ? "Freelance" : jobTypeFilter === "festanstellung" ? "Festanstellung" : "Praktikum"}
                  <button onClick={() => setJobTypeFilter("alle")} className="hover:opacity-70 ml-0.5"><X size={9} /></button>
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
              <button onClick={clearAll} className="text-[11px] text-text-muted hover:text-red-400 transition-colors underline underline-offset-2 ml-1">
                Alle löschen
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Results ──────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-5">
          <p className="text-sm text-text-muted">
            <span className="text-text-primary font-semibold">{filtered.length} {filtered.length !== 1 ? "Stellen" : "Stelle"}</span> gefunden
            {query && <span className="text-gold"> für &ldquo;{query}&rdquo;</span>}
          </p>
        </div>

        {filtered.length === 0 && (
          <EmptyState icon={Briefcase} title="Keine Jobs gefunden"
            description="Versuche einen anderen Suchbegriff oder entferne aktive Filter."
            action={{ label: "Filter zurücksetzen", onClick: clearAll }} />
        )}

        <div className="space-y-2">
          {filtered.slice(0, visibleCount).map((job) => {
            const parsed = job.isReal ? parseJobDescription(job.description ?? "") : null;
            const roleLabel = parsed?.roleLabel;
            const company = parsed?.company ?? job.company;
            const projectType = parsed?.projectType ?? job.projectType;
            const shootDates = parsed?.shootDates ?? job.shootDates;
            const urgent = parsed?.urgent ?? job.urgent;
            const descPreview = (parsed?.description ?? job.description ?? "").replace(/\n+/g, " ").trim().slice(0, 120);
            const rateDisplay = !job.rate || job.rate === "0 €/Tag" || job.rate === "0" ? null : job.rate;

            const jobTypeMeta: Record<string, { label: string; cls: string }> = {
              festanstellung: { label: "Festanstellung", cls: "bg-violet-500/10 border-violet-500/20 text-violet-400" },
              praktikum:      { label: "Praktikum",      cls: "bg-sky-500/10 border-sky-500/20 text-sky-400" },
              freelance:      { label: "Freelance",      cls: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" },
            };
            const jobTypeBadge = job.jobType ? jobTypeMeta[job.jobType] : jobTypeMeta.freelance;

            return (
              <Link key={job.id} href={`/jobs/${job.id}`}
                suppressHydrationWarning
                className="card-hover group flex gap-4 p-4 rounded-xl border border-border bg-bg-secondary hover:bg-bg-elevated transition-colors block">

                {/* Icon */}
                <div className="w-10 h-10 rounded-lg bg-bg-elevated border border-border flex items-center justify-center shrink-0 mt-0.5">
                  <Briefcase size={16} className="text-text-muted group-hover:text-gold transition-colors" />
                </div>

                <div className="flex-1 min-w-0">
                  {/* Row 1: title + urgent + rate */}
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                      <h3 className="font-semibold text-sm text-text-primary group-hover:text-gold transition-colors leading-snug">{job.title}</h3>
                      {urgent && (
                        <span className="px-1.5 py-0.5 bg-crimson/15 border border-crimson/30 text-crimson-light text-[10px] rounded font-semibold shrink-0">Dringend</span>
                      )}
                    </div>
                    {rateDisplay && (
                      <span className="text-gold font-semibold text-xs shrink-0">{rateDisplay}</span>
                    )}
                  </div>

                  {/* Row 2: badges */}
                  <div className="flex flex-wrap items-center gap-1.5 mb-2">
                    <span className={`px-2 py-0.5 text-[10px] font-semibold rounded border ${jobTypeBadge.cls}`}>
                      {jobTypeBadge.label}
                    </span>
                    {roleLabel && (
                      <span className="px-2 py-0.5 bg-bg-elevated border border-border text-text-muted text-[10px] rounded font-medium">{roleLabel}</span>
                    )}
                    {projectType && (
                      <span className="px-2 py-0.5 bg-bg-elevated border border-border text-text-muted text-[10px] rounded">{projectType}</span>
                    )}
                    {company && (
                      <span className="text-[11px] text-text-muted">{company}</span>
                    )}
                  </div>

                  {/* Row 3: description preview */}
                  {descPreview && (
                    <p className="text-[11px] text-text-muted leading-relaxed line-clamp-1 mb-2">{descPreview}{descPreview.length === 120 ? "…" : ""}</p>
                  )}

                  {/* Row 4: meta */}
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-text-muted">
                    {job.location && <span className="flex items-center gap-1"><MapPin size={10} />{job.location}</span>}
                    {shootDates && <span className="flex items-center gap-1"><Clock size={10} />{shootDates}</span>}
                    <span className="ml-auto">{job.posted}</span>
                  </div>
                </div>

                <ChevronRight size={14} className="text-text-muted group-hover:text-gold transition-colors shrink-0 self-center" />
              </Link>
            );
          })}
        </div>

        {visibleCount < filtered.length && (
          <div className="mt-6 text-center">
            <button onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
              className="px-6 py-2.5 bg-bg-secondary border border-border rounded-lg text-sm text-text-secondary hover:border-gold hover:text-gold transition-colors">
              Mehr laden · {filtered.length - visibleCount} weitere Jobs
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function JobsContent({ serverJobs }: { serverJobs: Job[] }) {
  return (
    <Suspense fallback={<div className="pt-16 min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" /></div>}>
      <JobsInner serverJobs={serverJobs} />
    </Suspense>
  );
}
