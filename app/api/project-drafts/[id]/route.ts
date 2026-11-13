import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { sanitizeProjectDraftData } from "@/lib/project-drafts";
import { NextRequest, NextResponse } from "next/server";
import { getTranslations as getResponseTranslations } from "next-intl/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tResponse = await getResponseTranslations();
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;
  const { id } = await params;
  const { data, error } = await db.from("project_drafts")
    .select("id, user_id, source_project_id, published_project_id, draft_data, created_at, updated_at")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: tResponse('System.m_4bb7a67aea1b') }, { status: 500 });
  if (!data) return NextResponse.json({ error: tResponse('System.m_36ae6da39735') }, { status: 404 });
  return NextResponse.json({ draft: data }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tResponse = await getResponseTranslations();
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: tResponse('System.m_0e4698bf4051') }, { status: 400 });

  const { data: existing, error: readError } = await db.from("project_drafts")
    .select("id, draft_data, published_project_id, updated_at")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (readError) return NextResponse.json({ error: tResponse('System.m_4bb7a67aea1b') }, { status: 500 });
  if (!existing) return NextResponse.json({ error: tResponse('System.m_36ae6da39735') }, { status: 404 });
  if (existing.published_project_id) return NextResponse.json({ error: tResponse('System.m_994f68946c5e') }, { status: 409 });

  if (typeof body.expectedUpdatedAt !== "string" || existing.updated_at !== body.expectedUpdatedAt) {
    return NextResponse.json({ error: tResponse("projects.publishConflict") }, { status: 409 });
  }
  const patch = sanitizeProjectDraftData(body.draftData);
  const draftData = { ...(existing.draft_data ?? {}), ...patch };
  if (typeof draftData.title !== "string" || !draftData.title.trim()) return NextResponse.json({ error: tResponse('System.m_c2018abde6e3') }, { status: 400 });
  if (JSON.stringify(draftData).length > 250_000) return NextResponse.json({ error: tResponse('System.m_cf20581bc065') }, { status: 413 });
  const { data, error } = await db.from("project_drafts")
    .update({ draft_data: draftData, updated_at: new Date().toISOString() })
    .eq("id", id).eq("user_id", userId).eq("updated_at", existing.updated_at).is("published_project_id", null)
    .select("id, source_project_id, draft_data, created_at, updated_at")
    .maybeSingle();
  if (!error && !data) return NextResponse.json({ error: tResponse("projects.publishConflict") }, { status: 409 });
  if (error) return NextResponse.json({ error: tResponse('System.m_6a45e8145d0e') }, { status: 500 });
  return NextResponse.json({ draft: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tResponse = await getResponseTranslations();
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;
  const { id } = await params;
  const { data, error } = await db.from("project_drafts")
    .delete().eq("id", id).eq("user_id", userId).is("published_project_id", null)
    .select("id").maybeSingle();
  if (error) return NextResponse.json({ error: tResponse('System.m_7ceea2763bb6') }, { status: 500 });
  if (!data) return NextResponse.json({ error: tResponse('System.m_36ae6da39735') }, { status: 404 });
  return NextResponse.json({ success: true });
}
