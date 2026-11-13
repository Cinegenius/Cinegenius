"use client";

import { useMemo } from "react";
import { useViewState } from "./use-view-state";
import { inMapBounds, type MapBounds } from "./location-map";

export function useDirectoryMap<T extends { lat?: number | null; lng?: number | null }>(scope: string, filterKey: string, items: T[], enabled: boolean) {
  const [viewport, setViewport] = useViewState<{ filterKey: string; bounds: MapBounds | null }>(`${scope}.mapBounds`, { filterKey, bounds: null });
  const bounds = viewport.filterKey === filterKey ? viewport.bounds : null;
  const rows = useMemo(() => enabled && bounds
    ? items.filter(item => inMapBounds({ lat: item.lat ?? null, lng: item.lng ?? null }, bounds)) : items, [enabled, bounds, items]);
  const setBounds = (next: MapBounds | null) => {
    if (JSON.stringify(bounds) !== JSON.stringify(next)) setViewport({ filterKey, bounds: next });
  };
  return { rows, bounds, setBounds };
}
