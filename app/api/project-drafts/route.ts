import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { saveProjectDraft } from "@/lib/project-drafts-server";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;
  const { data, error } = await db.from("project_drafts")
    .select("id, source_project_id, draft_data, created_at, updated_at")
    .eq("user_id", userId)
    .is("published_project_id", null)
    .order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Entwürfe konnten nicht geladen werden" }, { status: 500 });
  return NextResponse.json({ drafts: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });

  const result = await saveProjectDraft(userId, {
    sourceProjectId: typeof body.sourceProjectId === "string" ? body.sourceProjectId : null,
    draftData: body.draftData,
  });
  if (result.error) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ draft: result.draft }, { status: 201 });
}
