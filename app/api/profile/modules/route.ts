import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAuth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(req: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) return authResult;
    const { userId } = authResult;

    const body = await req.json();
    const { profile_type, modules } = body;
    console.log("[modules PATCH] profile_type:", profile_type, "modules count:", modules?.length);

    const { error } = await supabaseAdmin.rpc("update_profile_modules", {
      p_user_id: userId,
      p_profile_type: profile_type,
      p_modules: modules,
    });

    if (error) {
      console.error("[modules PATCH] supabase error:", error.code, error.message);
      return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
    }

    console.log("[modules PATCH] success");
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[modules PATCH] uncaught exception:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
