import "server-only";
import sharp from "sharp";
import { db } from "@/lib/db";
import { legacyStorageObject, protectedMediaKey, PROTECTED_MEDIA_BUCKET } from "@/lib/protected-media";
import { ReviewError, type loadReviewSource } from "@/lib/admin-review-server";

/** Called only after loadReviewSource has verified the current administrative session. */
export async function readReviewImage(review: Awaited<ReturnType<typeof loadReviewSource>>, index: number, width = 1920): Promise<Uint8Array> {
  const reference = review.images[index];
  if (!reference) throw new ReviewError("notFound", 404);
  let bytes: Uint8Array;
  const privateKey = protectedMediaKey(reference);
  if (privateKey) {
    const asset = await db.from("media_assets").select("storage_path,source_type,source_id,reference_url")
      .eq("storage_path", privateKey).maybeSingle();
    if (asset.error) throw new ReviewError("loadError", 503);
    // Mirroring a private image in an unrelated reviewed record grants no access.
    if (!asset.data || asset.data.source_type !== review.kind || asset.data.source_id !== review.id || asset.data.reference_url !== reference.split("?")[0]) throw new ReviewError("sourceMismatch", 403);
    const file = await db.storage.from(PROTECTED_MEDIA_BUCKET).download(privateKey);
    if (file.error || !file.data) throw new ReviewError("mediaError", 404);
    if (file.data.size > 25 * 1024 * 1024) throw new ReviewError("mediaError", 422);
    bytes = new Uint8Array(await file.data.arrayBuffer());
  } else {
    const storage = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const object = legacyStorageObject(reference, storage);
    // Only legacy public objects, never signed URLs or a second private bucket.
    if (object) {
      const bucket = await db.storage.getBucket(object.bucket);
      if (bucket.error || !bucket.data?.public) throw new ReviewError("sourceMismatch", 403);
      const file = await db.storage.from(object.bucket).download(object.path);
      if (file.error || !file.data) throw new ReviewError("mediaError", 404);
      if (file.data.size > 25 * 1024 * 1024) throw new ReviewError("mediaError", 422);
      bytes = new Uint8Array(await file.data.arrayBuffer());
    } else {
      let url: URL;
      try { url = new URL(reference); } catch { throw new ReviewError("mediaError", 422); }
      if (url.protocol !== "https:" || url.hostname !== "img.clerk.com" || url.username || url.password || url.port) throw new ReviewError("sourceMismatch", 403);
      const response = await fetch(url, { cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(8000) });
      if (!response.ok || !response.body) throw new ReviewError("mediaError", 502);
      const chunks: Uint8Array[] = []; let size = 0;
      const reader = response.body.getReader();
      for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > 25 * 1024 * 1024) { await reader.cancel(); throw new ReviewError("mediaError", 422); } chunks.push(part.value); }
      bytes = Buffer.concat(chunks);
    }
  }
  try {
    const image = await sharp(bytes, { limitInputPixels: 50_000_000 }).rotate().resize({ width, height: width, fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
    return new Uint8Array(image);
  } catch { throw new ReviewError("mediaError", 422); }
}
