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
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    settings: data ?? { profile_visibility: "public", message_permission: "everyone", email_new_message: true },
  });
}

// PATCH /api/user-settings
export async function PATCH(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Ungültige Einstellungen." }, { status: 400 });
  }
  const update: Record<string, unknown> = { user_id: userId, updated_at: new Date().toISOString() };

  if (body.profile_visibility !== undefined) {
    if (!["public", "private"].includes(body.profile_visibility)) {
      return NextResponse.json({ error: "Ungültige Profil-Sichtbarkeit." }, { status: 400 });
    }
    update.profile_visibility = body.profile_visibility;
  }
  if (body.message_permission !== undefined) {
    if (!["everyone", "friends_only"].includes(body.message_permission)) {
      return NextResponse.json({ error: "Ungültige Nachrichteneinstellung." }, { status: 400 });
    }
    update.message_permission = body.message_permission;
  }
  if (body.email_new_message !== undefined) {
    if (typeof body.email_new_message !== "boolean") {
      return NextResponse.json({ error: "Ungültige E-Mail-Einstellung." }, { status: 400 });
    }
    update.email_new_message = body.email_new_message;
  }
  if (Object.keys(update).length === 2) {
    return NextResponse.json({ error: "Keine unterstützte Einstellung erhalten." }, { status: 400 });
  }

  const { data: saved, error } = await db
    .from("user_settings")
    .upsert(update, { onConflict: "user_id" })
    .select("profile_visibility, message_permission, email_new_message")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, settings: saved });
}
