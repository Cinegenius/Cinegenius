"use client";

import dynamic from "next/dynamic";
import { ContentTranslationNotice } from "@/components/ContentTranslation";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type Dispatch, type SetStateAction } from "react";
import { useTranslations } from "next-intl";
import { Briefcase, Building2, ChevronDown, Film, MapPin, Newspaper, PawPrint, RotateCcw, ShoppingBag, SlidersHorizontal, Users, X } from "lucide-react";
import BrowseResultCount from "./BrowseResultCount";
import BrowseSelect from "./BrowseSelect";
import DirectoryViewControls, { type DirectoryView } from "./DirectoryViewControls";
import { useNativeAppAppearance } from "@/lib/use-native-app-appearance";
import { nativeSmartResultAreas, nativeSmartView } from "@/lib/native-smart-controls";
import NativeSmartFilters from "./app/NativeSmartFilters";
import { browseFilterControls, hasBrowseFilterControls } from "@/lib/browse-filter-controls";
import nativeStyles from "./app/NativeSmartAreas.module.css";
import ResultCard from "./SearchResultCard";
import { searchGroupKey, type SearchGroup, type SearchPlan } from "@/lib/unified-search";
import { SMART_MAP_COLORS } from "@/lib/smart-search-map";
import { NATIVE_SMART_MAP_COLORS, nativeSmartColorStyle } from "@/lib/native-smart-colors";
import resultStyles from "./SmartSearchResults.module.css";
import SmartSearchMapInfo from "./SmartSearchMapInfo";
import { preserveDiscoveryMapOrder } from "@/lib/discovery-map-order";
import { nativeSmartViewportGroups } from "@/lib/native-smart-viewport";
import { searchQueryTitle } from "@/lib/unified-search-areas";
import { discoveryAreas, discoveryResults, discoveryCount, discoveryFacets, emptyDiscoveryFilters, filterDiscoveryGroups, mergeDiscoveryPage, sortDiscoveryGroups, type DiscoveryFilters } from "@/lib/smart-discovery";

function LoadingMap() {
  const t = useTranslations("directoryMap");
  return <div role="status" className="smart-map-frame flex items-center justify-center text-sm text-text-muted">{t("loading")}</div>;
}
const SmartSearchMap = dynamic(() => import("./SmartSearchMap"), { ssr: false, loading: LoadingMap });
const toggle = <T,>(values: T[], value: T) => values.includes(value) ? values.filter(item => item !== value) : [...values, value];
const chip = "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-gold";
const activeChip = "border-gold/40 bg-gold/10 text-text-primary";
const inactiveChip = "border-border bg-bg-secondary text-text-muted";
export type SmartSearchControls = { scope: string; filters: DiscoveryFilters; mapOpen: boolean; view?: DirectoryView; limits: Record<string, number> };

const areaIcons = { crew:Users, marketplace:ShoppingBag, locations:MapPin, companies:Building2, jobs:Briefcase, projects:Film, animals:PawPrint, news:Newspaper, organizations:Building2 };

