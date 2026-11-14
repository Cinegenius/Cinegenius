import { NextRequest, NextResponse } from "next/server";
import { getLocale } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth";
import { trustedMutationOrigin } from "@/lib/request-origin";
import { GenieError, readGenieBody } from "@/lib/genie-server";
import { validateResolvedSearchPlan } from "@/lib/unified-search-plan-server";
import { executeUnifiedSearch, type SearchCursor } from "@/lib/unified-search-server";
import { unifiedSearchAccess } from "@/lib/unified-search-access";
import { SEARCH_AREAS } from "@/lib/unified-search";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
export const maxDuration = 30;
const headers = { "Cache-Control": "private, no-store", "CDN-Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store" };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });

export async function POST(request: NextRequest) {
  if (!trustedMutationOrigin({ requestUrl: request.url, origin: request.headers.get("origin"), referer: request.headers.get("referer"), development: process.env.NODE_ENV !== "production", deploymentHost: process.env.VERCEL_URL })) return json({ error: "invalid_request" }, 403);
  try {
    const user = await getCurrentUser();
    const userId = user?.userId ?? null;
    if (!userId || !unifiedSearchAccess(userId).canReadResults) return json({ error: "unauthorized" }, 401);
    if (!(await rateLimit(`unified-search:${userId}`, 40, 60)).allowed) return json({ error: "rate_limited" }, 429);
    const body = await readGenieBody(request);
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some(key => !["plan", "cursor"].includes(key))) return json({ error: "invalid_request" }, 400);
    const { plan: rawPlan, cursor } = body as { plan: unknown; cursor?: SearchCursor };
    const plan = validateResolvedSearchPlan(rawPlan);
    if (cursor !== undefined && (!cursor || typeof cursor !== "object" || Array.isArray(cursor) || Object.keys(cursor).some(key => !["wishIndex", "area", "offset"].includes(key))
      || !Number.isInteger(cursor.wishIndex) || cursor.wishIndex < 0 || cursor.wishIndex >= plan.searches.length
      || !Number.isInteger(cursor.offset) || cursor.offset < 0 || cursor.offset > 1_000_000
      || !SEARCH_AREAS.includes(cursor.area) || !["all", cursor.area].includes(plan.searches[cursor.wishIndex].area))) return json({ error: "invalid_request" }, 400);
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(20_000)]);
    return json(await executeUnifiedSearch(plan, await getLocale(), userId, signal, cursor));
  } catch (error) {
    return json({ error: error instanceof GenieError ? error.code : "unavailable" }, error instanceof GenieError ? error.status : 503);
  }
}
