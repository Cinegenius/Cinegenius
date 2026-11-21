import "server-only";
import { db } from "@/lib/db";
import { PRIVACY_COLUMNS, profileAccess, type PrivacySettings, type ProfileAccess } from "@/lib/profile-privacy";

const RELATION_PAGE = 200;
type Relationship = { table: "blocks" | "friendships"; viewer: string; other: string };

/** Only the caller's complete relationship sets; fixed-size keyset pages keep URLs short. */
async function relationshipIds(direction: Relationship, viewerId: string, signal: AbortSignal) {
  const ids = new Set<string>();
  let after: string | null = null;
  for (;;) {
    signal.throwIfAborted();
    let query = db.from(direction.table).select(`id,${direction.other}`).eq(direction.viewer, viewerId).order("id").range(0, RELATION_PAGE - 1);
    if (direction.table === "friendships") query = query.eq("status", "accepted");
    if (after) query = query.gt("id", after);
    const { data, error } = await query.abortSignal(signal);
    signal.throwIfAborted();
    if (error) throw new Error("Profile permissions unavailable");
    const rows = (data ?? []) as unknown as Record<string, unknown>[];
    // Continue to an empty keyset page, even when the API caps a response below
    // our requested size. A short nonempty page is not proof of completeness.
    if (!rows.length) return ids;
    for (const row of rows) {
      if (typeof row.id !== "string" || !row.id || typeof row[direction.other] !== "string" || !row[direction.other]) throw new Error("Profile permissions unavailable");
      ids.add(row[direction.other] as string);
    }
    const lastId = rows[rows.length - 1].id as string;
    // A malformed/unadvanced page cannot be mistaken for a complete permission set.
    if (after && lastId <= after) throw new Error("Profile permissions unavailable");
    after = lastId;
  }
}

/** Create inside one validated native-discovery request, never share across requests/accounts. */
export function createNativeDiscoveryProfileAccess(viewerId: string | null, requestSignal: AbortSignal) {
  let relationships: Promise<{ blocked: Set<string>; friends: Set<string> }> | undefined;
  const readRelationships = () => relationships ??= (async () => {
    if (!viewerId) return { blocked: new Set<string>(), friends: new Set<string>() };
    const signal = AbortSignal.any([requestSignal, AbortSignal.timeout(8000)]);
    const [incoming, outgoing, from, to] = await Promise.all([
      relationshipIds({ table: "blocks", viewer: "blocked_id", other: "blocker_id" }, viewerId, signal),
      relationshipIds({ table: "blocks", viewer: "blocker_id", other: "blocked_id" }, viewerId, signal),
      relationshipIds({ table: "friendships", viewer: "sender_id", other: "receiver_id" }, viewerId, signal),
      relationshipIds({ table: "friendships", viewer: "receiver_id", other: "sender_id" }, viewerId, signal),
    ]);
    return { blocked: new Set([...incoming, ...outgoing]), friends: new Set([...from, ...to]) };
  })();

  return async (ids: string[]): Promise<Map<string, ProfileAccess>> => {
    requestSignal.throwIfAborted();
    const unique = [...new Set(ids.filter(Boolean))];
    if (!unique.length) return new Map();
    const signal = AbortSignal.any([requestSignal, AbortSignal.timeout(8000)]);
    const [settings, { blocked, friends }] = await Promise.all([
      db.from("user_settings").select(`user_id,${PRIVACY_COLUMNS}`).in("user_id", unique).abortSignal(signal),
      readRelationships(),
    ]);
    signal.throwIfAborted();
    if (settings.error) throw new Error("Profile permissions unavailable");
    const byId = new Map((settings.data ?? []).map(row => [row.user_id, row as Partial<PrivacySettings>]));
    return new Map(unique.map(id => [id, profileAccess(byId.get(id) ?? null, id, viewerId, friends.has(id), blocked.has(id))]));
  };
}
