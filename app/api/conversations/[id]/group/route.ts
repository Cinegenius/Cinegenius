import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import { MESSAGING_HEADERS, messagingUuid, messagingRpcFailure } from "@/lib/messaging-backend";
import { NextRequest, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;
  const t = await getTranslations("MessagingBackend");
  const fail = (key: string, status: number) => NextResponse.json({ error: t(key) }, { status, headers: MESSAGING_HEADERS });
  const body = await request.json().catch(() => null);
  if (body?.accountId !== userId) return fail("accountChanged", 403);
  const { id } = await params;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!messagingUuid(id) || !name || name.length > 80) return fail("invalid", 400);
  if (!(await rateLimit(`group-manage:${userId}`, 60, 60)).allowed) return fail("rateLimit", 429);
  const { error } = await db.rpc("manage_group_conversation", {
    p_conversation_id: id, p_actor_id: userId, p_action: "rename", p_target_user_id: null, p_name: name,
  });
  if (error) { const failure = messagingRpcFailure(error); return fail(failure.key, failure.status); }
  return NextResponse.json({ success: true, name }, { headers: MESSAGING_HEADERS });
}
