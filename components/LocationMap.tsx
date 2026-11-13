"use client";

import "leaflet/dist/leaflet.css";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { MapPin, X } from "lucide-react";
import Image from "@/components/MediaImage";
import { listingPriceLabel } from "@/lib/listing-price";
import { placeDisplay } from "@/lib/places/core";
import { locationCategoryLabel } from "@/lib/location-category-labels";
import { readPublicLocationArea } from "@/lib/location-privacy";
import { hasCoordinates, inMapBounds, type MapBounds } from "@/lib/location-map";
import type * as Leaflet from "leaflet";

type Location = {
  id: string; title: string; type: string; city: string;
  price: number; image: string; lat: number | null; lng: number | null;
  metadata?: Record<string, unknown>;
  focalPoint?: { x: number; y: number } | null;
};
type Props = {
  labels?: { label: string; results: string; empty: string; unknownCoordinates: string; cluster?: (count: number) => string; error?: string };
  renderPreview?: (location: Location) => ReactNode;
  readOnly?: boolean;
  onBoundsChange?: (bounds: MapBounds) => void;
  visibleCount?: number;
  locations: Location[];
  activeId: string | null;
  onHover: (id: string | null) => void;
  userLocation: [number, number] | null;
  radiusKm: number;
  appliedBounds: MapBounds | null;
  onApplyBounds: (bounds: MapBounds | null) => void;
};

