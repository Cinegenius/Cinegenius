"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Info } from "lucide-react";
import { hasCoordinates, inMapBounds, type MapBounds } from "@/lib/location-map";
import { SMART_MAP_COLORS, smartMapEntries } from "@/lib/smart-search-map";
import { NATIVE_SMART_MAP_COLORS, NATIVE_SMART_PURE_COLORS } from "@/lib/native-smart-colors";
import { useNativeAppAppearance } from "@/lib/use-native-app-appearance";
import { useNativeAppTheme } from "@/lib/native-app-theme";
import type { SearchGroup } from "@/lib/unified-search";
import ResultCard, { SearchResultTitle } from "./SearchResultCard";

const LocationMap = dynamic(() => import("./LocationMap"), { ssr: false });

/** Both surfaces share the permission-projected pool. Native map movement
 * synchronizes the local viewport; the ordinary website retains explicit Apply. */
export default function SmartSearchMap({ groups, bounds, onApplyBounds, active = true }: {
  groups: SearchGroup[]; bounds: MapBounds | null; onApplyBounds: (value: MapBounds | null) => void; active?: boolean;
}) {
  const t = useTranslations("UnifiedSearch"), mapText = useTranslations("directoryMap");
  const nativeAppearance = useNativeAppAppearance(), theme = useNativeAppTheme();
  const colors = nativeAppearance ? NATIVE_SMART_MAP_COLORS : SMART_MAP_COLORS;
  const labelColors = nativeAppearance && theme === "pure" ? NATIVE_SMART_PURE_COLORS : colors;
  const [activeId, setActiveId] = useState<string | null>(null);
  const entries = useMemo(() => smartMapEntries(groups), [groups]);
  const locations = useMemo(() => entries.flatMap(entry => {
    const point = entry.result.mapPoint;
    if (!point || !hasCoordinates(point)) return [];
    return [{ id: entry.key, title: `${t(`areas.${entry.area}`)} · ${entry.result.title}`, city: entry.result.subtitle,
      titleContent: <>{t(`areas.${entry.area}`)} · <SearchResultTitle result={entry.result} /></>,
      type: entry.result.type, price: entry.result.price, image: entry.result.image ?? "", lat: point.lat, lng: point.lng,
      markerColor: colors[entry.area], ...(point.radiusMeters ? { metadata: { location_area: { lat: point.lat, lng: point.lng, radius_meters: point.radiusMeters } } } : {}),
    }];
  }), [entries, t, colors]);
  const visibleCount = nativeAppearance && bounds ? locations.filter(location => inMapBounds(location, bounds)).length : locations.length;
  const clusterLabel = useCallback((count: number) => mapText("cluster", { count }), [mapText]);

  return <section className="smart-map min-w-0 space-y-2" aria-label={t("mapTitle")}>
    <p className="sr-only">{mapText("cityNotice")}</p>
    <div className="smart-map-frame">
      <LocationMap locations={locations} activeId={activeId} onHover={setActiveId} userLocation={null} radiusKm={50}
        preserveViewport viewportActive={nativeAppearance ? active : undefined} appliedBounds={bounds} onApplyBounds={onApplyBounds} onBoundsChange={nativeAppearance ? onApplyBounds : undefined} visibleCount={visibleCount}
        labels={{ label: t("mapTitle"), results: mapText("mapped", { count: visibleCount }), empty: mapText("empty"), unknownCoordinates: "", cluster: clusterLabel, error: mapText("error"), applyArea: t("discovery.applyMapArea"), nativeApplyArea: t("discovery.searchHere") }}
        renderPreview={selected => {
          const entry = entries.find(item => item.key === selected.id);
          return entry ? <div className="p-3"><p className="flex min-h-8 items-start pr-9 text-xs font-medium" style={{ color: labelColors[entry.area] }}>{t(`areas.${entry.area}`)}</p><ResultCard result={entry.result} compact row /></div> : null;
        }} />
    </div>
    <div className="smart-map-meta">
    {!nativeAppearance && entries.length > locations.length && <p className="text-xs text-text-muted">{t("discovery.unmapped", { count: entries.length - locations.length })}</p>}
    <details className="smart-map-info"><summary aria-label={t("mapTitle")} className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center text-text-muted"><Info size={16} aria-hidden="true" /></summary><div className="space-y-2 rounded-xl border border-border bg-bg-secondary p-3 text-xs text-text-muted"><p>{mapText("cityNotice")}</p><p>{mapText.rich("source", { provider: chunks => <a href="https://www.geonames.org/" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center underline">{chunks}</a>, license: chunks => <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center underline">{chunks}</a> })}</p></div></details>
    </div>
  </section>;
}
