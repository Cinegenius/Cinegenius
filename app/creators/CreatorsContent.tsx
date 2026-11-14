"use client";
import { withinCrewRadius, type CrewNear } from "@/lib/genie-search";
import BrowseGeography from "@/components/BrowseGeography";
import { prioritizeGeographically } from "@/lib/browse-geography";
import { useBrowseGeography } from "@/lib/use-browse-geography";


import DirectoryMap from "@/components/DirectoryMap";
import DirectoryViewControls,{ type DirectoryView } from "@/components/DirectoryViewControls";
import FloatingMapToggle from "@/components/FloatingMapToggle";
import { useDirectoryMap } from "@/lib/use-directory-map";

import PlaceFilters from "@/components/PlaceFilters";

import { canonicalFilterValue,matchesPlace,browsePlaceOptions as placeOptions, UNASSIGNED_COUNTRY,placeSearchMatches } from "@/lib/places/core";

import { crewLanguageLabel,matchesCrewLanguage,normalizeCrewLanguages } from "@/lib/crew-languages";
import { profileTraitLabel,profileTraitOptions } from "@/lib/profile-trait-labels";
import { useViewState } from "@/lib/use-view-state";
import { useViewUrl } from "@/lib/use-view-url";

import { filterCrewOccupations } from "@/lib/crew-occupations";
import { filterProviderProfiles,isProviderFilter,CREW_PROVIDER_FILTER,LOCATION_PROVIDER_FILTER,MARKETPLACE_PROVIDER_FILTER } from "@/lib/profile-provider-filters";

import EmptyState from "@/components/EmptyState";
import MobileBrowseControls,{ BrowseRoleFilter,MobileFilterField,MobileFilterSelect,type BrowseChip } from "@/components/MobileBrowseControls";
import ProfileCardPhoto from "@/components/ProfileCardPhoto";
import ProviderQuickFilters from "@/components/ProviderQuickFilters";
import { compareCreatorNames } from "@/lib/creator-directory-order";
import { departments,getDepartmentRoleLabel,getDeptLabel,getOccupationSearchTerms,taxonomyLabel } from "@/lib/departments";
import { gripSearchTerms,isGripDepartmentSearch,isGripOccupation,normalizeOccupation } from "@/lib/gripTaxonomy";
import { occupationById,occupationCatalogue,type PrimaryOccupation } from "@/lib/primary-occupation";
import type { ProfileFocalPoint } from "@/lib/profile-cover";
import { crewPhotoInput } from "@/lib/profile-photo";
import { subscribeToProfileUpdated } from "@/lib/profile-update-events";
import { rankByRatingConfidence } from "@/lib/rating-ranking";
import {
CheckCircle,
MapPin,
Star,
Users
} from "lucide-react";
import { useLocale,useTranslations } from "next-intl";
import Link from "next/link";
import { useCallback,useEffect,useMemo,useRef,useState } from "react";

const PAGE_SIZE = 24;
type CrewInitialFilters = { query: string; city: string; sort: string; cityText?: string; country?: string; region?: string; view?: string; genie?: boolean; department?: string; role?: string; near?: CrewNear | null };

