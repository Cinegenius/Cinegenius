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
  const textPaint = { "text-color": "#bec8d3", "text-halo-color": "#151b24", "text-halo-width": 1.5 };
  return {
    version: 8,
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: { openmaptiles: { type: "vector", url: "https://tiles.openfreemap.org/planet" } },
    layers: [
      { id: "land", type: "background", paint: { "background-color": "#1b222d" } },
      { id: "nature", type: "fill", ...source, "source-layer": "landcover", paint: { "fill-color": "#202f2e", "fill-opacity": 0.5 } },
      { id: "parks", type: "fill", ...source, "source-layer": "park", minzoom: 10, paint: { "fill-color": "#253931", "fill-opacity": 0.6 } },
      { id: "water", type: "fill", ...source, "source-layer": "water", paint: { "fill-color": "#101722" } },
      { id: "rivers", type: "line", ...source, "source-layer": "waterway", minzoom: 9, paint: { "line-color": "#101722", "line-width": ["interpolate", ["linear"], ["zoom"], 9, 0.5, 16, 3] } },
      { id: "buildings", type: "fill", ...source, "source-layer": "building", minzoom: 14, paint: { "fill-color": "#303b49", "fill-outline-color": "#3a4756" } },
      { id: "local-roads", type: "line", ...source, "source-layer": "transportation", minzoom: 11, filter: ["in", "class", "minor", "service", "track", "path"], paint: { "line-color": "#3b4654", "line-width": ["interpolate", ["linear"], ["zoom"], 11, 0.5, 16, 2.5] } },
      { id: "main-roads", type: "line", ...source, "source-layer": "transportation", minzoom: 5, filter: ["in", "class", "motorway", "trunk", "primary", "secondary", "tertiary"], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#53616e", "line-opacity": 0.8, "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.5, 11, 1.5, 16, 4] } },
      { id: "rail", type: "line", ...source, "source-layer": "transportation", minzoom: 12, filter: ["==", "class", "rail"], paint: { "line-color": "#677380", "line-width": 1, "line-dasharray": [2, 3] } },
      { id: "regions", type: "line", ...source, "source-layer": "boundary", minzoom: 6, filter: ["==", "admin_level", 4], paint: { "line-color": "#586271", "line-width": 0.8, "line-dasharray": [3, 4] } },
      { id: "borders", type: "line", ...source, "source-layer": "boundary", filter: ["all", ["==", "admin_level", 2], ["!=", "maritime", 1]], paint: { "line-color": "#6d7787", "line-width": 1, "line-dasharray": [4, 3] } },
      { id: "street-names", type: "symbol", ...source, "source-layer": "transportation_name", minzoom: 13, layout: { ...text, "symbol-placement": "line", "text-size": 11 }, paint: textPaint },
      { id: "neighborhoods", type: "symbol", ...source, "source-layer": "place", minzoom: 11, filter: ["in", "class", "suburb", "quarter", "neighbourhood", "hamlet"], layout: { ...text, "text-size": 11 }, paint: { ...textPaint, "text-color": "#97a4b2" } },
      { id: "towns", type: "symbol", ...source, "source-layer": "place", minzoom: 8, filter: ["in", "class", "town", "village"], layout: { ...text, "text-size": 12 }, paint: textPaint },
      { id: "cities", type: "symbol", ...source, "source-layer": "place", minzoom: 3, filter: ["==", "class", "city"], layout: { ...text, "text-size": ["interpolate", ["linear"], ["zoom"], 3, 11, 10, 15], "symbol-sort-key": ["coalesce", ["get", "rank"], 10] }, paint: { ...textPaint, "text-color": "#e0e6ed" } },
      { id: "countries", type: "symbol", ...source, "source-layer": "place", maxzoom: 7, filter: ["==", "class", "country"], layout: { ...text, "text-size": 12, "text-letter-spacing": 0.12, "text-transform": "uppercase" }, paint: { ...textPaint, "text-color": "#9ba9b9" } },
    ],
  };
}
