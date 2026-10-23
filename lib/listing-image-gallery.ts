export const MAX_LISTING_IMAGES = 10;
export const LISTING_GALLERY_PREVIEW_LIMIT = 4;

export type ListingImageGallery = {
  imageUrl: string | null;
  extraImages: string[];
};

export type GalleryValidation =
  | { ok: true; gallery: ListingImageGallery }
  | { ok: false; error: string };

export type ListingGalleryPreview = {
  activeImage: string | null;
  thumbnails: { url: string; index: number }[];
  additionalCount: number;
};

/** Build a bounded preview while keeping every image reachable in the lightbox. */
export function getListingGalleryPreview(
  images: readonly string[],
  activeIndex = 0,
  limit = LISTING_GALLERY_PREVIEW_LIMIT,
): ListingGalleryPreview {
  const uniqueImages = [...new Set(images.filter((url) => typeof url === "string").map((url) => url.trim()).filter(Boolean))];
  if (uniqueImages.length === 0) return { activeImage: null, thumbnails: [], additionalCount: 0 };

  const safeIndex = Math.min(Math.max(activeIndex, 0), uniqueImages.length - 1);
  const thumbnails = uniqueImages
    .map((url, index) => ({ url, index }))
    .filter((image) => image.index !== safeIndex)
    .slice(0, Math.max(0, limit));

  return {
    activeImage: uniqueImages[safeIndex],
    thumbnails,
    additionalCount: Math.max(0, uniqueImages.length - thumbnails.length - 1),
  };
}

/** Keep the database's legacy main-image column as the first image in the gallery. */
export function normalizeListingImageGallery(
  imageUrl: unknown,
  extraImages: unknown,
): GalleryValidation {
  if (imageUrl !== undefined && imageUrl !== null && typeof imageUrl !== "string") {
    return { ok: false, error: "Das Hauptbild ist ungültig." };
  }
  if (extraImages !== undefined && extraImages !== null && !Array.isArray(extraImages)) {
    return { ok: false, error: "Die Bildergalerie ist ungültig." };
  }

  const extras = (Array.isArray(extraImages) ? extraImages : []) as unknown[];
  if (extras.some((url) => typeof url !== "string")) {
    return { ok: false, error: "Die Bildergalerie enthält einen ungültigen Eintrag." };
  }

  const raw = [imageUrl, ...extras]
    .filter((url): url is string => typeof url === "string")
    .map((url) => url.trim())
    .filter(Boolean);
  const urls = [...new Set(raw)];

  if (urls.length > MAX_LISTING_IMAGES) {
    return { ok: false, error: `Pro Artikel sind höchstens ${MAX_LISTING_IMAGES} Bilder erlaubt.` };
  }
  if (urls.some((url) => url.length > 2048)) {
    return { ok: false, error: "Ein Bildlink ist zu lang." };
  }

  return {
    ok: true,
    gallery: {
      imageUrl: urls[0] ?? null,
      extraImages: urls.slice(1),
    },
  };
}

export function moveGalleryImage<T>(images: readonly T[], from: number, to: number): T[] {
  if (from < 0 || from >= images.length || to < 0 || to >= images.length || from === to) {
    return [...images];
  }
  const next = [...images];
  const [image] = next.splice(from, 1);
  next.splice(to, 0, image);
  return next;
}

export function galleryUrlsFromEntries(
  entries: readonly { url?: string | null; status: "ready" | "uploading" | "failed" }[],
): string[] {
  return entries
    .filter((entry) => entry.status === "ready" && typeof entry.url === "string" && entry.url.length > 0)
    .map((entry) => entry.url as string);
}
