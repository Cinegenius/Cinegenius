import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/projects/[id] — project detail with credits + profiles
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: project, error } = await supabaseAdmin
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !project) {
    return NextResponse.json({ error: "Projekt nicht gefunden" }, { status: 404 });
  }

  // Fetch credits with profile data
  const { data: credits } = await supabaseAdmin
    .from("project_credits")
    .select("id, user_id, role, created_at")
    .eq("project_id", id)
    .order("created_at", { ascending: true });

  const userIds = (credits ?? []).map((c) => c.user_id);
  let profiles: Record<string, { display_name: string; avatar_url: string | null; role: string | null }> = {};

  if (userIds.length > 0) {
    const { data: profileData } = await supabaseAdmin
      .from("profiles")
      .select("user_id, display_name, avatar_url, role")
      .in("user_id", userIds);

    profiles = Object.fromEntries(
      (profileData ?? []).map((p) => [p.user_id, p])
    );
  }

  const creditsWithProfiles = (credits ?? []).map((c) => ({
    ...c,
    profile: profiles[c.user_id] ?? null,
  }));

  return NextResponse.json({ project, credits: creditsWithProfiles });
}

// PATCH /api/projects/[id] — update project (only creator)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const { data: project } = await supabaseAdmin
    .from("projects")
    .select("created_by")
    .eq("id", id)
    .single();

  if (!project || project.created_by !== userId) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const { error } = await supabaseAdmin
    .from("projects")
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
