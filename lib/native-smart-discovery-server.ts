import "server-only";
import { db } from "@/lib/db";
import { selectedCrewOccupations } from "@/lib/crew-occupations";
import { publicMapPoint } from "@/lib/places/public-map-point";
import { PLACE_COLUMNS, cityName } from "@/lib/places/core";
import { executeUnifiedSearch } from "@/lib/unified-search-server";
import { isDiscoverySeed } from "./discovery-seed";
import { NATIVE_DISCOVERY_CONTRACT, nativeDiscoveryPlan, rankNativeDiscoveryGroups, type NativeDiscoveryMode, type NativeDiscoveryFocus, type NativeDiscoveryResponse } from "./native-smart-discovery";

/** Only the authenticated account's explicit saved occupations and verified city. */
async function discoveryFocus(accountId: string, locale: string, mode: NativeDiscoveryMode, signal: AbortSignal) {
  let focus: NativeDiscoveryFocus = { mode: "neutral", departments: [], city: null };
  let origin: { lat: number; lng: number } | null = null;
  if (mode === "profile") {
    const { data, error } = await db.from("profiles").select(`positions,role,crew,${PLACE_COLUMNS}`).eq("user_id", accountId).abortSignal(signal).maybeSingle();
    if (error) throw new Error("unavailable");
    if (data) {
      const departments = [...new Set(selectedCrewOccupations(Array.isArray(data.positions) ? data.positions : [], data.crew?.occupations, data.role, data.crew?.primaryOccupation).map(role => role.departmentId))];
      const point = publicMapPoint(data);
      const city = point.lat !== null && point.lng !== null && data.place_status === "verified" && data.place_city_id && typeof data.place_city_name === "string"
        ? cityName(data.place_city_id, data.place_city_name, locale) : null;
      if (point.lat !== null && point.lng !== null) origin = { lat: point.lat, lng: point.lng };
      if (departments.length || city) focus = { mode: "profile", departments, city };
    }
  }
  return { focus, origin };
}

/** The caller has freshly verified the account and existing Smart permission.
 * Focus is soft ordering only, so it need not delay the independent search.
 * Maps retain their existing explicit, permission-checked Unified Search load. */
export async function nativeDiscoveryForAccount(accountId: string, locale: string, mode: NativeDiscoveryMode, signal: AbortSignal, seed?: string): Promise<NativeDiscoveryResponse> {
  if (signal.aborted) throw new Error("unavailable");
  if (seed !== undefined && !isDiscoverySeed(seed)) throw new Error("invalid_request");
  const controller = new AbortController();
  const activeSignal = AbortSignal.any([signal, controller.signal]);
  const plan = nativeDiscoveryPlan();
  try {
    // Initial cards/list use the shared 12-result pages and real cursors. Keep
    // all current visibility checks inside executeUnifiedSearch unchanged.
    const [{ focus, origin }, { groups }] = await Promise.all([
      discoveryFocus(accountId, locale, mode, activeSignal),
      executeUnifiedSearch(plan, locale, accountId, activeSignal, undefined, "list", seed, { version: 1 }),
    ]);
    if (activeSignal.aborted) throw new Error("unavailable");
    return { contract: NATIVE_DISCOVERY_CONTRACT, accountId, serverNow: new Date().toISOString(), focus,
      plan, groups: rankNativeDiscoveryGroups(groups, focus, origin), ...(seed ? { seed } : {}) };
  } catch (error) {
    controller.abort();
    throw error;
  }
}
