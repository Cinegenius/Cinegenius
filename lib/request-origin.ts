const PUBLIC_ORIGINS = new Set(["https://cinegenius.co", "https://www.cinegenius.co"]);

/** An explicit Origin is authoritative; Referer cannot override a hostile Origin. */
export function trustedMutationOrigin(input: { requestUrl: string; origin: string | null; referer: string | null; development?: boolean; deploymentHost?: string }) {
  try {
    const request = new URL(input.requestUrl);
    const allowed = new Set(PUBLIC_ORIGINS);
    if (input.deploymentHost && request.origin === `https://${input.deploymentHost}`) allowed.add(request.origin);
    if (input.development && ["localhost", "127.0.0.1", "[::1]"].includes(request.hostname)) allowed.add(request.origin);
    if (input.origin !== null) return allowed.has(input.origin);
    return input.referer !== null && allowed.has(new URL(input.referer).origin);
  } catch { return false; }
}
