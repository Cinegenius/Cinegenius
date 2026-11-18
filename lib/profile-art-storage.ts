import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PROFILE_ART_BUCKET, PROFILE_ART_REFILL_POLICY as POLICY, profileArtObjectKey, type PlatformArtKind } from "@/lib/profile-art-refill-contract";
import { ArtPipelineError, readArtStream, withArtDeadline } from "@/lib/profile-art-io";

export const artBytesSHA256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
export function isWebPContainer(bytes: Uint8Array): boolean {
  return bytes.length >= 20 && new TextDecoder().decode(bytes.subarray(0, 4)) === "RIFF"
    && new TextDecoder().decode(bytes.subarray(8, 12)) === "WEBP"
    && new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(4, true) + 8 === bytes.length;
}
export function createProfileArtStorage(storage: SupabaseClient["storage"]) {
  async function assertPrivate(signal?: AbortSignal) {
    const {data, error} = await withArtDeadline(() => storage.getBucket(PROFILE_ART_BUCKET), signal, POLICY.storageTimeoutMs);
    if (error || !data || data.id !== PROFILE_ART_BUCKET || data.public !== false
      || !Number.isInteger(data.file_size_limit) || Number(data.file_size_limit) < 1 || Number(data.file_size_limit) > 180_000
      || data.allowed_mime_types?.length !== 1 || data.allowed_mime_types[0] !== "image/webp") throw new ArtPipelineError("storage_unavailable");
  }
  async function read(kind: PlatformArtKind, mediaKey: string, parent?: AbortSignal): Promise<Uint8Array> {
    const key = profileArtObjectKey(kind, mediaKey);
    await assertPrivate(parent);
    return withArtDeadline(async signal => {
      const {data, error} = await storage.from(PROFILE_ART_BUCKET).download(key, {}, { signal, cache: "no-store" }).asStream();
      if (error || !data) throw new ArtPipelineError("storage_unavailable");
      const bytes = await readArtStream(data, POLICY.maxOutputBytes[kind], signal);
      if (!isWebPContainer(bytes)) throw new ArtPipelineError("storage_invalid");
      return bytes;
    }, parent, POLICY.storageTimeoutMs);
  }
  async function putVerified(kind: PlatformArtKind, mediaKey: string, bytes: Uint8Array, parent?: AbortSignal) {
    const key = profileArtObjectKey(kind, mediaKey);
    if (!isWebPContainer(bytes) || bytes.byteLength > POLICY.maxOutputBytes[kind]) throw new ArtPipelineError("storage_invalid");
    await assertPrivate(parent);
    // This SDK upload cannot be cancelled mid-flight. A timeout leaves a journaled
    // quarantine object at this job's key; it is never retried, overwritten or published.
    const {data, error} = await withArtDeadline(() => storage.from(PROFILE_ART_BUCKET).upload(key, bytes, { contentType: "image/webp", cacheControl: "0", upsert: false }), parent, POLICY.storageTimeoutMs);
    if (error || data?.path !== key) throw new ArtPipelineError("storage_failed");
    const downloaded = await read(kind, mediaKey, parent), expected = artBytesSHA256(bytes);
    if (downloaded.byteLength !== bytes.byteLength || artBytesSHA256(downloaded) !== expected) throw new ArtPipelineError("storage_mismatch");
    return { sha256: expected, byteLength: downloaded.byteLength };
  }
  return { read, putVerified };
}
