import "server-only";
import { db } from "@/lib/db";
import { collectFacetRows } from "@/lib/browse-facets";
import { orderHomeCrew } from "@/lib/home-crew-selection";
import { profileAccessFor } from "@/lib/profile-privacy-server";
import { projectProfilePrivacy } from "@/lib/profile-privacy";
import { isPeopleDirectoryProfile } from "@/lib/profile-provider-filters";
import type { OccupationProfile } from "@/lib/crew-occupations";

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
  created_at?: string | null;
};
const CARD_FIELDS = "user_id,slug,display_name,tagline,avatar_url,location,verified,role,positions,crew,profile_type,profile_types,created_at";
const CARD_BATCH = 32;

export async function homeCrewProfiles(now: number): Promise<{ data: HomeCrewProfile[]; error: null }> {
  const signal = AbortSignal.timeout(8000);
  // Read only IDs and registration dates across the pool. A newest-300 cap would
  // permanently exclude older members even when the visible selection rotates.
  const pool = await collectFacetRows<{ user_id: string; created_at: string | null }>((from, to) => db.from("profiles")
    .select("user_id,created_at").not("display_name", "is", null).neq("display_name", "")
    .order("user_id").range(from, to).abortSignal(signal), 500);
  const candidates = orderHomeCrew(pool, now);
  const selected: HomeCrewProfile[] = [];
  for (let from = 0; from < candidates.length && selected.length < 10; from += CARD_BATCH) {
    const ids = candidates.slice(from, from + CARD_BATCH).map(row => row.user_id);
    const result = await db.from("profiles").select(CARD_FIELDS).in("user_id", ids)
      .not("display_name", "is", null).neq("display_name", "").abortSignal(signal);
    if (result.error) throw new Error("Homepage people unavailable", { cause: result.error });
    const rows = (result.data ?? []) as HomeCrewProfile[];
    const privacy = await profileAccessFor(rows.map(row => row.user_id), null, { signal, throwOnError: true });
    const byId = new Map(rows.map(row => [row.user_id, row]));
    for (const id of ids) {
      const row = byId.get(id), access = privacy.get(id);
      if (!row || !row.display_name?.trim() || !access?.profile) continue;
      const projected = projectProfilePrivacy(row, access);
      if (!isPeopleDirectoryProfile(projected)) continue;
      selected.push(projected);
      if (selected.length === 10) break;
    }
  }
  return { data: selected, error: null };
}
