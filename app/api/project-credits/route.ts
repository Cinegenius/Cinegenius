import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

// POST /api/project-credits
// - Without unclaimed_profile_id: adds the authenticated user themselves
// - With unclaimed_profile_id: adds a ghost profile (only project creator allowed)
export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const { allowed } = await rateLimit(`credits:${userId}`, 20, 60);
  if (!allowed) return NextResponse.json({ error: "Zu viele Anfragen" }, { status: 429 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  const { project_id, role, unclaimed_profile_id } = body;

  if (!project_id || !role?.trim()) {
    return NextResponse.json({ error: "project_id und role sind Pflichtfelder" }, { status: 400 });
  }

  const { data: project } = await db
    .from("projects")
    .select("id, created_by")
    .eq("id", project_id)
    .maybeSingle();

  if (!project) return NextResponse.json({ error: "Projekt nicht gefunden" }, { status: 404 });

  let insertPayload: Record<string, unknown>;

  if (unclaimed_profile_id) {
    // Adding a ghost profile — only the project creator may do this
    if (project.created_by !== userId) {
      return NextResponse.json({ error: "Nur der Ersteller darf Teammitglieder hinzufügen" }, { status: 403 });
    }
    insertPayload = { project_id, unclaimed_profile_id, role: role.trim() };
  } else {
    // Self-join
    insertPayload = { project_id, user_id: userId, role: role.trim() };
  }

  const { data, error } = await db
    .from("project_credits")
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Bereits in diesem Projekt eingetragen" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidateTag("projects");
  return NextResponse.json({ credit: data });
}

// DELETE /api/project-credits?project_id=xxx — remove yourself
export async function DELETE(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const { searchParams } = new URL(req.url);
  const project_id = searchParams.get("project_id");
  if (!project_id) return NextResponse.json({ error: "project_id fehlt" }, { status: 400 });

  const { error } = await db
    .from("project_credits")
    .delete()
    .eq("project_id", project_id)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  revalidateTag("projects");
  return NextResponse.json({ success: true });
}

// GET /api/project-credits?user_id=xxx — get all credits for a user
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const user_id = searchParams.get("user_id");
  if (!user_id) return NextResponse.json({ error: "user_id fehlt" }, { status: 400 });

  const { data: credits, error } = await db
    .from("project_credits")
    .select("id, role, created_at, project_id, projects(id, title, year, type, director, poster_url, metadata)")
    .eq("user_id", user_id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ credits: credits ?? [] });
}
