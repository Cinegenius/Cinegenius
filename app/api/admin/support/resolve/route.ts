import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/requireAdmin";
import { resolveAdminSupportTarget, SupportTargetError, type AdminSupportTargetType } from "@/lib/admin-support";

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const type = request.nextUrl.searchParams.get("type") ?? "";
  const id = request.nextUrl.searchParams.get("id") ?? "";
  if (!["profile", "company", "listing", "started_offer"].includes(type) || !id || id.length > 160) {
    return NextResponse.json({ error: "Ungültiges Supportziel." }, { status: 400 });
  }
  try {
    const target = await resolveAdminSupportTarget(type as AdminSupportTargetType, id, admin.userId);
    const { data: previous, error } = await db.from("conversations")
      .select("id, support_target_label, updated_at")
      .eq("kind", "support").eq("support_user_id", target.recipientUserId)
      .order("updated_at", { ascending: false }).limit(5);
    if (error) return NextResponse.json({ error: "Bisherige Supportkontakte konnten nicht geladen werden." }, { status: 500 });
    return NextResponse.json({ target, previousContacts: previous ?? [] }, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    const status = error instanceof SupportTargetError ? error.status : 500;
    const message = error instanceof SupportTargetError ? error.message : "Empfänger konnte nicht sicher ermittelt werden.";
    return NextResponse.json({ error: message }, { status });
  }
}

