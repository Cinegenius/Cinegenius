import sharp from "sharp";

export const PREVIEW_SOURCE_MAX_BYTES = 20 * 1024 * 1024;
export const PREVIEW_EDGE = { thumbnail: 640, detail: 1600 } as const;
let resizeQueue: Promise<unknown> = Promise.resolve();

/** Bound decoded pixels, output dimensions and frames; never pass the original through. */
export function resizeCommunityPreview(source: Uint8Array, size: keyof typeof PREVIEW_EDGE) {
  // Do not decode several ~100 MP originals concurrently in the same instance.
  const job = resizeQueue.catch(() => {}).then(() => sharp(source, { limitInputPixels: 100_000_000, animated: false })
    .rotate()
    .resize({ width: PREVIEW_EDGE[size], height: PREVIEW_EDGE[size], fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer());
  resizeQueue = job;
  return job;
}

export async function readPreviewSource(response: Response) {
  if (!response.ok || !response.body) throw new Error("Image source unavailable");
  const length = Number(response.headers.get("content-length"));
  if (length > PREVIEW_SOURCE_MAX_BYTES) throw new Error("Image source too large");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > PREVIEW_SOURCE_MAX_BYTES) throw new Error("Image source too large");
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  return Buffer.concat(chunks, total);
}

// Cache only small derivatives. Public eligibility is checked before each use.
const cache = new Map<string, Buffer>();
const pending = new Map<string, Promise<Buffer>>();
const MAX_CACHE_BYTES = 8 * 1024 * 1024;
let cacheBytes = 0;
export async function cachedCommunityPreview(key: string, create: () => Promise<Buffer>) {
  const hit = cache.get(key);
  if (hit) {
    // Keep frequently displayed previews hot within the same bounded memory.
    // Callers must still check current source permissions before every lookup.
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const running = pending.get(key);
  if (running) return running;
  const task = create().then((result) => {
    if (result.length <= MAX_CACHE_BYTES) {
      while (cache.size && (cacheBytes + result.length > MAX_CACHE_BYTES || cache.size >= 32)) {
        const oldest = cache.keys().next().value!;
        cacheBytes -= cache.get(oldest)!.length;
        cache.delete(oldest);
      }
      cache.set(key, result);
      cacheBytes += result.length;
    }
    return result;
  }).finally(() => pending.delete(key));
  pending.set(key, task);
  return task;
}
