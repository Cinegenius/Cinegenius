import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/projects?q=titel&limit=10
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50);

  let query = supabaseAdmin
    .from("projects")
    .select("id, title, year, type, director, poster_url")
    .order("year", { ascending: false })
    .limit(limit);

  if (q) {
    query = query.ilike("title", `%${q}%`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ projects: data ?? [] });
}

// POST /api/projects — create new project
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const body = await req.json();
  const { title, year, type, description, director, poster_url, images, myRole } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: "Titel ist Pflichtfeld" }, { status: 400 });
  }

  // Create project
  const { data: project, error: projError } = await supabaseAdmin
    .from("projects")
    .insert({
      title: title.trim(),
      year: year ? parseInt(year) : null,
      type: type || null,
      description: description?.trim() || null,
      director: director?.trim() || null,
      poster_url: poster_url || null,
      images: images ?? [],
      created_by: userId,
    })
    .select()
    .single();

  if (projError) return NextResponse.json({ error: projError.message }, { status: 500 });

  // Auto-add creator with their role
  if (myRole?.trim()) {
    await supabaseAdmin.from("project_credits").insert({
      project_id: project.id,
      user_id: userId,
      role: myRole.trim(),
    });
  }

  return NextResponse.json({ project });
}
