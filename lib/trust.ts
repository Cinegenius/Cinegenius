import "server-only";
import { db } from "@/lib/db";

/**
 * Returns true if `blockerId` has blocked `blockedId`.
 * Used for single-direction checks inside API guards.
 */
export async function isBlockedBy(blockedId: string, blockerId: string): Promise<boolean> {
  const { data } = await db
    .from("blocks")
    .select("id")
    .eq("blocker_id", blockerId)
    .eq("blocked_id", blockedId)
    .maybeSingle();
  return !!data;
}

/**
 * Returns true if either party has blocked the other.
 * Uses two safe .eq() queries instead of .or() interpolation.
 */
export async function anyBlockExists(userA: string, userB: string): Promise<boolean> {
  const [ab, ba] = await Promise.all([
    db.from("blocks").select("id").eq("blocker_id", userA).eq("blocked_id", userB).maybeSingle(),
    db.from("blocks").select("id").eq("blocker_id", userB).eq("blocked_id", userA).maybeSingle(),
  ]);
  return !!(ab.data ?? ba.data);
}

/** Returns true only for an accepted friendship in either direction. */
export async function areAcceptedFriends(userA: string, userB: string): Promise<boolean> {
  const [ab, ba] = await Promise.all([
    db.from("friendships").select("id").eq("sender_id", userA).eq("receiver_id", userB).eq("status", "accepted").maybeSingle(),
    db.from("friendships").select("id").eq("sender_id", userB).eq("receiver_id", userA).eq("status", "accepted").maybeSingle(),
  ]);
  return !!(ab.data ?? ba.data);
}

/** Whether the current viewer may open a profile under its saved privacy setting. */
export async function canViewProfile(ownerId: string, viewerId: string | null): Promise<boolean> {
  if (viewerId === ownerId) return true;

  const { data: settings, error } = await db
    .from("user_settings")
    .select("profile_visibility")
    .eq("user_id", ownerId)
    .maybeSingle();

  // Before the settings table exists, profiles retain the historical public default.
  if (error && (error.code === "42P01" || error.code === "PGRST205")) return true;
  if (error) {
    console.error("[profile visibility] settings lookup failed:", error.message);
    return false;
  }

  if (settings?.profile_visibility !== "private") return true;
  return viewerId ? areAcceptedFriends(viewerId, ownerId) : false;
}

/** Private profiles stay out of public crew discovery, even if their link is known. */
export async function getPrivateProfileIds(userIds: string[]): Promise<Set<string>> {
  const uniqueIds = [...new Set(userIds)];
  if (uniqueIds.length === 0) return new Set();

  const { data, error } = await db
    .from("user_settings")
    .select("user_id, profile_visibility")
    .in("user_id", uniqueIds);

  if (error && (error.code === "42P01" || error.code === "PGRST205")) return new Set();
  if (error) {
    console.error("[profile visibility] discovery lookup failed:", error.message);
    return new Set(uniqueIds);
  }

  return new Set((data ?? []).filter((setting) => setting.profile_visibility === "private").map((setting) => setting.user_id));
}

/**
 * Returns both directions for the profile page.
 * Uses two safe .eq() queries instead of .or() interpolation.
 */
export async function getBlockStatus(
  userId: string,
  otherId: string
): Promise<{ youBlocked: boolean; theyBlocked: boolean }> {
  const [you, they] = await Promise.all([
    db.from("blocks").select("id").eq("blocker_id", userId).eq("blocked_id", otherId).maybeSingle(),
    db.from("blocks").select("id").eq("blocker_id", otherId).eq("blocked_id", userId).maybeSingle(),
  ]);
  return { youBlocked: !!you.data, theyBlocked: !!they.data };
}
