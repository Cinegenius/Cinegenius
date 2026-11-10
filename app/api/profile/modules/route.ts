import { getTranslations as getResponseTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(req: NextRequest) {
  const tResponse = await getResponseTranslations();
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) return authResult;
    const { userId } = authResult;

    const body = await req.json();
    const { profile_type, modules } = body;

    const { error } = await db.rpc("update_profile_modules", {
      p_user_id: userId,
      p_profile_type: profile_type,
      p_modules: modules,
    });

    if (error) {
      console.error("[modules PATCH] database update failed");
      return NextResponse.json({ error: tResponse('System.requestFailed'), code: error.code }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    console.error("[modules PATCH] unexpected failure");
    return NextResponse.json({ error: tResponse('System.requestFailed') }, { status: 500 });
  }
}
