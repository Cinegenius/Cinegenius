import type { ExpressionSpecification, StyleSpecification } from "maplibre-gl";

export const MAP_ATTRIBUTION = '<a href="https://openfreemap.org/" target="_blank" rel="noopener noreferrer">OpenFreeMap</a> <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener noreferrer">© OpenMapTiles</a> <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap</a>';

export function mapLabelExpression(locale: string): ExpressionSpecification {
  return ["coalesce", ["get", `name:${locale.split("-")[0]}`], ["get", "name:latin"], ["get", "name"]];
}

/** Original CineGenius cartography using the documented OpenMapTiles schema. */
export function cinegeniusMapStyle(locale: string): StyleSpecification {
  const name = mapLabelExpression(locale);
  const source = { source: "openmaptiles" };
  const text = { "text-field": name, "text-font": ["Noto Sans Regular"], "text-padding": 6 };
  const textPaint = { "text-color": "#42545c", "text-halo-color": "#edf1ec", "text-halo-width": 1.5 };
  return {
    version: 8,
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: { openmaptiles: { type: "vector", url: "https://tiles.openfreemap.org/planet" } },
    layers: [
      { id: "land", type: "background", paint: { "background-color": "#dfe6e4" } },
      { id: "nature", type: "fill", ...source, "source-layer": "landcover", paint: { "fill-color": "#c3d2bb", "fill-opacity": 0.5 } },
      { id: "parks", type: "fill", ...source, "source-layer": "park", minzoom: 10, paint: { "fill-color": "#b8cfad", "fill-opacity": 0.6 } },
      { id: "water", type: "fill", ...source, "source-layer": "water", paint: { "fill-color": "#adcbd8" } },
      { id: "rivers", type: "line", ...source, "source-layer": "waterway", minzoom: 9, paint: { "line-color": "#adcbd8", "line-width": ["interpolate", ["linear"], ["zoom"], 9, 0.5, 16, 3] } },
      { id: "buildings", type: "fill", ...source, "source-layer": "building", minzoom: 14, paint: { "fill-color": "#c7d0ce", "fill-outline-color": "#b5c1c0" } },
      { id: "local-roads", type: "line", ...source, "source-layer": "transportation", minzoom: 11, filter: ["in", "class", "minor", "service", "track", "path"], paint: { "line-color": "#f5f4ee", "line-width": ["interpolate", ["linear"], ["zoom"], 11, 0.5, 16, 2.5] } },
      { id: "main-roads", type: "line", ...source, "source-layer": "transportation", minzoom: 5, filter: ["in", "class", "motorway", "trunk", "primary", "secondary", "tertiary"], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#fbf9ee", "line-opacity": 0.8, "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.5, 11, 1.5, 16, 4] } },
      { id: "rail", type: "line", ...source, "source-layer": "transportation", minzoom: 12, filter: ["==", "class", "rail"], paint: { "line-color": "#9faba7", "line-width": 1, "line-dasharray": [2, 3] } },
      { id: "regions", type: "line", ...source, "source-layer": "boundary", minzoom: 6, filter: ["==", "admin_level", 4], paint: { "line-color": "#a5b6b8", "line-width": 0.8, "line-dasharray": [3, 4] } },
      { id: "borders", type: "line", ...source, "source-layer": "boundary", filter: ["all", ["==", "admin_level", 2], ["!=", "maritime", 1]], paint: { "line-color": "#94a7aa", "line-width": 1, "line-dasharray": [4, 3] } },
      { id: "street-names", type: "symbol", ...source, "source-layer": "transportation_name", minzoom: 13, layout: { ...text, "symbol-placement": "line", "text-size": 11 }, paint: textPaint },
      { id: "neighborhoods", type: "symbol", ...source, "source-layer": "place", minzoom: 11, filter: ["in", "class", "suburb", "quarter", "neighbourhood", "hamlet"], layout: { ...text, "text-size": 11 }, paint: { ...textPaint, "text-color": "#607778" } },
      { id: "towns", type: "symbol", ...source, "source-layer": "place", minzoom: 8, filter: ["in", "class", "town", "village"], layout: { ...text, "text-size": 12 }, paint: textPaint },
      { id: "cities", type: "symbol", ...source, "source-layer": "place", minzoom: 3, filter: ["==", "class", "city"], layout: { ...text, "text-size": ["interpolate", ["linear"], ["zoom"], 3, 11, 10, 15], "symbol-sort-key": ["coalesce", ["get", "rank"], 10] }, paint: { ...textPaint, "text-color": "#243b46" } },
      { id: "countries", type: "symbol", ...source, "source-layer": "place", maxzoom: 7, filter: ["==", "class", "country"], layout: { ...text, "text-size": 12, "text-letter-spacing": 0.12, "text-transform": "uppercase" }, paint: { ...textPaint, "text-color": "#60777e" } },
    ],
  };
}
