import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import { MESSAGING_HEADERS, messagingAccountId } from "@/lib/messaging-backend";
import { NextRequest, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

export async function GET() {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;
  const t = await getTranslations();
  const result = await db.from("blocks").select("id,blocked_id,created_at").eq("blocker_id", actor.userId).order("created_at", { ascending: false }).limit(200);
  if (result.error) return NextResponse.json({ error: t("System.requestFailed") }, { status: 503, headers: MESSAGING_HEADERS });
  return NextResponse.json({ blocked: result.data ?? [] }, { headers: MESSAGING_HEADERS });
}

/** Explicit state makes a repeated block request safe; it never toggles a retry. */
export async function POST(req: NextRequest) {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;
  const t = await getTranslations();
  const fail = (key: string, status: number) => NextResponse.json({ error: t(key) }, { status, headers: MESSAGING_HEADERS });
  const body = await req.json().catch(() => null);
  if (body?.accountId !== actor.userId) return fail("MessagingBackend.accountChanged", 403);
  if (!messagingAccountId(body.blocked_id) || body.blocked_id === actor.userId || typeof body.blocked !== "boolean") return fail("System.m_f2e69ad52fd4", 400);
  if (!(await rateLimit(`block:${actor.userId}`, 20, 60)).allowed) return fail("System.m_35bd89251439", 429);
  const result = await db.rpc("set_member_block", { p_actor: actor.userId, p_target: body.blocked_id, p_blocked: body.blocked });
  if (result.error) return fail(result.error.code === "PT409" || result.error.code === "55P03" ? "MessagingBackend.busy" : "System.requestFailed", result.error.code === "PT409" || result.error.code === "55P03" ? 409 : 503);
  if (typeof result.data?.blocked !== "boolean" || result.data.blocked !== body.blocked) return fail("System.requestFailed", 503);
  return NextResponse.json({ blocked: result.data.blocked, changed: result.data.changed === true }, { headers: MESSAGING_HEADERS });
}
