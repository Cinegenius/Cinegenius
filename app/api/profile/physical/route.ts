import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(req: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) return authResult;
    const { userId } = authResult;

    const body = await req.json();
    const { profile_type, physical } = body;

    const { data: existing } = await db
      .from("profiles")
      .select("user_id, profile_type, physical")
      .eq("user_id", userId)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: "Profil nicht gefunden" }, { status: 404 });
    }

    const { error, data } = await db.rpc("update_profile_physical", {
      p_user_id:      userId,
      p_profile_type: profile_type ?? null,
      p_physical:     physical ?? null,
    });

    if (error) {
      console.error("[physical PATCH] rpc error:", error.code, error.message);
      return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
    }

    const { data: after } = await db
      .from("profiles")
      .select("physical, profile_type")
      .eq("user_id", userId)
      .maybeSingle();

    return NextResponse.json({ success: true, debug: { before: existing, after } });
  } catch (err) {
    console.error("[physical PATCH] uncaught:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
