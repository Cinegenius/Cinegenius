"use client";

import React, { useState, useMemo, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  MapPin, CheckCircle, Search, X, LayoutGrid, List, SlidersHorizontal, ChevronDown, Users, Globe, Languages,
} from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { departments, deptColors, type Department } from "@/lib/departments";

const PAGE_SIZE = 24;

export type ServerCreator = {
  id: string;
  name: string;
  role: string;
  positions: string[];
  location: string;
  image: string;       // cover image (portfolio or avatar)
  avatar: string;      // circular avatar (always avatar_url)
  rating: number;
  reviews: number;
  dayRate: string;
  available: boolean;
  credits: string[];
  skills: string[];
  bio?: string;
  languages?: string[];
  verified: boolean;
  isReal: true;
  // Casting-Felder
  profile_type?: string;
  hair_color?: string;
  eye_color?: string;
  body_type?: string;
  playing_age_min?: number | null;
  playing_age_max?: number | null;
  height_cm?: number | null;
  travel?: string;
};

function parseLocation(loc: string): { city: string; country: string } {
  const parts = loc.split(",").map((s) => s.trim()).filter(Boolean);
  return { city: parts[0] ?? "", country: parts[1] ?? "" };
}

function getPositions(c: ServerCreator): string[] {
  if (Array.isArray(c.positions) && c.positions.length > 0) return c.positions;
  return [c.role];
}

/** Normalize a role label: strip parentheses, split " / " alternatives */
function normalizeRole(label: string): string[] {
  return label
    .toLowerCase()
    .replace(/\([^)]+\)/g, " ")
    .split(" / ")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Match a creator against a department role label.
 *  Only checks positions + role (not skills) to avoid false positives
 *  from generic skill tags like "Kamera" matching "Kamera CCU Operator". */
function matchesRole(c: ServerCreator, roleLabel: string): boolean {
  const needles = normalizeRole(roleLabel);

  // Normalize stored positions/role the same way
  const haystack = [...getPositions(c), c.role]
    .flatMap((s) => normalizeRole(s));

  // A stored value matches if it includes the needle OR the needle includes it
  // BUT only when both sides are at least 4 chars to avoid "ccu".includes("c") style hits
  return needles.some((needle) =>
    haystack.some((s) => {
      if (s === needle) return true;
      if (needle.length >= 4 && s.includes(needle)) return true;
      if (s.length >= 4 && needle.includes(s)) return true;
      return false;
    })
  );
}

// ─── Filter Dropdown ────────────────────────────────────────────────────────

