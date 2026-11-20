import "server-only";
import { db } from "@/lib/db";
import { protectedMediaKey, protectedMediaUrl } from "@/lib/protected-media";
import { NEWS_GALLERY_LIMIT, parseNewsGallery } from "@/lib/news-gallery";

export type OrganizationMediaSource = "organization" | "organization_entry";

export async function validateOrganizationMediaReference(
  value: unknown,
  ownerUserId: string,
  sourceType: OrganizationMediaSource,
  sourceId: string,
) {
  if (value === null || value === undefined || value === "") return { url: null as string | null };
  if (typeof value !== "string") return { error: "media" as const };

  const key = protectedMediaKey(value.trim());
  if (!key) return { error: "media" as const };
  const referenceUrl = protectedMediaUrl(key);
  const { data, error } = await db
    .from("media_assets")
    .select("owner_user_id,source_type,source_id")
    .eq("storage_path", key)
    .eq("reference_url", referenceUrl)
    .maybeSingle();
  if (error || !data) return { error: "media" as const };

  const ownedUpload = data.owner_user_id === ownerUserId && data.source_type === null && data.source_id === null;
  const existingAssignment = data.source_type === sourceType && data.source_id === sourceId;
  if (!ownedUpload && !existingAssignment) return { error: "media" as const };
  return { url: referenceUrl };
}

export async function validateNewsGallery(value: unknown, ownerUserId: string, entryId: string, cover: string | null) {
  if (value === undefined) return { gallery: undefined };
  const gallery = parseNewsGallery(value);
  if (!gallery || new Set([...(cover ? [cover] : []), ...gallery.map(image => image.url)]).size > NEWS_GALLERY_LIMIT) return { error: "media" as const };
  for (const image of gallery) {
    const checked = await validateOrganizationMediaReference(image.url, ownerUserId, "organization_entry", entryId);
    if (checked.error) return { error: "media" as const };
  }
  return { gallery };
}
