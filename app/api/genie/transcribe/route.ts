import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { GenieError, genieConfiguration, reserveGenieUsage } from "@/lib/genie-server";
import { readGenieAudio, transcribeGenieAudio } from "@/lib/genie-audio-server";
import { trustedMutationOrigin } from "@/lib/request-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 35;
const headers = { "Cache-Control": "private, no-store, max-age=0", "CDN-Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const json = (value: unknown, status = 200) => NextResponse.json(value, { status, headers });

export async function POST(request: NextRequest) {
  if (!trustedMutationOrigin({ requestUrl: request.url, origin: request.headers.get("origin"), referer: request.headers.get("referer"),
    development: process.env.NODE_ENV !== "production", deploymentHost: process.env.VERCEL_URL })) return json({ error: "invalid_request" }, 403);
  try {
    const user = await getCurrentUser();
    if (!user?.userId) return json({ error: "unauthorized" }, 401);
    const config = genieConfiguration();
    // Reserve before accepting an audio body, bounding repeated upload attempts too.
    await reserveGenieUsage(request, user.userId, config);
    const audio = await readGenieAudio(request);
    return json(await transcribeGenieAudio(request, audio, config));
  } catch (error) {
    return error instanceof GenieError ? json({ error: error.code }, error.status) : json({ error: "unavailable" }, 503);
  }
}
