import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PATCH(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

    const body = await req.json();
    const { profile_type, physical } = body;

    console.log("[physical PATCH] userId:", userId);
    console.log("[physical PATCH] profile_type:", profile_type);
    console.log("[physical PATCH] physical:", JSON.stringify(physical));

    // First verify the row exists
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("user_id, profile_type, physical")
      .eq("user_id", userId)
      .maybeSingle();

    console.log("[physical PATCH] existing row:", JSON.stringify(existing));

    if (!existing) {
      return NextResponse.json({ error: "Profil nicht gefunden" }, { status: 404 });
    }

    const { error, data } = await supabaseAdmin.rpc("update_profile_physical", {
      p_user_id:      userId,
      p_profile_type: profile_type ?? null,
      p_physical:     physical ?? null,
    });

    console.log("[physical PATCH] rpc result:", JSON.stringify({ error, data }));

    if (error) {
      console.error("[physical PATCH] rpc error:", error.code, error.message);
      return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
    }

    // Verify the update worked
    const { data: after } = await supabaseAdmin
      .from("profiles")
      .select("physical, profile_type")
      .eq("user_id", userId)
      .maybeSingle();

    console.log("[physical PATCH] after update:", JSON.stringify(after));

    return NextResponse.json({ success: true, debug: { before: existing, after } });
  } catch (err) {
    console.error("[physical PATCH] uncaught:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
