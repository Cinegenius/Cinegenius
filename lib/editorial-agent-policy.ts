import { createHash, timingSafeEqual } from "node:crypto";

export const EDITORIAL_ACTOR = "cinegenius-editorial";

/** Keep meaningful article parameters (e.g. FFA's `meldung`); never persist
 * credential/tracking links as public sources. This does not fetch the URL. */
export function editorialSourceUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port ||
        !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(url.hostname) || /(?:^|\.)(?:localhost|local|internal)$/i.test(url.hostname)) return null;
    for (const key of [...url.searchParams.keys()]) {
      if (/token|secret|password|session|unsubscribe|activation|email|authorization|api.?key/i.test(key)) return null;
      if (/^utm_|^(fbclid|gclid)$/i.test(key)) url.searchParams.delete(key);
    }
    url.hash = '';
    return url.toString();
  } catch { return null; }
}
// Machine authentication is independent of Clerk, Support and all member roles.
export function editorialCredentialValid(authorization: string | null, enabled: string | undefined, digest: string | undefined) {
  if (enabled !== "true" || !digest || !/^[a-f0-9]{64}$/.test(digest)) return false;
  const token = authorization?.match(/^Bearer (cge_[a-f0-9]{64})$/)?.[1];
  if (!token) return false;
  const actual = createHash("sha256").update(token).digest();
  return timingSafeEqual(actual, Buffer.from(digest, "hex"));
}

const EDITORIAL_ROUTES: Record<string, readonly string[]> = {
  "/api/editorial/organizations": ["GET"],
  "/api/editorial/entries": ["GET", "POST"],
  "/api/editorial/entries/moderation": ["POST"],
  "/api/editorial/upload": ["POST"],
  "/api/editorial/media": ["GET"],
};
export function editorialRouteAllowed(path: string, method: string) {
  return Object.hasOwn(EDITORIAL_ROUTES, path) && EDITORIAL_ROUTES[path].includes(method);
}
