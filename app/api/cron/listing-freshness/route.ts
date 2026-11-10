import { NextRequest, NextResponse } from "next/server";
import { authorizedListingFreshnessCron } from "@/lib/listing-freshness-cron-auth";
import { runListingFreshnessWorker } from "@/lib/listing-freshness-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest) {
  if (!authorizedListingFreshnessCron(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ code: "unauthorized" }, { status: 401, headers });
  }
  try {
    return NextResponse.json(await runListingFreshnessWorker(), { headers });
  } catch {
    return NextResponse.json({ code: "unavailable" }, { status: 503, headers });
  }
}

// Do not let Next.js derive a mutating HEAD handler from GET.
export function HEAD() {
  return new NextResponse(null, { status: 405, headers: { ...headers, Allow: "GET" } });
}
