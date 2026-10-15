import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { PROFILE_CATEGORY_MAP } from "@/lib/profile-types";
import { NextRequest, NextResponse } from "next/server";

const PROFILE_TYPES = new Set([...Object.keys(PROFILE_CATEGORY_MAP), "performer", "crew", "creative", "vendor"]);

export async function PATCH(req: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) return authResult;
    const { userId } = authResult;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Ungültige Profilangaben." }, { status: 400 });
    }
    const { profile_type, physical } = body;

    if (profile_type !== undefined && profile_type !== null &&
      (typeof profile_type !== "string" || !PROFILE_TYPES.has(profile_type))) {
      return NextResponse.json({ error: "Ungültiger Profiltyp." }, { status: 400 });
    }
    if (physical !== undefined && physical !== null &&
      (typeof physical !== "object" || Array.isArray(physical))) {
      return NextResponse.json({ error: "Ungültige Casting-Daten." }, { status: 400 });
    }

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (profile_type !== undefined) update.profile_type = profile_type;
    if (physical !== undefined) update.physical = physical;
    if (Object.keys(update).length === 1) {
      return NextResponse.json({ error: "Keine Casting-Daten erhalten." }, { status: 400 });
    }

    const { error, data } = await db
      .from("profiles")
      .update(update)
      .eq("user_id", userId)
      .select("profile_type, physical")
      .maybeSingle();

    if (error) {
      console.error("[physical PATCH] update error:", error.code, error.message);
      return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
    }

    if (!data) return NextResponse.json({ error: "Profil nicht gefunden" }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[physical PATCH] uncaught:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
