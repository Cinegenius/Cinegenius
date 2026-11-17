"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, List, Map as MapIcon, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import BrowseResultCount from "./BrowseResultCount";
import ResultCard from "./SearchResultCard";
import { SEARCH_AREAS, searchGroupKey, type SearchGroup, type SearchPlan } from "@/lib/unified-search";
import { SMART_MAP_COLORS } from "@/lib/smart-search-map";
import { searchQueryTitle } from "@/lib/unified-search-areas";
import { discoveryCount, discoveryFacets, emptyDiscoveryFilters, filterDiscoveryGroups, mergeDiscoveryPage, sortDiscoveryGroups, type DiscoveryFilters } from "@/lib/smart-discovery";

const SmartSearchMap = dynamic(() => import("./SmartSearchMap"), { ssr: false });
const toggle = <T,>(values: T[], value: T) => values.includes(value) ? values.filter(item => item !== value) : [...values, value];
const chip = "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-gold";
const activeChip = "border-gold/40 bg-gold/10 text-text-primary";
const inactiveChip = "border-border bg-bg-secondary text-text-muted";

function ResultGroup({ group, plan, initiallyOpen, pending, failed, more }: {
  group: SearchGroup; plan: SearchPlan; initiallyOpen: boolean; pending: boolean; failed: boolean; more: () => void;
}) {
  const t = useTranslations("UnifiedSearch"), taxonomy = useTranslations("Taxonomy");
  const [open, setOpen] = useState(initiallyOpen);
  const [limit, setLimit] = useState(3);
  const wish = plan.searches[group.wishIndex];
  const title = group.segment && taxonomy.has(`departments.${group.segment}`) ? taxonomy(`departments.${group.segment}`) : group.label;
  return <section className="min-w-0 rounded-xl border border-border bg-bg-secondary/80 p-3" aria-label={title}>
    <h3><button type="button" className="flex min-h-11 w-full items-center gap-2 text-left text-sm font-semibold text-text-primary" aria-expanded={open} onClick={() => setOpen(value => !value)}>
      <span className="min-w-0 flex-1 break-words">{wish.quantity ? `${wish.quantity} × ` : ""}{title}</span>
      <BrowseResultCount count={group.results.length} label={t("discovery.loaded", { count: group.results.length })} />
      <ChevronDown size={18} aria-hidden="true" className={`shrink-0 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`} />
    </button></h3>
    {open && <div className="space-y-2 pt-1">
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-muted">
        {wish.recommended && <span>{t("suggested")}</span>}
        {group.results.length > 0 && (group.nearby ? <span>{t("nearbyResults")}</span> : wish.places.length > 0 && <span>{t("discovery.requestedPlace")}</span>)}
      </div>
      {!group.results.length && <p className="text-sm text-text-muted">{t("discovery.emptyGroup")}</p>}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">{group.results.slice(0, limit).map(result => <ResultCard key={`${result.type}:${result.id}`} result={result} compact showEvidence />)}</div>
      {failed && <p role="alert" className="text-sm text-text-secondary">{t("error")}</p>}
      {(group.results.length > limit || group.nextOffset !== null || failed) && <button type="button" disabled={pending} className="min-h-11 rounded-lg border border-border px-3 text-sm text-gold disabled:opacity-50" onClick={() => {
        if (group.results.length > limit) setLimit(value => value + 6);
        else { setLimit(value => value + 6); more(); }
      }}>{pending ? t("loading") : failed ? t("retry") : t("more")}</button>}
    </div>}
  </section>;
}

/** Account/plan-scoped by the parent key; ephemeral filters never enter history
 * or storage. Combined responses serve both surfaces without duplicate reads. */
