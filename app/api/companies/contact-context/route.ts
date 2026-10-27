import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

/** Confirm the company/recipient pair before showing a company identity in a chat. */
export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const slug = request.nextUrl.searchParams.get("slug") ?? "";
  const recipient = request.nextUrl.searchParams.get("recipient") ?? "";
  const headers = { "Cache-Control": "private, no-store" };
  if (!slug || slug.length > 200 || !/^[a-zA-Z0-9_-]{1,128}$/.test(recipient)) return NextResponse.json({ company: null }, { status: 400, headers });
  const { data, error } = await db.from("companies").select("name,slug")
    .eq("slug", slug).eq("owner_user_id", recipient).eq("published", true).maybeSingle();
  if (error) return NextResponse.json({ company: null }, { status: 503, headers });
  if (!data) return NextResponse.json({ company: null }, { status: 404, headers });
  return NextResponse.json({ company: data }, { headers });
}
