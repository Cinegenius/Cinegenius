export type PublicProfilePhotoSource = {
  user_id: string;
  slug?: string | null;
  display_name?: string | null;
  profile_images?: unknown;
  portfolio_images?: unknown;
};

export type PublicProfilePhoto = {
  profileId: string;
  profileSlug: string;
  author: string;
  imageUrl: string;
  caption: string;
  rating: number;
  count: number;
};

const APPROVED_GALLERY_TYPES = new Set(["fullbody", "editorial", "polaroid", "bts", "portfolio", "set_photo", "product"]);

function isUploadedPublicImage(url: unknown): url is string {
  if (typeof url !== "string") return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname.endsWith(".supabase.co") && parsed.pathname.includes("/storage/v1/object/");
  } catch {
    return false;
  }
}

export function extractPublicProfilePhotos(profiles: readonly PublicProfilePhotoSource[]): PublicProfilePhoto[] {
  const candidates: PublicProfilePhoto[] = [];
  for (const profile of profiles) {
    const seen = new Set<string>();
    const images = Array.isArray(profile.profile_images) ? profile.profile_images : [];
    for (const raw of images) {
      if (!raw || typeof raw !== "object") continue;
      const image = raw as { url?: unknown; caption?: unknown; media_type?: unknown };
      const mediaType = typeof image.media_type === "string" ? image.media_type : "";
      if (mediaType === "headshot" || (mediaType && !APPROVED_GALLERY_TYPES.has(mediaType))) continue;
      if (!isUploadedPublicImage(image.url) || seen.has(image.url)) continue;
      seen.add(image.url);
      candidates.push({
        profileId: profile.user_id,
        profileSlug: profile.slug || profile.user_id,
        author: profile.display_name?.trim() || "CineGenius Mitglied",
        imageUrl: image.url,
        caption: typeof image.caption === "string" ? image.caption.trim() : "",
        rating: 0,
        count: 0,
      });
    }
    const portfolioImages = Array.isArray(profile.portfolio_images) ? profile.portfolio_images : [];
    for (const url of portfolioImages) {
      if (!isUploadedPublicImage(url) || seen.has(url)) continue;
      seen.add(url);
      candidates.push({
        profileId: profile.user_id,
        profileSlug: profile.slug || profile.user_id,
        author: profile.display_name?.trim() || "CineGenius Mitglied",
        imageUrl: url,
        caption: "Portfolio",
        rating: 0,
        count: 0,
      });
    }
  }
  return candidates;
}
