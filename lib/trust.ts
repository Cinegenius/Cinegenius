import { visibleLinkedProfileIds } from "@/lib/linked-profile-access";
import "server-only";
import { db } from "@/lib/db";
import { normalizeContactVisibility, type ProfileContactVisibility } from "@/lib/contact-visibility";

const HIDDEN_CONTACTS: ProfileContactVisibility = { phone: "hidden", contact_email: "hidden" };

/** Resolve per-field contact consent. Owners can always see their own values. */
export async function getProfileContactVisibility(
  ownerId: string,
): Promise<ProfileContactVisibility> {
  const { data, error } = await db
    .from("user_settings")
    .select("phone_visibility, contact_email_visibility")
    .eq("user_id", ownerId)
    .maybeSingle();

  if (error) {
    // Fail closed if settings or the new columns are unavailable during rollout.
    console.error("[profile contact visibility] settings lookup failed:", error.message);
    return HIDDEN_CONTACTS;
  }

  return {
    phone: normalizeContactVisibility(data?.phone_visibility),
    contact_email: normalizeContactVisibility(data?.contact_email_visibility),
  };
}

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
  return Boolean(ab.error || ba.error || ab.data || ba.data);
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
  return (await visibleLinkedProfileIds([ownerId], viewerId)).has(ownerId);
}

/** Private profiles stay out of public crew discovery, even if their link is known. */
export async function getPrivateProfileIds(userIds: string[]): Promise<Set<string>> {
  const uniqueIds = [...new Set(userIds)];
  if (uniqueIds.length === 0) return new Set();

  const { data, error } = await db
    .from("user_settings")
    .select("user_id, profile_visibility")
    .in("user_id", uniqueIds);


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
