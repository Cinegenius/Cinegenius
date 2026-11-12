import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import { normalizeMemberIds } from "@/lib/conversation-logic";
import { MESSAGING_HEADERS, messagingAccountId, messagingRequestKey, messagingUuid, messagingRpcFailure } from "@/lib/messaging-backend";
import { NextRequest, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;
  const t = await getTranslations("MessagingBackend");
  const fail = (key: string, status: number) => NextResponse.json({ error: t(key) }, { status, headers: MESSAGING_HEADERS });
  const body = await request.json().catch(() => null);
  if (body?.accountId !== userId) return fail("accountChanged", 403);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const members = normalizeMemberIds(userId, body.member_ids);
  if (!name || name.length > 80 || !members || members.length < 1 || members.length > 49
    || members.some(id => !messagingAccountId(id) || id === "cinegenius-support") || !messagingRequestKey(body.idempotencyKey)) return fail("invalid", 400);
  if (!(await rateLimit(`group-create:${userId}`, 5, 60)).allowed) return fail("rateLimit", 429);
  const { data, error } = await db.rpc("create_group_conversation", {
    p_creator_id: userId, p_name: name, p_member_ids: members, p_idempotency_key: body.idempotencyKey,
  });
  if (error) { const failure = messagingRpcFailure(error); return fail(failure.key, failure.status); }
  if (!data || !messagingUuid(data.conversationId) || typeof data.created !== "boolean") return fail("saveError", 503);
  return NextResponse.json({ conversationId: data.conversationId, replayed: !data.created }, { headers: MESSAGING_HEADERS });
}
