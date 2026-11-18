import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { authorizedListingFreshnessCron } from "@/lib/listing-freshness-cron-auth";
import { enqueueServerProfileArtRefill, runServerProfileArtRefill } from "@/lib/profile-art-refill-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 150;
const headers = {"Cache-Control": "private, no-store"};

/** Fixed curated artwork only. Neither prompts, accounts nor URLs are accepted. */
async function run(request: NextRequest, manual: boolean) {
  const secret = manual ? process.env.PROFILE_ART_WORKER_SECRET : process.env.CRON_SECRET;
  if (!authorizedListingFreshnessCron(request.headers.get("authorization"), secret)) return NextResponse.json({code: "unauthorized"}, {status: 401, headers});
  if (process.env.VERCEL_ENV !== "production" || (!manual && process.env.PROFILE_ART_WORKER_ENABLED !== "true")) return NextResponse.json({status: "disabled"}, {headers});
  if (!process.env.OPENAI_API_KEY?.trim()) return NextResponse.json({code: "provider_unavailable"}, {status: 503, headers});
  try {
    for (const kind of ["avatar", "cover"] as const) {
      // The database owns buffer, daily budget, concurrency and journal bounds.
      try {await enqueueServerProfileArtRefill(kind, randomUUID());} catch { /* a full buffer/budget must not prevent processing an existing job */ }
    }
    return NextResponse.json(await runServerProfileArtRefill(request.signal), {headers});
  } catch {return NextResponse.json({code: "unavailable"}, {status: 503, headers});}
}
export const GET = (request: NextRequest) => run(request, false);
export const POST = (request: NextRequest) => run(request, true);
export function HEAD() {return new NextResponse(null, {status: 405, headers: {...headers, Allow: "GET, POST"}});}
