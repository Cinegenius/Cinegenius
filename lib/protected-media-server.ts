import { createHash } from "node:crypto";
import "server-only";
import { db } from "@/lib/db";
import { PROTECTED_MEDIA_BUCKET, protectedMediaKey, protectedMediaUrl } from "@/lib/protected-media";

/** Every file/derivative request rechecks its canonical parent's current state. */
export async function readableProtectedMedia(reference: string, viewerId: string | null) {
  const key = protectedMediaKey(reference);
  if (!key) return null;
  const { data, error } = await db.rpc("readable_media_asset", { p_key: key, p_viewer: viewerId });
  if (error) throw new Error("Media permission lookup failed");
  const asset = Array.isArray(data) ? data[0] : data;
  return asset && asset.storage_path === key ? asset as { storage_path: string; mime_type: string } : null;
}

export async function storeProtectedMedia(ownerId: string, path: string, buffer: ArrayBuffer, mime: string) {
  const url = protectedMediaUrl(path);
  if (path.split("/").at(-2) !== ownerId) throw new Error("Media owner mismatch");
  const sha = createHash("sha256").update(new Uint8Array(buffer)).digest("hex");
  const previous = await db.from("media_assets").select("owner_user_id, reference_url, content_sha256").eq("storage_path", path).maybeSingle();
  if (previous.error) throw new Error("Media journal unavailable");
  const bucket = db.storage.from(PROTECTED_MEDIA_BUCKET);
  if (previous.data) {
    if (previous.data.owner_user_id !== ownerId || previous.data.reference_url !== url || previous.data.content_sha256 !== sha) throw new Error("Media upload identifier already used");
    if (!await readableProtectedMedia(url, ownerId)) throw new Error("Media no longer available to uploader");
    const confirmed = await bucket.download(path);
    const bytes = confirmed.data && !confirmed.error ? new Uint8Array(await confirmed.data.arrayBuffer()) : null;
    if (!bytes || createHash("sha256").update(bytes).digest("hex") !== sha) throw new Error("Stored media could not be confirmed");
    return url;
  }
  const { error } = await bucket.upload(path, buffer, { contentType: mime, upsert: false, cacheControl: "0" });
  if (error) {
    // A lost storage acknowledgement can still have stored the file. Recover
    // only the caller's exact immutable upload, never overwrite another file.
    const existing = await bucket.download(path);
    const bytes = existing.data && !existing.error ? new Uint8Array(await existing.data.arrayBuffer()) : null;
    if (!bytes || createHash("sha256").update(bytes).digest("hex") !== sha) throw new Error("Private media upload failed");
  }
  const saved = await db.from("media_assets").insert({ storage_path: path, owner_user_id: ownerId, reference_url: url, mime_type: mime, content_sha256: sha });
  if (saved.error) {
    // A lost write response is ambiguous: confirm before removing any bytes.
    const confirmed = await db.from("media_assets").select("owner_user_id, reference_url, content_sha256").eq("storage_path", path).maybeSingle();
    if (!confirmed.error && confirmed.data?.owner_user_id === ownerId && confirmed.data.reference_url === url && confirmed.data.content_sha256 === sha) return url;
    if (!confirmed.error && !confirmed.data) await bucket.remove([path]);
    throw new Error("Private media association failed");
  }
  return url;
}

export async function downloadProtectedMedia(reference: string, viewerId: string | null) {
  const asset = await readableProtectedMedia(reference, viewerId);
  if (!asset) return null;
  const { data, error } = await db.storage.from(PROTECTED_MEDIA_BUCKET).download(asset.storage_path);
  if (error || !data) return null;
  return { bytes: new Uint8Array(await data.arrayBuffer()), mime: asset.mime_type };
}

/** Cleanup is limited to the caller's unbound upload, never an existing source. */
export async function removeUnusedProtectedMedia(ownerId: string, path: string) {
  const removed = await db.from("media_assets").delete().eq("storage_path", path).eq("owner_user_id", ownerId).is("source_type", null).select("storage_path").maybeSingle();
  if (removed.error) throw new Error("Unused media cleanup failed");
  if (removed.data) await db.storage.from(PROTECTED_MEDIA_BUCKET).remove([path]);
}
