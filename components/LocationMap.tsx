"use client";

import { useEffect, useRef } from "react";

type Location = {
  id: string; title: string; type: string; city: string;
  price: number; priceUnit: string; rating: number; reviews: number;
  image: string; tags: string[]; instantBook: boolean; verified: boolean;
  sqft: number; capacity: number; lat: number; lng: number;
};

type Props = {
  locations: Location[];
  activeId: string | null;
  onHover: (id: string | null) => void;
  userLocation: [number, number] | null;
  radiusKm: number;
};


type Cluster = {
  ids: string[];
  lat: number;
  lng: number;
};

function buildClusters(locations: Location[], map: L.Map, pixelRadius = 60): Cluster[] {
  const zoom = map.getZoom();
  const points = locations
    .filter((l) => l.lat && l.lng)
    .map((l) => ({
      id: l.id,
      lat: l.lat,
      lng: l.lng,
      px: map.project([l.lat, l.lng], zoom),
    }));

  const assigned = new Set<string>();
  const clusters: Cluster[] = [];

  for (const p of points) {
    if (assigned.has(p.id)) continue;
    assigned.add(p.id);
    const cluster: Cluster = { ids: [p.id], lat: p.lat, lng: p.lng };

    for (const q of points) {
      if (assigned.has(q.id)) continue;
      const dx = p.px.x - q.px.x;
      const dy = p.px.y - q.px.y;
      if (Math.sqrt(dx * dx + dy * dy) <= pixelRadius) {
        cluster.ids.push(q.id);
        assigned.add(q.id);
      }
    }

    // Centroid
    if (cluster.ids.length > 1) {
      const members = points.filter((pt) => cluster.ids.includes(pt.id));
      cluster.lat = members.reduce((s, pt) => s + pt.lat, 0) / members.length;
      cluster.lng = members.reduce((s, pt) => s + pt.lng, 0) / members.length;
    }

    clusters.push(cluster);
  }

  return clusters;
}

