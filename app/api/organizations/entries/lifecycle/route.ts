import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PATCH(request: NextRequest) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  const body = await request.json().catch(() => null);
  if (typeof body?.id !== "string" || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(body.id)
    || !["hide", "delete", "restore"].includes(body.action)
    || typeof body.expectedUpdatedAt !== "string" || Number.isNaN(Date.parse(body.expectedUpdatedAt))
    || typeof body.reason !== "string" || body.reason.trim().length < 5 || body.reason.trim().length > 1000) {
    return NextResponse.json({ error: "required" }, { status: 400 });
  }
  const { data, error } = await db.rpc("manage_organization_entry_lifecycle", {
    p_id: body.id, p_actor: session.userId, p_expected: body.expectedUpdatedAt,
    p_action: body.action, p_reason: body.reason.trim(),
  });
  if (error) {
    const status = ({ PT400: 400, PT403: 403, PT409: 409 } as Record<string, number>)[error.code] || 503;
    return NextResponse.json({ error: status === 409 ? "conflict" : status === 403 ? "forbidden" : status === 400 ? "required" : "save" }, { status });
  }
  if (!data?.[0]) return NextResponse.json({ error: "save" }, { status: 503 });
  return NextResponse.json({ entry: data[0] }, { headers: { "Cache-Control": "private, no-store" } });
}
