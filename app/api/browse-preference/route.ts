import { NextResponse } from "next/server";
import { preferredBrowsePlace } from "@/lib/browse-preference-server";
export async function GET() {
  const headers = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" };
  try { return NextResponse.json(await preferredBrowsePlace(), { headers }); }
  catch { return NextResponse.json({ place: null }, { status: 503, headers }); }
}
