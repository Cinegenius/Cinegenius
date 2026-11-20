import { NextRequest, NextResponse } from "next/server";
import { requireEditorialAgent, editorialFailure } from "@/lib/editorial-agent-server";
import { db } from "@/lib/db";

const headers = { "Cache-Control": "private, no-store" };
export async function POST(request: NextRequest) {
  const session = await requireEditorialAgent(request);
  if (session instanceof NextResponse) return session;
  const body = await request.json().catch(() => null);
  if (!body || !["publish", "hide"].includes(body.action) || typeof body.id !== "string" ||
      typeof body.expectedUpdatedAt !== "string" || typeof body.sourceUrl !== "string" ||
      typeof body.checkedAt !== "string" || body.verified !== true || typeof body.reason !== "string") {
    return NextResponse.json({ error: "review_required" }, { status: 400, headers });
  }
  const { data, error } = await db.rpc("moderate_own_editorial_entry", {
    p_actor: session.userId, p_entry: body.id, p_expected: body.expectedUpdatedAt,
    p_action: body.action, p_source: body.sourceUrl, p_checked: body.checkedAt,
    p_verified: body.verified, p_reason: body.reason,
  });
  if (error) return editorialFailure(error);
  const entry = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({ entry: { id: entry.id, moderation_status: entry.moderation_status, updated_at: entry.updated_at, publication_authority: entry.publication_authority } }, { headers });
}
