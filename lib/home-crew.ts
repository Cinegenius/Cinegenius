import "server-only";
import { db } from "@/lib/db";
import { collectFacetRows } from "@/lib/browse-facets";
import { orderHomeCrew } from "@/lib/home-crew-selection";
import { profileAccessFor } from "@/lib/profile-privacy-server";
import { projectProfilePrivacy } from "@/lib/profile-privacy";
import { isPeopleDirectoryProfile } from "@/lib/profile-provider-filters";
import type { OccupationProfile } from "@/lib/crew-occupations";
import type { BrowsePlace } from "@/lib/browse-geography";

export type HomeCrewProfile = {
  user_id: string;
  slug: string | null;
  display_name: string | null;
  tagline: string | null;
  avatar_url: string | null;
  location: string | null;
  verified: boolean | null;
  role: string | null;
  positions: string[] | null;
  crew?: OccupationProfile["crew"];
  profile_type: string | null;
  profile_types: string[] | null;
};
const CARD_FIELDS = "user_id,slug,display_name,tagline,avatar_url,location,verified,role,positions,crew,profile_type,profile_types";
const CARD_BATCH = 32;

export async function homeCrewProfiles(now: number, preferred: BrowsePlace | null = null): Promise<{ data: HomeCrewProfile[]; error: null }> {
  const signal = AbortSignal.timeout(8000);
  // Read a thin index across the pool. A newest-300 cap would
  // permanently exclude older members even when the visible selection rotates.
  const pool = await collectFacetRows<{ user_id: string }>((from, to) => {
    const table = db.from("profiles");
    const query = preferred
      ? table.select("user_id,place_country_code,place_region_id,place_city_id")
      : table.select("user_id");
    return query.not("display_name", "is", null).neq("display_name", "")
      .order("user_id").range(from, to).abortSignal(signal);
  }, 500);
  const visiblePool: typeof pool = [];
  if (preferred) {
    // Hidden locations may not influence rank. Project permissions before sorting
    // this thin index, then recheck the selected cards immediately before output.
    for (let from = 0; from < pool.length; from += 200) {
      const batch = pool.slice(from, from + 200);
      const access = await profileAccessFor(batch.map(row => row.user_id), null, { signal, throwOnError: true });
      for (const row of batch) {
        const permission = access.get(row.user_id);
        if (permission?.profile) visiblePool.push(projectProfilePrivacy(row, permission));
      }
    }
  }
  const candidates = orderHomeCrew(preferred ? visiblePool : pool, now, preferred);
  const selected: HomeCrewProfile[] = [];
  for (let from = 0; from < candidates.length && selected.length < 10; from += CARD_BATCH) {
    const ids = candidates.slice(from, from + CARD_BATCH).map(row => row.user_id);
    const result = await db.from("profiles").select(CARD_FIELDS).in("user_id", ids)
      .not("display_name", "is", null).neq("display_name", "").abortSignal(signal);
    if (result.error) throw new Error("Homepage people unavailable", { cause: result.error });
    const rows = (result.data ?? []) as HomeCrewProfile[];
    const [privacy, preferences] = await Promise.all([
      profileAccessFor(rows.map(row => row.user_id), null, { signal, throwOnError: true }),
      db.from("user_settings").select("user_id,show_in_home_crew").in("user_id", ids).abortSignal(signal),
    ]);
    if (preferences.error) throw new Error("Homepage crew preferences unavailable", { cause: preferences.error });
    // No settings row is the existing default. Unknown saved values fail closed.
    const excluded = new Set((preferences.data ?? []).filter(row => row.show_in_home_crew !== true).map(row => row.user_id));
    const byId = new Map(rows.map(row => [row.user_id, row]));
    for (const id of ids) {
      const row = byId.get(id), access = privacy.get(id);
      if (!row || !row.display_name?.trim() || !access?.profile || excluded.has(id)) continue;
      const projected = projectProfilePrivacy(row, access);
      if (!isPeopleDirectoryProfile(projected)) continue;
      selected.push(projected);
      if (selected.length === 10) break;
    }
  }
  return { data: selected, error: null };
}
