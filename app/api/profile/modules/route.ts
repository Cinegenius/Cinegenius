import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(req: NextRequest) {
  try {
    const { userId } = await auth();
    console.log("[modules PATCH] userId:", userId);
    if (!userId) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

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
