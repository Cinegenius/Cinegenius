import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/guards";
import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getTranslations as getResponseTranslations } from "next-intl/server";

// POST /api/projects/[id]/verify — admin only, toggles verified flag
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tResponse = await getResponseTranslations();
  const adminResult = await requireAdmin();
  if (adminResult instanceof NextResponse) return adminResult;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const verified = body.verified !== false; // default true

  const { data: current, error: currentError } = await db
    .from("projects")
    .select("id, metadata")
    .eq("id", id)
    .maybeSingle();

  if (currentError) return NextResponse.json({ error: tResponse('System.m_2ca35ef7b5b2') }, { status: 500 });
  if (!current) return NextResponse.json({ error: tResponse('System.m_bfbc36f441fc') }, { status: 404 });

  const currentMetadata = current.metadata && typeof current.metadata === "object" && !Array.isArray(current.metadata)
    ? current.metadata as Record<string, unknown>
    : {};
  const currentDetails = currentMetadata.project_details && typeof currentMetadata.project_details === "object" && !Array.isArray(currentMetadata.project_details)
    ? currentMetadata.project_details as Record<string, unknown>
    : {};
  const { data, error } = await db.from("projects")
    .update({ metadata: { ...currentMetadata, project_details: { ...currentDetails, verified } }, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: tResponse('System.requestFailed') }, { status: 500 });
  if (!data) return NextResponse.json({ error: tResponse('System.m_9df36bfde46c') }, { status: 404 });
  revalidateTag("profiles", "max");
  revalidateTag("projects", "max");
  return NextResponse.json({ success: true, verified });
}
