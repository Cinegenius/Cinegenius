export const MAX_COMPANY_GALLERY_IMAGES = 12;

export function moveCompanyGalleryImage(images: string[], from: number, to: number): string[] {
  if (from < 0 || to < 0 || from >= images.length || to >= images.length || from === to) return images;
  const result = [...images];
  const [image] = result.splice(from, 1);
  result.splice(to, 0, image);
  return result;
}

export function isCompanyImageUrlOwnedByUser(url: string, userId: string, supabaseUrl: string): boolean {
  try {
    const parsed = new URL(url);
    const storageOrigin = new URL(supabaseUrl).origin;
    if (parsed.origin !== storageOrigin) return false;
    const path = decodeURIComponent(parsed.pathname);
    return path.startsWith(`/storage/v1/object/public/listing-images/${userId}/`);
  } catch {
    return false;
  }
}

export function canPersistCompanyImages(
  candidateUrls: unknown,
  previouslySavedUrls: unknown,
  userId: string,
  supabaseUrl: string,
): candidateUrls is string[] {
  if (!Array.isArray(candidateUrls)) return false;
  const previousUrls = Array.isArray(previouslySavedUrls) ? previouslySavedUrls.filter((url): url is string => typeof url === "string") : [];
  // Preserve legacy galleries above today's upload limit while still preventing
  // additions until the gallery is reduced to the supported size.
  if (candidateUrls.length > Math.max(MAX_COMPANY_GALLERY_IMAGES, previousUrls.length)) return false;
  const previous = new Set(previousUrls);
  return candidateUrls.every((url) => typeof url === "string" && url.length <= 2048 && (previous.has(url) || isCompanyImageUrlOwnedByUser(url, userId, supabaseUrl)));
}
