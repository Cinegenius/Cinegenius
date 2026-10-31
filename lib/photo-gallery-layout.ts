// Choose a stable preview frame before image decoding. Unknown legacy dimensions
// must not rebalance the masonry columns as each lazy image finishes loading.
// The image itself remains contained, so this never crops or distorts originals.
const PHOTO_PREVIEW_RATIOS = ["4 / 5", "1 / 1", "4 / 3", "3 / 4", "3 / 2"] as const;

export function galleryPreviewAspectRatio(photo: { imageUrl: string; fit?: "contain" | "cover" }): string {
  if (photo.fit === "contain") return "4 / 3";
  let hash = 0;
  for (let index = 0; index < photo.imageUrl.length; index++) {
    hash = (Math.imul(hash, 31) + photo.imageUrl.charCodeAt(index)) >>> 0;
  }
  return PHOTO_PREVIEW_RATIOS[hash % PHOTO_PREVIEW_RATIOS.length];
}
