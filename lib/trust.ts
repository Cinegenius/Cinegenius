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
