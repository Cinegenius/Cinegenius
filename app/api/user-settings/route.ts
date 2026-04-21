import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

// GET /api/user-settings
export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const { data, error } = await db
    .from("user_settings")
    .select("profile_visibility, message_permission, email_new_message")
    .eq("user_id", userId)
    .single();

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    settings: data ?? { profile_visibility: "public", message_permission: "everyone", email_new_message: true },
  });
}

// PATCH /api/user-settings
export async function PATCH(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const body = await req.json();
  const update: Record<string, string> = { user_id: userId, updated_at: new Date().toISOString() };

  if (body.profile_visibility !== undefined) update.profile_visibility = body.profile_visibility;
  if (body.message_permission !== undefined) update.message_permission = body.message_permission;
  if (body.email_new_message !== undefined) update.email_new_message = body.email_new_message;

  const { error } = await db
    .from("user_settings")
    .upsert(update, { onConflict: "user_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
