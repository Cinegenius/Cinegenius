import { readSearchPlan, type SearchGroup, type SearchPlan } from "./unified-search";
import { locationDistanceKm } from "./location-map";

export const NATIVE_DISCOVERY_CONTRACT = "cinegenius.native-discovery.v1" as const;
export const NATIVE_DISCOVERY_DIRECTORIES = [
  { area: "crew", href: "/creators" },
  { area: "marketplace", href: "/props" },
  { area: "locations", href: "/locations" },
  { area: "companies", href: "/companies" },
] as const;
export type NativeDiscoveryMode = "profile" | "neutral";
export type NativeDiscoveryFocus = { mode: NativeDiscoveryMode; departments: string[]; city: string | null };
export type NativeDiscoveryResponse = {
  contract: typeof NATIVE_DISCOVERY_CONTRACT; accountId: string; serverNow: string;
  focus: NativeDiscoveryFocus; plan: SearchPlan; groups: SearchGroup[];
};

/** Six wishes are the existing plan-v1 ceiling. No invented tenth result domain. */
export function nativeDiscoveryPlan(): SearchPlan {
  return { version: 1, searches: [
    ["crew", "Crew"], ["marketplace", "Marketplace"], ["locations", "Locations"],
    ["companies", "Companies"], ["jobs", "Jobs"], ["projects", "Projects"],
  ].map(([area, query]) => ({ area, query, department: "", places: [] })) } as SearchPlan;
}

/** Reorder only results already projected by the shared permission engine.
 * The current page cursor stays untouched; this is not a catalogue-wide rank. */
export function rankNativeDiscoveryGroups(groups: SearchGroup[], focus: NativeDiscoveryFocus, origin: { lat: number; lng: number } | null): SearchGroup[] {
  if (focus.mode === "neutral" || (!focus.departments.length && !origin)) return groups;
  return groups.map(group => ({ ...group, results: group.results.map((result, index) => ({ result, index })).sort((a, b) => {
    const department = (entry: typeof a) => group.area === "crew" && entry.result.facets?.departments?.some(id => focus.departments.includes(id)) ? 1 : 0;
    const distance = (entry: typeof a) => origin && entry.result.mapPoint
      ? locationDistanceKm([origin.lat, origin.lng], [entry.result.mapPoint.lat, entry.result.mapPoint.lng]) : Number.POSITIVE_INFINITY;
    return department(b) - department(a) || distance(a) - distance(b) || a.index - b.index;
  }).map(entry => entry.result) }));
}

/** Validate the account/plan envelope; public rows keep the shared SearchGroup contract. */
export function readNativeDiscovery(value: unknown, accountId: string): NativeDiscoveryResponse | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  if (data.contract !== NATIVE_DISCOVERY_CONTRACT || data.accountId !== accountId || typeof data.serverNow !== "string" || !Number.isFinite(Date.parse(data.serverNow))) return null;
  const plan = readSearchPlan(data.plan);
  if (!plan || JSON.stringify(plan) !== JSON.stringify(nativeDiscoveryPlan()) || !Array.isArray(data.groups) || data.groups.length !== plan.searches.length) return null;
  const focus = data.focus as NativeDiscoveryFocus | undefined;
  if (!focus || !["profile", "neutral"].includes(focus.mode) || !Array.isArray(focus.departments) || focus.departments.length > 100
    || focus.departments.some(id => typeof id !== "string" || id.length > 60) || (focus.city !== null && (typeof focus.city !== "string" || focus.city.length > 200))) return null;
  if (data.groups.some((group, index) => !group || typeof group !== "object" || group.area !== plan.searches[index].area || group.wishIndex !== index
    || !Array.isArray(group.results) || group.results.length > 180 || (group.nextOffset !== null && (!Number.isInteger(group.nextOffset) || group.nextOffset < 0)))) return null;
  return data as unknown as NativeDiscoveryResponse;
}
