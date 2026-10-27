import "server-only";
import { db } from "@/lib/db";

/** Blocked sources are excluded before community pagination and file access. */
export async function blockedMediaOwnerIds(viewerId: string | null): Promise<string[]> {
  if (!viewerId) return [];
  const [outgoing, incoming] = await Promise.all([
    db.from("blocks").select("blocked_id").eq("blocker_id", viewerId),
    db.from("blocks").select("blocker_id").eq("blocked_id", viewerId),
  ]);
  if (outgoing.error || incoming.error) throw new Error("Media block lookup unavailable");
  return [...new Set([...(outgoing.data ?? []).map(row => row.blocked_id), ...(incoming.data ?? []).map(row => row.blocker_id)])];
}

/** Batch current source permissions before fetching linked identities. No shared cache. */
export async function visibleLinkedProfileIds(ids: Array<string | null>, viewerId: string | null = null) {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (!unique.length) return new Set<string>();
  const own = new Set(unique.filter((id) => id === viewerId));
  const empty = { data: [], error: null };
  const [settings, blockedBy, blocks, friendsFrom, friendsTo] = await Promise.all([
    db.from("user_settings").select("user_id, profile_visibility").in("user_id", unique),
    viewerId ? db.from("blocks").select("blocker_id").in("blocker_id", unique).eq("blocked_id", viewerId) : empty,
    viewerId ? db.from("blocks").select("blocked_id").in("blocked_id", unique).eq("blocker_id", viewerId) : empty,
    viewerId ? db.from("friendships").select("receiver_id").eq("sender_id", viewerId).eq("status", "accepted").in("receiver_id", unique) : empty,
    viewerId ? db.from("friendships").select("sender_id").eq("receiver_id", viewerId).eq("status", "accepted").in("sender_id", unique) : empty,
  ]);
  if ([settings, blockedBy, blocks, friendsFrom, friendsTo].some((result) => result.error)) return own;
  const privateIds = new Set((settings.data ?? []).filter((row) => row.profile_visibility === "private").map((row) => row.user_id));
  const blocked = new Set([...(blockedBy.data ?? []).map((row) => row.blocker_id), ...(blocks.data ?? []).map((row) => row.blocked_id)]);
  const friends = new Set([...(friendsFrom.data ?? []).map((row) => row.receiver_id), ...(friendsTo.data ?? []).map((row) => row.sender_id)]);
  return new Set(unique.filter((id) => id === viewerId || (!blocked.has(id) && (!privateIds.has(id) || friends.has(id)))));
}
