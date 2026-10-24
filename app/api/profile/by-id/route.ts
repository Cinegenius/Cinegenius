import { db } from "@/lib/db";
import { canViewProfile } from "@/lib/trust";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id || !/^[a-zA-Z0-9_-]{1,128}$/.test(id)) {
    return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });
  }

  const { userId } = await auth();
  if (!(await canViewProfile(id, userId))) {
    return NextResponse.json({ profile: null }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  }

  const { data } = await db
    .from("profiles")
    .select("user_id, display_name, avatar_url, slug")
    .eq("user_id", id)
    .maybeSingle();

  return NextResponse.json({ profile: data ?? null }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