function ResultArea({ area, groups, pending, errors, more, grid = false, limit: controlledLimit, setLimit: changeLimit, colors, native = false, autoLoad = false }: {
  area: SearchGroup["area"]; groups: SearchGroup[]; pending: string[]; errors: string[]; more: (group: SearchGroup) => void;
  grid?: boolean; limit?: number; setLimit?: (limit: number) => void;
  colors: typeof SMART_MAP_COLORS;
  native?: boolean; autoLoad?: boolean;
}) {
  const t = useTranslations("UnifiedSearch");
  const [localLimit, setLocalLimit] = useState(3);
  const limit = controlledLimit ?? localLimit;
  const setLimit = changeLimit ?? setLocalLimit;
  const results = discoveryResults(groups);
  const next = groups.find(group => errors.includes(searchGroupKey(group))) ?? groups.find(group => group.nextOffset !== null);
  const busy = pending.includes("initial") || groups.some(group => pending.includes(searchGroupKey(group)));
  const failed = groups.some(group => errors.includes(searchGroupKey(group)));
  const AreaIcon = areaIcons[area];
  const sentinel = useRef<HTMLButtonElement>(null);
  const automaticPage = useRef<string | null>(null);
  const canLoad = results.length > limit || !!next;
  const automatic = autoLoad && typeof IntersectionObserver !== "undefined";
  const pageToken = JSON.stringify([limit, results.length, next?.nextOffset, next?.discoveryCursor, next?.rankCursor, next?.nearby, next?.nearbyCursor]);
  const loadMore = useCallback(() => {
    if (busy) return;
    if (results.length > limit && !failed) setLimit(limit + 6);
    else if (next) { setLimit(limit + 6); more(next); }
  }, [busy, results.length, limit, failed, setLimit, next, more]);
  useEffect(() => {
    const target = sentinel.current;
    if (!automatic || !target || !canLoad || busy || failed || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(entries => {
      if (document.visibilityState !== "visible" || !entries.some(entry => entry.isIntersecting) || automaticPage.current === pageToken) return;
      automaticPage.current = pageToken;
      observer.disconnect();
      loadMore();
    }, { rootMargin: "0px 0px 240px 0px", threshold: 0 });
    observer.observe(target);
    return () => observer.disconnect();
  }, [automatic, canLoad, busy, failed, pageToken, loadMore]);
  if (!results.length) return null;
  return <section className={`smart-result-area${native ? ` ${resultStyles.block}` : ""}`} aria-label={t(`areas.${area}`)}
    data-native-smart-result-area={native ? area : undefined} style={native ? nativeSmartColorStyle(area) as CSSProperties : undefined}>
    <h2 className={`smart-area-heading${native ? ` ${resultStyles.heading}` : ""}`}>
      {native ? <AreaIcon size={16} aria-hidden="true" /> : <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: colors[area] }} aria-hidden="true" />}
      <span className="min-w-0 flex-1">{t(`areas.${area}`)}</span><BrowseResultCount count={results.length} label={t("discovery.loaded", { count: results.length })} />
    </h2>
    {grid ? <div className={nativeStyles.grid}>{results.slice(0, limit).map(result => <ResultCard key={`${result.type}:${result.id}`} result={result} />)}</div>
      : results.slice(0, limit).map(result => <ResultCard key={`${result.type}:${result.id}`} result={result} compact row />)}
    {failed && <p role="alert" className="py-2 text-sm text-text-secondary">{t("error")}</p>}
    {canLoad && <button ref={sentinel} type="button" disabled={busy} data-native-auto-load={automatic || undefined}
      className={`${automatic && !busy && !failed ? resultStyles.autoMore : ""} min-h-11 min-w-11 text-sm text-gold disabled:opacity-50`}
      onClick={loadMore}>{busy ? t("loading") : failed ? t("retry") : t("more")}</button>}
  </section>;
}

/** Account/plan-scoped by the parent key; ephemeral filters never enter history
 * or storage. Combined responses serve both surfaces without duplicate reads. */
