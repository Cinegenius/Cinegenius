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
 * Used for messaging: block in either direction prevents contact.
 */
export async function anyBlockExists(userA: string, userB: string): Promise<boolean> {
  const { data } = await db
    .from("blocks")
    .select("id")
    .or(
      `and(blocker_id.eq.${userA},blocked_id.eq.${userB}),` +
      `and(blocker_id.eq.${userB},blocked_id.eq.${userA})`
    )
    .limit(1)
    .maybeSingle();
  return !!data;
}

/**
 * Returns both directions for the profile page.
 * youBlocked  — current user blocked the profile owner
 * theyBlocked — profile owner blocked the current user
 */
export async function getBlockStatus(
  userId: string,
  otherId: string
): Promise<{ youBlocked: boolean; theyBlocked: boolean }> {
  const { data } = await db
    .from("blocks")
    .select("blocker_id")
    .or(
      `and(blocker_id.eq.${userId},blocked_id.eq.${otherId}),` +
      `and(blocker_id.eq.${otherId},blocked_id.eq.${userId})`
    );

  const rows = data ?? [];
  return {
    youBlocked:  rows.some((r: { blocker_id: string }) => r.blocker_id === userId),
    theyBlocked: rows.some((r: { blocker_id: string }) => r.blocker_id === otherId),
  };
}
