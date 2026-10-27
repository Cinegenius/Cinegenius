export const PROTECTED_MEDIA_BUCKET = "protected-media";
export const PROTECTED_MEDIA_PREFIX = "/api/media/";
const KEY = /^(?:(?:profile-media\/avatars|profile-media|avatars)\/)?[A-Za-z0-9_-]{1,128}\/[a-f0-9]{32}\.(?:jpg|png|webp)$/i;

export function protectedMediaKey(reference: string): string | null {
  if (!reference.startsWith(PROTECTED_MEDIA_PREFIX)) return null;
  const key = reference.slice(PROTECTED_MEDIA_PREFIX.length).split("?")[0];
  return KEY.test(key) ? key : null;
}
export function protectedMediaUrl(key: string): string {
  if (!KEY.test(key)) throw new Error("Invalid protected media path");
  return `${PROTECTED_MEDIA_PREFIX}${key}`;
}
export function isOwnedProtectedMedia(reference: string, userId: string): boolean {
  const key = protectedMediaKey(reference);
  return Boolean(key && key.split("/").at(-2) === userId);
}
/** Even a manually crafted optimizer URL must not create an unguarded cached copy. */
export function isProtectedMediaOptimizerSource(value: string | null, origin: string): boolean {
  if (!value) return false;
  try {
    let decodedValue = value;
    for (let n = 0; n < 3; n++) { const next = decodeURIComponent(decodedValue); if (next === decodedValue) break; decodedValue = next; }
    const path = new URL(decodedValue.replace(/\\/g,"/"), origin).pathname.replace(/\/{2,}/g, "/");
    return /^\/api\/(?:media(?:\/|$)|community-image(?:\/|$))/i.test(path);

  } catch { return true; }
}

/** Map only our own legacy public originals/transforms, never arbitrary hosts. */
export function legacyStorageObject(reference: string, storageOrigin: string): { bucket: string; path: string } | null {
  try {
    const candidate = new URL(reference);
    if (candidate.origin !== new URL(storageOrigin).origin || candidate.protocol !== "https:") return null;
    const match = decodeURIComponent(candidate.pathname).replace(/\/{2,}/g, "/").match(/^\/storage\/v1\/(?:object|render\/image)\/public\/([^/]+)\/(.+)$/);
    if (!match) return null;
    const path = match[2];
    if (path.split("/").some((part) => part === "..") || /[\u0000-\u001f]/.test(path)) return null;
    return { bucket: decodeURIComponent(match[1]), path };
  } catch { return null; }
}
