"use client";

import React, { useState, useMemo, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import {
  MapPin, CheckCircle, Search, X, LayoutGrid, List, SlidersHorizontal, ChevronDown, Users, Globe, Languages, ArrowUpDown, Plus,
  Clapperboard, Video, Lightbulb, Mic, Palette, Shirt, Sparkles, Scissors, Music, Truck, Star, Zap, Tv, MonitorPlay, FileText, Smartphone, Camera, Bot,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { departments, deptColors, getDeptLabel, type Department } from "@/lib/departments";

const DEPT_ICON: Record<string, LucideIcon> = {
  produktion:    Clapperboard,
  regie:         Clapperboard,
  kamera:        Video,
  licht:         Lightbulb,
  ton:           Mic,
  art:           Palette,
  kostuem:       Shirt,
  maske:         Sparkles,
  post:          Scissors,
  musik:         Music,
  "set-logistik":Truck,
  cast:          Star,
  sfx:           Zap,
  broadcast:     Tv,
  virtual:       MonitorPlay,
  redaktion:     FileText,
  social:        Smartphone,
  foto:          Camera,
  ki:            Bot,
};

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
  focal_point?: { x: number; y: number };
  isVendor?: boolean;
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
        className={`flex items-center gap-2 h-9 px-3 rounded-lg text-xs font-medium border transition-all ${
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

function SortDropdown({ value, options, onChange }: { value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);
  const label = options.find((o) => o.value === value)?.label ?? "Sortierung";
  return (
    <div ref={ref} className="relative shrink-0">
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 h-9 px-3 rounded-lg text-xs font-medium border border-border text-text-muted hover:text-text-secondary transition-all bg-bg-elevated">
        <ArrowUpDown size={11} />
        {label}
        <ChevronDown size={11} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-bg-elevated border border-border rounded-xl shadow-xl overflow-hidden min-w-[160px]">
          {options.map((o) => (
            <button key={o.value} onClick={() => { onChange(o.value); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-white/[0.04] ${value === o.value ? "text-gold font-medium bg-gold/8" : "text-text-secondary"}`}>
              {o.label}
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
  locale,
}: {
  dept: Department;
  selectedRoles: Set<string>;
  occupiedRoles: Set<string>;
  onToggle: (role: string) => void;
  onClose: () => void;
  locale: string;
}) {
  const t = useTranslations("creators");
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
          <span className={`text-xs font-semibold ${colors.text}`}>{getDeptLabel(dept, locale)}</span>
          <span className="text-[11px] text-text-muted">{t("deptRoles", { count: deptRoles.length })}</span>
          {selectedCount > 0 && (
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${colors.bg} ${colors.border} border ${colors.text}`}>
              {t("activeRoles", { count: selectedCount })}
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
            placeholder={t("searchRoles")}
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
          <p className="text-xs text-text-muted text-center py-4">{t("noRolesFound")}</p>
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
  const tc = useTranslations("common");
  const t = useTranslations("creators");
  const locale = useLocale();

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
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");

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

  const PROFILE_TYPE_LABELS: Record<string, Record<string, string>> = {
    de: { actor:"Schauspieler/in", model:"Model", extra:"Komparse/in", host:"Moderator/in", dancer:"Tänzer/in", stunt:"Stunt Performer", voiceover:"Synchronsprecher/in", creator:"Creator", camera:"Kamera", lighting:"Licht", sound:"Ton", director_of_photography:"DoP", director:"Regie", production:"Produktion", makeup:"Maske", costume:"Kostüm", postproduction:"Postproduktion", vfx:"VFX", sfx:"SFX", art_department:"Szenenbild", broadcast:"Broadcast", filmmaker:"Regisseur/in", writer:"Autor/in", photographer:"Fotograf/in", editor:"Editor/in", motion_designer:"Motion Designer", art_director:"Art Director", location:"Location", equipment:"Equipment", vehicle:"Fahrzeuge", studio:"Studio", props:"Requisiten" },
    en: { actor:"Actor/Actress", model:"Model", extra:"Extra", host:"Host", dancer:"Dancer", stunt:"Stunt Performer", voiceover:"Voice Over", creator:"Creator", camera:"Camera", lighting:"Lighting", sound:"Sound", director_of_photography:"DoP", director:"Director", production:"Production", makeup:"Make-up", costume:"Costume", postproduction:"Post-Production", vfx:"VFX", sfx:"SFX", art_department:"Art Department", broadcast:"Broadcast", filmmaker:"Filmmaker", writer:"Writer", photographer:"Photographer", editor:"Editor", motion_designer:"Motion Designer", art_director:"Art Director", location:"Location", equipment:"Equipment", vehicle:"Vehicles", studio:"Studio", props:"Props" },
    es: { actor:"Actor/Actriz", model:"Modelo", extra:"Extra", host:"Presentador/a", dancer:"Bailarín/a", stunt:"Especialista", voiceover:"Actor/a de doblaje", creator:"Creador/a", camera:"Cámara", lighting:"Iluminación", sound:"Sonido", director_of_photography:"DoP", director:"Director/a", production:"Producción", makeup:"Maquillaje", costume:"Vestuario", postproduction:"Postproducción", vfx:"VFX", sfx:"SFX", art_department:"Arte", broadcast:"Broadcast", filmmaker:"Cineasta", writer:"Guionista", photographer:"Fotógrafo/a", editor:"Editor/a", motion_designer:"Motion Designer", art_director:"Dir. de Arte", location:"Locación", equipment:"Equipamiento", vehicle:"Vehículos", studio:"Estudio", props:"Atrezzo" },
    it: { actor:"Attore/Attrice", model:"Modello/a", extra:"Comparsa", host:"Presentatore/trice", dancer:"Ballerino/a", stunt:"Stuntman/woman", voiceover:"Doppiatore/trice", creator:"Creator", camera:"Camera", lighting:"Illuminazione", sound:"Suono", director_of_photography:"DoP", director:"Regista", production:"Produzione", makeup:"Trucco", costume:"Costume", postproduction:"Post-Produzione", vfx:"VFX", sfx:"SFX", art_department:"Arte", broadcast:"Broadcast", filmmaker:"Cineasta", writer:"Sceneggiatore/trice", photographer:"Fotografo/a", editor:"Editor", motion_designer:"Motion Designer", art_director:"Art Director", location:"Location", equipment:"Attrezzatura", vehicle:"Veicoli", studio:"Studio", props:"Oggetti di scena" },
    cs: { actor:"Herec/Herečka", model:"Model", extra:"Komparz", host:"Moderátor/ka", dancer:"Tanečník/ce", stunt:"Kaskadér/ka", voiceover:"Dabér/ka", creator:"Creator", camera:"Kamera", lighting:"Osvětlení", sound:"Zvuk", director_of_photography:"DoP", director:"Režisér/ka", production:"Produkce", makeup:"Masky", costume:"Kostýmy", postproduction:"Postprodukce", vfx:"VFX", sfx:"SFX", art_department:"Art oddělení", broadcast:"Broadcast", filmmaker:"Filmař/ka", writer:"Scenárista/ka", photographer:"Fotograf/ka", editor:"Editor/ka", motion_designer:"Motion Designer", art_director:"Art Director", location:"Lokace", equipment:"Vybavení", vehicle:"Vozidla", studio:"Studio", props:"Rekvizity" },
    hu: { actor:"Színész/Színésznő", model:"Modell", extra:"Statiszta", host:"Műsorvezető", dancer:"Táncos/Táncosnő", stunt:"Kaszkadőr", voiceover:"Szinkronszínész/nő", creator:"Creator", camera:"Kamera", lighting:"Világítás", sound:"Hang", director_of_photography:"DoP", director:"Rendező", production:"Produkció", makeup:"Smink", costume:"Jelmez", postproduction:"Utómunka", vfx:"VFX", sfx:"SFX", art_department:"Díszlet", broadcast:"Broadcast", filmmaker:"Filmkészítő", writer:"Forgatókönyvíró", photographer:"Fotós", editor:"Vágó", motion_designer:"Motion Designer", art_director:"Art Director", location:"Helyszín", equipment:"Felszerelés", vehicle:"Járművek", studio:"Stúdió", props:"Kellékek" },
  };
  const PROFILE_TYPE_MAP = PROFILE_TYPE_LABELS[locale] ?? PROFILE_TYPE_LABELS.de;

  const TRAVEL_LABELS: Record<string, Record<string, string>> = {
    de: { regional:"Regional", national:"Deutschlandweit", european:"Europaweit", worldwide:"Weltweit" },
    en: { regional:"Regional", national:"Nationwide", european:"Europe-wide", worldwide:"Worldwide" },
    es: { regional:"Regional", national:"Nacional", european:"Europa", worldwide:"Mundial" },
    it: { regional:"Regionale", national:"Nazionale", european:"Europa", worldwide:"Mondiale" },
    cs: { regional:"Regionálně", national:"Celostátně", european:"Evropsky", worldwide:"Celosvětově" },
    hu: { regional:"Regionális", national:"Országosan", european:"Európai", worldwide:"Világszerte" },
  };
  const TRAVEL_MAP = TRAVEL_LABELS[locale] ?? TRAVEL_LABELS.de;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [vendorOnly, setVendorOnly] = useState(false);

  // Hierarchical filter state
  const [filterOpen, setFilterOpen] = useState(false);
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
  const [sidebarDept, setSidebarDept] = useState<string | null>(null);

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

    if (sidebarDept) {
      const deptRoles = departments.find((d) => d.id === sidebarDept)?.roles ?? [];
      result = result.filter((c) => deptRoles.some((role) => matchesRole(c, role)));
    }

    if (vendorOnly) result = result.filter((c) => c.isVendor === true);
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
  }, [query, selectedRoles, sidebarDept, availableOnly, vendorOnly, cityFilter, countryFilter, languageFilter,
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

  // ── Mobile promoted role shortcuts ────────────────────────────────────
  const ROLE_SHORTCUTS: { label: string; role: string }[] = [
    { label: "DP / Kamera",  role: "Director of Photography (DoP)" },
    { label: "Regisseur",    role: "Regisseur"                     },
    { label: "Schauspieler/in", role: "Schauspieler"                },
    { label: "Fotograf",     role: "Fotograf/in"                   },
    { label: "Creator",      role: "Content Creator"               },
    { label: "Gaffer",       role: "Gaffer (Oberbeleuchter)"       },
    { label: "Ton",          role: "Production Sound Mixer"        },
    { label: "Producer",     role: "Producer"                      },
    { label: "Model",        role: "Model"                         },
    { label: "Editor",       role: "Editor (Schnitt)"              },
  ];
  const mobilePromotedRoles = ROLE_SHORTCUTS.filter((s) => occupiedRoles.has(s.role));

  const [sheetOpen, setSheetOpen] = useState(false);

  const secondaryFilterCount = [
    availableOnly,
    !!cityFilter,
    !!countryFilter,
    !!languageFilter,
    !!profileTypeFilter,
    !!hairFilter,
    !!eyeFilter,
    !!bodyFilter,
    !!travelFilter,
    !!(ageMinFilter || ageMaxFilter),
  ].filter(Boolean).length + selectedRoles.size;

  const SORT_OPTIONS = [
    { value: "featured", label: t("sortFeatured") },
    { value: "rating",   label: t("sortRating") },
    { value: "reviews",  label: t("sortRatingCount") },
  ];

  return (
    <div className="min-h-screen">

      {/* ══════════════════════════════════════════════════════════════════════
          MOBILE LAYOUT  (< lg)
          ══════════════════════════════════════════════════════════════════ */}
      <div className="lg:hidden">

        {/* Row 1 — Search + View toggle */}
        <div className="bg-bg-secondary border-b border-border px-3 py-2 flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 bg-bg-elevated border border-border rounded-xl px-3 focus-within:border-gold/50 transition-colors">
            <Search size={14} className="text-text-muted shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="bg-transparent border-none py-2.5 text-sm w-full focus:outline-none"
            />
            {query && (
              <button onClick={() => setQuery("")} className="text-text-muted hover:text-text-primary transition-colors">
                <X size={12} />
              </button>
            )}
          </div>
          <div className="flex bg-bg-elevated border border-border rounded-xl overflow-hidden shrink-0">
            <button onClick={() => setViewMode("grid")}
              className={`flex items-center justify-center w-9 h-9 transition-colors ${viewMode === "grid" ? "bg-gold text-bg-primary" : "text-text-muted"}`}>
              <LayoutGrid size={14} />
            </button>
            <button onClick={() => setViewMode("list")}
              className={`flex items-center justify-center w-9 h-9 transition-colors border-l border-border ${viewMode === "list" ? "bg-gold text-bg-primary" : "text-text-muted"}`}>
              <List size={14} />
            </button>
          </div>
        </div>

        {/* Row 2 — Verfügbar + Rollen-Chips + Filter-Button (eine scrollbare Zeile) */}
        <div className="bg-bg-secondary border-b border-border px-3 py-2.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          <div className="flex gap-2 items-center">
            <button
              onClick={() => setAvailableOnly((v) => !v)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                availableOnly ? "bg-gold text-bg-primary border-gold" : "border-border text-text-muted bg-bg-elevated"
              }`}
            >
              {availableOnly ? "✓ " : ""}{tc("available")}
            </button>

            <div className="w-px h-4 bg-border shrink-0" />

            {mobilePromotedRoles.map(({ label, role }) => {
              const active = selectedRoles.has(role);
              return (
                <button
                  key={role}
                  onClick={() => toggleRole(role)}
                  className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    active ? "bg-gold text-bg-primary border-gold" : "border-border text-text-muted bg-bg-elevated"
                  }`}
                >
                  {label}
                </button>
              );
            })}

            <div className="w-px h-4 bg-border shrink-0" />

            <button
              onClick={() => setSheetOpen(true)}
              className={`shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all ${
                secondaryFilterCount > 0 ? "bg-gold/10 border-gold/30 text-gold" : "border-border text-text-muted bg-bg-elevated"
              }`}
            >
              <SlidersHorizontal size={11} />
              {t("filterAllFilters")}
              {secondaryFilterCount > 0 && (
                <span className="bg-gold text-bg-primary text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {secondaryFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Row 3 — Active role chips (nur wenn aktiv) */}
        {activeChips.length > 0 && (
          <div className="bg-bg-secondary border-b border-border px-3 py-2 flex flex-wrap gap-1.5 items-center">
            {activeChips.map(({ role, dept }) => {
              const colors = dept ? deptColors(dept.color) : deptColors("slate");
              return (
                <span key={role} className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border font-medium ${colors.bg} ${colors.border} ${colors.text}`}>
                  {role}
                  <button onClick={() => removeRole(role)} className="hover:opacity-70 ml-0.5"><X size={9} /></button>
                </span>
              );
            })}
            <button
              onClick={() => { clearAll(); setCityFilter(""); setCountryFilter(""); setLanguageFilter(""); setAvailableOnly(false); setVendorOnly(false); }}
              className="text-[11px] text-text-muted hover:text-red-400 transition-colors underline underline-offset-2"
            >
              {t("clearAll")}
            </button>
          </div>
        )}

        {/* Row 4 — Ergebnis-Count + Sort */}
        <div className="px-4 py-2.5 flex items-center justify-between">
          <p className="text-xs text-text-muted">
            <span className="text-text-primary font-semibold">{t("results", { count: filtered.length })}</span>
            {query && <span className="text-gold"> für &ldquo;{query}&rdquo;</span>}
          </p>
          <div className="relative">
            <select value={sortKey} onChange={(e) => setSortKey(e.target.value)}
              className="appearance-none pl-2.5 pr-6 py-1.5 bg-bg-elevated border border-border rounded-lg text-xs text-text-muted focus:outline-none focus:border-gold/50 transition-colors cursor-pointer">
              {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <ArrowUpDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted" />
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          MOBILE FILTER SHEET  — keine verschachtelte Suchleiste
          ══════════════════════════════════════════════════════════════════ */}
      {sheetOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSheetOpen(false)} />
          <div className="relative bg-bg-elevated border-t border-border rounded-t-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>
            <div className="flex items-center justify-between px-4 pb-3 shrink-0">
              <h3 className="text-sm font-semibold text-text-primary">{t("filterAllFilters")}</h3>
              <button onClick={() => setSheetOpen(false)} className="text-text-muted hover:text-text-primary p-1"><X size={18} /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-6">

              {/* Rollen — einfache Chips pro Abteilung, keine Suchleiste */}
              {activeDepts.map((dept) => {
                const deptRoles = dept.roles.filter((r) => occupiedRoles.has(r));
                if (deptRoles.length === 0) return null;
                const colors = deptColors(dept.color);
                return (
                  <div key={dept.id}>
                    <p className={`text-[11px] uppercase tracking-widest font-semibold mb-2.5 ${colors.text}`}>
                      {dept.emoji} {getDeptLabel(dept, locale)}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {deptRoles.map((role) => {
                        const active = selectedRoles.has(role);
                        return (
                          <button
                            key={role}
                            onClick={() => toggleRole(role)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                              active ? `${colors.bg} ${colors.text} border-transparent` : "border-border text-text-muted bg-bg-secondary"
                            }`}
                          >
                            {role}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Stadt */}
              {availableCities.length > 0 && (
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-text-muted font-semibold mb-2.5">{t("filterCity")}</p>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setCityFilter("")}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${!cityFilter ? "bg-gold text-bg-primary border-gold" : "border-border text-text-muted bg-bg-secondary"}`}>
                      {t("filterAll")}
                    </button>
                    {availableCities.map((city) => (
                      <button key={city} onClick={() => setCityFilter(cityFilter === city ? "" : city)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${cityFilter === city ? "bg-gold text-bg-primary border-gold" : "border-border text-text-muted bg-bg-secondary"}`}>
                        {city}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Sprache */}
              {availableLanguages.length > 0 && (
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-text-muted font-semibold mb-2.5">{t("filterLanguage")}</p>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setLanguageFilter("")}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${!languageFilter ? "bg-gold text-bg-primary border-gold" : "border-border text-text-muted bg-bg-secondary"}`}>
                      {t("filterAll")}
                    </button>
                    {availableLanguages.slice(0, 12).map((lang) => (
                      <button key={lang} onClick={() => setLanguageFilter(languageFilter === lang ? "" : lang)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${languageFilter === lang ? "bg-gold text-bg-primary border-gold" : "border-border text-text-muted bg-bg-secondary"}`}>
                        {lang}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Profiltyp */}
              {availableProfileTypes.length > 0 && (
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-text-muted font-semibold mb-2.5">{t("filterProfileType")}</p>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setProfileTypeFilter("")}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${!profileTypeFilter ? "bg-gold text-bg-primary border-gold" : "border-border text-text-muted bg-bg-secondary"}`}>
                      {t("filterAll")}
                    </button>
                    {availableProfileTypes.map((type) => (
                      <button key={type} onClick={() => setProfileTypeFilter(profileTypeFilter === type ? "" : type)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${profileTypeFilter === type ? "bg-gold text-bg-primary border-gold" : "border-border text-text-muted bg-bg-secondary"}`}>
                        {PROFILE_TYPE_MAP[type] ?? type}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Haarfarbe / Augenfarbe */}
              {(availableHairColors.length > 0 || availableEyeColors.length > 0) && (
                <div className="grid grid-cols-2 gap-3">
                  {availableHairColors.length > 0 && (
                    <div>
                      <p className="text-[11px] uppercase tracking-widest text-text-muted font-semibold mb-2">{t("filterHairColor")}</p>
                      <select value={hairFilter} onChange={(e) => setHairFilter(e.target.value)}
                        className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-text-secondary focus:outline-none focus:border-gold transition-colors">
                        <option value="">Alle</option>
                        {availableHairColors.map((h) => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                  )}
                  {availableEyeColors.length > 0 && (
                    <div>
                      <p className="text-[11px] uppercase tracking-widest text-text-muted font-semibold mb-2">{t("filterEyeColor")}</p>
                      <select value={eyeFilter} onChange={(e) => setEyeFilter(e.target.value)}
                        className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-text-secondary focus:outline-none focus:border-gold transition-colors">
                        <option value="">Alle</option>
                        {availableEyeColors.map((e) => <option key={e} value={e}>{e}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* Spielalter */}
              <div>
                <p className="text-[11px] uppercase tracking-widest text-text-muted font-semibold mb-2">{t("filterAge")}</p>
                <div className="flex items-center gap-2">
                  <input type="number" min="1" max="99" value={ageMinFilter} onChange={(e) => setAgeMinFilter(e.target.value)}
                    placeholder="von" className="w-20 bg-bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-gold transition-colors" />
                  <span className="text-xs text-text-muted">–</span>
                  <input type="number" min="1" max="99" value={ageMaxFilter} onChange={(e) => setAgeMaxFilter(e.target.value)}
                    placeholder="bis" className="w-20 bg-bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-gold transition-colors" />
                </div>
              </div>

              {/* Reisebereitschaft */}
              <div>
                <p className="text-[11px] uppercase tracking-widest text-text-muted font-semibold mb-2.5">{t("filterTravel")}</p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setTravelFilter("")}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${!travelFilter ? "bg-gold text-bg-primary border-gold" : "border-border text-text-muted bg-bg-secondary"}`}>
                    {t("filterAll")}
                  </button>
                  {Object.entries(TRAVEL_MAP).map(([key, label]) => (
                    <button key={key} onClick={() => setTravelFilter(travelFilter === key ? "" : key)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${travelFilter === key ? "bg-gold text-bg-primary border-gold" : "border-border text-text-muted bg-bg-secondary"}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="shrink-0 px-4 py-4 border-t border-border flex gap-3">
              <button
                onClick={() => {
                  clearAll();
                  setCityFilter(""); setCountryFilter(""); setLanguageFilter("");
                  setAvailableOnly(false); setVendorOnly(false);
                  setProfileTypeFilter(""); setHairFilter(""); setEyeFilter("");
                  setBodyFilter(""); setTravelFilter(""); setAgeMinFilter(""); setAgeMaxFilter("");
                }}
                className="flex-1 py-3 border border-border rounded-xl text-sm font-medium text-text-muted hover:border-red-400/40 hover:text-red-400 transition-all"
              >
                {t("resetFilters")}
              </button>
              <button
                onClick={() => setSheetOpen(false)}
                className="flex-[2] py-3 bg-gold text-bg-primary rounded-xl text-sm font-bold hover:bg-gold-light transition-all"
              >
                {t("showResults", { count: filtered.length })}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          DESKTOP LAYOUT  (≥ lg)
          ══════════════════════════════════════════════════════════════════ */}
      <div className="hidden lg:block bg-bg-secondary border-b border-border">
        <div className="px-4 py-2 space-y-2">

          {/* Row 1: Search + View toggle */}
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 bg-bg-elevated border border-border rounded-lg px-3 focus-within:border-gold/50 transition-colors">
              <Search size={14} className="text-text-muted shrink-0" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("searchPlaceholder")}
                className="bg-transparent border-none py-2 text-sm w-full focus:outline-none"
              />
              {query && (
                <button onClick={() => setQuery("")} className="text-text-muted hover:text-text-primary transition-colors">
                  <X size={12} />
                </button>
              )}
            </div>
            <div className="flex bg-bg-elevated border border-border rounded-lg overflow-hidden shrink-0">
              <button onClick={() => setViewMode("grid")} className={`flex items-center justify-center w-9 h-9 transition-colors ${viewMode === "grid" ? "bg-gold text-bg-primary" : "text-text-muted hover:text-text-primary"}`}>
                <LayoutGrid size={14} />
              </button>
              <button onClick={() => setViewMode("list")} className={`flex items-center justify-center w-9 h-9 transition-colors border-l border-border ${viewMode === "list" ? "bg-gold text-bg-primary" : "text-text-muted hover:text-text-primary"}`}>
                <List size={14} />
              </button>
            </div>
          </div>

          {/* Row 2: Filters */}
          <div className="flex items-center gap-2 overflow-x-auto lg:overflow-visible pb-0.5" style={{ scrollbarWidth: "none" }}>
            {/* Available toggle */}
            <label className="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer hover:text-text-secondary transition-colors select-none shrink-0">
              <div
                onClick={() => setAvailableOnly((v) => !v)}
                className={`w-7 h-4 rounded-full transition-colors relative cursor-pointer ${availableOnly ? "bg-gold" : "bg-border"}`}
              >
                <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${availableOnly ? "left-3.5" : "left-0.5"}`} />
              </div>
              {tc("available")}
            </label>

            <div className="w-px h-5 bg-border shrink-0" />

            {/* Sort */}
            <SortDropdown
              value={sortKey}
              options={SORT_OPTIONS}
              onChange={setSortKey}
            />


            {availableCities.length > 0 && (
              <FilterDropdown icon={MapPin} label={t("filterCity")} value={cityFilter} options={availableCities} onChange={setCityFilter} />
            )}
            {availableLanguages.length > 0 && (
              <FilterDropdown icon={Languages} label={t("filterLanguage")} value={languageFilter} options={availableLanguages} onChange={setLanguageFilter} />
            )}

            <button
              onClick={() => setMoreFiltersOpen((v) => !v)}
              className={`flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-medium border transition-all shrink-0 ${
                moreFiltersOpen || [profileTypeFilter, hairFilter, eyeFilter, travelFilter, ageMinFilter, ageMaxFilter, countryFilter].some(Boolean)
                  ? "bg-gold/12 border-gold/30 text-gold"
                  : "border-border text-text-muted hover:text-text-secondary hover:border-border-light"
              }`}
            >
              <SlidersHorizontal size={11} />
              {t("moreFilters")}
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
                className="h-9 px-3 text-xs text-text-muted hover:text-red-400 transition-colors whitespace-nowrap border border-border rounded-lg hover:border-red-400/40 shrink-0"
              >
                {t("clearRoles")}
              </button>
            )}
          </div>

          {/* Mehr Filter (ausgeklappt) */}
          {moreFiltersOpen && (
            <div className="flex items-center gap-2 flex-wrap pt-1">
              {availableCountries.length > 0 && (
                <FilterDropdown icon={Globe} label={t("filterCountry")} value={countryFilter} options={availableCountries} onChange={setCountryFilter} />
              )}
              {availableProfileTypes.length > 0 && (
                <FilterDropdown
                  icon={Users}
                  label={t("filterProfileType")}
                  value={profileTypeFilter ? (PROFILE_TYPE_MAP[profileTypeFilter] ?? profileTypeFilter) : ""}
                  options={availableProfileTypes.map(t => PROFILE_TYPE_MAP[t] ?? t)}
                  onChange={v => {
                    const found = availableProfileTypes.find(t => (PROFILE_TYPE_MAP[t] ?? t) === v);
                    setProfileTypeFilter(found ?? "");
                  }}
                />
              )}
              {availableHairColors.length > 0 && (
                <FilterDropdown icon={SlidersHorizontal} label={t("filterHairColor")} value={hairFilter} options={availableHairColors} onChange={setHairFilter} />
              )}
              {availableEyeColors.length > 0 && (
                <FilterDropdown icon={SlidersHorizontal} label={t("filterEyeColor")} value={eyeFilter} options={availableEyeColors} onChange={setEyeFilter} />
              )}
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-xs text-text-muted whitespace-nowrap">{t("filterAge")}</span>
                <input type="number" min="1" max="99" value={ageMinFilter} onChange={e => setAgeMinFilter(e.target.value)}
                  placeholder="von" className="w-14 bg-bg-elevated border border-border rounded-lg px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-gold transition-colors" />
                <span className="text-xs text-text-muted">–</span>
                <input type="number" min="1" max="99" value={ageMaxFilter} onChange={e => setAgeMaxFilter(e.target.value)}
                  placeholder="bis" className="w-14 bg-bg-elevated border border-border rounded-lg px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-gold transition-colors" />
              </div>
              <FilterDropdown
                icon={Globe}
                label={t("filterTravel")}
                value={travelFilter ? (TRAVEL_MAP[travelFilter] ?? travelFilter) : ""}
                options={Object.values(TRAVEL_MAP)}
                onChange={v => {
                  const found = Object.entries(TRAVEL_MAP).find(([, label]) => label === v)?.[0] ?? "";
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
                        {dept.emoji} {getDeptLabel(dept, locale)}
                        {deptSelected > 0 && <span className={`w-3.5 h-3.5 rounded-full text-[8px] font-bold flex items-center justify-center ${colors.bg} ${colors.text}`}>{deptSelected}</span>}
                      </button>
                    );
                  })}
                </div>
                <div className="p-3">
                  <RolePanel dept={activeDeptData} selectedRoles={selectedRoles} occupiedRoles={occupiedRoles} onToggle={toggleRole} onClose={() => setFilterOpen(false)} locale={locale} />
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
                        <span>{getDeptLabel(dept, locale)}</span>
                        {deptSelected > 0 && (
                          <span className={`text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${colors.bg} border ${colors.border} ${colors.text}`}>{deptSelected}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="flex-1 overflow-y-auto p-3">
                  <RolePanel dept={activeDeptData} selectedRoles={selectedRoles} occupiedRoles={occupiedRoles} onToggle={toggleRole} onClose={() => setFilterOpen(false)} locale={locale} />
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
                {t("clearAll")}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Results ─────────────────────────────────────────────────────────── */}
      {(() => {
        const filteredCrew = filtered.filter((c) => !c.isVendor);
        const crewVisible  = filteredCrew.slice(0, visibleCount);

        return (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-8">
            <div className="flex gap-8 items-start">

            {/* Left sidebar */}
            <aside className="hidden lg:block w-44 shrink-0 sticky top-20">
              <p className="text-[11px] uppercase tracking-widest text-text-muted font-semibold mb-3 px-2">
                Bereiche
              </p>
              <nav className="space-y-0.5">
                <button
                  onClick={() => setSidebarDept(null)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all text-left ${
                    !sidebarDept
                      ? "bg-gold/10 text-gold font-semibold border-l-2 border-gold pl-[10px]"
                      : "text-text-secondary hover:text-text-primary hover:bg-bg-secondary"
                  }`}
                >
                  <Users size={14} className={!sidebarDept ? "text-gold" : "text-text-muted"} />
                  Alle Bereiche
                </button>
                {departments.map((dept) => {
                  const isActive = sidebarDept === dept.id;
                  const Icon = DEPT_ICON[dept.id] ?? Users;
                  return (
                    <button
                      key={dept.id}
                      onClick={() => setSidebarDept(isActive ? null : dept.id)}
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
                <a
                  href="/profile"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-gold hover:bg-gold/10 rounded-lg transition-colors font-medium"
                >
                  <Plus size={14} />
                  Profil erstellen
                </a>
              </div>
            </aside>

            {/* Main content */}
            <div className="flex-1 min-w-0">

            {/* Mobile dept pills */}
            <div className="lg:hidden flex gap-2 overflow-x-auto pb-3 mb-4" style={{ scrollbarWidth: "none" }}>
              <button
                onClick={() => setSidebarDept(null)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0 border transition-all ${
                  !sidebarDept
                    ? "bg-gold/10 text-gold border-gold/40"
                    : "border-border text-text-muted hover:border-gold/30 hover:text-text-primary"
                }`}
              >
                Alle Bereiche
              </button>
              {departments.map((dept) => {
                const isActive = sidebarDept === dept.id;
                return (
                  <button
                    key={dept.id}
                    onClick={() => setSidebarDept(isActive ? null : dept.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0 border transition-all ${
                      isActive
                        ? "bg-gold/10 text-gold border-gold/40"
                        : "border-border text-text-muted hover:border-gold/30 hover:text-text-primary"
                    }`}
                  >
                    {dept.label}
                  </button>
                );
              })}
            </div>

            {/* Count */}
            <p className="text-sm text-text-muted mb-5">
              <span className="text-text-primary font-semibold">
                {t("results", { count: filteredCrew.length })}
              </span>
              {query && <span className="text-gold"> für &ldquo;{query}&rdquo;</span>}
            </p>

            {/* Empty */}
            {filteredCrew.length === 0 && (
              <EmptyState
                icon={Users}
                title={allCreators.length === 0 ? t("emptyTitle") : t("emptyTitleFiltered")}
                description={allCreators.length === 0 ? t("emptyDesc") : t("emptyDescFiltered")}
                action={allCreators.length === 0
                  ? { label: t("emptyActionCreate"), onClick: () => window.location.href = "/profile" }
                  : { label: t("emptyActionReset"), onClick: () => { setQuery(""); clearAll(); setAvailableOnly(false); setCityFilter(""); setCountryFilter(""); setLanguageFilter(""); } }
                }
              />
            )}

            {/* ── Crew grid ── */}
            {filteredCrew.length > 0 && (
              <>
              {/* List: compact directory table */}
              {viewMode === "list" && (
                <div className="border border-border rounded-xl overflow-hidden bg-bg-secondary divide-y divide-border/50">
                  {crewVisible.map((c) => {
                    const displayPositions = getPositions(c);
                    const href = c.id.startsWith("listing_") ? `/creators/${c.id.replace("listing_", "")}` : `/profile/${c.id}`;
                    return (
                      <Link key={c.id} href={href} suppressHydrationWarning
                        className="group flex items-center gap-3 px-4 py-2.5 hover:bg-bg-elevated transition-colors">
                        {/* Avatar */}
                        {c.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.avatar} alt={c.name} loading="lazy" decoding="async"
                            className="w-9 h-9 rounded-full object-cover border border-border/60 shrink-0"
                            style={{ objectPosition: c.focal_point ? `${c.focal_point.x}% ${c.focal_point.y}%` : "50% 33%" }} />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-bg-elevated border border-border/60 flex items-center justify-center text-text-muted text-sm font-bold shrink-0">
                            {c.name[0]}
                          </div>
                        )}
                        {/* Name + role */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold text-text-primary group-hover:text-gold transition-colors truncate">{c.name}</span>
                            {c.verified && <CheckCircle size={11} className="text-gold/60 shrink-0" />}
                            {c.available && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" title={tc("available")} />}
                          </div>
                          <p className="text-[11px] text-text-muted truncate">{displayPositions.slice(0, 2).join(" · ")}</p>
                        </div>
                        {/* City */}
                        {c.location && (
                          <p className="hidden sm:flex items-center gap-1 text-xs text-text-muted shrink-0 w-32 truncate">
                            <MapPin size={10} className="shrink-0" />{c.location.split(",")[0]}
                          </p>
                        )}
                        {/* Rate */}
                        <p className="hidden md:block text-xs text-text-secondary shrink-0 w-28 text-right">{c.dayRate}</p>
                      </Link>
                    );
                  })}
                </div>
              )}

              {/* Grid: compact portrait cards */}
              {viewMode === "grid" && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {crewVisible.map((c) => {
                  const displayPositions = getPositions(c);
                  const href = c.id.startsWith("listing_") ? `/creators/${c.id.replace("listing_", "")}` : `/profile/${c.id}`;
                  return (
                    <Link key={c.id} href={href} suppressHydrationWarning
                      className="card-hover group rounded-xl border border-border bg-bg-secondary overflow-hidden block">
                      <div className="aspect-[3/4] overflow-hidden bg-bg-elevated">
                        {c.image || c.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.image || c.avatar} alt={c.name} loading="lazy" decoding="async"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            style={{ objectPosition: c.focal_point ? `${c.focal_point.x}% ${c.focal_point.y}%` : "50% 33%" }} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-text-muted/20">
                            {c.name[0]}
                          </div>
                        )}
                      </div>
                      <div className="p-2.5">
                        <div className="flex items-start justify-between gap-1 mb-0.5">
                          <h3 className="font-semibold text-text-primary text-xs leading-tight truncate">{c.name}</h3>
                          {c.verified && <CheckCircle size={10} className="text-gold/60 shrink-0 mt-0.5" />}
                        </div>
                        <p className="text-[10px] text-gold font-medium truncate">{displayPositions[0]}</p>
                        {c.location && <p className="text-[10px] text-text-muted truncate mt-0.5">{c.location.split(",")[0]}</p>}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
              </>
            )}

            {/* Load more crew */}
            {(filteredCrew.length > visibleCount || hasMoreFromApi) && (
              <div className="mt-8 text-center">
                <button
                  onClick={() => {
                    if (filteredCrew.length > visibleCount) {
                      setVisibleCount((v) => v + PAGE_SIZE);
                    } else {
                      loadMoreFromApi();
                    }
                  }}
                  disabled={loadingMore}
                  className="px-8 py-3 border border-border text-sm font-semibold text-text-secondary hover:border-gold hover:text-gold rounded-xl transition-all disabled:opacity-50 flex items-center gap-2 mx-auto"
                >
                  {loadingMore
                    ? <><span className="w-4 h-4 border-2 border-gold border-t-transparent rounded-full animate-spin inline-block" /> {t("loading")}</>
                    : filteredCrew.length > visibleCount
                      ? t("loadMore", { count: filteredCrew.length - visibleCount })
                      : t("loadMoreApi")
                  }
                </button>
              </div>
            )}


            </div>{/* end main content */}
            </div>{/* end flex gap-8 */}
          </div>
        );
      })()}
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
