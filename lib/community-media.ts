import { protectedMediaKey } from "./protected-media";
export const COMMUNITY_ALLOWED_SOURCE_TYPES = ["profile", "company"] as const;
export const COMMUNITY_IMAGE_LABELS: Record<string, string> = {
  profile: "Portfolio / Arbeitsprobe", company: "Firmenfoto",
};
export type CommunityMediaRow = {
  source_type: string; source_id: string; owner_id: string | null; author: string;
  author_href: string | null; source_href: string; source_label: string;
  image_url: string; caption: string; media_type: string; uploaded_at: string; storage_id: string;
};
export function communityMediaLabel(row: Pick<CommunityMediaRow, "source_type" | "media_type">) {
  if (row.media_type === "floor_plan") return "Location-Grundriss";
  if (row.media_type === "production") return "Produktionsfoto / Referenz";
  if (row.media_type === "logo") return "Firmenlogo";
  if (row.media_type === "avatar" || row.media_type === "headshot") return "Profilfoto";
  if (row.media_type === "cover") return row.source_type === "company" ? "Firmen-Titelbild" : "Profil-Titelbild";
  return COMMUNITY_IMAGE_LABELS[row.source_type] ?? "Öffentliches Foto";
}
export function isOwnPublicStorageUrl(value: string, origin: string) {
  if (protectedMediaKey(value)) return true;
  try { const url = new URL(value); return url.origin === new URL(origin).origin && url.pathname.startsWith("/storage/v1/object/public/") && !url.searchParams.has("token"); } catch { return false; }
}
export function communityPhotoFromRow(row: CommunityMediaRow) {
  return {
    profileId: row.owner_id ?? `media:${row.source_id}`, profileSlug: row.owner_id ?? "",
    author: row.author, authorHref: row.author_href, sourceHref: row.source_href, sourceTitle: row.source_label,
    imageKind: communityMediaLabel(row), imageUrl: row.image_url,
    caption: row.caption, fit: row.media_type === "logo" ? "contain" as const : "cover" as const,
    canRate: row.source_type === "profile" && !["avatar", "headshot", "cover"].includes(row.media_type),
    uploadedAt: row.uploaded_at, canLike: Boolean(row.owner_id), rating: 0, count: 0,
  };
}
