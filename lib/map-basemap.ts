import { maplibreGL } from "@maplibre/maplibre-gl-leaflet";
import { setWorkerCount, setWorkerUrl } from "maplibre-gl";
import { cinegeniusMapStyle, MAP_ATTRIBUTION } from "./map-style";

// Webpack emits the bundled worker on our own origin; no third-party executable code.
setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href);
setWorkerCount(2);

export function createBasemap(locale: string) {
  return maplibreGL({
    style: cinegeniusMapStyle(locale),
    attributionControl: { customAttribution: MAP_ATTRIBUTION },
    // Markers, viewport filters and accessible controls stay in the shared Leaflet map.
    interactive: false,
    maxZoom: 19,
  });
}
