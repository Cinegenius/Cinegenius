"use client";

import PlaceFilters from "@/components/PlaceFilters";

import { placeSearchMatches, placeOptions, matchesPlace, canonicalFilterValue } from "@/lib/places/core";

import { normalizeCrewLanguages, crewLanguageLabel, matchesCrewLanguage } from "@/lib/crew-languages";
import { PROFILE_TRAIT_MESSAGE_KEYS, profileTraitLabel, profileTraitOptions } from "@/lib/profile-trait-labels";
import { useViewState } from "@/lib/use-view-state";
import { useViewUrl } from "@/lib/use-view-url";

import { filterProviderProfiles, isProviderFilter, LOCATION_PROVIDER_FILTER, MARKETPLACE_PROVIDER_FILTER } from "@/lib/profile-provider-filters";
import { filterCrewOccupations } from "@/lib/crew-occupations";

import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import ProfileCardPhoto from "@/components/ProfileCardPhoto";
import { crewPhotoInput } from "@/lib/profile-photo";
import type { ProfileFocalPoint } from "@/lib/profile-cover";
import { useTranslations, useLocale } from "next-intl";
import {
  MapPin, CheckCircle, Search, X, LayoutGrid, List, SlidersHorizontal, ChevronDown, Users, Globe, Languages, ArrowUpDown, Plus, ShoppingBag,
  Clapperboard, Video, Lightbulb, Wrench, Mic, Palette, Shirt, Sparkles, Scissors, Music, Truck, Star, Zap, Tv, MonitorPlay, FileText, Smartphone, Camera, Bot,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { departments, deptColors, getDeptLabel, getOccupationSearchTerms, getDepartmentRoleSearchTerms, getDepartmentRoleLabel, type Department , taxonomyLabel } from "@/lib/departments";
import MobileBrowseControls, { MobileFilterField, MobileFilterSelect, type BrowseChip } from "@/components/MobileBrowseControls";
import { rankByRatingConfidence } from "@/lib/rating-ranking";
import { gripSearchTerms, isGripDepartmentSearch, isGripOccupation, normalizeOccupation } from "@/lib/gripTaxonomy";
import { occupationCatalogue, occupationById, occupationId, type PrimaryOccupation } from "@/lib/primary-occupation";
import { subscribeToProfileUpdated } from "@/lib/profile-update-events";
import { compareCreatorNames } from "@/lib/creator-directory-order";

const DEPT_ICON: Record<string, LucideIcon> = {
  produktion:    Clapperboard,
  regie:         Clapperboard,
  kamera:        Video,
  grip:          Wrench,
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
  ownerId?: string;
  name: string;
  role: string;
  positions: string[];
  primaryOccupation?: PrimaryOccupation | null;
  occupationIds?: string[];
  location: string;
  image: string;       // cover image (portfolio or avatar)
  avatar: string;      // circular avatar (always avatar_url)
  rating: number;
  reviews: number;
  dayRate: string;
  dayRateOnRequest?: boolean;
  available: boolean;
  credits: string[];
  skills: string[];
  bio?: string;
  languages?: string[];
  verified: boolean;
  isReal: true;
  // Casting-Felder
  profile_type?: string;
  profile_types?: string[];
  hair_color?: string;
  eye_color?: string;
  body_type?: string;
  playing_age_min?: number | null;
  playing_age_max?: number | null;
  height_cm?: number | null;
  travel?: string;
  focal_point?: ProfileFocalPoint;
  isVendor?: boolean;
  last_seen_at?: string | null;
};


function getPositions(c: ServerCreator): string[] {
  if (Array.isArray(c.positions) && c.positions.length > 0) return c.positions;
  return [c.role];
}

function hasProfileType(c: ServerCreator, ...types: string[]): boolean {
  return types.some((type) => c.profile_type === type || c.profile_types?.includes(type));
}

// ─── Filter Dropdown ────────────────────────────────────────────────────────

function FilterDropdown({
  icon: Icon,
  label,
  value,
  options,
  onChange,
  optionLabel = (option: string) => option,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  options: string[];
  optionLabel?: (option: string) => string;
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
        {active ? optionLabel(value) : label}
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
              {optionLabel(opt)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SortDropdown({ value, options, onChange }: { value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  const uiText = useTranslations();

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);
  const label = options.find((o) => o.value === value)?.label ?? uiText("creators.sort");
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
  onToggle,
  onClose,
  locale,
}: {
  dept: Department;
  selectedRoles: Set<string>;
  onToggle: (role: string) => void;
  onClose: () => void;
  locale: string;
}) {
  const taxonomyText = useTranslations("Taxonomy");

  const uiText = useTranslations();

  const t = useTranslations("creators");
  const animals = useTranslations("FilmAnimals");
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const colors = deptColors(dept.color);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const deptRoles = dept.roles;

  const visible = useMemo(() => {
    if (!search.trim()) return deptRoles;
    const q = search.toLowerCase();
    return deptRoles.filter((r) => getDepartmentRoleSearchTerms(dept, r).some(term => term.toLowerCase().includes(q)) || getDepartmentRoleLabel(dept.id, r, locale, animals, taxonomyText).toLowerCase().includes(q));
  }, [deptRoles, search, dept, locale, animals, taxonomyText]);

  const selectedCount = deptRoles.filter((r) => selectedRoles.has(occupationId(dept.id, r))).length;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className={`flex items-center justify-between pb-2 mb-2 border-b border-border/60`}>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold ${colors.text}`}>{getDeptLabel(dept, locale, animals, taxonomyText)}</span>
          <span className="text-[11px] text-text-muted">{t("deptRoles", { count: deptRoles.length })}</span>
          {selectedCount > 0 && (
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${colors.bg} ${colors.border} border ${colors.text}`}>
              {t("activeRoles", { count: selectedCount })}
            </span>
          )}
        </div>
        <button aria-label={uiText("Ui.text_0245e5d1d7c111")} onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors p-0.5 rounded hover:bg-white/5">
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
              const active = selectedRoles.has(occupationId(dept.id, role));
              return (
                <label
                  key={role}
                  className={`flex min-h-11 items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer transition-all group
                    ${active ? `${colors.bg} ${colors.text}` : `text-text-secondary hover:text-text-primary hover:bg-white/[0.03]`}`}
                >
                  <div className={`w-3 h-3 rounded border flex items-center justify-center shrink-0 transition-all
                    ${active ? `${colors.border} bg-current/20` : "border-border group-hover:border-border-light"}`}>
                    {active && <div className="w-1.5 h-1.5 rounded-sm bg-current" />}
                  </div>
                  <input type="checkbox" checked={active} onChange={() => onToggle(occupationId(dept.id, role))} className="sr-only" />
                  <span className="text-[11px] leading-snug">{getDepartmentRoleLabel(dept.id, role, locale, animals, taxonomyText)}</span>
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

function CreatorsInner({
  serverCreators,
  hasMoreProfiles = false,
  initialFilters,
}: {
  serverCreators: ServerCreator[];
  hasMoreProfiles?: boolean;
  initialFilters: { query: string; city: string; sort: string; cityText?: string; country?: string; region?: string };
}) {
  const taxonomyText = useTranslations("Taxonomy");

  const uiText = useTranslations();

  const tc = useTranslations("common");
  const t = useTranslations("creators");
  const profileText = useTranslations("profile");
  const animals = useTranslations("FilmAnimals");
  const locale = useLocale();

  const [query, setQuery] = useViewState("crew.query", () => initialFilters.query);
  const [cityFilter, setCityFilter] = useViewState("crew.cityFilter", () => initialFilters.city);
  const [cityText, setCityText] = useViewState("crew.cityText", () => initialFilters.cityText?.trim() ?? "");
  const [countryFilter, setCountryFilter] = useViewState("crew.countryFilter", () => initialFilters.country ?? "");
  const [regionFilter, setRegionFilter] = useViewState("creators.regionFilter", () => initialFilters.region ?? "");
  const [languageFilter, setLanguageFilter] = useViewState("crew.languageFilter", "");
  const changePlaceFilters = (value: {country:string;region:string;city:string}) => {
    setCountryFilter(value.country); setRegionFilter(value.region); setCityFilter(value.city);
    if (value.city) setCityText("");
  };
  const [availableOnly, setAvailableOnly] = useViewState("crew.availableOnly", false);

  // allCreators muss VOR den useMemo-Aufrufen deklariert sein
  const [allCreators, setAllCreators] = useState<ServerCreator[]>(serverCreators);
  const [apiPage, setApiPage] = useState(1);
  const [hasMoreFromApi, setHasMoreFromApi] = useState(hasMoreProfiles);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  useEffect(() => {
    setAllCreators(serverCreators);
    setApiPage(1);
    setHasMoreFromApi(hasMoreProfiles);
    setLoadError(false);
  }, [serverCreators, hasMoreProfiles]);

  useEffect(() => subscribeToProfileUpdated(({ userId, avatarUrl, previousAvatarUrl, focalPoint }) => {
    if (!userId || (avatarUrl === undefined && focalPoint === undefined)) return;
    setAllCreators((current) => current.map((creator) => {
      if (creator.id !== userId) return creator;
      const imageUsedAvatar = creator.image === creator.avatar || creator.image === previousAvatarUrl;
      const nextAvatar = avatarUrl ?? "";
      return { ...creator,
        ...(avatarUrl !== undefined ? { avatar: nextAvatar, ...(imageUsedAvatar ? { image: nextAvatar } : {}) } : {}),
        ...(focalPoint !== undefined ? { focal_point: focalPoint ?? undefined } : {}),
      };
    }));
  }), []);

  const loadMoreFromApi = useCallback(async () => {
    if (loadingMore || !hasMoreFromApi) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/creators?page=${apiPage}`);
      if (!res.ok) throw new Error(uiText("Ui.text_3246f5de17bad7"));
      const { creators, hasMore } = await res.json();
      if (creators?.length) {
        setAllCreators(prev => [...new Map([...prev.filter(creator => !creator.id.startsWith("listing_") || !creators.some((profile: ServerCreator) => profile.id === creator.ownerId)), ...creators].map(creator => [creator.id, creator])).values()]);
      }
      setApiPage(p => p + 1);
      setHasMoreFromApi(!!hasMore);
    } catch { setLoadError(true); } finally {
      setLoadingMore(false);
    }
  }, [apiPage, hasMoreFromApi, loadingMore]);

  // Fetch bounded pages so filters also see profiles beyond the initial page.
  useEffect(() => {
    if (hasMoreFromApi && !loadingMore && !loadError) void loadMoreFromApi();
  }, [hasMoreFromApi, loadingMore, loadError, loadMoreFromApi]);

  // Derive available filter options from real data only
  useEffect(() => {
    const country=canonicalFilterValue(countryFilter,allCreators,"country"),city=canonicalFilterValue(cityFilter,allCreators,"city");
    if(country!==countryFilter||city!==cityFilter)queueMicrotask(()=>{setCountryFilter(country);setCityFilter(city);});
  },[countryFilter,cityFilter,allCreators,setCountryFilter,setCityFilter]);
  const cityOptions = useMemo(() => placeOptions(allCreators, "city", locale, countryFilter), [allCreators, locale, countryFilter]);
  const countryOptions = useMemo(() => placeOptions(allCreators, "country", locale), [allCreators, locale]);
  const regionOptions = useMemo(() => placeOptions(allCreators, "region", locale), [allCreators, locale]);
  const availableCities = cityOptions.map(o => o.value);
  const availableCountries = countryOptions.map(o => o.value);
  const availableLanguages = useMemo(() => [...new Set(allCreators.flatMap(c => normalizeCrewLanguages(c.languages)))].sort((a,b) => crewLanguageLabel(a,locale).localeCompare(crewLanguageLabel(b,locale),locale)), [allCreators,locale]);
  const cityLabel = (value: string) => cityOptions.find(o => o.value === value)?.label ?? value;
  const countryLabel = (value: string) => countryOptions.find(o => o.value === value)?.label ?? value;
  const regionLabel = (value: string) => regionOptions.find(option => option.value === value)?.label ?? value;
  const [sortKey, setSortKey] = useViewState("crew.sortKey", () => ["rating", "reviews"].includes(initialFilters.sort) ? initialFilters.sort : "featured");
  const [viewMode, setViewMode] = useViewState<"grid" | "list">("crew.viewMode", "grid");

  // Neue Casting-Filter
  const [profileTypeFilter, setProfileTypeFilter] = useViewState("crew.profileTypeFilter", "");
  const [hairFilter, setHairFilter] = useViewState("crew.hairFilter", "");
  const [eyeFilter, setEyeFilter] = useViewState("crew.eyeFilter", "");
  const [bodyFilter, setBodyFilter] = useViewState("crew.bodyFilter", "");
  const [ageMinFilter, setAgeMinFilter] = useViewState("crew.ageMinFilter", "");
  const [ageMaxFilter, setAgeMaxFilter] = useViewState("crew.ageMaxFilter", "");
  const [travelFilter, setTravelFilter] = useViewState("crew.travelFilter", "");

  // Optionen aus echten Daten ableiten
  const { availableProfileTypes, availableHairColors, availableEyeColors, availableBodyTypes } = useMemo(() => {
    const types = new Set<string>();
    const hair  = new Set<string>();
    const eye   = new Set<string>();
    const body  = new Set<string>();
    for (const c of allCreators) {
      for (const type of c.profile_types ?? []) types.add(type);
      if (c.profile_type) types.add(c.profile_type);
      if (c.hair_color)   hair.add(c.hair_color);
      if (c.eye_color)    eye.add(c.eye_color);
      if (c.body_type)    body.add(c.body_type);
    }
    return {
      availableProfileTypes: [...types].sort(),
      availableHairColors:   profileTraitOptions("hair", [...hair], profileText, locale).map(option => option.value),
      availableEyeColors:    profileTraitOptions("eyes", [...eye], profileText, locale).map(option => option.value),
      availableBodyTypes:    profileTraitOptions("body", [...body], profileText, locale).map(option => option.value),
    };
  }, [allCreators, locale, profileText]);
  const hairLabel = (value: string) => profileTraitLabel("hair", value, profileText);
  const eyeLabel = (value: string) => profileTraitLabel("eyes", value, profileText);
  const bodyLabel = (value: string) => profileTraitLabel("body", value, profileText);


  const PROFILE_TYPE_MAP: Record<string, string> = { actor: uiText("menu.crewActors"), model: uiText("MarketplaceOffer.fields.model"), extra: uiText("Ui.text_7fb159238f13fa"), host: uiText("Ui.text_0a95f0e5c8dfe9"), dancer: uiText("Ui.text_edbf4c8ebb46d7"), stunt: uiText("Ui.text_b84275027d70dc"), voiceover: uiText("Ui.text_ecd65813175a41"), creator: uiText("Ui.text_88447b83090cde"), camera: uiText("menu.crewCamera"), lighting: uiText("menu.crewLight"), sound: uiText("menu.crewSound"), director_of_photography: uiText("Ui.text_09119154bd2ac6"), director: uiText("menu.crewDirection"), production: uiText("menu.crewProduction"), makeup: uiText("Ui.text_93c744e1d17b9a"), costume: uiText("Ui.text_a21ae87ef519df"), postproduction: uiText("Ui.text_212f3b80ce86c2"), vfx: uiText("Ui.text_23d20474305ac3"), sfx: uiText("menu.marketSfx"), art_department: uiText("Ui.text_03552f45d48cae"), broadcast: uiText("Ui.text_17bc9178343601"), filmmaker: uiText("Ui.text_93ecd734fdc054"), writer: uiText("Ui.text_c01d8914754e43"), photographer: uiText("menu.crewPhotographer"), editor: uiText("Ui.text_23891caedf928e"), motion_designer: uiText("Ui.text_8213a51cdbc986"), art_director: uiText("Ui.text_2d3b48143ed2b9"), location: uiText("profile.labelLocation"), equipment: uiText("companies.groupAusstattung"), vehicle: uiText("footer.links_vehicles"), studio: uiText("Ui.text_0aa91af2ec4c1f"), props: uiText("search.typeProps") };

  const travelValues = [...new Set([...Object.keys(PROFILE_TRAIT_MESSAGE_KEYS.travel),
    ...allCreators.flatMap(creator => typeof creator.travel === "string" && creator.travel ? [creator.travel] : []),
  ])];
  const TRAVEL_MAP = Object.fromEntries(travelValues.map(value => [value, profileTraitLabel("travel", value, profileText)]));
  const [pagination, setPagination] = useViewState("crew.pagination", { filterKey: "", visibleCount: PAGE_SIZE });

  const [vendorOnly, setVendorOnly] = useViewState("crew.vendorOnly", false);

  // Hierarchical filter state
  const [filterOpen, setFilterOpen] = useState(false);
  const [moreFiltersOpen, setMoreFiltersOpen] = useViewState("crew.moreFiltersOpen", false);
  const [selectedRoles, setSelectedRoles] = useViewState<Set<string>>("crew.selectedRoles", new Set());
  const [sidebarDept, setSidebarDept] = useViewState<string | null>("crew.sidebarDept", null);

  // Same complete catalogue and order as onboarding and profile editing.
  const activeDepts = departments;

  const [activeDept, setActiveDept] = useViewState<string>("crew.activeDept", () => activeDepts[0]?.id ?? departments[0].id);

  const toggleRole = (role: string) => {
    const departmentId = occupationById(role)?.departmentId;
    if (departmentId && sidebarDept && departmentId !== sidebarDept) {
      setSidebarDept(departmentId);
      setSelectedRoles(new Set([role]));
      return;
    }
    setSelectedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  };

  const chooseSidebarDept = (deptId: string | null) => {
    setSelectedRoles(new Set());
    setSidebarDept(deptId);
    if (deptId && !isProviderFilter(deptId)) setActiveDept(deptId);
    if (isProviderFilter(deptId)) setFilterOpen(false);
    if (deptId === null) setViewMode("grid");
  };

  const removeRole = (role: string) =>
    setSelectedRoles((prev) => { const n = new Set(prev); n.delete(role); return n; });

  const clearAll = () => { setSelectedRoles(new Set()); };

  const activeDeptData = activeDepts.find((d) => d.id === activeDept) ?? activeDepts[0] ?? departments[0];

  const filterParams = new URLSearchParams();
  if (query) filterParams.set("q", query);
  if (cityText) filterParams.set("cityText", cityText);
  if (cityFilter) filterParams.set("city", cityFilter);
  if (countryFilter) filterParams.set("country", countryFilter);
  if (regionFilter) filterParams.set("region", regionFilter);
  if (sortKey !== "featured") filterParams.set("sort", sortKey);
  useViewUrl(filterParams.size ? `/creators?${filterParams}` : "/creators");

  // Filtered results
  const isTopMode = !query.trim() && selectedRoles.size === 0 && !sidebarDept
    && !availableOnly && !vendorOnly && !cityText && !cityFilter && !countryFilter && !regionFilter && !languageFilter
    && !profileTypeFilter && !hairFilter && !eyeFilter && !bodyFilter && !travelFilter
    && !ageMinFilter && !ageMaxFilter;

  const filtered = useMemo(() => {
    let result = [...allCreators];

    if (query.trim()) {
      const q = query.toLowerCase().trim();
      const normalizedQuery = normalizeOccupation(query);
      result = result.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        getPositions(c).some((p) => p.toLowerCase().includes(q)
          || taxonomyLabel(p, uiText).toLowerCase().includes(q)
          || getOccupationSearchTerms(p).some((term) => normalizeOccupation(term).includes(normalizedQuery))
          || gripSearchTerms(p).some((term) => normalizeOccupation(term).includes(normalizedQuery))) ||
        (isGripDepartmentSearch(query) && getPositions(c).some(isGripOccupation)) ||
        c.role.toLowerCase().includes(q) ||
        (c.location.toLowerCase().includes(q) || placeSearchMatches(c,q)) ||
        c.skills.some((s) => s.toLowerCase().includes(q))
      );
    }

    if (selectedRoles.size > 0) {
      result = filterCrewOccupations(result, null, [...selectedRoles]);
    }

    if (isProviderFilter(sidebarDept)) {
      result = filterProviderProfiles(result, sidebarDept!);
    } else if (sidebarDept) {
      result = filterCrewOccupations(result, sidebarDept);
    }

    if (vendorOnly) result = result.filter((c) => c.isVendor === true);
    if (availableOnly) result = result.filter((c) => c.available);

    if (cityText) result = result.filter(c => placeSearchMatches(c, cityText) || c.location.toLowerCase().includes(cityText.toLowerCase()));
    if (cityFilter) {
      result = result.filter((c) => matchesPlace(c, "city", cityFilter));
    }
    if (regionFilter) result = result.filter(row => matchesPlace(row, "region", regionFilter));
    if (countryFilter) {
      result = result.filter((c) => matchesPlace(c, "country", countryFilter));
    }
    if (languageFilter) {
      result = result.filter((c) => matchesCrewLanguage(c.languages, languageFilter));
    }

    if (profileTypeFilter) result = result.filter(c => hasProfileType(c, profileTypeFilter));
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

    if (sortKey === "rating") {
      const rated = rankByRatingConfidence(result.filter((creator) => creator.reviews > 0), (creator) => creator.rating, (creator) => creator.reviews, (creator) => `${creator.name}:${creator.id}`);
      const unrated = result.filter((creator) => creator.reviews === 0).sort((a, b) => compareCreatorNames(a, b, locale));
      result = [...rated, ...unrated];
    } else if (sortKey === "reviews") {
      result.sort((a, b) => b.reviews - a.reviews || compareCreatorNames(a, b, locale));
    } else {
      result.sort((a, b) => compareCreatorNames(a, b, locale));
    }

    return result;
  }, [query, selectedRoles, sidebarDept, availableOnly, vendorOnly, cityText, cityFilter, countryFilter, regionFilter, languageFilter,
      profileTypeFilter, hairFilter, eyeFilter, bodyFilter, travelFilter, ageMinFilter, ageMaxFilter,
      sortKey, allCreators, isTopMode, locale, uiText]);

  const filterKey = JSON.stringify([query, [...selectedRoles].sort(), sidebarDept, availableOnly, vendorOnly,
    cityText, cityFilter, countryFilter, regionFilter, languageFilter, profileTypeFilter, hairFilter, eyeFilter, bodyFilter,
    travelFilter, ageMinFilter, ageMaxFilter, sortKey]);
  const visibleCount = pagination.filterKey === filterKey ? pagination.visibleCount : PAGE_SIZE;
  const setVisibleCount = (next: number | ((value: number) => number)) =>
    setPagination({ filterKey, visibleCount: typeof next === "function" ? next(visibleCount) : next });

  // Active filter chips: group by dept for context
  const activeChips = useMemo(() =>
    [...selectedRoles].map((role) => {
      const option = occupationById(role);
      const dept = departments.find((d) => d.id === option?.departmentId);
      return { role, label: taxonomyLabel(option?.label ?? role, uiText), dept };
    }),
    [selectedRoles, uiText]
  );

  // ── Mobile promoted role shortcuts ────────────────────────────────────
  const [sheetOpen, setSheetOpen] = useState(false);

  const secondaryFilterCount = [
    availableOnly,
    !!cityText,
    !!cityFilter,
    !!countryFilter,
    !!regionFilter,
    !!languageFilter,
    !!profileTypeFilter,
    !!hairFilter,
    !!eyeFilter,
    !!bodyFilter,
    !!travelFilter,
    !!(ageMinFilter || ageMaxFilter),
  ].filter(Boolean).length + selectedRoles.size;

  const mobileChips: BrowseChip[] = [
    ...(cityText ? [{ id: "city-text", label: `${uiText("Places.city")}: ${cityText}`, onRemove: () => setCityText("") }] : []),
    ...(sidebarDept ? [{ id: "area", label: sidebarDept === "__locations" ? uiText("nav.locations") : sidebarDept === "__marktplatz" ? uiText("nav.marketplace") : getDeptLabel(departments.find((department) => department.id === sidebarDept) ?? departments[0], locale, animals, taxonomyText), onRemove: () => chooseSidebarDept(null) }] : []),
    ...[...selectedRoles].map((role) => ({ id: `role-${role}`, label: taxonomyLabel(occupationById(role)?.label ?? role, uiText), onRemove: () => removeRole(role) })),
    ...(cityFilter ? [{ id: "city", label: cityLabel(cityFilter), onRemove: () => setCityFilter("") }] : []),
    ...(countryFilter ? [{ id: "country", label: countryLabel(countryFilter), onRemove: () => setCountryFilter("") }] : []),
    ...(regionFilter ? [{ id: "region", label: regionLabel(regionFilter), onRemove: () => setRegionFilter("") }] : []),
    ...(languageFilter ? [{ id: "language", label: crewLanguageLabel(languageFilter, locale), onRemove: () => setLanguageFilter("") }] : []),
    ...(profileTypeFilter ? [{ id: "profileType", label: uiText("Ui.text_efae3eb968ceb3", { value1: String(t("filterProfileType")), value2: String(PROFILE_TYPE_MAP[profileTypeFilter] ?? profileTypeFilter) }), onRemove: () => setProfileTypeFilter("") }] : []),
    ...(hairFilter ? [{ id: "hair", label: uiText("Ui.text_efae3eb968ceb3", { value1: String(t("filterHairColor")), value2: String(hairLabel(hairFilter)) }), onRemove: () => setHairFilter("") }] : []),
    ...(eyeFilter ? [{ id: "eyes", label: uiText("Ui.text_efae3eb968ceb3", { value1: String(t("filterEyeColor")), value2: String(eyeLabel(eyeFilter)) }), onRemove: () => setEyeFilter("") }] : []),
    ...(bodyFilter ? [{ id: "body", label: uiText("Ui.text_efae3eb968ceb3", { value1: String(profileText("castingBody")), value2: String(bodyLabel(bodyFilter)) }), onRemove: () => setBodyFilter("") }] : []),
    ...(ageMinFilter || ageMaxFilter ? [{ id: "age", label: uiText("Ui.text_907dc400de24ac", { value1: String(t("filterAge")), value2: String(ageMinFilter || "1"), value3: String(ageMaxFilter || "99") }), onRemove: () => { setAgeMinFilter(""); setAgeMaxFilter(""); } }] : []),
    ...(travelFilter ? [{ id: "travel", label: uiText("Ui.text_efae3eb968ceb3", { value1: String(t("filterTravel")), value2: String(TRAVEL_MAP[travelFilter] ?? travelFilter) }), onRemove: () => setTravelFilter("") }] : []),
    ...(availableOnly ? [{ id: "available", label: tc("available"), onRemove: () => setAvailableOnly(false) }] : []),
    ...(vendorOnly ? [{ id: "vendor", label: uiText("profile.catAnbieterLabel"), onRemove: () => setVendorOnly(false) }] : []),
  ];
  const resetMobileFilters = () => {
    setSelectedRoles(new Set()); setSidebarDept(null); setQuery(""); setCityText(""); setCityFilter(""); setCountryFilter(""); setRegionFilter(""); setLanguageFilter("");
    setAvailableOnly(false); setVendorOnly(false); setProfileTypeFilter(""); setHairFilter(""); setEyeFilter(""); setBodyFilter("");
    setAgeMinFilter(""); setAgeMaxFilter(""); setTravelFilter(""); setSortKey("featured");
  };

  const SORT_OPTIONS = [
    { value: "featured", label: t("sortAlphabetical") },
    { value: "rating",   label: t("sortRating") },
    { value: "reviews",  label: t("sortRatingCount") },
  ];

  return (
    <div className="min-h-screen mobile-bottom-nav-clear">

      <MobileBrowseControls
        query={query}
        onQueryChange={setQuery}
        searchPlaceholder={t("searchPlaceholder")}
        sortValue={sortKey}
        sortOptions={SORT_OPTIONS}
        onSortChange={setSortKey}
        categoryLabel={t("deptFilter")}
        allCategoryLabel={uiText("Ui.text_bc0b501bb3186b")}
        categories={[
          ...departments.map((department) => ({ value: department.id, label: getDeptLabel(department, locale, animals, taxonomyText) })),
          { value: LOCATION_PROVIDER_FILTER, label: uiText("Ui.text_e05308bad64468") },
          { value: MARKETPLACE_PROVIDER_FILTER, label: uiText("Ui.text_47ce00e52d872a") },
        ]}
        categoryValue={sidebarDept ?? ""}
        onCategoryChange={(value) => { setSelectedRoles(new Set()); chooseSidebarDept(value || null); }}
        resultSummary={hasMoreFromApi ? (loadError ? t("resultsLoadFailed") : t("resultsLoading")) : t("results", { count: filtered.length })}
        filterCount={secondaryFilterCount + (sidebarDept ? 1 : 0)}
        chips={mobileChips}
        onReset={resetMobileFilters}
        resetLabel={t("resetFilters")}
        showResultsLabel={t("showResults", { count: filtered.length })}
      >
        <MobileFilterField label={t("filterProfileType")}>
          <MobileFilterSelect value={profileTypeFilter} onChange={setProfileTypeFilter} placeholder={t("filterAll")} options={availableProfileTypes.map((value) => ({ value, label: PROFILE_TYPE_MAP[value] ?? value }))} />
        </MobileFilterField>
        {!isProviderFilter(sidebarDept) && <MobileFilterField label={uiText("Ui.text_0038a9cf86613c")}>
          <MobileFilterSelect value={[...selectedRoles][0] ?? ""} onChange={(value) => setSelectedRoles(value ? new Set([value]) : new Set())} placeholder={uiText("Ui.text_903f372337ed95")} options={occupationCatalogue.filter(option => !sidebarDept || option.departmentId === sidebarDept).map(option => ({ value: option.roleId, label: uiText("Ui.text_6ae50ea0dac869", { value1: String(getDeptLabel(departments.find(department=>department.id === option.departmentId)!, locale, animals, taxonomyText)), value2: String(getDepartmentRoleLabel(option.departmentId, option.label, locale, animals, taxonomyText)) }) }))} />
        </MobileFilterField>}
        <PlaceFilters rows={allCreators} value={{country:countryFilter,region:regionFilter,city:cityFilter}} onChange={changePlaceFilters} />
        <MobileFilterField label={t("filterLanguage")}>
          <MobileFilterSelect value={languageFilter} onChange={setLanguageFilter} placeholder={t("filterAll")} options={availableLanguages.map((value) => ({ value, label: crewLanguageLabel(value, locale) }))} />
        </MobileFilterField>
        <div className="grid grid-cols-2 gap-3">
          <MobileFilterField label={t("filterHairColor")}>
            <MobileFilterSelect value={hairFilter} onChange={setHairFilter} placeholder={t("filterAll")} options={availableHairColors.map((value) => ({ value, label: hairLabel(value) }))} />
          </MobileFilterField>
          <MobileFilterField label={t("filterEyeColor")}>
            <MobileFilterSelect value={eyeFilter} onChange={setEyeFilter} placeholder={t("filterAll")} options={availableEyeColors.map((value) => ({ value, label: eyeLabel(value) }))} />
          </MobileFilterField>
        </div>
        <MobileFilterField label={profileText("castingBody")}>
          <MobileFilterSelect value={bodyFilter} onChange={setBodyFilter} placeholder={t("filterAll")} options={availableBodyTypes.map((value) => ({ value, label: bodyLabel(value) }))} />
        </MobileFilterField>
        <div className="grid grid-cols-2 gap-3">
          <MobileFilterField label={uiText("Ui.text_7f41f4ab011b53")}><input inputMode="numeric" type="number" min="1" max="99" value={ageMinFilter} onChange={(event) => setAgeMinFilter(event.target.value)} placeholder={uiText("Ui.text_d0c50fd56cbce3")} /></MobileFilterField>
          <MobileFilterField label={uiText("Ui.text_cf402a5ebe8d8f")}><input inputMode="numeric" type="number" min="1" max="99" value={ageMaxFilter} onChange={(event) => setAgeMaxFilter(event.target.value)} placeholder={uiText("Ui.text_d0c50fd56cbce3")} /></MobileFilterField>
        </div>
        <MobileFilterField label={t("filterTravel")}>
          <MobileFilterSelect value={travelFilter} onChange={setTravelFilter} placeholder={t("filterAll")} options={Object.entries(TRAVEL_MAP).map(([value, label]) => ({ value, label }))} />
        </MobileFilterField>
        <div className="grid gap-1">
          <label className="flex min-h-11 items-center gap-3 text-sm text-text-secondary"><input type="checkbox" className="size-4 accent-gold" checked={availableOnly} onChange={(event) => setAvailableOnly(event.target.checked)} />{tc("available")}</label>
          <label className="flex min-h-11 items-center gap-3 text-sm text-text-secondary">{uiText.rich("Ui.text_2be79df6cf7abd", { part1: () => (<input type="checkbox" className="size-4 accent-gold" checked={vendorOnly} onChange={(event) => setVendorOnly(event.target.checked)} />) })}</label>
        </div>
      </MobileBrowseControls>

      {/* ══════════════════════════════════════════════════════════════════════
          MOBILE LAYOUT  (< lg)
          ══════════════════════════════════════════════════════════════════ */}
      <div className="hidden">

        {/* Row 1 — Search + View toggle */}
        <div className="browse-toolbar site-container flex items-center gap-2 py-2">
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
        <div className="browse-toolbar site-container overflow-x-auto py-2.5" style={{ scrollbarWidth: "none" }}>
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
          <div className="browse-toolbar site-container flex flex-wrap items-center gap-1.5 py-2">
            {activeChips.map(({ role, label, dept }) => {
              const colors = dept ? deptColors(dept.color) : deptColors("slate");
              return (
                <span key={role} className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border font-medium ${colors.bg} ${colors.border} ${colors.text}`}>
                  {label}
                  <button onClick={() => removeRole(role)} className="hover:opacity-70 ml-0.5"><X size={9} /></button>
                </span>
              );
            })}
            <button
              onClick={() => { clearAll(); setCityFilter(""); setCountryFilter(""); setRegionFilter(""); setLanguageFilter(""); setAvailableOnly(false); setVendorOnly(false); }}
              className="text-[11px] text-text-muted hover:text-red-400 transition-colors underline underline-offset-2"
            >
              {t("clearAll")}
            </button>
          </div>
        )}

        {/* Row 4 — Ergebnis-Count + Sort */}
        <div className="site-container flex items-center justify-between py-2.5">
          <p className="text-xs text-text-muted">
            {isTopMode ? (
              <span className="text-gold font-semibold">{t("results", { count: filtered.length })}</span>
            ) : (
              <span className="text-text-primary font-semibold">{t("results", { count: filtered.length })}</span>
            )}
            {query && <span className="text-gold">{uiText.rich("Ui.text_58e2efda5da487", { value1: () => (query) })}</span>}
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
                const deptRoles = dept.roles;
                if (deptRoles.length === 0) return null;
                const colors = deptColors(dept.color);
                return (
                  <div key={dept.id}>
                    <p className={`text-[11px] uppercase tracking-widest font-semibold mb-2.5 ${colors.text}`}>
                      {dept.emoji} {getDeptLabel(dept, locale, animals, taxonomyText)}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {deptRoles.map((role) => {
                        const active = selectedRoles.has(occupationId(dept.id, role));
                        return (
                          <button
                            key={role}
                            onClick={() => toggleRole(occupationId(dept.id, role))}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                              active ? `${colors.bg} ${colors.text} border-transparent` : "border-border text-text-muted bg-bg-secondary"
                            }`}
                          >
                            {getDepartmentRoleLabel(dept.id, role, locale, animals, taxonomyText)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Stadt */}
              {(availableCities.length > 0 || availableCountries.length > 0) && (
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-text-muted font-semibold mb-2.5">{t("filterCity")}</p>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setCityFilter("")}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${!cityFilter ? "bg-gold text-bg-primary border-gold" : "border-border text-text-muted bg-bg-secondary"}`}>
                      {t("filterAll")}
                    </button>
                    {availableCities.map((city) => (
                      <button key={city} onClick={() => { setCityFilter(cityFilter === city ? "" : city); setCityText(""); }}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${cityFilter === city ? "bg-gold text-bg-primary border-gold" : "border-border text-text-muted bg-bg-secondary"}`}>
                        {cityLabel(city)}
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
                    {availableLanguages.map((lang) => (
                      <button key={lang} onClick={() => setLanguageFilter(languageFilter === lang ? "" : lang)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${languageFilter === lang ? "bg-gold text-bg-primary border-gold" : "border-border text-text-muted bg-bg-secondary"}`}>
                        {crewLanguageLabel(lang, locale)}
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
                        <option value="">{t("filterAll")}</option>
                        {availableHairColors.map((h) => <option key={h} value={h}>{hairLabel(h)}</option>)}
                      </select>
                    </div>
                  )}
                  {availableEyeColors.length > 0 && (
                    <div>
                      <p className="text-[11px] uppercase tracking-widest text-text-muted font-semibold mb-2">{t("filterEyeColor")}</p>
                      <select value={eyeFilter} onChange={(e) => setEyeFilter(e.target.value)}
                        className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-text-secondary focus:outline-none focus:border-gold transition-colors">
                        <option value="">{t("filterAll")}</option>
                        {availableEyeColors.map((e) => <option key={e} value={e}>{eyeLabel(e)}</option>)}
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
                    placeholder={uiText("profile.ageFrom")} className="w-20 bg-bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-gold transition-colors" />
                  <span className="text-xs text-text-muted">–</span>
                  <input type="number" min="1" max="99" value={ageMaxFilter} onChange={(e) => setAgeMaxFilter(e.target.value)}
                    placeholder={uiText("profile.ageTo")} className="w-20 bg-bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-gold transition-colors" />
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
                  setCityText(""); setCityFilter(""); setCountryFilter(""); setRegionFilter(""); setLanguageFilter("");
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
      <div className="hidden xl:block browse-toolbar">
        <div className="site-container py-2 space-y-2">

          {/* Row 1: Search + Sort + View toggle */}
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 bg-bg-elevated border border-border rounded-lg px-3 focus-within:border-gold/50 transition-colors">
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
            <SortDropdown
              value={sortKey}
              options={SORT_OPTIONS}
              onChange={setSortKey}
            />
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
            {!isProviderFilter(sidebarDept) && <button type="button" onClick={() => setFilterOpen(value => !value)} aria-expanded={filterOpen}
              className={`flex min-h-11 items-center gap-2 rounded-lg border px-3 text-xs font-medium ${filterOpen || selectedRoles.size ? "border-gold/30 text-gold bg-gold/10" : "border-border text-text-muted"}`}>{uiText.rich("Ui.text_bcc09674bbade1", { part1: () => (<ChevronDown size={12} />) })}</button>}
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


            {(availableCities.length > 0 || availableCountries.length > 0) && (
              <PlaceFilters rows={allCreators} value={{country:countryFilter,region:regionFilter,city:cityFilter}} onChange={changePlaceFilters} />
            )}
            {availableLanguages.length > 0 && (
              <FilterDropdown icon={Languages} label={t("filterLanguage")} value={languageFilter} options={availableLanguages} optionLabel={(value) => crewLanguageLabel(value, locale)} onChange={setLanguageFilter} />
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

            {cityText && <span className="mobile-browse-chip"><span className="truncate">{uiText("Places.city")}: {cityText}</span><button type="button" aria-label={uiText("Ui.text_f10fe7a27ce274", { value1: cityText })} onClick={() => setCityText("")}><X size={13} /></button></span>}
            {regionFilter && <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border font-medium bg-bg-elevated border-border text-text-secondary"><MapPin size={9} />{regionLabel(regionFilter)}<button type="button" aria-label={uiText("Ui.text_efae3eb968ceb3", { value1: String(tc("clearFilter")), value2: String(regionLabel(regionFilter)) })} onClick={() => setRegionFilter("")} className="hover:opacity-70 ml-0.5"><X size={9} /></button></span>}
            {(cityText || cityFilter || countryFilter || regionFilter || languageFilter || selectedRoles.size > 0 ||
              profileTypeFilter || hairFilter || eyeFilter || bodyFilter || travelFilter || ageMinFilter || ageMaxFilter) && (
              <button
                onClick={() => {
                  clearAll();
                  setCityText(""); setCityFilter(""); setCountryFilter(""); setRegionFilter(""); setLanguageFilter("");
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
                <FilterDropdown icon={SlidersHorizontal} label={t("filterHairColor")} value={hairFilter} options={availableHairColors} optionLabel={hairLabel} onChange={setHairFilter} />
              )}
              {availableEyeColors.length > 0 && (
                <FilterDropdown icon={SlidersHorizontal} label={t("filterEyeColor")} value={eyeFilter} options={availableEyeColors} optionLabel={eyeLabel} onChange={setEyeFilter} />
              )}
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-xs text-text-muted whitespace-nowrap">{t("filterAge")}</span>
                <input type="number" min="1" max="99" value={ageMinFilter} onChange={e => setAgeMinFilter(e.target.value)}
                  placeholder={uiText("profile.ageFrom")} className="w-14 bg-bg-elevated border border-border rounded-lg px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-gold transition-colors" />
                <span className="text-xs text-text-muted">–</span>
                <input type="number" min="1" max="99" value={ageMaxFilter} onChange={e => setAgeMaxFilter(e.target.value)}
                  placeholder={uiText("profile.ageTo")} className="w-14 bg-bg-elevated border border-border rounded-lg px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-gold transition-colors" />
              </div>
              <FilterDropdown
                icon={Globe}
                label={t("filterTravel")}
                value={travelFilter}
                options={Object.keys(TRAVEL_MAP)}
                optionLabel={value => TRAVEL_MAP[value] ?? value}
                onChange={setTravelFilter}
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
                    const deptSelected = dept.roles.filter((r) => selectedRoles.has(occupationId(dept.id, r))).length;
                    const isActive = activeDept === dept.id;
                    return (
                      <button key={dept.id} onClick={() => chooseSidebarDept(dept.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border shrink-0 transition-all ${
                          isActive ? `${colors.bg} ${colors.text} border-transparent` : "border-border text-text-muted"
                        }`}>
                        {dept.emoji} {getDeptLabel(dept, locale, animals, taxonomyText)}
                        {deptSelected > 0 && <span className={`w-3.5 h-3.5 rounded-full text-[8px] font-bold flex items-center justify-center ${colors.bg} ${colors.text}`}>{deptSelected}</span>}
                      </button>
                    );
                  })}
                </div>
                <div className="p-3">
                  <RolePanel key={activeDeptData.id} dept={activeDeptData} selectedRoles={selectedRoles} onToggle={toggleRole} onClose={() => setFilterOpen(false)} locale={locale} />
                </div>
              </div>
              {/* Desktop: two-panel */}
              <div className="hidden h-80 sm:flex">
                <div className="w-44 shrink-0 border-r border-border overflow-y-auto bg-bg-secondary">
                  {activeDepts.map((dept) => {
                    const colors = deptColors(dept.color);
                    const deptSelected = dept.roles.filter((r) => selectedRoles.has(occupationId(dept.id, r))).length;
                    const isActive = activeDept === dept.id;
                    return (
                      <button key={dept.id}
                        onClick={() => chooseSidebarDept(dept.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs transition-colors border-b border-border/40 last:border-0 ${
                          isActive ? `${colors.bg} ${colors.text} font-semibold` : "text-text-muted hover:text-text-secondary hover:bg-white/[0.02]"
                        }`}>
                        <span>{getDeptLabel(dept, locale, animals, taxonomyText)}</span>
                        {deptSelected > 0 && (
                          <span className={`text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${colors.bg} border ${colors.border} ${colors.text}`}>{deptSelected}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="flex-1 overflow-y-auto p-3">
                  <RolePanel key={activeDeptData.id} dept={activeDeptData} selectedRoles={selectedRoles} onToggle={toggleRole} onClose={() => setFilterOpen(false)} locale={locale} />
                </div>
              </div>
            </div>
          )}

          {/* Row 4: Active filter chips */}
          {activeChips.length > 0 && (
            <div className="flex flex-wrap gap-1.5 items-center">
              {activeChips.map(({ role, label, dept }) => {
                const colors = dept ? deptColors(dept.color) : deptColors("slate");
                return (
                  <span
                    key={role}
                    className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border font-medium ${colors.bg} ${colors.border} ${colors.text}`}
                  >
                    {dept?.emoji} {label}
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

      {loadError && <div className="site-container py-3"><p role="alert" className="text-sm text-text-muted">{uiText("Ui.text_ce8a3ad3ae6d5b")}<button className="min-h-11 text-gold underline" onClick={() => setLoadError(false)}>{uiText("notifications.retry")}</button></p></div>}
      {/* ── Results ─────────────────────────────────────────────────────────── */}
      {(() => {
        const filteredCrew = filtered;
        const crewVisible  = filteredCrew.slice(0, visibleCount);

        return (
          <div className="site-container py-3 pb-24 sm:py-6 lg:pb-8">
            <div className="flex gap-8 items-start">

            {/* Left sidebar */}
            <aside className="cat-sidebar w-44 shrink-0 sticky top-20">
              <p className="text-[11px] uppercase tracking-widest text-text-muted font-semibold mb-3 px-2">{uiText("Ui.text_7b40d8db4ebc62")}</p>
              <nav className="space-y-0.5">
                <button
                  onClick={() => chooseSidebarDept(null)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all text-left ${
                    !sidebarDept
                      ? "bg-gold/10 text-gold font-semibold border-l-2 border-gold pl-[10px]"
                      : "text-text-secondary hover:text-text-primary hover:bg-bg-secondary"
                  }`}
                >{uiText.rich("Ui.text_059ad29af9ea26", { part1: () => (<Users size={14} className={!sidebarDept ? "text-gold" : "text-text-muted"} />) })}</button>
                {departments.map((dept) => {
                  const isActive = sidebarDept === dept.id;
                  const Icon = DEPT_ICON[dept.id] ?? Users;
                  return (
                    <button
                      key={dept.id}
                      onClick={() => chooseSidebarDept(isActive ? null : dept.id)}
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
                <div className="pt-3 mt-2 border-t border-border/50 space-y-0.5">
                  {([
                    { id: LOCATION_PROVIDER_FILTER, label: uiText("nav.locations"), Icon: MapPin },
                    { id: MARKETPLACE_PROVIDER_FILTER, label: uiText("nav.marketplace"), Icon: ShoppingBag },
                  ] as const).map(({ id, label, Icon }) => {
                    const isActive = sidebarDept === id;
                    return (
                      <button
                        key={id}
                        onClick={() => chooseSidebarDept(isActive ? null : id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all text-left ${
                          isActive
                            ? "bg-gold/10 text-gold font-semibold border-l-2 border-gold pl-[10px]"
                            : "text-text-secondary hover:text-text-primary hover:bg-bg-secondary"
                        }`}
                      >
                        <Icon size={14} className={isActive ? "text-gold" : "text-text-muted"} />
                        {label}
                      </button>
                    );
                  })}
                </div>
              </nav>
              <div className="mt-6 pt-5 border-t border-border">{uiText.rich("Ui.text_a91cbe30fbb0b1", { part2: () => (<Plus size={14} />), part1: chunks => (<Link
                  href="/profile"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-gold hover:bg-gold/10 rounded-lg transition-colors font-medium"
                >{chunks}</Link>) })}</div>
            </aside>

            {/* Main content */}
            <div className="flex-1 min-w-0">

            {/* Mobile dept pills */}
            <div className="cat-pills gap-2 overflow-x-auto pb-3 mb-4" style={{ scrollbarWidth: "none" }}>
              <button
                onClick={() => chooseSidebarDept(null)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0 border transition-all ${
                  !sidebarDept
                    ? "bg-gold/10 text-gold border-gold/40"
                    : "border-border text-text-muted hover:border-gold/30 hover:text-text-primary"
                }`}
              >{uiText("Ui.text_bc0b501bb3186b")}</button>
              {departments.map((dept) => {
                const isActive = sidebarDept === dept.id;
                return (
                  <button
                    key={dept.id}
                    onClick={() => chooseSidebarDept(isActive ? null : dept.id)}
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
              {([
                { id: LOCATION_PROVIDER_FILTER, label: uiText("nav.locations") },
                { id: MARKETPLACE_PROVIDER_FILTER, label: uiText("nav.marketplace") },
              ] as const).map(({ id, label }) => {
                const isActive = sidebarDept === id;
                return (
                  <button
                    key={id}
                    onClick={() => chooseSidebarDept(isActive ? null : id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0 border transition-all ${
                      isActive
                        ? "bg-gold/10 text-gold border-gold/40"
                        : "border-border text-text-muted hover:border-gold/30 hover:text-text-primary"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Count */}
            <p className="hidden xl:block text-sm text-text-muted mb-5">
              <span className="text-text-primary font-semibold">
                {hasMoreFromApi ? (loadError ? t("resultsLoadFailed") : t("resultsLoading")) : t("results", { count: filteredCrew.length })}
              </span>
              {query && <span className="text-gold">{uiText.rich("Ui.text_58e2efda5da487", { value1: () => (query) })}</span>}
            </p>

            {/* Empty */}
            {filteredCrew.length === 0 && (
              <EmptyState
                icon={Users}
                title={allCreators.length === 0 ? t("emptyTitle") : t("emptyTitleFiltered")}
                description={allCreators.length === 0 ? t("emptyDesc") : t("emptyDescFiltered")}
                action={allCreators.length === 0
                  ? { label: t("emptyActionCreate"), onClick: () => window.location.href = "/profile" }
                  : { label: t("emptyActionReset"), onClick: () => { setQuery(""); clearAll(); setAvailableOnly(false); setCityFilter(""); setCountryFilter(""); setRegionFilter(""); setLanguageFilter(""); } }
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
                    const displayPositions = getPositions(c).map(label => taxonomyLabel(label, uiText));
                    const href = c.id.startsWith("listing_") ? `/creators/${c.id.replace("listing_", "")}` : `/profile/${c.id}`;
                    return (
                      <Link key={c.id} href={href} suppressHydrationWarning
                        className="group flex items-center gap-3 px-4 py-2.5 hover:bg-bg-elevated transition-colors">
                        {/* Avatar */}
                        <ProfileCardPhoto src={c.avatar} name={c.name} focalPoint={c.focal_point} className="h-9 w-9 rounded-full border border-border/60" sizes="36px" />
                        {/* Name + role */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold text-text-primary group-hover:text-gold transition-colors truncate">{c.name}</span>
                            {c.verified && <CheckCircle size={11} className="text-gold/60 shrink-0" />}
                            {c.available && c.last_seen_at && (Date.now() - new Date(c.last_seen_at).getTime() < 14 * 24 * 60 * 60 * 1000) && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" title={tc("available")} />}
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
                        <p className="hidden md:block text-xs shrink-0 w-28 text-right">
                          {c.dayRate && !c.dayRateOnRequest
                            ? <span className="text-text-secondary">{c.dayRate}</span>
                            : <span className="text-text-muted/30">–</span>
                          }
                        </p>
                      </Link>
                    );
                  })}
                </div>
              )}

              {/* Grid: large profile cards */}
              {viewMode === "grid" && (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
                {crewVisible.map((c) => {
                  const displayPositions = getPositions(c).map(label => taxonomyLabel(label, uiText));
                  const href = c.id.startsWith("listing_") ? `/creators/${c.id.replace("listing_", "")}` : `/profile/${c.id}`;
                  const photo = crewPhotoInput(c);
                  return (
                    <Link key={c.id} href={href} suppressHydrationWarning
                      className="browse-card card-hover group flex min-w-0 items-center gap-1.5 p-2 sm:gap-3 sm:p-3">
                      <ProfileCardPhoto {...photo} name={c.name} className="h-12 w-12 rounded-lg border border-border/60 min-[375px]:h-14 min-[375px]:w-14 sm:h-[88px] sm:w-[88px] lg:h-24 lg:w-24" sizes="(min-width: 1024px) 96px, (min-width: 640px) 88px, (min-width: 375px) 56px, 48px" />
                      <div className="min-w-0 flex-1 py-0.5">
                        <div className="flex items-start justify-between gap-1 mb-0.5">
                          <h3 className="min-w-0 break-words [overflow-wrap:anywhere] font-semibold text-text-primary text-[13px] leading-snug sm:text-sm">{c.name}</h3>
                          {c.verified && <CheckCircle size={12} className="text-gold/60 shrink-0 mt-0.5" />}
                        </div>
                        <p className="line-clamp-2 text-[11px] leading-snug text-gold font-medium sm:text-xs">{displayPositions.slice(0, 2).join(" · ")}</p>
                        {c.location && (
                          <p className="mt-1.5 flex min-w-0 items-center gap-1 text-[10px] text-text-muted sm:text-xs">
                            <MapPin size={11} className="shrink-0" />
                            <span className="truncate">{c.location.split(",")[0]}</span>
                          </p>
                        )}
                        {c.reviews > 0 && (
                          <div className="mt-1.5 flex items-center gap-1">
                            <Star size={10} className="fill-gold text-gold" />
                            <span className="text-[10px] font-semibold text-text-primary">{c.rating.toFixed(1)}</span>
                            <span className="text-[10px] text-text-muted">({c.reviews})</span>
                          </div>
                        )}
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
  hasMoreProfiles = false,
  initialFilters,
}: {
  serverCreators: ServerCreator[];
  hasMoreProfiles?: boolean;
  initialFilters: { query: string; city: string; sort: string; cityText?: string; country?: string; region?: string };
}) {
  return <CreatorsInner serverCreators={serverCreators} hasMoreProfiles={hasMoreProfiles} initialFilters={initialFilters} />;
}
