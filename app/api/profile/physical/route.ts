import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { PROFILE_CATEGORY_MAP } from "@/lib/profile-types";
import { NextRequest, NextResponse } from "next/server";
import { getTranslations as getResponseTranslations } from "next-intl/server";

const PROFILE_TYPES = new Set([...Object.keys(PROFILE_CATEGORY_MAP), "performer", "crew", "creative", "vendor"]);

export async function PATCH(req: NextRequest) {
  const tResponse = await getResponseTranslations();
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) return authResult;
    const { userId } = authResult;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: tResponse('System.m_e56ebabd3f11') }, { status: 400 });
    }
    const { profile_type, physical } = body;

    if (profile_type !== undefined && profile_type !== null &&
      (typeof profile_type !== "string" || !PROFILE_TYPES.has(profile_type))) {
      return NextResponse.json({ error: tResponse('System.m_39a06a4868c7') }, { status: 400 });
    }
    if (physical !== undefined && physical !== null &&
      (typeof physical !== "object" || Array.isArray(physical))) {
      return NextResponse.json({ error: tResponse('System.m_2a4e62478dd1') }, { status: 400 });
    }

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (profile_type !== undefined) update.profile_type = profile_type;
    if (physical !== undefined) update.physical = physical;
    if (Object.keys(update).length === 1) {
      return NextResponse.json({ error: tResponse('System.m_698adcc62a1d') }, { status: 400 });
    }

    const { error, data } = await db
      .from("profiles")
      .update(update)
      .eq("user_id", userId)
      .select("profile_type, physical")
      .maybeSingle();

    if (error) {
      console.error("[physical PATCH] database update failed");
      return NextResponse.json({ error: tResponse('System.requestFailed'), code: error.code }, { status: 500 });
    }

    if (!data) return NextResponse.json({ error: tResponse('System.m_4b7786bc0e50') }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch {
    console.error("[physical PATCH] unexpected failure");
    return NextResponse.json({ error: tResponse('System.requestFailed') }, { status: 500 });
  }
}
