"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2, Map as MapIcon } from "lucide-react";
import { hasCoordinates, inMapBounds, type MapBounds } from "@/lib/location-map";
import { SMART_MAP_COLORS, smartMapEntries } from "@/lib/smart-search-map";
import { SEARCH_AREAS, searchGroupKey, type SearchGroup, type SearchPlan } from "@/lib/unified-search";
import ResultCard from "./SearchResultCard";

const LocationMap = dynamic(() => import("./LocationMap"), { ssr: false });
const groupKey = searchGroupKey;

export default function SmartSearchMap({ plan, onUnauthorized, initialGroups }: { plan: SearchPlan; onUnauthorized: () => void; initialGroups?: SearchGroup[] }) {
  const t = useTranslations("UnifiedSearch"), mapText = useTranslations("directoryMap"), locationText = useTranslations("locationMap");
  const locale = useLocale();
  const [groups, setGroups] = useState<SearchGroup[]>(initialGroups ?? []);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const request = useRef<AbortController | null>(null);
  const unauthorized = useRef(onUnauthorized);
  useEffect(() => { unauthorized.current = onUnauthorized; }, [onUnauthorized]);
  const encoded = JSON.stringify(plan);

  const read = useCallback(async (controller: AbortController, cursor?: { area: SearchGroup["area"]; wishIndex: number; offset: number; segment?: string; rank?: SearchGroup["rankCursor"]; nearby?: SearchGroup["nearbyCursor"] }) => {
    const response = await fetch("/api/search/unified", {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin",
      cache: "no-store", referrerPolicy: "no-referrer", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(35_000)]),
      body: JSON.stringify({ plan: JSON.parse(encoded), view: "map", ...(cursor ? { cursor } : {}) }),
    });
    if (controller.signal.aborted) return [];
    if (response.status === 401) { controller.abort(); unauthorized.current(); return []; }
    if (!response.ok) throw new Error("unavailable");
    const data = await response.json();
    if (!Array.isArray(data.groups)) throw new Error("invalid");
    return data.groups as SearchGroup[];
  }, [encoded]);

  useEffect(() => {
    if (initialGroups && retry === 0) return;
    const controller = new AbortController(); request.current = controller;
    const timer = window.setTimeout(async () => {
      setPending(true); setFailed(false); setGroups([]); setBounds(null);
      try { const next = await read(controller); if (!controller.signal.aborted) setGroups(next); }
      catch { if (!controller.signal.aborted) setFailed(true); }
      finally { if (!controller.signal.aborted) { setPending(false); request.current = null; } }
    }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); request.current?.abort(); request.current = null; };
  }, [read, retry, locale, initialGroups]);

  async function more() {
    if (request.current) return;
    const remaining = groups.filter(group => group.nextOffset !== null);
    if (!remaining.length) return;
    const controller = new AbortController(); request.current = controller;
    setPending(true); setFailed(false);
    let next = 0;
    try {
      // Bounded batches keep broad searches responsive and retries explicit.
      await Promise.all(Array.from({ length: Math.min(2, remaining.length) }, async () => {
        while (next < remaining.length && !controller.signal.aborted) {
          const group = remaining[next++];
          const [page] = await read(controller, { area: group.area, wishIndex: group.wishIndex, offset: group.nextOffset!, ...(group.segment ? { segment: group.segment } : {}), ...(group.rankCursor ? { rank: group.rankCursor } : {}), ...(group.nearbyCursor ? { nearby: group.nearbyCursor } : {}) });
          if (controller.signal.aborted || !page) return;
          setGroups(current => current.map(existing => groupKey(existing) !== groupKey(group) ? existing : {
            ...page, results: [...new Map([...(!!existing.nearby === !!page.nearby ? existing.results : []), ...page.results].map(result => [`${result.type}:${result.id}`, result])).values()],
          }));
        }
      }));
    } catch { if (!controller.signal.aborted) { controller.abort(); setFailed(true); } }
    finally { if (request.current === controller) { setPending(false); request.current = null; } }
  }

  const entries = useMemo(() => smartMapEntries(groups), [groups]);
  const locations = useMemo(() => entries.flatMap(entry => {
    const point = entry.result.mapPoint;
    if (!point || !hasCoordinates(point)) return [];
    return [{ id: entry.key, title: `${t(`areas.${entry.area}`)} · ${entry.result.title}`, city: entry.result.subtitle,
      type: entry.result.type, price: entry.result.price, image: entry.result.image ?? "", lat: point.lat, lng: point.lng,
      markerColor: SMART_MAP_COLORS[entry.area], ...(point.radiusMeters ? { metadata: { location_area: { lat: point.lat, lng: point.lng, radius_meters: point.radiusMeters } } } : {}),
    }];
  }), [entries, t]);
  const known = locations.length, visible = bounds ? locations.filter(item => inMapBounds(item, bounds)).length : known;
  const incomplete = groups.some(group => group.nextOffset !== null);
  const clusterLabel = useCallback((count: number) => mapText("cluster", { count }), [mapText]);

  return <section className="min-w-0 space-y-3 rounded-2xl border border-border bg-bg-secondary/70 p-3 sm:p-4" aria-label={t("mapTitle")}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-base font-semibold text-text-primary"><MapIcon size={20} className="text-gold" aria-hidden="true" />{t("mapTitle")}</h2>
      {bounds && <button type="button" className="min-h-11 text-sm text-gold" onClick={() => setBounds(null)}>{locationText("resetArea")}</button>}
    </div>
    <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-text-secondary" aria-label={t("mapLegend")}>
      {SEARCH_AREAS.filter(area => entries.some(entry => entry.area === area)).map(area => <li key={area} className="inline-flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ backgroundColor: SMART_MAP_COLORS[area] }} aria-hidden="true" />{t(`areas.${area}`)}</li>)}
    </ul>
    <p className="text-xs text-text-muted">{mapText("cityNotice")}</p>
    {groups.some(group => group.nearby && group.results.length) && <p className="text-xs text-text-muted">{t("nearbyMap")}</p>}
    <div className="directory-map-frame">
      <LocationMap locations={locations} activeId={activeId} onHover={setActiveId} userLocation={null} radiusKm={50}
        appliedBounds={bounds} onApplyBounds={setBounds} onBoundsChange={setBounds} visibleCount={visible}
        labels={{ label: t("mapTitle"), results: mapText("mapped", { count: visible }), empty: pending ? mapText("loading") : mapText("empty"), unknownCoordinates: "", cluster: clusterLabel, error: mapText("error") }}
        renderPreview={selected => {
          const entry = entries.find(item => item.key === selected.id);
          return entry ? <div className="p-3 pt-12"><p className="mb-2 text-xs font-medium" style={{ color: SMART_MAP_COLORS[entry.area] }}>{t(`areas.${entry.area}`)}</p><ResultCard result={entry.result} compact /></div> : null;
        }} />
    </div>
    {pending && <p role="status" className="flex items-center gap-2 text-xs text-text-muted"><Loader2 size={16} className="animate-spin" />{mapText("loading")}</p>}
    {entries.length > known && <p className="text-xs text-text-muted">{mapText("unmapped", { count: entries.length - known })}</p>}
    {incomplete && <p className="text-xs text-text-muted">{t("mapIncomplete")}</p>}
    {failed && <p role="alert" className="text-sm text-text-secondary">{t("error")}</p>}
    {(incomplete || failed) && <button type="button" disabled={pending} className="min-h-11 rounded-lg border border-border px-3 text-sm text-gold disabled:opacity-50"
      onClick={() => { if (groups.length) void more(); else setRetry(value => value + 1); }}>{failed ? t("retry") : t("mapMore")}</button>}
    <p className="text-xs text-text-muted">{mapText.rich("source", { provider: chunks => <a href="https://www.geonames.org/" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center underline">{chunks}</a>, license: chunks => <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center underline">{chunks}</a> })}</p>
  </section>;
}
