import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/user-settings
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("user_settings")
    .select("profile_visibility, message_permission")
    .eq("user_id", userId)
    .single();

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    settings: data ?? { profile_visibility: "public", message_permission: "everyone" },
  });
}

// PATCH /api/user-settings
export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const body = await req.json();
  const update: Record<string, string> = { user_id: userId, updated_at: new Date().toISOString() };

  if (body.profile_visibility !== undefined) update.profile_visibility = body.profile_visibility;
  if (body.message_permission !== undefined) update.message_permission = body.message_permission;

  const { error } = await supabaseAdmin
    .from("user_settings")
    .upsert(update, { onConflict: "user_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
