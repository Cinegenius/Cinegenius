import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;
  const { id } = await params;
  const { data: conversation, error: conversationError } = await db.from("conversations").select("kind").eq("id", id).maybeSingle();
  if (conversationError) return NextResponse.json({ error: "Unterhaltung konnte nicht geprüft werden." }, { status: 500 });
  if (conversation?.kind !== "group") return NextResponse.json({ error: "Nur Gruppengespräche können verwaltet werden." }, { status: 404 });
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (name.length < 1 || name.length > 80) return NextResponse.json({ error: "Der Gruppenname muss 1 bis 80 Zeichen lang sein." }, { status: 400 });

  const { data: membership, error: membershipError } = await db
    .from("conversation_members")
    .select("role")
    .eq("conversation_id", id)
    .eq("user_id", userId)
    .is("left_at", null)
    .maybeSingle();
  if (membershipError) return NextResponse.json({ error: "Mitgliedschaft konnte nicht geprüft werden." }, { status: 500 });
  if (!membership) return NextResponse.json({ error: "Gruppe nicht gefunden." }, { status: 404 });
  if (membership.role !== "admin") return NextResponse.json({ error: "Nur Gruppenadmins dürfen den Namen ändern." }, { status: 403 });

  const { error } = await db.rpc("manage_group_conversation", {
    p_conversation_id: id,
    p_actor_id: userId,
    p_action: "rename",
    p_target_user_id: null,
    p_name: name,
  });
  if (error) return NextResponse.json({ error: "Gruppenname konnte nicht geändert werden." }, { status: 400 });

  await db.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", id);
  return NextResponse.json({ success: true, name });
}