export default function SmartSearchExplorer({ plan, initialGroups, initialMapGroups, onUnavailable, stored, setStored, discoverySeed,initialBrowseKey }: {
  plan: SearchPlan; initialGroups: SearchGroup[]; initialMapGroups?: SearchGroup[]; onUnavailable: () => void;
  discoverySeed?: string; initialBrowseKey?: string;
  stored?: SmartSearchControls; setStored?: Dispatch<SetStateAction<SmartSearchControls>>;
}) {
  const t = useTranslations("UnifiedSearch"), taxonomy = useTranslations("Taxonomy"), marketplace = useTranslations("MarketplaceCatalog");
  const nativeAppearance = useNativeAppAppearance();
  const colors = nativeAppearance ? NATIVE_SMART_MAP_COLORS : SMART_MAP_COLORS;
  const [groups, setGroups] = useState(initialMapGroups ?? initialGroups);
  const [webFilters, setWebFilters] = useState<DiscoveryFilters>(emptyDiscoveryFilters);
  const [webMapOpen, setWebMapOpen] = useState(true);
  const scope = JSON.stringify(plan);
  const [localControls, setLocalControls] = useState<SmartSearchControls>(() => ({ scope, filters: emptyDiscoveryFilters(), mapOpen: true, limits: {} }));
  const saved = stored ?? localControls;
  const controls = saved.scope === scope ? saved : { ...saved, scope, filters: emptyDiscoveryFilters(), limits: {} };
  const writeControls = setStored ?? setLocalControls;
  const filters = nativeAppearance ? controls.filters : webFilters;
  const mapOpen = nativeAppearance ? controls.mapOpen : webMapOpen;
  const browseRaw = nativeAppearance ? controls.filters.browse : undefined;
  const browseFilters = useMemo(() => browseFilterControls(nativeAppearance ? {
    ...(browseRaw ?? {version:1 as const}),
    departments:browseRaw?.departments ?? controls.filters.departments,
    marketplace:browseRaw?.marketplace ?? controls.filters.marketplace,
  } : undefined), [browseRaw, nativeAppearance, controls.filters.departments, controls.filters.marketplace]);
  const browseKey = JSON.stringify(browseFilters);
  const [loadedBrowseKey,setLoadedBrowseKey] = useState(initialBrowseKey ?? JSON.stringify({version:1}));
  const requestedBrowseKey = useRef(initialBrowseKey ?? JSON.stringify({version:1}));
  const filteredGroups = useMemo(() => nativeAppearance && loadedBrowseKey !== browseKey ? [] : groups, [nativeAppearance, loadedBrowseKey, browseKey, groups]);
  const view = nativeSmartView(mapOpen, controls.view);
  const setFilters = (action: SetStateAction<DiscoveryFilters>) => {
    if (!nativeAppearance) { setWebFilters(action); return; }
    writeControls(old => {
      const current = old.scope === scope ? old : { ...old, scope, filters: emptyDiscoveryFilters(), limits: {} };
      return { ...current, filters: typeof action === "function" ? action(current.filters) : action };
    });
  };
  const setView = (value: DirectoryView) => {
    if (!nativeAppearance) { setWebMapOpen(value === "map"); return; }
    writeControls(old => ({ ...(old.scope === scope ? old : controls), mapOpen: value === "map", view: value }));
  };
  const setLimit = (area: string, limit: number) => writeControls(old => {
    const current = old.scope === scope ? old : controls;
    return { ...current, limits: { ...current.limits, [area]: limit } };
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterId = useId();
  const filterTrigger = useRef<HTMLButtonElement>(null);
  const closeFilters = () => { setFiltersOpen(false); filterTrigger.current?.focus({ preventScroll: true }); };
  useEffect(() => {
    if (!filtersOpen) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) {
        setFiltersOpen(false);
        filterTrigger.current?.focus({ preventScroll: true });
      }
    };
    document.addEventListener("keydown", dismiss);
    return () => document.removeEventListener("keydown", dismiss);
  }, [filtersOpen]);
  const ui = useTranslations();
  const [pending, setPending] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [mapReady, setMapReady] = useState(!!initialMapGroups);
  const mapReceived = useRef<number | null>(null);
  const requests = useRef(new Map<string, AbortController>());
  const poolGeneration = useRef(0);
  const visitedPages = useRef(new Map<string, Set<string>>());
  const denied = useRef(onUnavailable);
  useEffect(() => { denied.current = onUnavailable; }, [onUnavailable]);
  useEffect(() => { const active = requests.current; return () => { for (const request of active.values()) request.abort(); active.clear(); }; }, []);
  useLayoutEffect(() => {
    if (!nativeAppearance || !mapReady || mapReceived.current === null) return;
    performance.clearMeasures("cinegenius:smart:map-render");
    performance.measure("cinegenius:smart:map-render", { start: mapReceived.current, end: performance.now() });
    mapReceived.current = null;
  }, [mapReady, groups, nativeAppearance]);

  const read = useCallback(async (group?: SearchGroup) => {
    const key = group ? searchGroupKey(group) : "initial";
    if (requests.current.has(key) || group && requests.current.has("initial")) return;
    if (!group) {
      // The complete map pool replaces the list snapshot. Retire every page
      // from that snapshot, including transports that resolve after abort.
      poolGeneration.current += 1;
      visitedPages.current.clear();
      for (const active of requests.current.values()) active.abort();
      requests.current.clear();
    }
    const generation = poolGeneration.current;
    const controller = new AbortController(); requests.current.set(key, controller);
    const current = () => !controller.signal.aborted && generation === poolGeneration.current;
    const started = performance.now(), requestView = group && !mapOpen && !mapReady ? "list" : "map";
    setPending(values => group ? [...values, key] : [key]); setErrors(values => values.filter(value => value !== key));
    try {
      const response = await fetch("/api/search/unified", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin",
        cache: "no-store", referrerPolicy: "no-referrer", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(35_000)]),
        body: JSON.stringify({ plan, view: requestView, ...(nativeAppearance ? {browseFilters} : {}), ...(discoverySeed ? { discoverySeed } : {}), ...(group ? { cursor: { area: group.area, wishIndex: group.wishIndex, offset: group.nextOffset,
          ...(group.browseKey ? {browseKey:group.browseKey} : {}), ...(group.discoveryCursor ? { discovery: group.discoveryCursor } : {}), ...(group.segment ? { segment: group.segment } : {}), ...(group.rankCursor ? { rank: group.rankCursor } : {}), ...(group.nearbyCursor ? { nearby: group.nearbyCursor } : {}) } } : {}) }) });
      if (!current()) return;
      if (response.status === 401 || response.status === 403) { denied.current(); return; }
      if (!response.ok) throw new Error("unavailable");
      const data = await response.json();
      if (!current()) return;
      if (!Array.isArray(data.groups) || (group && !data.groups.some((page: SearchGroup) => searchGroupKey(page) === key))) throw new Error("invalid");
      if (nativeAppearance && group) {
        const page = data.groups.find((value: SearchGroup) => searchGroupKey(value) === key) as SearchGroup;
        const token = (value: SearchGroup) => JSON.stringify([value.nextOffset, value.discoveryCursor ?? null, value.rankCursor ?? null, !!value.nearby, value.nearbyCursor ?? null]);
        const seen = visitedPages.current.get(key) ?? new Set<string>();
        if (page.nextOffset !== null && (token(page) === token(group) || seen.has(token(page)))) throw new Error("stalled_page");
        seen.add(token(group)); visitedPages.current.set(key, seen);
      }
      if (nativeAppearance) {
        const name = `cinegenius:smart:${group ? "page-api" : "map-api"}`;
        performance.clearMeasures(name); performance.measure(name, { start: started, end: performance.now() });
      }
      setGroups(groups => !current() ? groups : group ? mergeDiscoveryPage(groups, data.groups.find((page: SearchGroup) => searchGroupKey(page) === key))
        : nativeAppearance && discoverySeed && requestView === "map" ? preserveDiscoveryMapOrder(groups, data.groups) : data.groups);
      if (!group) { mapReceived.current = performance.now(); setMapReady(true); setLoadedBrowseKey(browseKey); }
    } catch { if (current()) setErrors(values => [...new Set([...values, key])]); }
    finally {
      if (requests.current.get(key) === controller) {
        requests.current.delete(key);
        setPending(values => values.filter(value => value !== key));
      }
    }
  }, [plan, mapOpen, mapReady, nativeAppearance, discoverySeed, browseKey, browseFilters]);

  useEffect(() => {
    if (!nativeAppearance || requestedBrowseKey.current === browseKey) return;
    requestedBrowseKey.current = browseKey;
    // New filter scope invalidates every prior page and transport before reading.
    poolGeneration.current += 1;
    visitedPages.current.clear();
    for (const request of requests.current.values()) request.abort();
    requests.current.clear();
    void read();
  }, [browseKey, nativeAppearance, read]);

  useEffect(() => {
    if (initialMapGroups || !mapOpen || mapReady) return;
    const timer = window.setTimeout(() => void read(), 0);
    return () => window.clearTimeout(timer);
  }, [initialMapGroups, mapOpen, mapReady, read]);

  const areas = discoveryAreas(groups);
  const selectedAreas = areas.filter(area => !filters.hiddenAreas.includes(area));
  const areaValue = selectedAreas.length === areas.length ? "all" : selectedAreas.length === 1 ? selectedAreas[0] : "selection";
  const wishes = plan.searches.flatMap((_, index) => groups.some(group => group.wishIndex === index && group.results.length) ? [index] : []);
  const available = useMemo(() => discoveryFacets(filterDiscoveryGroups(groups, { ...emptyDiscoveryFilters(), hiddenAreas: filters.hiddenAreas, hiddenWishes: filters.hiddenWishes })), [groups, filters.hiddenAreas, filters.hiddenWishes]);
  // Never feed a clipped viewport back into its own map. The pool stays stable
  // through pan/zoom, so widening the viewport can restore previously hidden rows.
  const mapPool = useMemo(() => sortDiscoveryGroups(filterDiscoveryGroups(filteredGroups, { hiddenAreas: filters.hiddenAreas, hiddenWishes: filters.hiddenWishes,
    departments: filters.departments, marketplace: filters.marketplace, bounds: null }), plan),
    [filteredGroups, filters.hiddenAreas, filters.hiddenWishes, filters.departments, filters.marketplace, plan]);
  const viewport = useMemo(() => nativeAppearance && mapOpen ? nativeSmartViewportGroups(mapPool, filters.bounds) : null,
    [nativeAppearance, mapOpen, mapPool, filters.bounds]);
  const visible = useMemo(() => viewport?.visible ?? sortDiscoveryGroups(filterDiscoveryGroups(filteredGroups, filters), plan), [viewport, filteredGroups, filters, plan]);
  const unmappedCount = viewport ? discoveryCount(viewport.unmapped) : 0;
  const count = discoveryCount(visible);
  const hasMapPositions = groups.some(group => group.results.some(result => result.mapPoint));
  const filtered = !!(filters.hiddenAreas.length || filters.hiddenWishes.length || filters.departments.length || filters.marketplace.length || filters.bounds || hasBrowseFilterControls(browseFilters));
  const reset = () => setFilters(emptyDiscoveryFilters());
  const labelWish = (index: number) => {
    const wish = plan.searches[index];
    return [wish.quantity ? `${wish.quantity} ×` : "", searchQueryTitle(wish, t) || (taxonomy.has(`departments.${wish.department}`) ? taxonomy(`departments.${wish.department}`) : wish.department), wish.places.map(place => place.city || place.country || place.continent).filter(Boolean).join(" / ")].filter(Boolean).join(" · ");
  };
  const facetName = (kind: "departments" | "marketplace", id: string) => kind === "departments"
    ? taxonomy.has(`departments.${id}`) ? taxonomy(`departments.${id}`) : id
    : marketplace.has(`categories.${id}`) ? marketplace(`categories.${id}`) : id;
  const moreAction = <button ref={filterTrigger} type="button" className="smart-filter-trigger" aria-label={t("discovery.filterTitle")} aria-expanded={filtersOpen} aria-controls={filterId} onClick={() => setFiltersOpen(value => !value)}>
    <SlidersHorizontal size={18} aria-hidden="true" />{filtered && <span className="smart-filter-dot" aria-hidden="true" />}
  </button>;

  return <div className={`smart-explorer${nativeAppearance ? ` ${resultStyles.explorer}` : ""}`} data-smart-explorer data-map-open={mapOpen}>
    {nativeAppearance ? <NativeSmartFilters groups={groups} count={count} busy={loadedBrowseKey !== browseKey || pending.includes("initial")} failed={errors.includes("initial")} filters={{...filters,browse:browseFilters}}
      onChange={value => setFilters({...value,departments:[],marketplace:[]})} views={<DirectoryViewControls value={view} onChange={setView} views={["grid", "list", "map"]} />} /> : <div className="smart-result-toolbar">
      <BrowseResultCount count={count} label={t("discovery.loaded", { count })} />
      <BrowseSelect label={t("allAreas")} value={areaValue} className="smart-area-select" triggerClassName="smart-area-trigger"
        options={[{ value: "all", label: t("allAreas") }, ...areas.map(area => ({ value: area, label: t(`areas.${area}`) })), ...(areaValue === "selection" ? [{ value: "selection", label: t("discovery.activeFilters"), disabled: true }] : [])]}
        onChange={area => setFilters(value => ({ ...value, hiddenAreas: area === "all" ? [] : areas.filter(item => item !== area) }))} />
      {moreAction}
      <DirectoryViewControls value={mapOpen ? "map" : "list"} onChange={setView} views={["list", "map"]} />
    </div>}
    {!nativeAppearance && <section id={filterId} hidden={!filtersOpen} onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); closeFilters(); } }} className="smart-filter-panel space-y-3 rounded-xl border border-border bg-bg-secondary p-3 sm:p-4" aria-label={t("discovery.filterTitle")}>

      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex-1 text-base font-semibold text-text-primary">{t("discovery.filterTitle")}</h2>
        <button type="button" onClick={reset} disabled={!filtered} aria-label={t("discovery.reset")} className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 px-2 text-sm text-text-secondary disabled:opacity-40"><RotateCcw size={15} aria-hidden="true" /><span className="hidden sm:inline">{t("discovery.reset")}</span></button>
        <button type="button" className="min-h-11 min-w-11 text-text-muted" aria-label={ui("ProfilePhotoCrop.close")} onClick={closeFilters}><X size={18} className="mx-auto" aria-hidden="true" /></button>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label={t("mapLegend")}>
        {areas.map(area => <button type="button" key={area} aria-pressed={!filters.hiddenAreas.includes(area)} className={`${chip} ${filters.hiddenAreas.includes(area) ? inactiveChip : activeChip}`}
          onClick={() => setFilters(value => ({ ...value, hiddenAreas: toggle(value.hiddenAreas, area) }))}>
          <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: colors[area] }} aria-hidden="true" />{t(`areas.${area}`)}</button>)}
      </div>
      {wishes.length > 1 && <details><summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-text-secondary"><ChevronDown size={16} aria-hidden="true" />{t("discovery.wishes")}</summary>
        <div className="flex flex-wrap gap-2 pb-2" role="group" aria-label={t("discovery.wishes")}>{wishes.map(index => <button key={index} type="button" aria-pressed={!filters.hiddenWishes.includes(index)}
          className={`${chip} max-w-full text-left ${filters.hiddenWishes.includes(index) ? inactiveChip : activeChip}`} onClick={() => setFilters(value => ({ ...value, hiddenWishes: toggle(value.hiddenWishes, index) }))}><span className="break-words">{labelWish(index)}</span></button>)}</div>
      </details>}
      {(available.departments.length > 1 || available.marketplace.length > 1 || filters.departments.length > 0 || filters.marketplace.length > 0) && <details><summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-text-secondary"><ChevronDown size={16} aria-hidden="true" />{t("discovery.refine")}</summary>
        <div className="space-y-3 pb-2">{(["departments", "marketplace"] as const).map(kind => available[kind].length > 0 && <fieldset key={kind}><legend className="mb-2 text-xs text-text-muted">{kind === "departments" ? t("areas.crew") : t("areas.marketplace")}</legend>
          <div className="flex flex-wrap gap-2"><button type="button" className={`${chip} ${!filters[kind].length ? activeChip : inactiveChip}`} aria-pressed={!filters[kind].length} onClick={() => setFilters(value => ({ ...value, [kind]: [] }))}>{t("discovery.all")}</button>
            {available[kind].map(id => <button key={id} type="button" className={`${chip} ${filters[kind].includes(id) ? activeChip : inactiveChip}`} aria-pressed={filters[kind].includes(id)} onClick={() => setFilters(value => ({ ...value, [kind]: toggle(value[kind], id) }))}>{facetName(kind, id)}</button>)}
          </div></fieldset>)}</div>
      </details>}
      {filtered && <div className="flex flex-wrap gap-2" aria-label={t("discovery.activeFilters")}>
        {filters.hiddenAreas.map(area => <button type="button" key={area} className={`${chip} ${inactiveChip}`} onClick={() => setFilters(value => ({ ...value, hiddenAreas: toggle(value.hiddenAreas, area) }))}>{t("discovery.hidden", { name: t(`areas.${area}`) })}<X size={14} aria-hidden="true" /></button>)}
        {filters.hiddenWishes.map(index => <button type="button" key={index} className={`${chip} ${inactiveChip} max-w-full text-left`} onClick={() => setFilters(value => ({ ...value, hiddenWishes: toggle(value.hiddenWishes, index) }))}><span className="break-words">{t("discovery.hidden", { name: labelWish(index) })}</span><X size={14} className="shrink-0" aria-hidden="true" /></button>)}
        {(["departments", "marketplace"] as const).flatMap(kind => filters[kind].map(id => <button type="button" key={`${kind}:${id}`} className={`${chip} ${activeChip}`} aria-label={t("discovery.removeFilter", { name: facetName(kind, id) })} onClick={() => setFilters(value => ({ ...value, [kind]: toggle(value[kind], id) }))}>{facetName(kind, id)}<X size={14} aria-hidden="true" /></button>))}
        {filters.bounds && <button type="button" className={`${chip} ${activeChip}`} onClick={() => setFilters(value => ({ ...value, bounds: null }))}>{t("discovery.mapArea")}<X size={14} aria-hidden="true" /></button>}
      </div>}
    </section>}
    {/* One map instance; switching views keeps zoom and current result filters. */}
    <div className="smart-map-panel" hidden={!mapOpen}>{mapReady && hasMapPositions && <SmartSearchMap groups={nativeAppearance ? mapPool : visible} active={mapOpen} bounds={filters.bounds} onApplyBounds={bounds => setFilters(value => ({ ...value, bounds }))} />}
      {mapReady && !hasMapPositions && count > 0 && <p className="text-xs text-text-muted">{t("discovery.unmapped", { count })}</p>}
    </div>
    <div className="smart-result-list">
    {nativeAppearance ? <div className={resultStyles.utilityRow} data-native-smart-utility="v1">
      <ContentTranslationNotice />
      {mapOpen && mapReady && hasMapPositions && <SmartSearchMapInfo native />}
    </div> : <ContentTranslationNotice />}
    {errors.includes("initial") && <div role="alert" className="text-sm text-text-secondary"><p>{t("error")}</p><button type="button" className="min-h-11 min-w-11 text-gold" onClick={() => void read()} disabled={pending.includes("initial")}>{t("retry")}</button></div>}
    {pending.includes("initial") && <p role="status" className="text-sm text-text-muted">{t("loading")}</p>}
    {!count && loadedBrowseKey === browseKey && !pending.includes("initial") && <div role="status" className="rounded-xl border border-border bg-bg-secondary p-4 text-sm text-text-secondary"><p>{t(filtered ? "discovery.emptyFilters" : "emptyGroup")}</p>{filtered && <button type="button" className="min-h-11 min-w-11 text-gold" onClick={reset}>{t("discovery.reset")}</button>}</div>}
    {(nativeAppearance ? nativeSmartResultAreas(discoveryAreas(visible)) : discoveryAreas(visible)).map(area => <ResultArea key={area} area={area} colors={colors} native={nativeAppearance} autoLoad={nativeAppearance && discoveryAreas(mapPool).length === 1} groups={visible.filter(group => group.area === area)} pending={pending} errors={errors}
      {...(nativeAppearance ? { grid: view === "grid", limit: controls.limits[area] ?? (view === "grid" ? 6 : 3), setLimit: (limit: number) => setLimit(area, limit) } : {})}
      more={group => void read(groups.find(item => searchGroupKey(item) === searchGroupKey(group))!)} />)}
    {viewport && unmappedCount > 0 && <details className="smart-unmapped-results">
      <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-text-muted"><ChevronDown size={16} aria-hidden="true" />{t("discovery.unmapped", { count: unmappedCount })}</summary>
      {nativeSmartResultAreas(discoveryAreas(viewport.unmapped)).map(area => <ResultArea key={`unmapped:${area}`} area={area} colors={colors} native groups={viewport.unmapped.filter(group => group.area === area)} pending={pending} errors={errors}
        limit={controls.limits[`unmapped:${area}`] ?? 3} setLimit={(limit: number) => setLimit(`unmapped:${area}`, limit)}
        more={group => void read(groups.find(item => searchGroupKey(item) === searchGroupKey(group))!)} />)}
    </details>}
    {!nativeAppearance && groups.some(group => group.nextOffset !== null) && <p className="text-xs text-text-muted">{t("discovery.partial")}</p>}
    {/* A cursor with no currently matching rows remains reachable without an empty area card. */}
    {visible.some(group => group.nextOffset !== null && !visible.some(item => item.area === group.area && item.results.length)) && <button type="button" disabled={pending.length > 0} className="min-h-11 text-sm text-gold" onClick={() => {
      const next = visible.find(group => group.nextOffset !== null && !visible.some(item => item.area === group.area && item.results.length));
      if (next) void read(groups.find(item => searchGroupKey(item) === searchGroupKey(next))!);
    }}>{pending.length ? t("loading") : t("more")}</button>}
    {errors.some(key => key !== "initial" && !visible.some(group => searchGroupKey(group) === key && group.results.length)) && <p role="alert" className="text-sm text-text-secondary">{t("error")}</p>}
    </div>
  </div>;
}
