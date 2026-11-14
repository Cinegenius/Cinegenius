import "server-only";
import { db } from "@/lib/db";
import { HIDDEN_PROFILE_ACCESS, PRIVACY_COLUMNS, profileAccess, type PrivacySettings, type ProfileAccess } from "@/lib/profile-privacy";

/** Request-local decisions only. Unknown permissions fail closed, including fields. */
export async function profileAccessFor(ids: string[], viewerId: string | null = null, options: { signal?: AbortSignal; throwOnError?: boolean } = {}): Promise<Map<string, ProfileAccess>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map();
  const empty = { data: [], error: null };
  const signal = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000);
  const [settings, incoming, outgoing, friendsFrom, friendsTo] = await Promise.all([
    db.from("user_settings").select(`user_id,${PRIVACY_COLUMNS}`).in("user_id", unique).abortSignal(signal),
    viewerId ? db.from("blocks").select("blocker_id").in("blocker_id", unique).eq("blocked_id", viewerId).abortSignal(signal) : empty,
    viewerId ? db.from("blocks").select("blocked_id").in("blocked_id", unique).eq("blocker_id", viewerId).abortSignal(signal) : empty,
    viewerId ? db.from("friendships").select("receiver_id").eq("sender_id", viewerId).eq("status", "accepted").in("receiver_id", unique).abortSignal(signal) : empty,
    viewerId ? db.from("friendships").select("sender_id").eq("receiver_id", viewerId).eq("status", "accepted").in("sender_id", unique).abortSignal(signal) : empty,
  ]);
  if ([settings, incoming, outgoing, friendsFrom, friendsTo].some(result => result.error)) {
    if (options.throwOnError) throw new Error("Profile permissions unavailable");
    return new Map(unique.map(id => [id, id === viewerId ? profileAccess(null, id, viewerId) : HIDDEN_PROFILE_ACCESS]));
  }
  const byId = new Map((settings.data ?? []).map(row => [row.user_id, row as Partial<PrivacySettings>]));
  const blocked = new Set([...(incoming.data ?? []).map(row => row.blocker_id), ...(outgoing.data ?? []).map(row => row.blocked_id)]);
  const friends = new Set([...(friendsFrom.data ?? []).map(row => row.receiver_id), ...(friendsTo.data ?? []).map(row => row.sender_id)]);
  return new Map(unique.map(id => [id, profileAccess(byId.get(id) ?? null, id, viewerId, friends.has(id), blocked.has(id))]));
}

/** Ghost also hides explicitly public personal contact snapshots on company offers. */
export async function ghostProfileIds(ids: string[]): Promise<Set<string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Set();
  const {data,error} = await db.from("user_settings").select("user_id,ghost_mode").in("user_id",unique).abortSignal(AbortSignal.timeout(8000));
  if (error) return new Set(unique);
  return new Set((data ?? []).filter(row => row.ghost_mode).map(row => row.user_id));
}

/** Fresh authorization after any cached listing content, including known direct URLs. */
export async function publicListingIds(ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const {data,error} = await db.from("privacy_visible_listings").select("id").in("id", [...new Set(ids)]).abortSignal(AbortSignal.timeout(8000));
  if (error) throw new Error("Listing privacy lookup unavailable");
  return new Set((data ?? []).map(row => row.id));
}

export async function filterPublicListings<T extends {id: string}>(rows: T[]): Promise<T[]> {
  const ids = await publicListingIds(rows.map(row => row.id));
  return rows.filter(row => ids.has(row.id));
}
