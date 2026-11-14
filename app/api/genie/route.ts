import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { validateGenieRequest } from "@/lib/genie";
import { GenieError, genieConfiguration, generateGenieAdvice, readGenieBody, reserveGenieUsage } from "@/lib/genie-server";
import { trustedMutationOrigin } from "@/lib/request-origin";
import { unifiedSearchAccess } from "@/lib/unified-search-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 35;
const headers = {
  "Cache-Control": "private, no-store, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};
const json = (value: unknown, status = 200) => NextResponse.json(value, { status, headers });

export async function POST(request: NextRequest) {
  if (!trustedMutationOrigin({
    requestUrl: request.url, origin: request.headers.get("origin"), referer: request.headers.get("referer"),
    development: process.env.NODE_ENV !== "production", deploymentHost: process.env.VERCEL_URL,
  })) return json({ error: "invalid_request" }, 403);
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser?.userId || !unifiedSearchAccess(currentUser.userId).canInterpret) return json({ error: "unauthorized" }, 401);
    const config = genieConfiguration(currentUser.userId);
    const validated = validateGenieRequest(await readGenieBody(request));
    if (!validated.ok) return json({ error: validated.error }, 400);
    await reserveGenieUsage(request, currentUser.userId, config);
    return json(await generateGenieAdvice(request, validated.value, config));
  } catch (error) {
    return error instanceof GenieError
      ? json({ error: error.code }, error.status)
      : json({ error: "unavailable" }, 503);
  }
}
