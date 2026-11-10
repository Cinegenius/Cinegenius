import { groupRpcFailure } from "@/lib/conversation-rpc-errors";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import { getPrivateProfileIds } from "@/lib/trust";
import { normalizeMemberIds } from "@/lib/conversation-logic";
import { NextRequest, NextResponse } from "next/server";
import { getTranslations as getResponseTranslations } from "next-intl/server";

export async function POST(request: NextRequest) {
  const tResponse = await getResponseTranslations();
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;
  const { allowed } = await rateLimit(`group-create:${userId}`, 5, 60);
  if (!allowed) return NextResponse.json({ error: tResponse('System.m_58e100f983d5') }, { status: 429 });

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const memberIds = normalizeMemberIds(userId, body?.member_ids);
  if (name.length < 1 || name.length > 80) return NextResponse.json({ error: tResponse('System.m_027e01fb54de') }, { status: 400 });
  if (!memberIds || memberIds.length < 1 || memberIds.length > 49) return NextResponse.json({ error: tResponse('System.m_286903b7c95b') }, { status: 400 });

  const privateIds = await getPrivateProfileIds(memberIds);
  if (memberIds.some((memberId) => privateIds.has(memberId))) {
    return NextResponse.json({ error: tResponse('System.m_c720b974c036') }, { status: 404 });
  }

  const { data, error } = await db.rpc("create_group_conversation", {
    p_creator_id: userId,
    p_name: name,
    p_member_ids: memberIds,
  });
  if (error) {
    const failure = groupRpcFailure(error, "create");
    return NextResponse.json({ error: tResponse(failure.key) }, { status: failure.status });
  }
  return NextResponse.json({ conversationId: data });
}
