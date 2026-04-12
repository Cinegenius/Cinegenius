import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/project-festivals?project_id=xxx
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const project_id = searchParams.get("project_id");
  if (!project_id) return NextResponse.json({ error: "project_id fehlt" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("project_festivals")
    .select("*")
    .eq("project_id", project_id)
    .order("year", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ festivals: data ?? [] });
}

// POST /api/project-festivals
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const body = await req.json();
  const { project_id, festival_name, year, section, status, award_name, notes } = body;

  if (!project_id || !festival_name?.trim() || !year || !status) {
    return NextResponse.json({ error: "Pflichtfelder fehlen" }, { status: 400 });
  }

  // Verify the user owns this project
  const { data: project } = await supabaseAdmin
    .from("projects")
    .select("created_by")
    .eq("id", project_id)
    .single();

  if (!project || project.created_by !== userId) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ festival: data });
}
