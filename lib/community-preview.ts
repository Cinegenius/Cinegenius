/** Display URL only. Likes and photo links continue to use the original media identity. */
export function communityPreviewUrl(imageUrl: string, size: "thumbnail" | "detail" = "thumbnail") {
  return `/api/community-image?${new URLSearchParams({ image: imageUrl, size })}`;
}