export type ServerCreator = {
  id: string;
  ownerId?: string;
  name: string;
  role: string;
  positions: string[];
  primaryOccupation?: PrimaryOccupation | null;
  occupationIds?: string[];
  location: string;
  lat?: number | null;
  lng?: number | null;
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

// ─── Role Panel ─────────────────────────────────────────────────────────────

// ─── Main ────────────────────────────────────────────────────────────────────

function CreatorsInner({
  serverCreators,
  hasMoreProfiles = false,
  initialFilters,
}: {
  serverCreators: ServerCreator[];
  hasMoreProfiles?: boolean;
  initialFilters: CrewInitialFilters;
}) {
  const taxonomyText = useTranslations("Taxonomy");

  const uiText = useTranslations();

  const tc = useTranslations("common");
  const t = useTranslations("creators");
  const profileText = useTranslations("profile");
  const animals = useTranslations("FilmAnimals");
  const locale = useLocale();
  const resultsRef = useRef<HTMLDivElement>(null);

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
  const [near, setNear] = useViewState<CrewNear | null>("crew.near", () => initialFilters.near ?? null);
  const [availableOnly, setAvailableOnly] = useViewState("crew.availableOnly", false);

  // allCreators muss VOR den useMemo-Aufrufen deklariert sein
  const [allCreators, setAllCreators] = useState<ServerCreator[]>(serverCreators);
  const [hasMoreFromApi, setHasMoreFromApi] = useState(hasMoreProfiles);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const directoryRequest = useRef<{ source: ServerCreator[]; page: number; hasMore: boolean; active: boolean; controller: AbortController | null }>({ source: serverCreators, page: 1, hasMore: hasMoreProfiles, active: true, controller: null });
  useEffect(() => {
    const scope = { source: serverCreators, page: 1, hasMore: hasMoreProfiles, active: true, controller: null as AbortController | null };
    directoryRequest.current = scope;
    setAllCreators(serverCreators);
    setHasMoreFromApi(hasMoreProfiles);
    setLoadingMore(false);
    setLoadError(false);
    return () => { scope.active = false; scope.controller?.abort(); };
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
    const scope = directoryRequest.current;
    if (!scope.active || scope.source !== serverCreators || scope.controller || !scope.hasMore) return;
    const controller = new AbortController();
    scope.controller = controller;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/creators?page=${scope.page}`, { signal: controller.signal });
      if (!res.ok) throw new Error(uiText("Ui.text_3246f5de17bad7"));
      const { creators, hasMore } = await res.json();
      // A URL/session refresh replaces the first page. Older requests cannot finish that new sequence.
      if (!scope.active || directoryRequest.current !== scope) return;
      if (creators?.length) {
        setAllCreators(prev => scope.active && directoryRequest.current === scope
          ? [...new Map([...prev.filter(creator => !creator.id.startsWith("listing_") || !creators.some((profile: ServerCreator) => profile.id === creator.ownerId)), ...creators].map(creator => [creator.id, creator])).values()] : prev);
      }
      scope.page += 1;
      scope.hasMore = !!hasMore;
      setHasMoreFromApi(scope.hasMore);
    } catch {
      if (scope.active && directoryRequest.current === scope && !controller.signal.aborted) setLoadError(true);
    } finally {
      if (scope.active && directoryRequest.current === scope) { scope.controller = null; setLoadingMore(false); }
    }
  }, [serverCreators, uiText]);

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
  const availableLanguages = useMemo(() => [...new Set(allCreators.flatMap(c => normalizeCrewLanguages(c.languages)))].sort((a,b) => crewLanguageLabel(a,locale).localeCompare(crewLanguageLabel(b,locale),locale)), [allCreators,locale]);
  const cityLabel = (value: string) => cityOptions.find(o => o.value === value)?.label ?? value;
  const countryLabel = (value: string) => value === UNASSIGNED_COUNTRY ? uiText("Places.countryUnassigned") : countryOptions.find(o => o.value === value)?.label ?? value;
  const regionLabel = (value: string) => regionOptions.find(option => option.value === value)?.label ?? value;
  const [sortKey, setSortKey] = useViewState("crew.sortKey", () => ["rating", "reviews"].includes(initialFilters.sort) ? initialFilters.sort : "featured");
  const geography = useBrowseGeography(sortKey === "featured" && !countryFilter && !regionFilter && !cityFilter && !cityText && !near);
  const [viewMode, setViewMode] = useViewState<DirectoryView>("crew.viewMode", () => initialFilters.view === "map" ? "map" : initialFilters.view === "list" ? "list" : "grid");

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

  const travelValues = [...new Set([...allCreators.flatMap(creator => typeof creator.travel === "string" && creator.travel ? [creator.travel] : []),
  ])];
  const TRAVEL_MAP = Object.fromEntries(travelValues.map(value => [value, profileTraitLabel("travel", value, profileText)]));
  const [pagination, setPagination] = useViewState("crew.pagination", { filterKey: "", visibleCount: PAGE_SIZE });

  const [vendorOnly, setVendorOnly] = useViewState("crew.vendorOnly", false);

  // Hierarchical filter state
  const [selectedRoles, setSelectedRoles] = useViewState<Set<string>>("crew.selectedRoles", () => new Set(initialFilters.role ? [initialFilters.role] : []));
  const [sidebarDept, setSidebarDept] = useViewState<string | null>("crew.sidebarDept", () => initialFilters.department || null);

  // Keep canonical catalogue IDs and order; show only roles represented by public profiles.
  const availableOccupations = useMemo(() => occupationCatalogue.filter(option => filterCrewOccupations(allCreators, null, [option.roleId]).length > 0), [allCreators]);
  const activeDepts = useMemo(() => departments.filter(dept => filterCrewOccupations(allCreators, dept.id).length > 0), [allCreators]);

  const chooseSidebarDept = (deptId: string | null) => {
    setSelectedRoles(new Set());
    setSidebarDept(deptId);
    if (deptId === null && viewMode !== "map") setViewMode("grid");
  };

  const removeRole = (role: string) =>
    setSelectedRoles((prev) => { const n = new Set(prev); n.delete(role); return n; });

  const clearAll = () => { setSelectedRoles(new Set()); };

  // An explicit Genie link overrides restored directory filters, once per navigation.
  const launchKey = initialFilters.genie ? JSON.stringify(initialFilters) : "";
  const appliedLaunch = useRef("");
  useEffect(() => {
    if (!launchKey) { appliedLaunch.current = ""; return; }
    if (appliedLaunch.current === launchKey) return;
    appliedLaunch.current = launchKey;
    resetMobileFilters();
    setSidebarDept(initialFilters.department || null);
    setSelectedRoles(new Set(initialFilters.role ? [initialFilters.role] : []));
    setCityText(initialFilters.cityText ?? ""); setCountryFilter(initialFilters.country ?? "");
    setNear(initialFilters.near ?? null);
  }, [launchKey]);

  const filterParams = new URLSearchParams();
  if (sidebarDept && departments.some(dept => dept.id === sidebarDept)) filterParams.set("department", sidebarDept);
  if (selectedRoles.size === 1) filterParams.set("role", [...selectedRoles][0]);
  if (near) { filterParams.set("near", near.id); filterParams.set("radius", String(near.radius)); }
  if (query) filterParams.set("q", query);
  if (cityText) filterParams.set("cityText", cityText);
  if (cityFilter) filterParams.set("city", cityFilter);
  if (countryFilter) filterParams.set("country", countryFilter);
  if (regionFilter) filterParams.set("region", regionFilter);
  if (sortKey !== "featured") filterParams.set("sort", sortKey);
  if (viewMode !== "grid") filterParams.set("view", viewMode);
  useViewUrl(filterParams.size ? `/creators?${filterParams}` : "/creators");

  // Filtered results
  const isTopMode = !query.trim() && selectedRoles.size === 0 && !sidebarDept
    && !availableOnly && !vendorOnly && !near && !cityText && !cityFilter && !countryFilter && !regionFilter && !languageFilter
    && !profileTypeFilter && !hairFilter && !eyeFilter && !bodyFilter && !travelFilter
    && !ageMinFilter && !ageMaxFilter;

  const matching = useMemo(() => {
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

    if (near) result = result.filter(creator => withinCrewRadius(creator, near));
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

    return prioritizeGeographically(result, geography.preferred);
  }, [query, selectedRoles, sidebarDept, availableOnly, vendorOnly, near, cityText, cityFilter, countryFilter, regionFilter, languageFilter,
      profileTypeFilter, hairFilter, eyeFilter, bodyFilter, travelFilter, ageMinFilter, ageMaxFilter,
      sortKey, allCreators, isTopMode, locale, uiText, geography.preferred]);

  const filterKey = JSON.stringify([query, [...selectedRoles].sort(), sidebarDept, availableOnly, vendorOnly,
    near, cityText, cityFilter, countryFilter, regionFilter, languageFilter, profileTypeFilter, hairFilter, eyeFilter, bodyFilter,
    travelFilter, ageMinFilter, ageMaxFilter, sortKey, geography.key]);
  const map = useDirectoryMap("crew", filterKey, matching, viewMode === "map");
  const filtered = map.rows;
  const mapItems = useMemo(() => matching.map(creator => ({
    id: creator.id, title: creator.name, city: creator.location,
    subtitle: getPositions(creator).map(label => taxonomyLabel(label, uiText)).join(" · "),
    href: creator.id.startsWith("listing_") ? `/creators/${encodeURIComponent(creator.id.slice(8))}` : `/profile/${encodeURIComponent(creator.id)}`,
    image: creator.image, focalPoint: creator.focal_point, lat: creator.lat, lng: creator.lng,
  })), [matching, uiText]);
  const resultKey = JSON.stringify([filterKey, viewMode === "map" ? map.bounds : null]);
  const visibleCount = pagination.filterKey === resultKey ? pagination.visibleCount : PAGE_SIZE;
  const setVisibleCount = (next: number | ((value: number) => number)) =>
    setPagination({ filterKey: resultKey, visibleCount: typeof next === "function" ? next(visibleCount) : next });

  // Active filter chips: group by dept for context


  // ── Mobile promoted role shortcuts ────────────────────────────────────

  const secondaryFilterCount = [
    availableOnly,
    !!near,
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
    ...(near ? [{ id: "near", label: uiText("Genie.searchNear", { city: near.name, radius: near.radius }), onRemove: () => setNear(null) }] : []),
    ...(cityText ? [{ id: "city-text", label: `${uiText("Places.city")}: ${cityText}`, onRemove: () => setCityText("") }] : []),
    ...(sidebarDept ? [{ id: "area", label: sidebarDept === CREW_PROVIDER_FILTER ? uiText("nav.crew") : sidebarDept === "__locations" ? uiText("nav.locations") : sidebarDept === "__marktplatz" ? uiText("nav.marketplace") : getDeptLabel(departments.find((department) => department.id === sidebarDept) ?? departments[0], locale, animals, taxonomyText), onRemove: () => chooseSidebarDept(null) }] : []),
    ...[...selectedRoles].map((role) => ({ id: `role-${role}`, label: taxonomyLabel(occupationById(role)?.label ?? role, uiText), onRemove: () => removeRole(role) })),
    ...(cityFilter ? [{ id: "city", label: cityLabel(cityFilter), onRemove: () => setCityFilter("") }] : []),
    ...(countryFilter ? [{ id: "country", label: countryLabel(countryFilter), onRemove: () => changePlaceFilters({country:"",region:"",city:""}) }] : []),
    ...(regionFilter ? [{ id: "region", label: regionLabel(regionFilter), onRemove: () => changePlaceFilters({country:countryFilter,region:"",city:""}) }] : []),
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
    setNear(null);
    setSelectedRoles(new Set()); setSidebarDept(null); setQuery(""); setCityText(""); setCityFilter(""); setCountryFilter(""); setRegionFilter(""); setLanguageFilter("");
    setAvailableOnly(false); setVendorOnly(false); setProfileTypeFilter(""); setHairFilter(""); setEyeFilter(""); setBodyFilter("");
    setAgeMinFilter(""); setAgeMaxFilter(""); setTravelFilter(""); setSortKey("featured");
  };

  const viewControls = <DirectoryViewControls value={viewMode} onChange={setViewMode} />;

  const SORT_OPTIONS = [
    { value: "featured", label: geography.preferred ? uiText("BrowseGeography.recommended") : t("sortAlphabetical") },
    { value: "rating",   label: t("sortRating") },
    { value: "reviews",  label: t("sortRatingCount") },
  ];

  return (
    <div className="min-h-screen mobile-bottom-nav-clear">
      {near && <p className="site-container text-xs text-text-muted py-2">{uiText("Genie.radiusHint")}</p>}
      <FloatingMapToggle mapActive={viewMode === "map"} onToggle={() => { setViewMode(viewMode === "map" ? "list" : "map"); requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })); }} />

      <MobileBrowseControls preference={<BrowseGeography geography={geography} />}
        query={query}
        onQueryChange={setQuery}
        searchPlaceholder={t("searchPlaceholder")}
        sortValue={sortKey}
        sortOptions={SORT_OPTIONS}
        onSortChange={value => { geography.setEnabled(false); setSortKey(value); }}
        categoryLabel={t("deptFilter")}
        allCategoryLabel={uiText("Ui.text_bc0b501bb3186b")}
        categories={[
          ...(filterProviderProfiles(allCreators, CREW_PROVIDER_FILTER).length ? [{value:CREW_PROVIDER_FILTER,label:uiText("nav.crew")}] : []),
          ...activeDepts.map((department) => ({ value: department.id, label: getDeptLabel(department, locale, animals, taxonomyText) })),
          ...(filterProviderProfiles(allCreators, LOCATION_PROVIDER_FILTER).length ? [{ value: LOCATION_PROVIDER_FILTER, label: uiText("Ui.text_e05308bad64468") }] : []),
          ...(filterProviderProfiles(allCreators, MARKETPLACE_PROVIDER_FILTER).length ? [{ value: MARKETPLACE_PROVIDER_FILTER, label: uiText("Ui.text_47ce00e52d872a") }] : []),
        ]}
        categoryValue={sidebarDept ?? ""}
        onCategoryChange={(value) => { setSelectedRoles(new Set()); chooseSidebarDept(value || null); }}
        resultCount={hasMoreFromApi ? null : isProviderFilter(sidebarDept) ? allCreators.length : filtered.length} resultSummary={hasMoreFromApi ? (loadError ? t("resultsLoadFailed") : t("resultsLoading")) : t("results", { count: isProviderFilter(sidebarDept) ? allCreators.length : filtered.length })}
        resultActions={<ProviderQuickFilters value={sidebarDept}
          crew={filterProviderProfiles(allCreators, CREW_PROVIDER_FILTER).length > 0}
          locations={filterProviderProfiles(allCreators, LOCATION_PROVIDER_FILTER).length > 0}
          marketplace={filterProviderProfiles(allCreators, MARKETPLACE_PROVIDER_FILTER).length > 0}
          onChange={value => { setSelectedRoles(new Set()); chooseSidebarDept(value); }} />}
        viewControls={viewControls}
        filterCount={secondaryFilterCount + (sidebarDept ? 1 : 0)}
        chips={mobileChips}
        onReset={resetMobileFilters}
        resetLabel={t("resetFilters")}
        showResultsLabel={t("showResults", { count: filtered.length })}
      >
        <PlaceFilters rows={allCreators} value={{country:countryFilter,region:regionFilter,city:cityFilter}} onChange={changePlaceFilters} />
        <MobileFilterField label={t("filterProfileType")}>
          <MobileFilterSelect value={profileTypeFilter} onChange={setProfileTypeFilter} placeholder={t("filterAll")} options={availableProfileTypes.map((value) => ({ value, label: PROFILE_TYPE_MAP[value] ?? value }))} />
        </MobileFilterField>
        {(!isProviderFilter(sidebarDept)||sidebarDept===CREW_PROVIDER_FILTER) && <BrowseRoleFilter label={uiText("Ui.text_0038a9cf86613c")} placeholder={t("searchRoles")}
          selected={selectedRoles} onChange={setSelectedRoles} options={availableOccupations.filter(option => !sidebarDept || sidebarDept===CREW_PROVIDER_FILTER || option.departmentId === sidebarDept).map(option => ({ value: option.roleId, label: getDepartmentRoleLabel(option.departmentId, option.label, locale, animals, taxonomyText) }))} />}
        <MobileFilterField label={t("filterLanguage")}>
          <MobileFilterSelect value={languageFilter} onChange={setLanguageFilter} placeholder={t("filterAll")} options={availableLanguages.map((value) => ({ value, label: crewLanguageLabel(value, locale) }))} />
        </MobileFilterField>
        <details className="rounded-xl border border-border bg-bg-primary p-3" open={hairFilter || eyeFilter || bodyFilter || travelFilter || ageMinFilter || ageMaxFilter ? true : undefined}>
          <summary className="flex min-h-11 cursor-pointer items-center text-sm text-text-secondary">{t("moreFilters")}</summary>
          <div className="mt-3 grid gap-4">
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
          </div>
        </details>
        <div className="grid gap-1">
          {(availableOnly || allCreators.some(creator => creator.available)) && <label className="flex min-h-11 items-center gap-3 text-sm text-text-secondary"><input type="checkbox" className="size-4 accent-gold" checked={availableOnly} onChange={(event) => setAvailableOnly(event.target.checked)} />{tc("available")}</label>}
          {(vendorOnly || allCreators.some(creator => creator.isVendor)) && <label className="flex min-h-11 items-center gap-3 text-sm text-text-secondary">{uiText.rich("Ui.text_2be79df6cf7abd", { part1: () => (<input type="checkbox" className="size-4 accent-gold" checked={vendorOnly} onChange={(event) => setVendorOnly(event.target.checked)} />) })}</label>}
        </div>
      </MobileBrowseControls>

      {/* ══════════════════════════════════════════════════════════════════════
          MOBILE LAYOUT  (< lg)
          ══════════════════════════════════════════════════════════════════ */}


      {/* ══════════════════════════════════════════════════════════════════════
          MOBILE FILTER SHEET  — keine verschachtelte Suchleiste
          ══════════════════════════════════════════════════════════════════ */}


      {/* ══════════════════════════════════════════════════════════════════════
          DESKTOP LAYOUT  (≥ lg)
          ══════════════════════════════════════════════════════════════════ */}


      {loadError && <div className="site-container py-3"><p role="alert" className="text-sm text-text-muted">{uiText("Ui.text_ce8a3ad3ae6d5b")}<button className="min-h-11 text-gold underline" onClick={() => setLoadError(false)}>{uiText("notifications.retry")}</button></p></div>}
      {/* ── Results ─────────────────────────────────────────────────────────── */}
      {(() => {
        const filteredCrew = filtered;
        const crewVisible  = filteredCrew.slice(0, visibleCount);

        return (
          <div ref={resultsRef} className="site-container scroll-mt-24 py-3 pb-24 sm:py-6 lg:pb-8">
            <div className="flex gap-8 items-start">

            {/* Left sidebar */}


            {/* Main content */}
            <div className="flex-1 min-w-0">

            {/* Mobile dept pills */}


            {/* Count */}


            {viewMode === "map" && <DirectoryMap kind="crew" items={mapItems} bounds={map.bounds} onBoundsChange={map.setBounds} />}

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
              {(viewMode === "list" || viewMode === "map") && (
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
  initialFilters: CrewInitialFilters;
}) {
  return <CreatorsInner serverCreators={serverCreators} hasMoreProfiles={hasMoreProfiles} initialFilters={initialFilters} />;
}
