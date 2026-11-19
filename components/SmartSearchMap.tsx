"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Info } from "lucide-react";
import { hasCoordinates, type MapBounds } from "@/lib/location-map";
import { SMART_MAP_COLORS, smartMapEntries } from "@/lib/smart-search-map";
import type { SearchGroup } from "@/lib/unified-search";
import ResultCard, { SearchResultTitle } from "./SearchResultCard";

const LocationMap = dynamic(() => import("./LocationMap"), { ssr: false });

/** The explorer owns results, filtering and pagination for BOTH views. Moving
 * the map never interprets a search or mutates the active filter implicitly. */
export default function SmartSearchMap({ groups, bounds, onApplyBounds }: {
  groups: SearchGroup[]; bounds: MapBounds | null; onApplyBounds: (value: MapBounds | null) => void;
}) {
  const t = useTranslations("UnifiedSearch"), mapText = useTranslations("directoryMap");
  const [activeId, setActiveId] = useState<string | null>(null);
  const entries = useMemo(() => smartMapEntries(groups), [groups]);
  const locations = useMemo(() => entries.flatMap(entry => {
    const point = entry.result.mapPoint;
    if (!point || !hasCoordinates(point)) return [];
    return [{ id: entry.key, title: `${t(`areas.${entry.area}`)} · ${entry.result.title}`, city: entry.result.subtitle,
      titleContent: <>{t(`areas.${entry.area}`)} · <SearchResultTitle result={entry.result} /></>,
      type: entry.result.type, price: entry.result.price, image: entry.result.image ?? "", lat: point.lat, lng: point.lng,
      markerColor: SMART_MAP_COLORS[entry.area], ...(point.radiusMeters ? { metadata: { location_area: { lat: point.lat, lng: point.lng, radius_meters: point.radiusMeters } } } : {}),
    }];
  }), [entries, t]);
  const clusterLabel = useCallback((count: number) => mapText("cluster", { count }), [mapText]);

  return <section className="smart-map min-w-0 space-y-2" aria-label={t("mapTitle")}>
    <p className="sr-only">{mapText("cityNotice")}</p>
    <div className="smart-map-frame">
      <LocationMap locations={locations} activeId={activeId} onHover={setActiveId} userLocation={null} radiusKm={50}
        preserveViewport appliedBounds={bounds} onApplyBounds={onApplyBounds} visibleCount={locations.length}
        labels={{ label: t("mapTitle"), results: mapText("mapped", { count: locations.length }), empty: mapText("empty"), unknownCoordinates: "", cluster: clusterLabel, error: mapText("error"), applyArea: t("discovery.applyMapArea"), nativeApplyArea: t("discovery.searchHere") }}
        renderPreview={selected => {
          const entry = entries.find(item => item.key === selected.id);
          return entry ? <div className="p-3 pt-11"><p className="mb-2 text-xs font-medium" style={{ color: SMART_MAP_COLORS[entry.area] }}>{t(`areas.${entry.area}`)}</p><ResultCard result={entry.result} compact row /></div> : null;
        }} />
    </div>
    <div className="smart-map-meta">
    {entries.length > locations.length && <p className="text-xs text-text-muted">{t("discovery.unmapped", { count: entries.length - locations.length })}</p>}
    <details className="smart-map-info"><summary aria-label={t("mapTitle")} className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center text-text-muted"><Info size={16} aria-hidden="true" /></summary><div className="space-y-2 rounded-xl border border-border bg-bg-secondary p-3 text-xs text-text-muted"><p>{mapText("cityNotice")}</p><p>{mapText.rich("source", { provider: chunks => <a href="https://www.geonames.org/" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center underline">{chunks}</a>, license: chunks => <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center underline">{chunks}</a> })}</p></div></details>
    </div>
  </section>;
}
