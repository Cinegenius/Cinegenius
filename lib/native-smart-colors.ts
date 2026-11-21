import type { SearchArea } from "./unified-search";

/** Native Smart domain identity. Work's motive/base colours are a separate taxonomy. */
export const NATIVE_SMART_DOMAIN_COLORS = {
  crew: { cinema: "#ffab98", pure: "#9f3024" },
  marketplace: { cinema: "#e3b75c", pure: "#785e3b" },
  smart: { cinema: "#c2f135", pure: "#326e2d" },
  locations: { cinema: "#82c6ef", pure: "#486982" },
  companies: { cinema: "#c3a2ed", pure: "#6c5b82" },
  jobs: { cinema: "#e6c675", pure: "#604600" },
  animals: { cinema: "#70cdb0", pure: "#07503c" },
  projects: { cinema: "#e99eb2", pure: "#772b4b" },
  news: { cinema: "#a9bdcd", pure: "#3d566a" },
  organizations: { cinema: "#a5a4df", pure: "#4f417f" },
} as const;

export type NativeSmartDomain = keyof typeof NATIVE_SMART_DOMAIN_COLORS;
export const NATIVE_SMART_MAP_COLORS = Object.fromEntries(Object.entries(NATIVE_SMART_DOMAIN_COLORS)
  .filter(([area]) => area !== "smart").map(([area, color]) => [area, color.cinema])) as Record<SearchArea, string>;
export const NATIVE_SMART_PURE_COLORS = Object.fromEntries(Object.entries(NATIVE_SMART_DOMAIN_COLORS)
  .filter(([area]) => area !== "smart").map(([area, color]) => [area, color.pure])) as Record<SearchArea, string>;

/** Only fixed catalogue keys become colour variables, never member-authored text. */
export function nativeSmartColorStyle(area: NativeSmartDomain) {
  return { "--native-domain-cinema": NATIVE_SMART_DOMAIN_COLORS[area].cinema,
    "--native-domain-pure": NATIVE_SMART_DOMAIN_COLORS[area].pure };
}

const typeAreas: Readonly<Record<string, SearchArea>> = Object.freeze({ profile:"crew", creator:"crew", prop:"marketplace", vehicle:"marketplace",
  location:"locations", company:"companies", job:"jobs", animal:"animals", project:"projects", news:"news", organization:"organizations" });
export function nativeSmartAreaForType(type: string): SearchArea | null {
  return Object.hasOwn(typeAreas,type) ? typeAreas[type] : null;
}
