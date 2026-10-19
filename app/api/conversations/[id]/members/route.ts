import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { getPrivateProfileIds } from "@/lib/trust";
import { NextRequest, NextResponse } from "next/server";

const memberIdPattern = /^[\w-]{1,128}$/;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const action = body?.action;
  const targetUserId = typeof body?.user_id === "string" ? body.user_id : null;

  if (!new Set(["add", "remove", "leave"]).has(action)) {
    return NextResponse.json({ error: "Aktion nicht unterstützt." }, { status: 400 });
  }
  if ((action === "add" || action === "remove") && (!targetUserId || !memberIdPattern.test(targetUserId))) {
    return NextResponse.json({ error: "Mitglied ist ungültig." }, { status: 400 });
  }

  const { data: member, error: membershipError } = await db
    .from("conversation_members")
    .select("role")
    .eq("conversation_id", id)
    .eq("user_id", userId)
    .is("left_at", null)
    .maybeSingle();
  if (membershipError) return NextResponse.json({ error: "Mitgliedschaft konnte nicht geprüft werden." }, { status: 500 });
  if (!member) return NextResponse.json({ error: "Gruppe nicht gefunden." }, { status: 404 });
  if (action !== "leave" && member.role !== "admin") return NextResponse.json({ error: "Nur Gruppenadmins dürfen diese Aktion ausführen." }, { status: 403 });

  if (action === "add" && targetUserId) {
    const privateIds = await getPrivateProfileIds([targetUserId]);
    if (privateIds.has(targetUserId)) return NextResponse.json({ error: "Profil ist nicht verfügbar." }, { status: 404 });
  }

  const { error } = await db.rpc("manage_group_conversation", {
    p_conversation_id: id,
    p_actor_id: userId,
    p_action: action,
    p_target_user_id: targetUserId,
    p_name: null,
  });
  if (error) {
    const message = error.message ?? "Gruppenänderung fehlgeschlagen.";
    const status = message.includes("Nur Gruppenadmins") ? 403 : message.includes("nicht gefunden") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
  return NextResponse.json({ success: true, left: action === "leave" });
}
