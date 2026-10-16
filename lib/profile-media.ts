export const PROFILE_MEDIA_MAX_BYTES = 4 * 1024 * 1024;
export const PROFILE_MEDIA_SOURCE_MAX_BYTES = 20 * 1024 * 1024;
export const PROFILE_MEDIA_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export const PROFILE_MEDIA_ACCEPT = "image/jpeg,image/png,image/webp";

export function validateProfileMediaSource(file: Pick<File, "size" | "type">) {
  if (file.size === 0) return "empty" as const;
  if (file.size > PROFILE_MEDIA_SOURCE_MAX_BYTES) return "too-large" as const;
  if (file.type && !PROFILE_MEDIA_MIME_TYPES.has(file.type)) return "unsupported" as const;
  return null;
}

export function validateCompressedProfileMedia(file: Pick<File, "size">) {
  return file.size > PROFILE_MEDIA_MAX_BYTES ? "compressed-too-large" as const : null;
}
