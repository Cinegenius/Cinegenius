import type { SearchArea, SearchGroup, SearchResult } from "./unified-search";

export const SMART_MAP_COLORS: Record<SearchArea, string> = {
  crew: "#c2f135", locations: "#f3a45e", marketplace: "#b69ae8", companies: "#85b9ec",
  jobs: "#e6c675", animals: "#70cdb0", projects: "#e99eb2", news: "#a9bdcd", organizations: "#a5a4df",
};

export function smartMapEntries(groups: SearchGroup[]) {
  const entries = new Map<string, { key: string; area: SearchArea; result: SearchResult }>();
  for (const group of groups) for (const result of group.results) {
    const key = `${result.type}:${result.id}`;
    if (!entries.has(key)) entries.set(key, { key, area: group.area, result });
  }
  return [...entries.values()];
}

/** Only fixed hex colours enter Leaflet's generated marker HTML. No member text. */
export function mapMarkerStyle(colors: (string | undefined)[], clustered: boolean): string {
  if (!colors.some(Boolean)) return "";
  const safe = colors.map(color => color && /^#[a-f0-9]{6}$/i.test(color) ? color : SMART_MAP_COLORS.crew);
  const unique = [...new Set(safe)];
  if (!clustered || unique.length === 1) return `--map-marker-color:${unique[0]}`;
  let position = 0;
  const segments = unique.map(color => {
    const end = position + safe.filter(value => value === color).length / safe.length * 100;
    const segment = `${color} ${position}% ${end}%`; position = end; return segment;
  });
  return `--map-marker-color:#dce2e8;border:2px solid transparent;background:linear-gradient(#161a23,#161a23) padding-box,conic-gradient(${segments.join(",")}) border-box`;
}