export default function SmartSearchExplorer({ plan, initialGroups, initialMapGroups, onUnavailable }: {
  plan: SearchPlan; initialGroups: SearchGroup[]; initialMapGroups?: SearchGroup[]; onUnavailable: () => void;
}) {
  const t = useTranslations("UnifiedSearch"), taxonomy = useTranslations("Taxonomy"), marketplace = useTranslations("MarketplaceCatalog");
  const [groups, setGroups] = useState(initialMapGroups ?? initialGroups);
  const [filters, setFilters] = useState<DiscoveryFilters>(emptyDiscoveryFilters);
  const [mapOpen, setMapOpen] = useState(true);
  const [pending, setPending] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [mapReady, setMapReady] = useState(!!initialMapGroups);
  const requests = useRef(new Map<string, AbortController>());
  const denied = useRef(onUnavailable);
  useEffect(() => { denied.current = onUnavailable; }, [onUnavailable]);
  useEffect(() => { const active = requests.current; return () => { for (const request of active.values()) request.abort(); active.clear(); }; }, []);

  const read = useCallback(async (group?: SearchGroup) => {
    const key = group ? searchGroupKey(group) : "initial";
    if (requests.current.has(key)) return;
    const controller = new AbortController(); requests.current.set(key, controller);
    setPending(values => [...values, key]); setErrors(values => values.filter(value => value !== key));
    try {
      const response = await fetch("/api/search/unified", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin",
        cache: "no-store", referrerPolicy: "no-referrer", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(35_000)]),
        body: JSON.stringify({ plan, view: "map", ...(group ? { cursor: { area: group.area, wishIndex: group.wishIndex, offset: group.nextOffset,
          ...(group.segment ? { segment: group.segment } : {}), ...(group.rankCursor ? { rank: group.rankCursor } : {}), ...(group.nearbyCursor ? { nearby: group.nearbyCursor } : {}) } } : {}) }) });
      if (controller.signal.aborted) return;
      if (response.status === 401 || response.status === 403) { denied.current(); return; }
      if (!response.ok) throw new Error("unavailable");
      const data = await response.json();
      if (controller.signal.aborted) return;
      if (!Array.isArray(data.groups) || (group && !data.groups.some((page: SearchGroup) => searchGroupKey(page) === key))) throw new Error("invalid");
      setGroups(current => group ? mergeDiscoveryPage(current, data.groups.find((page: SearchGroup) => searchGroupKey(page) === key)) : data.groups);
      setMapReady(true);
    } catch { if (!controller.signal.aborted) setErrors(values => [...new Set([...values, key])]); }
    finally {
      requests.current.delete(key);
      if (!controller.signal.aborted) setPending(values => values.filter(value => value !== key));
    }
  }, [plan]);

  useEffect(() => {
    if (initialMapGroups) return;
    const timer = window.setTimeout(() => void read(), 0);
    return () => window.clearTimeout(timer);
  }, [initialMapGroups, read]);

  const areas = SEARCH_AREAS.filter(area => groups.some(group => group.area === area && (group.results.length || group.nextOffset !== null || plan.searches[group.wishIndex].area !== "all")));
  const available = useMemo(() => discoveryFacets(filterDiscoveryGroups(groups, { ...emptyDiscoveryFilters(), hiddenAreas: filters.hiddenAreas, hiddenWishes: filters.hiddenWishes })), [groups, filters.hiddenAreas, filters.hiddenWishes]);
  const visible = useMemo(() => sortDiscoveryGroups(filterDiscoveryGroups(groups, filters), plan), [groups, filters, plan]);
  const count = discoveryCount(visible);
  const filtered = !!(filters.hiddenAreas.length || filters.hiddenWishes.length || filters.departments.length || filters.marketplace.length || filters.bounds);
  const reset = () => setFilters(emptyDiscoveryFilters());
  const labelWish = (index: number) => {
    const wish = plan.searches[index];
    return [wish.quantity ? `${wish.quantity} ×` : "", searchQueryTitle(wish, t) || (taxonomy.has(`departments.${wish.department}`) ? taxonomy(`departments.${wish.department}`) : wish.department), wish.places.map(place => place.city || place.country || place.continent).filter(Boolean).join(" / ")].filter(Boolean).join(" · ");
  };
  const facetName = (kind: "departments" | "marketplace", id: string) => kind === "departments"
    ? taxonomy.has(`departments.${id}`) ? taxonomy(`departments.${id}`) : id
    : marketplace.has(`categories.${id}`) ? marketplace(`categories.${id}`) : id;

  return <div className="space-y-5" data-smart-explorer>
    <section className="space-y-3 rounded-2xl border border-border bg-bg-secondary/80 p-3 sm:p-4" aria-label={t("discovery.filterTitle")}>
      <div className="flex flex-wrap items-center gap-2">
        <SlidersHorizontal size={18} aria-hidden="true" className="text-gold" /><h2 className="flex-1 text-base font-semibold text-text-primary">{t("discovery.filterTitle")}</h2>
        <button type="button" onClick={reset} disabled={!filtered} aria-label={t("discovery.reset")} className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 px-2 text-sm text-text-secondary disabled:opacity-40"><RotateCcw size={15} aria-hidden="true" /><span className="hidden sm:inline">{t("discovery.reset")}</span></button>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label={t("mapLegend")}>
        {areas.map(area => <button type="button" key={area} aria-pressed={!filters.hiddenAreas.includes(area)} className={`${chip} ${filters.hiddenAreas.includes(area) ? inactiveChip : activeChip}`}
          onClick={() => setFilters(value => ({ ...value, hiddenAreas: toggle(value.hiddenAreas, area) }))}>
          <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: SMART_MAP_COLORS[area] }} aria-hidden="true" />{t(`areas.${area}`)}</button>)}
      </div>
      {plan.searches.length > 1 && <details><summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-text-secondary"><ChevronDown size={16} aria-hidden="true" />{t("discovery.wishes")}</summary>
        <div className="flex flex-wrap gap-2 pb-2" role="group" aria-label={t("discovery.wishes")}>{plan.searches.map((_, index) => <button key={index} type="button" aria-pressed={!filters.hiddenWishes.includes(index)}
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
    </section>
    <div className="flex min-h-11 items-center justify-between gap-3">
      <BrowseResultCount count={count} label={t("discovery.loaded", { count })} />
      <button type="button" aria-expanded={mapOpen} className={`${chip} ${inactiveChip}`} onClick={() => setMapOpen(value => !value)}>{mapOpen ? <List size={18} aria-hidden="true" /> : <MapIcon size={18} aria-hidden="true" />}{t(mapOpen ? "discovery.hideMap" : "discovery.showMap")}</button>
    </div>
    {/* Keep the map mounted when collapsed so its viewport survives view changes. */}
    <div hidden={!mapOpen}>{mapReady && <SmartSearchMap groups={visible} bounds={filters.bounds} onApplyBounds={bounds => setFilters(value => ({ ...value, bounds }))} />}</div>
    {errors.includes("initial") && <div role="alert" className="text-sm text-text-secondary"><p>{t("error")}</p><button type="button" className="min-h-11 min-w-11 text-gold" onClick={() => void read()} disabled={pending.includes("initial")}>{t("retry")}</button></div>}
    {pending.includes("initial") && <p role="status" className="text-sm text-text-muted">{t("loading")}</p>}
    {groups.some(group => group.nextOffset !== null) && <p className="text-xs text-text-muted">{t("discovery.partial")}</p>}
    {!count && <div role="status" className="rounded-xl border border-border bg-bg-secondary p-4 text-sm text-text-secondary"><p>{t(filtered ? "discovery.emptyFilters" : "emptyGroup")}</p>{filtered && <button type="button" className="min-h-11 min-w-11 text-gold" onClick={reset}>{t("discovery.reset")}</button>}</div>}
    <div className="space-y-5">{SEARCH_AREAS.map(area => {
      const areaGroups = visible.filter(group => group.area === area && (group.results.length || group.nextOffset !== null || plan.searches[group.wishIndex].area !== "all"));
      if (!areaGroups.length) return null;
      const initialOpen = areaGroups.filter(group => group.results.length).slice(0, 3).map(searchGroupKey);
      return <section key={area} aria-label={t(`areas.${area}`)} className="space-y-2"><h2 className="flex items-center gap-2 font-serif text-xl text-text-primary"><span className="size-2.5 rounded-full" style={{ backgroundColor: SMART_MAP_COLORS[area] }} aria-hidden="true" />{t(`areas.${area}`)}</h2>
        {areaGroups.map(group => <ResultGroup key={searchGroupKey(group)} group={group} plan={plan} initiallyOpen={initialOpen.includes(searchGroupKey(group))} pending={pending.includes(searchGroupKey(group))} failed={errors.includes(searchGroupKey(group))} more={() => void read(groups.find(item => searchGroupKey(item) === searchGroupKey(group))!)} />)}
      </section>;
    })}</div>
  </div>;
}
