import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { getTranslations as getResponseTranslations } from "next-intl/server";

// GET /api/project-festivals?project_id=xxx
export async function GET(req: NextRequest) {
  const tResponse = await getResponseTranslations();
  const { searchParams } = new URL(req.url);
  const project_id = searchParams.get("project_id");
  if (!project_id) return NextResponse.json({ error: tResponse('System.m_87e6682e9396') }, { status: 400 });

  const { data, error } = await db
    .from("project_festivals")
    .select("*")
    .eq("project_id", project_id)
    .order("year", { ascending: false });

  if (error) return NextResponse.json({ error: tResponse('System.requestFailed') }, { status: 500 });
  return NextResponse.json({ festivals: data ?? [] });
}

// POST /api/project-festivals
export async function POST(req: NextRequest) {
  const tResponse = await getResponseTranslations();
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const body = await req.json();
  const { project_id, festival_name, year, section, status, award_name, notes } = body;

  if (!project_id || !festival_name?.trim() || !year || !status) {
    return NextResponse.json({ error: tResponse('System.m_931da94b6c23') }, { status: 400 });
  }

  // Verify the user owns this project
  const { data: project } = await db
    .from("projects")
    .select("created_by")
    .eq("id", project_id)
    .single();

  if (!project || project.created_by !== userId) {
    return NextResponse.json({ error: tResponse('System.m_df847a54c928') }, { status: 403 });
  }

  const { data, error } = await db
    .from("project_festivals")
    .insert({
      project_id,
      festival_name: festival_name.trim(),
      year: Number(year),
      section: section?.trim() || null,
      status,
      award_name: award_name?.trim() || null,
      notes: notes?.trim() || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: tResponse('System.requestFailed') }, { status: 500 });
  return NextResponse.json({ festival: data });
}