export default function LocationMap({
  locations, activeId, onHover, userLocation, radiusKm,
}: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const locationsRef = useRef(locations);
  const activeIdRef = useRef(activeId);

  // Keep refs in sync
  useEffect(() => { locationsRef.current = locations; }, [locations]);
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);

  // Render clusters + individual markers
  const renderMarkers = async () => {
    if (!mapInstanceRef.current || !layerGroupRef.current) return;
    const L = (await import("leaflet")).default;
    const map = mapInstanceRef.current;
    const group = layerGroupRef.current;
    const locs = locationsRef.current;
    const currentActiveId = activeIdRef.current;

    group.clearLayers();

    const clusters = buildClusters(locs, map);

    for (const cluster of clusters) {
      if (cluster.ids.length === 1) {
        // Individual marker
        const loc = locs.find((l) => l.id === cluster.ids[0]);
        if (!loc) continue;
        const isActive = loc.id === currentActiveId;

        const icon = L.divIcon({
          html: isActive
            ? `<div style="
                width:18px;height:18px;
                background:#C2F135;
                border-radius:50%;
                box-shadow:0 0 0 4px rgba(194,241,53,0.25), 0 0 0 7px rgba(194,241,53,0.08);
              "></div>`
            : `<div style="
                width:10px;height:10px;
                background:#C2F135;
                border-radius:50%;
                opacity:0.85;
              "></div>`,
          iconSize: isActive ? [18, 18] : [10, 10],
          iconAnchor: isActive ? [9, 9] : [5, 5],
          popupAnchor: [0, -14],
          className: "",
        });

        const marker = L.marker([loc.lat, loc.lng], { icon })
          .bindPopup(
            `<div style="
              background:#1a1a1a;
              border:1px solid #2e2e2e;
              border-radius:12px;
              overflow:hidden;
              width:240px;
              font-family:Inter,sans-serif;
            ">
              <img src="${loc.image}" style="width:100%;height:130px;object-fit:cover;" />
              <div style="padding:12px;">
                <div style="font-size:13px;font-weight:600;color:#f0ede8;margin-bottom:4px;line-height:1.3">${loc.title}</div>
                <div style="font-size:11px;color:#9e9e9e;margin-bottom:8px">${loc.city} · ${loc.type}</div>
                <div style="display:flex;align-items:center;justify-content:space-between">
                  <span style="font-size:11px;color:#9e9e9e">★ ${loc.rating} (${loc.reviews})</span>
                  <span style="font-size:13px;font-weight:700;color:#C2F135">$${loc.price.toLocaleString()}/${loc.priceUnit}</span>
                </div>
                <a href="/locations/${loc.id}" style="
                  display:block;
                  margin-top:10px;
                  padding:8px;
                  background:#C2F135;
                  color:#0d0d0d;
                  font-size:12px;
                  font-weight:600;
                  text-align:center;
                  border-radius:6px;
                  text-decoration:none;
                ">Details ansehen →</a>
              </div>
            </div>`,
            { maxWidth: 260, className: "cine-popup" }
          );

        marker.on("mouseover", () => onHover(loc.id));
        marker.on("mouseout", () => onHover(null));
        if (isActive) marker.openPopup();

        group.addLayer(marker);
      } else {
        // Cluster bubble
        const count = cluster.ids.length;
        const size = count >= 20 ? 52 : count >= 10 ? 46 : 38;
        const fontSize = count >= 20 ? 15 : count >= 10 ? 13 : 12;

        const clusterIcon = L.divIcon({
          html: `<div style="
            width:${size}px;height:${size}px;
            background:#161a0e;
            border:2px solid #C2F135;
            border-radius:50%;
            display:flex;align-items:center;justify-content:center;
            color:#C2F135;
            font-size:${fontSize}px;
            font-weight:700;
            font-family:Inter,sans-serif;
            box-shadow:0 2px 16px rgba(0,0,0,0.6);
            cursor:pointer;
          ">${count}</div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
          className: "",
        });

        const clusterMarker = L.marker([cluster.lat, cluster.lng], { icon: clusterIcon });
        clusterMarker.on("click", () => {
          // Zoom into cluster
          map.flyTo([cluster.lat, cluster.lng], map.getZoom() + 3, { animate: true, duration: 0.8 });
        });

        group.addLayer(clusterMarker);
      }
    }
  };

  // Init map
  useEffect(() => {
    if (typeof window === "undefined" || !mapRef.current) return;

    const initMap = async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");

      if (mapInstanceRef.current) return;

      const map = L.map(mapRef.current!, {
        center: [51, 10],
        zoom: 6,
        zoomControl: false,
      });

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
          subdomains: "abcd",
          maxZoom: 19,
        }
      ).addTo(map);

      L.control.zoom({ position: "bottomright" }).addTo(map);

      layerGroupRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;

      // Re-cluster on zoom
      map.on("zoomend", () => { void renderMarkers(); });

      // Initial render
      await renderMarkers();

      // Fit bounds
      const coords = locationsRef.current
        .filter((l) => l.lat && l.lng)
        .map((l) => [l.lat, l.lng] as [number, number]);
      if (coords.length > 0) {
        map.fitBounds(L.latLngBounds(coords), { padding: [40, 40] });
      }
    };

    initMap();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-render markers when locations or activeId changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    void renderMarkers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locations, activeId]);

  // User location + radius circle
  useEffect(() => {
    if (typeof window === "undefined" || !mapInstanceRef.current) return;
    const updateUserLocation = async () => {
      const L = (await import("leaflet")).default;
      const map = mapInstanceRef.current!;

      if (circleRef.current) { map.removeLayer(circleRef.current); circleRef.current = null; }
      if (userMarkerRef.current) { map.removeLayer(userMarkerRef.current); userMarkerRef.current = null; }

      if (!userLocation) return;

      const userIcon = L.divIcon({
        html: `<div style="
          width:14px;height:14px;
          background:#C2F135;
          border:2px solid rgba(255,255,255,0.8);
          border-radius:50%;
          box-shadow:0 0 10px rgba(194,241,53,0.5);
        "></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
        className: "",
      });
      userMarkerRef.current = L.marker(userLocation, { icon: userIcon })
        .addTo(map)
        .bindPopup("<span style='color:#f0ede8;font-size:12px;font-family:Inter'>Dein Standort</span>");

      circleRef.current = L.circle(userLocation, {
        radius: radiusKm * 1000,
        color: "#C2F135",
        fillColor: "#C2F135",
        fillOpacity: 0.07,
        weight: 1.5,
        dashArray: "6 4",
      }).addTo(map);

      map.flyTo(userLocation, 10, { animate: true, duration: 1.2 });
    };
    updateUserLocation();
  }, [userLocation, radiusKm]);

  return (
    <>
      <style>{`
        .cine-popup .leaflet-popup-content-wrapper {
          background: transparent !important;
          border: none !important;
          box-shadow: 0 8px 32px rgba(0,0,0,0.6) !important;
          padding: 0 !important;
          border-radius: 12px !important;
          overflow: hidden;
        }
        .cine-popup .leaflet-popup-tip { background: #1a1a1a !important; }
        .cine-popup .leaflet-popup-content { margin: 0 !important; width: auto !important; }
        .leaflet-container { background: #0d0d0d !important; }
        .leaflet-control-attribution {
          background: rgba(13,13,13,0.8) !important;
          color: #666 !important;
          font-size: 10px !important;
        }
        .leaflet-control-attribution a { color: #C2F135 !important; }
        .leaflet-bar { border: 1px solid #2e2e2e !important; background: #1a1a1a !important; }
        .leaflet-bar a {
          background: #1a1a1a !important;
          color: #9e9e9e !important;
          border-bottom: 1px solid #2e2e2e !important;
        }
        .leaflet-bar a:hover { background: #242424 !important; color: #C2F135 !important; }
      `}</style>
      <div style={{ isolation: "isolate" }} className="w-full h-full rounded-xl overflow-hidden">
        <div ref={mapRef} className="w-full h-full" />
      </div>
    </>
  );
}
