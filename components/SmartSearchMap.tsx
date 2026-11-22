"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { hasCoordinates, inMapBounds, type MapBounds } from "@/lib/location-map";
import { SMART_MAP_COLORS, smartMapEntries } from "@/lib/smart-search-map";
import { NATIVE_SMART_MAP_COLORS, NATIVE_SMART_PURE_COLORS } from "@/lib/native-smart-colors";
import { useNativeAppAppearance } from "@/lib/use-native-app-appearance";
import { useNativeAppTheme } from "@/lib/native-app-theme";
import type { SearchGroup } from "@/lib/unified-search";
import ResultCard, { SearchResultTitle } from "./SearchResultCard";
import SmartSearchMapInfo from "./SmartSearchMapInfo";

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
    {!nativeAppearance && <div className="smart-map-meta">
    {entries.length > locations.length && <p className="text-xs text-text-muted">{t("discovery.unmapped", { count: entries.length - locations.length })}</p>}
    <SmartSearchMapInfo />
    </div>}
  </section>;
}
