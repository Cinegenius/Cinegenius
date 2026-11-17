import "server-only";
import { db } from "@/lib/db";
import { blockedMediaOwnerIds } from "@/lib/linked-profile-access";
import { COMMUNITY_ALLOWED_SOURCE_TYPES, communityPhotoFromRow, isOwnPublicStorageUrl, type CommunityMediaRow } from "@/lib/community-media";

export async function getCommunityMedia({ page = 1, limit = 48, ownerId, imageUrl, viewerId = null, diverse = false, includeTotal = true, randomSeed, signal }: { page?: number; limit?: number; ownerId?: string; imageUrl?: string; viewerId?: string | null; diverse?: boolean; includeTotal?: boolean; randomSeed?: string; signal?: AbortSignal } = {}) {
  let query = db.from("public_community_media").select("*", includeTotal ? { count: "exact" } : undefined).in("source_type", [...COMMUNITY_ALLOWED_SOURCE_TYPES]);
  if (signal) query = query.abortSignal(signal);
  const blocked = await blockedMediaOwnerIds(viewerId, signal);
  if (blocked.length) query = query.not("owner_id", "in", `(${blocked.map(id => JSON.stringify(id)).join(",")})`);
  if (diverse) query = query.order("contributor_rank", { ascending: true });
  query = query.order("uploaded_at", { ascending: false }).order("storage_id", { ascending: false });
  if (ownerId) query = query.eq("owner_id", ownerId);
  if (imageUrl) query = query.eq("image_url", imageUrl);
  const safeLimit = Math.max(1, Math.min(limit, 100));
  const offset = (Math.max(1, page) - 1) * safeLimit;
  let data: CommunityMediaRow[] | null;
  let count: number | null;
  if (randomSeed && !ownerId && !imageUrl) {
    let randomQuery = db.rpc("random_community_media", { p_seed: randomSeed, p_offset: offset, p_limit: safeLimit, p_blocked_owners: blocked, p_include_total: includeTotal, p_media_origin: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "" });
    if (signal) randomQuery = randomQuery.abortSignal(signal);
    const result = await randomQuery;
    if (result.error || !Array.isArray(result.data?.rows) || !Number.isFinite(result.data?.total)) throw new Error("Öffentliche Einblicke konnten nicht geladen werden.");
    data = result.data.rows;
    count = result.data.total;
  } else {
    const result = await query.range(offset, offset + safeLimit - 1);
    if (result.error) throw new Error("Öffentliche Einblicke konnten nicht geladen werden.");
    data = result.data;
    count = result.count;
  }
  const photos = ((data ?? []) as CommunityMediaRow[])
    .filter((row) => isOwnPublicStorageUrl(row.image_url, process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""))
    .map(communityPhotoFromRow);
  const owners = [...new Set(photos.filter((p) => p.canLike).map((p) => p.profileId))];
  let likesQuery = owners.length ? db.from("profile_image_likes")
    .select("profile_id,image_url,liker_id").in("profile_id", owners).in("image_url", photos.map((p) => p.imageUrl)) : null;
  if (likesQuery && signal) likesQuery = likesQuery.abortSignal(signal);
  const { data: likes, error: likesError } = likesQuery ? await likesQuery : { data: [], error: null };
  if (likesError) throw new Error("Foto-Likes konnten nicht geladen werden.");
  return { total: count ?? 0, photos: photos.map((photo) => {
    const rows = (likes ?? []).filter((like) => like.profile_id === photo.profileId && like.image_url === photo.imageUrl);
    return { ...photo, likeCount: rows.length, likedByMe: rows.some((like) => like.liker_id === viewerId) };
  }) };
}

export async function resolvePublicCommunityPhoto(ownerId: string, imageUrl: string) {
  const { photos } = await getCommunityMedia({ ownerId, imageUrl, limit: 1, includeTotal: false });
  return photos[0] ?? null;
}
