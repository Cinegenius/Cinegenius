import { NextRequest, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rateLimit";

const noStore = { headers: { "Cache-Control": "private, no-store, max-age=0" } };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Members address the shared support inbox, never an arbitrary admin account. */
export async function POST(request: NextRequest) {
  const member = await requireAuth();
  if (member instanceof NextResponse) return member;
  const t = await getTranslations("SupportContact");
  const { allowed } = await rateLimit(`support-contact:${member.userId}`, 10, 60);
  if (!allowed) return NextResponse.json({ error: t("rateLimited") }, { status: 429, ...noStore });
  const body = await request.json().catch(() => null);
  // A delayed request from a previously active account must never be filed
  // under whichever session happens to be active when the server receives it.
  if (body?.accountId !== member.userId) {
    return NextResponse.json({ error: t("accountChanged") }, { status: 409, ...noStore });
  }
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  const key = typeof body?.idempotencyKey === "string" ? body.idempotencyKey : "";
  if (!content || content.length > 5000 || !uuid.test(key)) {
    return NextResponse.json({ error: t("invalid") }, { status: 400, ...noStore });
  }
  const { data, error } = await db.rpc("contact_support", {
    p_user_id: member.userId, p_content: content, p_idempotency_key: key, p_label: t("threadLabel"),
  });
  if (error) return NextResponse.json({ error: t(error.code === "PT409" ? "busy" : "sendError") }, {
    status: error.code === "PT409" ? 409 : 503, ...noStore,
  });
  const result = Array.isArray(data) ? data[0] : data;
  if (!uuid.test(result?.conversation_id ?? "") || !uuid.test(result?.message_id ?? "")) {
    return NextResponse.json({ error: t("sendError") }, { status: 503, ...noStore });
  }
  return NextResponse.json({ conversationId: result.conversation_id, messageId: result.message_id, duplicate: !result.created }, noStore);
}
