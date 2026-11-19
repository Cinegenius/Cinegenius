import { authorizedListingFreshnessCron } from "./listing-freshness-cron-auth";
const headers = { "Cache-Control": "private, no-store", "CDN-Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store" };
type Feature = "SHOTS_CLEANUP_CRON_ENABLED" | "NATIVE_PUSH_CRON_ENABLED";

/** Explicit scheduler GET only; new schedules stay inert until separately enabled. */
export function createAppServiceCron(feature: Feature, run: () => Promise<unknown>, environment: Record<string, string | undefined> = process.env) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "GET") return new Response(null, { status: 405, headers: { ...headers, Allow: "GET" } });
    if (!authorizedListingFreshnessCron(request.headers.get("authorization"), environment.CRON_SECRET)) return Response.json({ error: { code: "unauthorized" } }, { status: 401, headers });
    if (environment.VERCEL_ENV !== "production" || environment[feature] !== "true") return Response.json({ status: "disabled" }, { headers });
    try { return Response.json(await run(), { headers }); }
    catch { return Response.json({ error: { code: "unavailable" } }, { status: 503, headers }); }
  };
}
