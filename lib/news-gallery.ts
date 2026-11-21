import { protectedMediaKey, protectedMediaUrl } from "@/lib/protected-media";

export const NEWS_GALLERY_LIMIT = 8;
export type NewsGalleryImage = {
  url: string;
  altText: string;
  creator: string;
  sourceUrl: string;
  licenseName: string;
  licenseUrl: string;
  changes: string;
  caption?: string;
  imageTitle?: string;
  attribution?: string;
  credit?: string;
};

/** Public credits only. Permission documents, email links and credentials stay private. */
export function newsCreditUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port ||
      !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(url.hostname) || /(?:^|\.)(localhost|local|internal)$/i.test(url.hostname)) return null;
    for (const key of url.searchParams.keys()) if (/token|secret|password|session|unsubscribe|activation|email|authorization|api.?key/i.test(key)) return null;
    return url.toString();
  } catch { return null; }
}

export function parseNewsGallery(value: unknown): NewsGalleryImage[] | null {
  if (!Array.isArray(value) || value.length > NEWS_GALLERY_LIMIT) return null;
  const images: NewsGalleryImage[] = [], seen = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const key = typeof item.url === "string" ? protectedMediaKey(item.url) : null;
    if (!key || protectedMediaUrl(key) !== item.url || seen.has(item.url)) return null;
    const fields = {altText: 300, creator: 200, licenseName: 160, changes: 500};
    for (const [field, max] of Object.entries(fields)) {
      if (typeof item[field] !== "string" || !item[field].trim() || item[field].length > max) return null;
    }
    const sourceUrl = newsCreditUrl(item.sourceUrl);
    const licenseUrl = (item.licenseUrl === "" || item.licenseUrl === undefined) ? "" : newsCreditUrl(item.licenseUrl);
    if (!sourceUrl || licenseUrl === null) return null;
    const optional = {caption: 800, imageTitle: 300, attribution: 1000, credit: 500};
    for (const [field, max] of Object.entries(optional)) {
      if (item[field] !== undefined && (typeof item[field] !== "string" || item[field].length > max)) return null;
    }
    seen.add(item.url);
    images.push({url: item.url, altText: item.altText.trim(), creator: item.creator.trim(), sourceUrl,
      licenseName: item.licenseName.trim(), licenseUrl, changes: item.changes.trim(),
      caption: item.caption?.trim() ?? "", imageTitle: item.imageTitle?.trim() ?? "",
      attribution: item.attribution?.trim() ?? "", credit: item.credit?.trim() ?? ""});
  }
  return images;
}

/** Existing covers remain visible without inventing a historical license. */
export function newsGalleryImages(cover: string | null | undefined, gallery: unknown) {
  const images: (Partial<NewsGalleryImage> & {url: string})[] = parseNewsGallery(gallery) ?? [];
  if (!cover) return images;
  const creditedCover = images.find(image => image.url === cover);
  return [creditedCover ?? {url: cover}, ...images.filter(image => image.url !== cover)].slice(0, NEWS_GALLERY_LIMIT);
}

/** Compact discovery keeps existing covers and their credits, or the first
 * valid gallery photo. This read projection never repairs or rewrites storage. */
export function newsPreviewImage(cover: string | null | undefined, gallery: unknown): (Partial<NewsGalleryImage> & {url: string}) | null {
  const images = Array.isArray(gallery)
    ? gallery.slice(0, NEWS_GALLERY_LIMIT).flatMap(item => parseNewsGallery([item]) ?? []) : [];
  return cover ? images.find(image => image.url === cover) ?? {url: cover} : images[0] ?? null;
}
