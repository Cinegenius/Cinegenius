import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

const headers = { "Cache-Control": "private, no-store" };
export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const { data, error } = await db.from("organization_editorial_grants").select("organization_id,enabled,updated_at");
  return error ? NextResponse.json({ error: "load" }, { status: 503, headers }) : NextResponse.json({ grants: data ?? [] }, { headers });
}
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  if (request.headers.get("origin") !== new URL(request.url).origin) return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.organizationId !== "string" || typeof body.enabled !== "boolean" ||
      !(body.expectedUpdatedAt === null || typeof body.expectedUpdatedAt === "string") || typeof body.reason !== "string") {
    return NextResponse.json({ error: "required" }, { status: 400, headers });
  }
  // The grant belongs to this organization and CineGenius Redaktion, never a member account.
  const { data, error } = await db.rpc("set_organization_editorial_grant", {
    p_actor: admin.userId, p_organization: body.organizationId, p_enabled: body.enabled,
    p_expected: body.expectedUpdatedAt, p_reason: body.reason,
  });
  if (error) {
    const statuses: Record<string, number> = { PT400: 400, PT403: 403, PT404: 404, PT409: 409 };
    const status = statuses[error.code] ?? 503;
    return NextResponse.json({ error: status === 503 ? "save" : error.message }, { status, headers });
  }
  return NextResponse.json({ grant: data }, { headers });
}
