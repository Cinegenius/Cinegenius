import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

// POST /api/project-credits — add yourself to a project
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { project_id, role } = await req.json();
  if (!project_id || !role?.trim()) {
    return NextResponse.json({ error: "project_id und role sind Pflichtfelder" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("project_credits")
    .insert({ project_id, user_id: userId, role: role.trim() })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Du bist bereits in diesem Projekt eingetragen" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ credit: data });
}

// DELETE /api/project-credits?project_id=xxx — remove yourself
export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const project_id = searchParams.get("project_id");
  if (!project_id) return NextResponse.json({ error: "project_id fehlt" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("project_credits")
    .delete()
    .eq("project_id", project_id)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// GET /api/project-credits?user_id=xxx — get all credits for a user
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const user_id = searchParams.get("user_id");
  if (!user_id) return NextResponse.json({ error: "user_id fehlt" }, { status: 400 });

  const { data: credits, error } = await supabaseAdmin
    .from("project_credits")
    .select("id, role, created_at, project_id, projects(id, title, year, type, director, poster_url, metadata)")
    .eq("user_id", user_id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ credits: credits ?? [] });
}
