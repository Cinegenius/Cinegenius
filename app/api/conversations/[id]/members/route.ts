import { groupRpcFailure } from "@/lib/conversation-rpc-errors";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { getPrivateProfileIds } from "@/lib/trust";
import { NextRequest, NextResponse } from "next/server";
import { getTranslations as getResponseTranslations } from "next-intl/server";

const memberIdPattern = /^[\w-]{1,128}$/;

export async function POST(
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
  const action = body?.action;
  const targetUserId = typeof body?.user_id === "string" ? body.user_id : null;

  if (!new Set(["add", "remove", "leave"]).has(action)) {
    return NextResponse.json({ error: tResponse('System.m_5b077741e504') }, { status: 400 });
  }
  if ((action === "add" || action === "remove") && (!targetUserId || !memberIdPattern.test(targetUserId))) {
    return NextResponse.json({ error: tResponse('System.m_d1d8af738c94') }, { status: 400 });
  }

  const { data: member, error: membershipError } = await db
    .from("conversation_members")
    .select("role")
    .eq("conversation_id", id)
    .eq("user_id", userId)
    .is("left_at", null)
    .maybeSingle();
  if (membershipError) return NextResponse.json({ error: tResponse('System.m_599c867e2758') }, { status: 500 });
  if (!member) return NextResponse.json({ error: tResponse('System.m_5e38bf9cacea') }, { status: 404 });
  if (action !== "leave" && member.role !== "admin") return NextResponse.json({ error: tResponse('System.m_5dbac5f6146d') }, { status: 403 });

  if (action === "add" && targetUserId) {
    const privateIds = await getPrivateProfileIds([targetUserId]);
    if (privateIds.has(targetUserId)) return NextResponse.json({ error: tResponse('System.m_87f41d11f8cb') }, { status: 404 });
  }

  const { error } = await db.rpc("manage_group_conversation", {
    p_conversation_id: id,
    p_actor_id: userId,
    p_action: action,
    p_target_user_id: targetUserId,
    p_name: null,
  });
  if (error) {
    const failure = groupRpcFailure(error, "manage");
    return NextResponse.json({ error: tResponse(failure.key) }, { status: failure.status });
  }
  return NextResponse.json({ success: true, left: action === "leave" });
}
