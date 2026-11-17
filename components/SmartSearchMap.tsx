"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Map as MapIcon } from "lucide-react";
import { hasCoordinates, type MapBounds } from "@/lib/location-map";
import { SMART_MAP_COLORS, smartMapEntries } from "@/lib/smart-search-map";
import type { SearchGroup } from "@/lib/unified-search";
import ResultCard from "./SearchResultCard";

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
      type: entry.result.type, price: entry.result.price, image: entry.result.image ?? "", lat: point.lat, lng: point.lng,
      markerColor: SMART_MAP_COLORS[entry.area], ...(point.radiusMeters ? { metadata: { location_area: { lat: point.lat, lng: point.lng, radius_meters: point.radiusMeters } } } : {}),
    }];
  }), [entries, t]);
  const clusterLabel = useCallback((count: number) => mapText("cluster", { count }), [mapText]);

  return <section className="min-w-0 space-y-3" aria-label={t("mapTitle")}>
    <h2 className="flex items-center gap-2 text-base font-semibold text-text-primary"><MapIcon size={20} className="text-gold" aria-hidden="true" />{t("mapTitle")}</h2>
    <p className="text-xs text-text-muted">{mapText("cityNotice")}</p>
    <div className="directory-map-frame">
      <LocationMap locations={locations} activeId={activeId} onHover={setActiveId} userLocation={null} radiusKm={50}
        preserveViewport appliedBounds={bounds} onApplyBounds={onApplyBounds} visibleCount={locations.length}
        labels={{ label: t("mapTitle"), results: mapText("mapped", { count: locations.length }), empty: mapText("empty"), unknownCoordinates: "", cluster: clusterLabel, error: mapText("error"), applyArea: t("discovery.applyMapArea") }}
        renderPreview={selected => {
          const entry = entries.find(item => item.key === selected.id);
          return entry ? <div className="p-3 pt-12"><p className="mb-2 text-xs font-medium" style={{ color: SMART_MAP_COLORS[entry.area] }}>{t(`areas.${entry.area}`)}</p><ResultCard result={entry.result} compact showEvidence /></div> : null;
        }} />
    </div>
    {entries.length > locations.length && <p className="text-xs text-text-muted">{t("discovery.unmapped", { count: entries.length - locations.length })}</p>}
    <p className="text-xs text-text-muted">{mapText.rich("source", { provider: chunks => <a href="https://www.geonames.org/" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center underline">{chunks}</a>, license: chunks => <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center underline">{chunks}</a> })}</p>
  </section>;
}
