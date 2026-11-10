import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { getTranslations as getResponseTranslations } from "next-intl/server";

// DELETE /api/project-festivals/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tResponse = await getResponseTranslations();
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const { id } = await params;

  // Verify ownership via project
  const { data: entry } = await db
    .from("project_festivals")
    .select("project_id, projects(created_by)")
    .eq("id", id)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createdBy = (entry?.projects as any)?.created_by;
  if (!entry || createdBy !== userId) {
    return NextResponse.json({ error: tResponse('System.m_df847a54c928') }, { status: 403 });
  }

  const { error } = await db
    .from("project_festivals")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: tResponse('System.requestFailed') }, { status: 500 });
  return NextResponse.json({ success: true });
}
