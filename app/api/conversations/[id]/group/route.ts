import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { getTranslations as getResponseTranslations } from "next-intl/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const tResponse = await getResponseTranslations();
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;
  const { id } = await params;
  const { data: conversation, error: conversationError } = await db.from("conversations").select("kind").eq("id", id).maybeSingle();
  if (conversationError) return NextResponse.json({ error: tResponse('System.m_c453f2efc15a') }, { status: 500 });
  if (conversation?.kind !== "group") return NextResponse.json({ error: tResponse('System.m_053aaee94219') }, { status: 404 });
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (name.length < 1 || name.length > 80) return NextResponse.json({ error: tResponse('System.m_027e01fb54de') }, { status: 400 });

  const { data: membership, error: membershipError } = await db
    .from("conversation_members")
    .select("role")
    .eq("conversation_id", id)
    .eq("user_id", userId)
    .is("left_at", null)
    .maybeSingle();
  if (membershipError) return NextResponse.json({ error: tResponse('System.m_599c867e2758') }, { status: 500 });
  if (!membership) return NextResponse.json({ error: tResponse('System.m_5e38bf9cacea') }, { status: 404 });
  if (membership.role !== "admin") return NextResponse.json({ error: tResponse('System.m_cf051a72b7a3') }, { status: 403 });

  const { error } = await db.rpc("manage_group_conversation", {
    p_conversation_id: id,
    p_actor_id: userId,
    p_action: "rename",
    p_target_user_id: null,
    p_name: name,
  });
  if (error) return NextResponse.json({ error: tResponse('System.m_f027823ed7d6') }, { status: 400 });

  await db.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", id);
  return NextResponse.json({ success: true, name });
}
