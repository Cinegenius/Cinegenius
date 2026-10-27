import { isProtectedMediaOptimizerSource, legacyStorageObject } from "./protected-media";

/** Runs in Proxy BEFORE Next's shared image cache. No authorization result is cached. */
export async function mediaOptimizerBlockStatus(source: string, requestUrl: string, storageOrigin: string, serviceKey: string | undefined, fetcher: typeof fetch = fetch): Promise<404 | 503 | null> {
  if (isProtectedMediaOptimizerSource(source, requestUrl)) return 404;
  const legacy = legacyStorageObject(source, storageOrigin);
  if (!legacy) return null;
  if (!serviceKey) return 503;
  try {
    const response = await fetcher(new URL("/rest/v1/rpc/is_legacy_media_retired", storageOrigin), {
      method: "POST", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(5000),
      headers: { "Content-Type": "application/json", apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ p_bucket: legacy.bucket, p_path: legacy.path }),
    });
    if (!response.ok) return 503;
    const retired: unknown = await response.json();
    if (typeof retired !== "boolean") return 503;
    return retired ? 404 : null;
  } catch { return 503; }
}