function FilterDropdown({
  icon: Icon,
  label,
  value,
  options,
  onChange,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const active = !!value;

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
          active
            ? "bg-gold/12 border-gold/30 text-gold"
            : open
            ? "bg-bg-elevated border-border-light text-text-secondary"
            : "border-border text-text-muted hover:text-text-secondary hover:border-border-light"
        }`}
      >
        <Icon size={11} />
        {active ? value : label}
        {active && (
          <span
            onClick={(e) => { e.stopPropagation(); onChange(""); setOpen(false); }}
            className="hover:text-red-400 transition-colors ml-0.5"
          >
            <X size={10} />
          </span>
        )}
        {!active && <ChevronDown size={11} className={`transition-transform ${open ? "rotate-180" : ""}`} />}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-bg-elevated border border-border rounded-xl shadow-xl overflow-hidden min-w-[140px] max-h-64 overflow-y-auto">
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => { onChange(opt); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-white/[0.04] ${
                value === opt ? "text-gold font-medium bg-gold/8" : "text-text-secondary"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Role Panel ─────────────────────────────────────────────────────────────

function RolePanel({
  dept,
  selectedRoles,
  occupiedRoles,
  onToggle,
  onClose,
}: {
  dept: Department;
  selectedRoles: Set<string>;
  occupiedRoles: Set<string>;
  onToggle: (role: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const colors = deptColors(dept.color);

  useEffect(() => {
    inputRef.current?.focus();
    setSearch("");
  }, [dept.id]);

  const deptRoles = dept.roles.filter((r) => occupiedRoles.has(r));

  const visible = useMemo(() => {
    if (!search.trim()) return deptRoles;
    const q = search.toLowerCase();
    return deptRoles.filter((r) => r.toLowerCase().includes(q));
  }, [deptRoles, search]);

  const selectedCount = deptRoles.filter((r) => selectedRoles.has(r)).length;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className={`flex items-center justify-between pb-2 mb-2 border-b border-border/60`}>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold ${colors.text}`}>{dept.label}</span>
          <span className="text-[11px] text-text-muted">{deptRoles.length} Rollen</span>
          {selectedCount > 0 && (
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${colors.bg} ${colors.border} border ${colors.text}`}>
              {selectedCount} aktiv
            </span>
          )}
        </div>
        <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors p-0.5 rounded hover:bg-white/5">
          <X size={13} />
        </button>
      </div>

      {/* Search */}
      <div className="mb-2">
        <div className="flex items-center gap-2 bg-bg-secondary border border-border rounded-lg px-2.5 py-1.5 focus-within:border-gold/50 transition-colors">
          <Search size={11} className="text-text-muted shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Suchen…"
            className="bg-transparent border-none text-xs w-full focus:outline-none text-text-secondary placeholder:text-text-muted"
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-text-muted hover:text-text-primary transition-colors">
              <X size={10} />
            </button>
          )}
        </div>
      </div>

      {/* Role grid */}
      <div className="flex-1 overflow-y-auto">
        {visible.length === 0 ? (
          <p className="text-xs text-text-muted text-center py-4">Keine Rollen gefunden</p>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-px">
            {visible.map((role) => {
              const active = selectedRoles.has(role);
              return (
                <label
                  key={role}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer transition-all group
                    ${active ? `${colors.bg} ${colors.text}` : `text-text-secondary hover:text-text-primary hover:bg-white/[0.03]`}`}
                >
                  <div className={`w-3 h-3 rounded border flex items-center justify-center shrink-0 transition-all
                    ${active ? `${colors.border} bg-current/20` : "border-border group-hover:border-border-light"}`}>
                    {active && <div className="w-1.5 h-1.5 rounded-sm bg-current" />}
                  </div>
                  <input type="checkbox" checked={active} onChange={() => onToggle(role)} className="sr-only" />
                  <span className="text-[11px] leading-snug">{role}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

function CreatorsInner({ serverCreators, hasStrip }: { serverCreators: ServerCreator[]; hasStrip?: boolean }) {
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [cityFilter, setCityFilter] = useState(() => searchParams.get("city") ?? "");
  const [countryFilter, setCountryFilter] = useState("");
  const [languageFilter, setLanguageFilter] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);

  // allCreators muss VOR den useMemo-Aufrufen deklariert sein
  const [allCreators, setAllCreators] = useState<ServerCreator[]>(serverCreators);
  const [apiPage, setApiPage] = useState(1);
  const [hasMoreFromApi, setHasMoreFromApi] = useState(serverCreators.length >= 96);
  const [loadingMore, setLoadingMore] = useState(false);

  async function loadMoreFromApi() {
    if (loadingMore || !hasMoreFromApi) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/creators?page=${apiPage}`);
      const { creators, hasMore } = await res.json();
      if (creators?.length) {
        setAllCreators(prev => [...prev, ...creators]);
        setApiPage(p => p + 1);
      }
      setHasMoreFromApi(!!hasMore);
    } catch { /* ignore */ } finally {
      setLoadingMore(false);
    }
  }

  // Derive available filter options from real data only
  const { availableCities, availableCountries, availableLanguages } = useMemo(() => {
    const cities = new Set<string>();
    const countries = new Set<string>();
    const langs = new Set<string>();
    for (const c of allCreators) {
      const { city, country } = parseLocation(c.location);
      if (city) cities.add(city);
      if (country) countries.add(country);
      for (const l of c.languages ?? []) if (l) langs.add(l);
    }
    return {
      availableCities:     [...cities].sort(),
      availableCountries:  [...countries].sort(),
      availableLanguages:  [...langs].sort(),
    };
  }, [allCreators]);
  const [sortKey, setSortKey] = useState("featured");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Neue Casting-Filter
  const [profileTypeFilter, setProfileTypeFilter] = useState("");
  const [hairFilter, setHairFilter] = useState("");
  const [eyeFilter, setEyeFilter] = useState("");
  const [bodyFilter, setBodyFilter] = useState("");
  const [ageMinFilter, setAgeMinFilter] = useState("");
  const [ageMaxFilter, setAgeMaxFilter] = useState("");
  const [travelFilter, setTravelFilter] = useState("");

  // Optionen aus echten Daten ableiten
  const { availableProfileTypes, availableHairColors, availableEyeColors, availableBodyTypes } = useMemo(() => {
    const types = new Set<string>();
    const hair  = new Set<string>();
    const eye   = new Set<string>();
    const body  = new Set<string>();
    for (const c of allCreators) {
      if (c.profile_type) types.add(c.profile_type);
      if (c.hair_color)   hair.add(c.hair_color);
      if (c.eye_color)    eye.add(c.eye_color);
      if (c.body_type)    body.add(c.body_type);
    }
    return {
      availableProfileTypes: [...types].sort(),
      availableHairColors:   [...hair].sort(),
      availableEyeColors:    [...eye].sort(),
      availableBodyTypes:    [...body].sort(),
    };
  }, [allCreators]);

  const PROFILE_TYPE_DE: Record<string, string> = {
    actor:"Schauspieler/in", model:"Model", extra:"Komparse", host:"Moderator/in",
    dancer:"Tänzer/in", stunt:"Stunt Performer", voiceover:"Synchronsprecher/in",
    creator:"Creator", camera:"Kamera", lighting:"Licht", sound:"Ton",
    director_of_photography:"DoP", director:"Regie", production:"Produktion",
    makeup:"Maske", costume:"Kostüm", postproduction:"Postproduktion",
    vfx:"VFX", sfx:"SFX", art_department:"Szenenbild", broadcast:"Broadcast",
    filmmaker:"Regisseur/in", writer:"Autor/in", photographer:"Fotograf/in",
    editor:"Editor/in", motion_designer:"Motion Designer", art_director:"Art Director",
    location:"Location", equipment:"Equipment", vehicle:"Fahrzeuge",
    studio:"Studio", props:"Requisiten",
  };

  const TRAVEL_DE: Record<string, string> = {
    regional:"Regional", national:"Deutschlandweit",
    european:"Europaweit", worldwide:"Weltweit",
  };
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Hierarchical filter state
  const [filterOpen, setFilterOpen] = useState(false);
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());

  // Which department roles actually have at least one creator
  const occupiedRoles = useMemo(() => {
    const set = new Set<string>();
    for (const c of allCreators) {
      for (const dept of departments) {
        for (const role of dept.roles) {
          if (!set.has(role) && matchesRole(c, role)) set.add(role);
        }
      }
    }
    return set;
  }, [allCreators]);

  // Only show departments that have at least one occupied role
  const activeDepts = useMemo(
    () => departments.filter((d) => d.roles.some((r) => occupiedRoles.has(r))),
    [occupiedRoles]
  );

  const [activeDept, setActiveDept] = useState<string>(() => activeDepts[0]?.id ?? departments[0].id);

  const toggleRole = (role: string) =>
    setSelectedRoles((prev) => {
      const next = new Set(prev);
      next.has(role) ? next.delete(role) : next.add(role);
      return next;
    });

  const removeRole = (role: string) =>
    setSelectedRoles((prev) => { const n = new Set(prev); n.delete(role); return n; });

  const clearAll = () => { setSelectedRoles(new Set()); };

  const activeDeptData = activeDepts.find((d) => d.id === activeDept) ?? activeDepts[0] ?? departments[0];

  // Filtered results
  const filtered = useMemo(() => {
    let result = [...allCreators];

    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        getPositions(c).some((p) => p.toLowerCase().includes(q)) ||
        c.role.toLowerCase().includes(q) ||
        c.location.toLowerCase().includes(q) ||
        c.skills.some((s) => s.toLowerCase().includes(q))
      );
    }

    if (selectedRoles.size > 0) {
      result = result.filter((c) =>
        [...selectedRoles].some((role) => matchesRole(c, role))
      );
    }

    if (availableOnly) result = result.filter((c) => c.available);

    if (cityFilter) {
      result = result.filter((c) => parseLocation(c.location).city === cityFilter);
    }
    if (countryFilter) {
      result = result.filter((c) => parseLocation(c.location).country === countryFilter);
    }
    if (languageFilter) {
      result = result.filter((c) => c.languages?.includes(languageFilter));
    }

    if (profileTypeFilter) result = result.filter(c => c.profile_type === profileTypeFilter);
    if (hairFilter)        result = result.filter(c => c.hair_color === hairFilter);
    if (eyeFilter)         result = result.filter(c => c.eye_color === eyeFilter);
    if (bodyFilter)        result = result.filter(c => c.body_type === bodyFilter);
    if (travelFilter)      result = result.filter(c => c.travel === travelFilter);

    if (ageMinFilter) {
      const min = Number(ageMinFilter);
      result = result.filter(c =>
        c.playing_age_max == null || c.playing_age_max >= min
      );
    }
    if (ageMaxFilter) {
      const max = Number(ageMaxFilter);
      result = result.filter(c =>
        c.playing_age_min == null || c.playing_age_min <= max
      );
    }

    if (sortKey === "rating") result.sort((a, b) => b.rating - a.rating);
    if (sortKey === "reviews") result.sort((a, b) => b.reviews - a.reviews);

    return result;
  }, [query, selectedRoles, availableOnly, cityFilter, countryFilter, languageFilter,
      profileTypeFilter, hairFilter, eyeFilter, bodyFilter, travelFilter, ageMinFilter, ageMaxFilter,
      sortKey, allCreators]);

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [filtered]);

  // Active filter chips: group by dept for context
  const activeChips = useMemo(() =>
    [...selectedRoles].map((role) => {
      const dept = departments.find((d) => d.roles.includes(role));
      return { role, dept };
    }),
    [selectedRoles]
  );

  return (
    <div className={`${hasStrip ? "" : "pt-16 "}min-h-screen`}>

      {/* ── Filter Bar ─────────────────────────────────────────────────────── */}
      <div className="bg-bg-secondary border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-3">

          {/* Row 1: Search */}
          <div className="flex items-center gap-2 bg-bg-elevated border border-border rounded-lg px-3 focus-within:border-gold/50 transition-colors">
            <Search size={14} className="text-text-muted shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name, Skill suchen…"
              className="bg-transparent border-none py-2.5 text-sm w-full focus:outline-none"
            />
            {query && (
              <button onClick={() => setQuery("")} className="text-text-muted hover:text-text-primary transition-colors">
                <X size={12} />
              </button>
            )}
          </div>

          {/* Row 2: Controls — horizontal scroll on mobile */}
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
            {/* Available toggle */}
            <label className="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer hover:text-text-secondary transition-colors select-none shrink-0">
              <div
                onClick={() => setAvailableOnly((v) => !v)}
                className={`w-7 h-4 rounded-full transition-colors relative cursor-pointer ${availableOnly ? "bg-gold" : "bg-border"}`}
              >
                <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${availableOnly ? "left-3.5" : "left-0.5"}`} />
              </div>
              Verfügbar
            </label>

            <div className="w-px h-4 bg-border shrink-0" />

            {/* View toggle */}
            <div className="flex bg-bg-elevated border border-border rounded-lg overflow-hidden shrink-0">
              <button onClick={() => setViewMode("grid")} className={`p-2 transition-colors ${viewMode === "grid" ? "bg-gold text-bg-primary" : "text-text-muted hover:text-text-primary"}`}>
                <LayoutGrid size={13} />
              </button>
              <button onClick={() => setViewMode("list")} className={`p-2 transition-colors border-l border-border ${viewMode === "list" ? "bg-gold text-bg-primary" : "text-text-muted hover:text-text-primary"}`}>
                <List size={13} />
              </button>
            </div>

            {/* Sort */}
            <div className="relative flex items-center shrink-0">
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value)}
                className="appearance-none text-xs py-2 pl-3 pr-7 bg-bg-elevated border border-border rounded-lg text-text-secondary focus:outline-none focus:border-gold/50 transition-colors cursor-pointer"
              >
                <option value="featured">Empfohlen</option>
                <option value="rating">Beste Bewertung</option>
                <option value="reviews">Meiste Bewertungen</option>
              </select>
              <ChevronDown size={11} className="absolute right-2 text-text-muted pointer-events-none" />
            </div>
          </div>

          {/* Row 2: Filter — horizontal scroll on mobile */}
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
            <button
              onClick={() => setFilterOpen((v) => !v)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all shrink-0 ${
                filterOpen || selectedRoles.size > 0
                  ? "bg-gold/12 border-gold/30 text-gold"
                  : "border-border text-text-muted hover:text-text-secondary hover:border-border-light"
              }`}
            >
              <SlidersHorizontal size={11} />
              Gewerk & Rollen
              {selectedRoles.size > 0 && (
                <span className="bg-gold text-bg-primary text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {selectedRoles.size}
                </span>
              )}
              <ChevronDown size={11} className={`transition-transform ${filterOpen ? "rotate-180" : ""}`} />
            </button>

            <div className="w-px h-5 bg-border shrink-0" />

            {availableCities.length > 0 && (
              <FilterDropdown icon={MapPin} label="Stadt" value={cityFilter} options={availableCities} onChange={setCityFilter} />
            )}
            {availableLanguages.length > 0 && (
              <FilterDropdown icon={Languages} label="Sprache" value={languageFilter} options={availableLanguages} onChange={setLanguageFilter} />
            )}

            <button
              onClick={() => setMoreFiltersOpen((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all shrink-0 ${
                moreFiltersOpen || [profileTypeFilter, hairFilter, eyeFilter, travelFilter, ageMinFilter, ageMaxFilter, countryFilter].some(Boolean)
                  ? "bg-gold/12 border-gold/30 text-gold"
                  : "border-border text-text-muted hover:text-text-secondary hover:border-border-light"
              }`}
            >
              <SlidersHorizontal size={11} />
              Mehr Filter
              {[profileTypeFilter, hairFilter, eyeFilter, travelFilter, ageMinFilter, ageMaxFilter, countryFilter].filter(Boolean).length > 0 && (
                <span className="bg-gold text-bg-primary text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {[profileTypeFilter, hairFilter, eyeFilter, travelFilter, ageMinFilter, ageMaxFilter, countryFilter].filter(Boolean).length}
                </span>
              )}
              <ChevronDown size={11} className={`transition-transform ${moreFiltersOpen ? "rotate-180" : ""}`} />
            </button>

            {(cityFilter || countryFilter || languageFilter || selectedRoles.size > 0 ||
              profileTypeFilter || hairFilter || eyeFilter || bodyFilter || travelFilter || ageMinFilter || ageMaxFilter) && (
              <button
                onClick={() => {
                  clearAll();
                  setCityFilter(""); setCountryFilter(""); setLanguageFilter("");
                  setProfileTypeFilter(""); setHairFilter(""); setEyeFilter("");
                  setBodyFilter(""); setTravelFilter(""); setAgeMinFilter(""); setAgeMaxFilter("");
                }}
                className="text-[11px] text-text-muted hover:text-red-400 transition-colors shrink-0"
              >
                Alle löschen
              </button>
            )}
          </div>

          {/* Mehr Filter (ausgeklappt) */}
          {moreFiltersOpen && (
            <div className="flex items-center gap-2 flex-wrap pt-1">
              {availableCountries.length > 0 && (
                <FilterDropdown icon={Globe} label="Land" value={countryFilter} options={availableCountries} onChange={setCountryFilter} />
              )}
              {availableProfileTypes.length > 0 && (
                <FilterDropdown
                  icon={Users}
                  label="Profiltyp"
                  value={profileTypeFilter ? (PROFILE_TYPE_DE[profileTypeFilter] ?? profileTypeFilter) : ""}
                  options={availableProfileTypes.map(t => PROFILE_TYPE_DE[t] ?? t)}
                  onChange={v => {
                    const found = availableProfileTypes.find(t => (PROFILE_TYPE_DE[t] ?? t) === v);
                    setProfileTypeFilter(found ?? "");
                  }}
                />
              )}
              {availableHairColors.length > 0 && (
                <FilterDropdown icon={SlidersHorizontal} label="Haarfarbe" value={hairFilter} options={availableHairColors} onChange={setHairFilter} />
              )}
              {availableEyeColors.length > 0 && (
                <FilterDropdown icon={SlidersHorizontal} label="Augenfarbe" value={eyeFilter} options={availableEyeColors} onChange={setEyeFilter} />
              )}
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-xs text-text-muted whitespace-nowrap">Spielalter</span>
                <input type="number" min="1" max="99" value={ageMinFilter} onChange={e => setAgeMinFilter(e.target.value)}
                  placeholder="von" className="w-14 bg-bg-elevated border border-border rounded-lg px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-gold transition-colors" />
                <span className="text-xs text-text-muted">–</span>
                <input type="number" min="1" max="99" value={ageMaxFilter} onChange={e => setAgeMaxFilter(e.target.value)}
                  placeholder="bis" className="w-14 bg-bg-elevated border border-border rounded-lg px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-gold transition-colors" />
              </div>
              <FilterDropdown
                icon={Globe}
                label="Reisen"
                value={travelFilter ? (TRAVEL_DE[travelFilter] ?? travelFilter) : ""}
                options={Object.values(TRAVEL_DE)}
                onChange={v => {
                  const found = Object.entries(TRAVEL_DE).find(([, label]) => label === v)?.[0] ?? "";
                  setTravelFilter(found);
                }}
              />
            </div>
          )}

          {/* Row 3: Department + Roles panel */}
          {filterOpen && (
            <div className="border border-border rounded-xl overflow-hidden bg-bg-elevated">
              {/* Mobile: horizontal dept scroll + roles below */}
              <div className="sm:hidden">
                <div className="flex overflow-x-auto gap-1.5 p-3 border-b border-border bg-bg-secondary" style={{ scrollbarWidth: "none" }}>
                  {activeDepts.map((dept) => {
                    const colors = deptColors(dept.color);
                    const deptSelected = dept.roles.filter((r) => selectedRoles.has(r) && occupiedRoles.has(r)).length;
                    const isActive = activeDept === dept.id;
                    return (
                      <button key={dept.id} onClick={() => setActiveDept(dept.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border shrink-0 transition-all ${
                          isActive ? `${colors.bg} ${colors.text} border-transparent` : "border-border text-text-muted"
                        }`}>
                        {dept.emoji} {dept.label}
                        {deptSelected > 0 && <span className={`w-3.5 h-3.5 rounded-full text-[8px] font-bold flex items-center justify-center ${colors.bg} ${colors.text}`}>{deptSelected}</span>}
                      </button>
                    );
                  })}
                </div>
                <div className="p-3">
                  <RolePanel dept={activeDeptData} selectedRoles={selectedRoles} occupiedRoles={occupiedRoles} onToggle={toggleRole} onClose={() => setFilterOpen(false)} />
                </div>
              </div>
              {/* Desktop: two-panel */}
              <div className="hidden sm:flex" style={{ minHeight: "260px" }}>
                <div className="w-44 shrink-0 border-r border-border overflow-y-auto bg-bg-secondary">
                  {activeDepts.map((dept) => {
                    const colors = deptColors(dept.color);
                    const deptSelected = dept.roles.filter((r) => selectedRoles.has(r) && occupiedRoles.has(r)).length;
                    const isActive = activeDept === dept.id;
                    return (
                      <button key={dept.id}
                        onMouseEnter={() => setActiveDept(dept.id)}
                        onClick={() => setActiveDept(dept.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs transition-colors border-b border-border/40 last:border-0 ${
                          isActive ? `${colors.bg} ${colors.text} font-semibold` : "text-text-muted hover:text-text-secondary hover:bg-white/[0.02]"
                        }`}>
                        <span>{dept.label}</span>
                        {deptSelected > 0 && (
                          <span className={`text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${colors.bg} border ${colors.border} ${colors.text}`}>{deptSelected}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="flex-1 overflow-y-auto p-3">
                  <RolePanel dept={activeDeptData} selectedRoles={selectedRoles} occupiedRoles={occupiedRoles} onToggle={toggleRole} onClose={() => setFilterOpen(false)} />
                </div>
              </div>
            </div>
          )}

          {/* Row 4: Active filter chips */}
          {activeChips.length > 0 && (
            <div className="flex flex-wrap gap-1.5 items-center">
              {activeChips.map(({ role, dept }) => {
                const colors = dept ? deptColors(dept.color) : deptColors("slate");
                return (
                  <span
                    key={role}
                    className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border font-medium ${colors.bg} ${colors.border} ${colors.text}`}
                  >
                    {dept?.emoji} {role}
                    <button onClick={() => removeRole(role)} className="hover:opacity-70 transition-opacity ml-0.5">
                      <X size={9} />
                    </button>
                  </span>
                );
              })}
              <button
                onClick={clearAll}
                className="text-[11px] text-text-muted hover:text-red-400 transition-colors underline underline-offset-2 ml-1"
              >
                Alle löschen
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Results ─────────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* Count */}
        <p className="text-sm text-text-muted mb-5">
          <span className="text-text-primary font-semibold">
            {filtered.length} {filtered.length !== 1 ? "Profile" : "Profil"}
          </span>{" "}
          gefunden
          {query && <span className="text-gold"> für &ldquo;{query}&rdquo;</span>}
          {filtered.length > visibleCount && (
            <span className="text-text-muted"> · zeige {visibleCount}</span>
          )}
        </p>

        {filtered.length === 0 && (
          <EmptyState
            icon={Users}
            title="Keine Profile gefunden"
            description="Versuche andere Rollen, einen anderen Namen oder eine andere Stadt."
            action={{
              label: "Filter zurücksetzen",
              onClick: () => { setQuery(""); clearAll(); setAvailableOnly(false); setCityFilter(""); setCountryFilter(""); setLanguageFilter(""); },
            }}
          />
        )}

        {/* Card grid */}
        <div className={viewMode === "grid" ? "grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3" : "space-y-2"}>
          {filtered.slice(0, visibleCount).map((c) => {
            const displayPositions = getPositions(c);

            if (viewMode === "list") {
              return (
                <Link
                  key={c.id}
                  href={c.id.startsWith("listing_") ? `/creators/${c.id.replace("listing_", "")}` : `/profile/${c.id}`}
                  suppressHydrationWarning
                  className="card-hover group flex items-center gap-4 p-4 rounded-xl border border-border bg-bg-secondary hover:bg-bg-elevated transition-colors"
                >
                  <div className="relative shrink-0">
                    {c.avatar ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={c.avatar} alt={c.name} loading="lazy" decoding="async"
                        className="w-12 h-12 rounded-full object-cover border-2 border-border group-hover:border-gold transition-colors" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-bg-elevated border-2 border-border flex items-center justify-center text-text-muted">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-semibold text-text-primary text-sm">{c.name}</h3>
                      {c.verified && <CheckCircle size={12} className="text-success shrink-0" />}
                    </div>
                    <p className="text-xs text-gold truncate">{displayPositions.slice(0, 2).join(" · ")}</p>
                    <p className="text-xs text-text-muted flex items-center gap-1 mt-0.5">
                      <MapPin size={10} /> {c.location}
                    </p>
                  </div>
                  {c.skills.length > 0 && (
                    <div className="hidden sm:flex gap-1.5 shrink-0">
                      {c.skills.slice(0, 2).map((s) => (
                        <span key={s} className="text-[10px] px-2 py-0.5 bg-bg-elevated border border-border text-text-muted rounded-full">{s}</span>
                      ))}
                    </div>
                  )}
                </Link>
              );
            }

            return (
              <Link
                key={c.id}
                href={c.id.startsWith("listing_") ? `/creators/${c.id.replace("listing_", "")}` : `/profile/${c.id}`}
                suppressHydrationWarning
                className="card-hover group rounded-xl border border-border bg-bg-secondary overflow-hidden block"
              >
                {/* Cover image — kein doppelter Avatar-Circle */}
                <div className="h-32 overflow-hidden bg-bg-elevated">
                  {c.image ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={c.image} alt={c.name} loading="lazy" decoding="async"
                      className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300" />
                  ) : c.avatar ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={c.avatar} alt={c.name} loading="lazy" decoding="async"
                      className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-text-muted/20">
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <div className="min-w-0 mb-2">
                    <div className="flex items-start justify-between gap-1 mb-0.5">
                      <h3 className="font-semibold text-text-primary text-sm leading-tight truncate">{c.name}</h3>
                      {c.verified && <CheckCircle size={12} className="text-success shrink-0 mt-0.5" />}
                    </div>
                    <div className="flex flex-wrap gap-1 mb-0.5">
                      {displayPositions.slice(0, 1).map((p) => (
                        <span key={p} className="text-[11px] text-gold font-medium truncate">{p}</span>
                      ))}
                    </div>
                    {c.location && (
                      <p className="text-[11px] text-text-muted flex items-center gap-0.5">
                        <MapPin size={9} /> {c.location}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-end pt-2 border-t border-border">
                    <span className="text-xs text-gold font-semibold group-hover:text-gold-light transition-colors">
                      Anfragen →
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {(filtered.length > visibleCount || hasMoreFromApi) && (
          <div className="mt-8 text-center">
            <button
              onClick={() => {
                if (filtered.length > visibleCount) {
                  setVisibleCount((v) => v + PAGE_SIZE);
                } else {
                  // Alle gefilterten Profile sichtbar — nächste Seite vom Server laden
                  loadMoreFromApi();
                }
              }}
              disabled={loadingMore}
              className="px-8 py-3 border border-border text-sm font-semibold text-text-secondary hover:border-gold hover:text-gold rounded-xl transition-all disabled:opacity-50 flex items-center gap-2 mx-auto"
            >
              {loadingMore
                ? <><span className="w-4 h-4 border-2 border-gold border-t-transparent rounded-full animate-spin inline-block" /> Lädt…</>
                : filtered.length > visibleCount
                  ? `Mehr laden · ${filtered.length - visibleCount} weitere`
                  : "Weitere Profile laden"
              }
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CreatorsContent({
  serverCreators,
  hasStrip,
}: {
  serverCreators: ServerCreator[];
  hasStrip?: boolean;
}) {
  return (
    <Suspense
      fallback={
        <div className="pt-16 min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <CreatorsInner serverCreators={serverCreators} hasStrip={hasStrip} />
    </Suspense>
  );
}