export default function LocationMap({ readOnly = false, locations, activeId, onHover, userLocation, radiusKm, appliedBounds, onApplyBounds, onBoundsChange, visibleCount, labels, renderPreview }: Props) {
  const clusterLabel = labels?.cluster;
  const t = useTranslations("locationMap");
  const mapUi = useTranslations("directoryMap"), commonUi = useTranslations("notifications");
  const zoom = useRef<Leaflet.Control.Zoom | null>(null);
  const zoomLabels = useRef({ zoomInTitle: mapUi("zoomIn"), zoomOutTitle: mapUi("zoomOut") });
  const privacyText = useTranslations("locationPrivacy");
  const priceText = useTranslations("MarketplaceOffer");
  const locale = useLocale();
  const categoryText = useTranslations("menu");
  const locationsText = useTranslations("locations");
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const [map, setMap] = useState<Leaflet.Map | null>(null);
  const [moved, setMoved] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const selectionKey = locations.map(location => location.id).join(",");
  const [selection, setSelection] = useState<{ scope: string; id: string | null; cluster: string[] }>({ scope: selectionKey, id: null, cluster: [] });
  if (selection.scope !== selectionKey) setSelection({ scope: selectionKey, id: null, cluster: [] });
  const hoverRef = useRef(onHover);
  const boundsChangeRef = useRef(onBoundsChange);
  const automaticBounds = Boolean(onBoundsChange);
  useEffect(() => { boundsChangeRef.current = onBoundsChange; }, [onBoundsChange]);
  const initialBounds = useRef(appliedBounds);
  useEffect(() => { initialBounds.current = appliedBounds; }, [appliedBounds]);
  useEffect(() => {
    const container = zoom.current?.getContainer();
    for (const [selector, label] of [[".leaflet-control-zoom-in", mapUi("zoomIn")], [".leaflet-control-zoom-out", mapUi("zoomOut")]]) {
      const control = container?.querySelector(selector);
      control?.setAttribute("title", label); control?.setAttribute("aria-label", label);
    }
  }, [map, mapUi]);
  useEffect(() => { hoverRef.current = onHover; }, [onHover]);
  const selected = selection.scope === selectionKey ? locations.find(location => location.id === selection.id) : undefined;
  const clusterLocations = selection.scope === selectionKey ? locations.filter(location => selection.cluster.includes(location.id)) : [];
  const select = (id: string | null, cluster: string[] = []) => {
    setSelection({ scope: selectionKey, id, cluster });
    hoverRef.current(id);
  };

  useEffect(() => {
    if (!map) return;
    const updateBounds = () => {
      if (!automaticBounds) { setMoved(true); return; }
      const bounds = map.getBounds();
      boundsChangeRef.current?.({south: bounds.getSouth(), north: bounds.getNorth(), west: bounds.getWest(), east: bounds.getEast()});
      setSelection(current => current.id || current.cluster.length ? {...current, id: null, cluster: []} : current);
      hoverRef.current(null);
    };
    map.on("moveend", updateBounds);
    if (automaticBounds) {
      map.on("zoomend", updateBounds);
      map.on("resize", updateBounds);
      updateBounds();
    }
    return () => { map.off("moveend", updateBounds); map.off("zoomend", updateBounds); map.off("resize", updateBounds); };
  }, [map, automaticBounds]);

  useEffect(() => {
    let cancelled = false;
    let instance: Leaflet.Map | null = null;
    const observer = new ResizeObserver(() => instance?.invalidateSize());
    async function initialize() {
      try {
        const L = (await import("leaflet")).default;
        if (cancelled || !containerRef.current) return;
        // Leaflet's delayed zoom transition can outlive a map removed by navigation or retry.
        instance = L.map(containerRef.current, { center: [51, 10], zoom: 6, zoomControl: false, zoomAnimation: false });
        mapRef.current = instance;
        const bounds = initialBounds.current;
        if (bounds) instance.fitBounds([[bounds.south, bounds.west], [bounds.north, bounds.east]], { animate: false });
        const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', maxZoom: 19,
        });
        tiles.on?.("tileerror", () => { if (!cancelled) setFailed(true); });
        tiles.addTo(instance);
        zoom.current = L.control.zoom({ position: "topright", ...zoomLabels.current }).addTo(instance);
        observer.observe(containerRef.current);
        setMap(instance);
      } catch { if (!cancelled) setFailed(true); }
    }
    void initialize();
    return () => { cancelled = true; observer.disconnect(); instance?.remove(); mapRef.current = null; zoom.current = null; };
  }, [attempt]);

  // Hover only changes marker styling; it never destroys an open touch preview.
  useEffect(() => {
    if (!map) return;
    let cancelled = false;
    let group: Leaflet.LayerGroup | undefined;
    async function initializeMarkers() {
      const L = (await import("leaflet")).default;
      if (cancelled) return;
      group = L.layerGroup().addTo(map!);
      const render = () => {
        group!.clearLayers();
        const bounds = map!.getBounds();
        const viewport = {south: bounds.getSouth(), north: bounds.getNorth(), west: bounds.getWest(), east: bounds.getEast()};
        const pending = locations.filter(hasCoordinates).filter(location => !automaticBounds || inMapBounds(location, viewport));
        for (const location of pending) {
          const area = readPublicLocationArea(location.metadata);
          if (area) L.circle([area.lat, area.lng], { radius: area.radius_meters, color: "#C2F135", fillOpacity: 0.07, weight: 1.5, interactive: false }).addTo(group!);
        }
        const used = new Set<string>();
        for (const location of pending) {
          if (used.has(location.id)) continue;
          const point = map!.latLngToLayerPoint([location.lat, location.lng]);
          const members = pending.filter(other => !used.has(other.id)
            && point.distanceTo(map!.latLngToLayerPoint([other.lat, other.lng])) <= 44);
          members.forEach(member => used.add(member.id));
          const clustered = members.length > 1;
          const marker = L.marker([
            members.reduce((sum, member) => sum + member.lat, 0) / members.length,
            members.reduce((sum, member) => sum + member.lng, 0) / members.length,
          ], {
            title: clustered ? (clusterLabel?.(members.length) ?? t("cluster", { count: members.length })) : location.title,
            icon: L.divIcon({ className: "location-map-marker", iconSize: [44, 44], iconAnchor: [22, 22],
              html: `<span class="location-map-marker__dot${clustered ? " location-map-marker__cluster" : ""}">${clustered ? members.length : ""}</span>` }),
          }).addTo(group!);
          marker.on("click", () => {
            if (readOnly) return;
            if (clustered) {
              if (map!.getZoom() >= 18) {
                setSelection({ scope: locations.map(location => location.id).join(","), id: null, cluster: members.map(member => member.id) });
              } else {
                map!.fitBounds(L.latLngBounds(members.map(member => [member.lat, member.lng])), { padding: [50, 50], maxZoom: Math.min(18, map!.getZoom() + 3) });
              }
            } else {
              setSelection({ scope: locations.map(location => location.id).join(","), id: location.id, cluster: [] }); hoverRef.current(location.id);
            }
          });
          marker.on("mouseover", () => { if (!clustered) hoverRef.current(location.id); });
          marker.on("mouseout", () => hoverRef.current(null));
        }
      };
      render(); map!.on("zoomend", render);
      if (automaticBounds) map!.on("moveend", render);
      cleanupRender = () => { map!.off("zoomend", render); map!.off("moveend", render); };
    }
    let cleanupRender = () => {};
    void initializeMarkers();
    return () => { cancelled = true; cleanupRender(); group?.remove(); };
  }, [map, locations, t, readOnly, automaticBounds, clusterLabel]);

  useEffect(() => {
    if (!map) return;
    // Marker titles and DOM text are never interpreted as HTML.
    map.eachLayer(layer => {
      if (!("getElement" in layer)) return;
      const marker = layer as Leaflet.Marker;
      const location = locations.find(item => item.id === (selected?.id ?? activeId));
      const highlighted = location && hasCoordinates(location) && marker.getLatLng?.().equals([location.lat, location.lng]);
      marker.getElement()?.classList.toggle("location-map-marker--active", Boolean(highlighted));
    });
  }, [map, activeId, selected, locations]);

  useEffect(() => {
    if (!map || appliedBounds) return;
    const coords = locations.filter(hasCoordinates).map(location => [location.lat, location.lng] as [number, number]);
    if (coords.length) {
      void import("leaflet").then(({ default: L }) => {
        if (mapRef.current === map && !userLocation) { map.fitBounds(L.latLngBounds(coords), { padding: [48, 48], maxZoom: 13, animate: false }); setMoved(false); }
      });
    }
  }, [map, locations, userLocation, appliedBounds]);

  useEffect(() => {
    if (!map || !userLocation) return;
    let cancelled = false;
    let circle: Leaflet.Circle | undefined;
    let marker: Leaflet.CircleMarker | undefined;
    void import("leaflet").then(({ default: L }) => {
      if (cancelled) return;
      circle = L.circle(userLocation, { radius: radiusKm * 1000, color: "#C2F135", fillOpacity: 0.07, weight: 1.5 }).addTo(map);
      marker = L.circleMarker(userLocation, { radius: 7, color: "white", fillColor: "#C2F135", fillOpacity: 1 }).addTo(map);
      marker.bindTooltip(t("yourLocation"));
      if (!appliedBounds) { map.fitBounds(circle.getBounds(), { padding: [32, 32], animate: false }); setMoved(false); }
    });
    return () => { cancelled = true; circle?.remove(); marker?.remove(); };
  }, [map, userLocation, radiusKm, t, appliedBounds]);

  return (
    <div className="location-map relative isolate h-full min-h-80 w-full overflow-hidden rounded-xl border border-border bg-bg-secondary" aria-label={labels?.label ?? t("label")}>
      <div ref={containerRef} className="h-full w-full" />
      <p role="status" aria-live="polite" className="pointer-events-none absolute left-3 top-3 z-[500] max-w-[calc(100%-5rem)] rounded-lg border border-border bg-bg-primary/95 px-3 py-2 text-xs font-medium text-text-primary">{labels?.results ?? locationsText("results", { count: visibleCount ?? locations.length })}</p>
      {!readOnly && !automaticBounds && <div className="absolute left-3 top-16 z-[500] flex max-w-[calc(100%-5rem)] flex-wrap gap-2">
        {moved && <button type="button" onClick={() => { if (!map) return; const b = map.getBounds(); onApplyBounds({ south: b.getSouth(), north: b.getNorth(), west: b.getWest(), east: b.getEast() }); setMoved(false); }} className="min-h-11 rounded-lg border border-border bg-bg-primary px-3 text-sm text-text-primary">{t("searchArea")}</button>}
        {appliedBounds && <button type="button" onClick={() => { onApplyBounds(null); setMoved(false); }} className="min-h-11 rounded-lg border border-border bg-bg-primary px-3 text-sm text-text-primary">{t("resetArea")}</button>}
      </div>}
      {(labels?.unknownCoordinates ?? true) && locations.some(location => !hasCoordinates(location)) && <p className="absolute bottom-8 left-3 z-[400] rounded bg-bg-primary px-2 py-1 text-xs text-text-muted">{labels?.unknownCoordinates ?? t("unknownCoordinates")}</p>}
      {failed && <div role="alert" className="absolute inset-x-3 top-16 z-[600] flex flex-wrap items-center gap-2 rounded-xl border border-border bg-bg-secondary p-3 text-sm text-text-secondary"><p className="min-w-0 flex-1">{labels?.error ?? t("error")}</p><button type="button" onClick={() => { setFailed(false); setMap(null); setAttempt(value => value + 1); }} className="min-h-11 rounded-lg border border-border px-3 text-gold">{commonUi("retry")}</button></div>}
      {(visibleCount ?? locations.length) === 0 && <p role="status" className="absolute inset-x-3 top-3 z-[500] rounded-lg border border-border bg-bg-primary p-4 text-sm text-text-secondary">{labels?.empty ?? t("empty")}</p>}
      {(selected || clusterLocations.length > 0) && (
        <div className="location-map-preview absolute inset-x-3 bottom-8 z-[1100] mx-auto max-h-[calc(100%-6rem)] max-w-sm overflow-y-auto rounded-xl border border-border bg-bg-secondary shadow-xl">
          <button type="button" aria-label={t("closePreview")} onClick={() => { select(null); }} className="absolute right-0 top-0 z-10 flex size-11 items-center justify-center rounded-full bg-bg-primary/90 text-text-primary"><X size={18} /></button>
          {selected ? (renderPreview ? renderPreview(selected) : (
            <Link href={`/locations/${selected.id}`} className="block overflow-hidden rounded-xl focus-visible:outline-2 focus-visible:outline-gold">
              <div className="relative h-32 bg-bg-elevated">
                {selected.image ? <Image src={selected.image} alt={selected.title} fill mediaSize="thumbnail" sizes="384px" className="object-cover" style={{ objectPosition: selected.focalPoint ? `${selected.focalPoint.x}% ${selected.focalPoint.y}%` : "50% 50%" }} /> : <div className="flex h-full items-center justify-center text-text-muted"><MapPin size={30} /></div>}
              </div>
              <div className="space-y-1 p-3">
                <h3 className="text-sm font-semibold text-text-primary">{selected.title}</h3>
                {readPublicLocationArea(selected.metadata) && <p className="text-xs text-text-muted">{privacyText("publicArea")}</p>}
                <p className="text-xs text-text-muted">{placeDisplay(selected, selected.city, locale)} · {locationCategoryLabel(selected.type, categoryText)}</p>
                <p className="text-sm font-bold text-gold">{listingPriceLabel(selected.price, selected.metadata, "/Tag", locale, key => priceText(key))}</p>
                <span className="flex min-h-11 items-center text-sm font-medium text-gold">{t("details")} →</span>
              </div>
            </Link>
          )) : <div className="max-h-60 overflow-y-auto p-3 pt-12">{clusterLocations.map(location => <button type="button" key={location.id} onClick={() => { select(location.id); }} className="block min-h-11 w-full border-b border-border p-2 text-left text-sm text-text-primary">{location.title}</button>)}</div>}
        </div>
      )}
    </div>
  );
}
