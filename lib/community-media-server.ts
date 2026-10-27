import "server-only";
import { db } from "@/lib/db";
import { COMMUNITY_ALLOWED_SOURCE_TYPES, communityPhotoFromRow, isOwnPublicStorageUrl, type CommunityMediaRow } from "@/lib/community-media";

export async function getCommunityMedia({ page = 1, limit = 48, ownerId, imageUrl, viewerId = null, diverse = false }: { page?: number; limit?: number; ownerId?: string; imageUrl?: string; viewerId?: string | null; diverse?: boolean } = {}) {
  let query = db.from("public_community_media").select("*", { count: "exact" }).in("source_type", [...COMMUNITY_ALLOWED_SOURCE_TYPES]);
  if (diverse) query = query.order("contributor_rank", { ascending: true });
  query = query.order("uploaded_at", { ascending: false }).order("storage_id", { ascending: false });
  if (ownerId) query = query.eq("owner_id", ownerId);
  if (imageUrl) query = query.eq("image_url", imageUrl);
  const safeLimit = Math.max(1, Math.min(limit, 100));
  const { data, error, count } = await query.range((Math.max(1, page) - 1) * safeLimit, Math.max(1, page) * safeLimit - 1);
  if (error) throw new Error("Öffentliche Einblicke konnten nicht geladen werden.");
  const media = ((data ?? []) as CommunityMediaRow[])
    .filter((row) => isOwnPublicStorageUrl(row.image_url, process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""));
  const companyIds = [...new Set(media.filter((row) => row.source_type === "company" && row.media_type === "logo").map((row) => row.source_id))];
  const photos = media.map(communityPhotoFromRow);
  const owners = [...new Set(photos.filter((p) => p.canLike).map((p) => p.profileId))];
  const [companyResult, { data: likes, error: likesError }] = await Promise.all([
    companyIds.length ? db.from("companies").select("id,logo_background").in("id", companyIds).eq("published", true) : Promise.resolve({ data: [], error: null }),
    owners.length ? db.from("profile_image_likes").select("profile_id,image_url,liker_id").in("profile_id", owners).in("image_url", photos.map((p) => p.imageUrl)) : Promise.resolve({ data: [], error: null }),
  ]);
  if (companyResult.error) throw new Error("Öffentliche Einblicke konnten nicht geladen werden.");
  const backgrounds = new Map((companyResult.data ?? []).map((company) => [company.id, company.logo_background]));
  if (likesError) throw new Error("Foto-Likes konnten nicht geladen werden.");
  return { total: count ?? 0, photos: photos.map((photo, index) => {
    const rows = (likes ?? []).filter((like) => like.profile_id === photo.profileId && like.image_url === photo.imageUrl);
    return { ...photo, logoBackground: media[index]?.media_type === "logo" ? backgrounds.get(media[index].source_id) ?? "auto" : undefined, likeCount: rows.length, likedByMe: rows.some((like) => like.liker_id === viewerId) };
  }) };
}

export async function resolvePublicCommunityPhoto(ownerId: string, imageUrl: string) {
  const { photos } = await getCommunityMedia({ ownerId, imageUrl, limit: 1 });
  return photos[0] ?? null;
}
