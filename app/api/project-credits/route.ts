import { publicProjectCredits } from "@/lib/project-media-rights";
import { auth } from "@clerk/nextjs/server";
import { canViewProfile } from "@/lib/trust";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getTranslations as getResponseTranslations } from "next-intl/server";

// POST /api/project-credits
// - Without unclaimed_profile_id: adds the authenticated user themselves
// - With unclaimed_profile_id: adds a ghost profile (only project creator allowed)
export async function POST(req: NextRequest) {
  const tResponse = await getResponseTranslations();
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const { allowed } = await rateLimit(`credits:${userId}`, 20, 60);
  if (!allowed) return NextResponse.json({ error: tResponse('System.m_81fb442ffb75') }, { status: 429 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: tResponse('System.m_0e4698bf4051') }, { status: 400 });
  const { project_id, role, unclaimed_profile_id } = body;

  if (typeof project_id !== "string" || typeof role !== "string" || !role.trim() || role.length > 500) {
    return NextResponse.json({ error: tResponse('System.m_e646adc1f282') }, { status: 400 });
  }

  const { data: project } = await db
    .from("projects")
    .select("id, created_by")
    .eq("id", project_id)
    .maybeSingle();

  if (!project) return NextResponse.json({ error: tResponse('System.m_67d6f019a7f1') }, { status: 404 });

  let insertPayload: Record<string, unknown>;

  if (unclaimed_profile_id) {
    // Adding a ghost profile — only the project creator may do this
    if (project.created_by !== userId) {
      return NextResponse.json({ error: tResponse('System.m_e956f1d8d8c3') }, { status: 403 });
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
      return NextResponse.json({ error: tResponse('System.m_435daa3e52dc') }, { status: 409 });
    }
    return NextResponse.json({ error: tResponse('System.requestFailed') }, { status: 500 });
  }

  revalidateTag("projects", { expire: 0 });
  return NextResponse.json({ credit: data });
}

// DELETE /api/project-credits?project_id=xxx — remove yourself
export async function DELETE(req: NextRequest) {
  const tResponse = await getResponseTranslations();
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const { searchParams } = new URL(req.url);
  const project_id = searchParams.get("project_id");
  if (!project_id) return NextResponse.json({ error: tResponse('System.m_87e6682e9396') }, { status: 400 });

  const { error } = await db
    .from("project_credits")
    .delete()
    .eq("project_id", project_id)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: tResponse('System.requestFailed') }, { status: 500 });
  revalidateTag("projects", { expire: 0 });
  return NextResponse.json({ success: true });
}

// PATCH /api/project-credits — update collaborator on a credit
export async function PATCH(req: NextRequest) {
  const tResponse = await getResponseTranslations();
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: tResponse('System.m_0e4698bf4051') }, { status: 400 });
  const { id, collaborator, role } = body;
  if (typeof id !== "string" || (role !== undefined && (typeof role !== "string" || !role.trim() || role.length > 500)) || (collaborator !== undefined && typeof collaborator !== "string")) return NextResponse.json({ error: tResponse('System.m_0e4698bf4051') }, { status: 400 });

  // Fetch the current credit to verify ownership and get existing role
  const { data: existing } = await db
    .from("project_credits")
    .select("id, user_id, role")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!existing) return NextResponse.json({ error: tResponse('System.m_35fb5ac8ec9b') }, { status: 404 });

  // Keep the role part, replace or remove the collaborator part
  const baseRole = existing.role.split("||")[0].trim();
  const newRole = typeof role === "string" ? role.trim() : collaborator?.trim() ? `${baseRole}||${collaborator.trim()}` : baseRole;

  const { error } = await db
    .from("project_credits")
    .update({ role: newRole })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: tResponse('System.requestFailed') }, { status: 500 });
  revalidateTag("projects", { expire: 0 });
  return NextResponse.json({ role: newRole });
}

// GET /api/project-credits?user_id=xxx — get all credits for a user
export async function GET(req: NextRequest) {
  const tResponse = await getResponseTranslations();
  const { searchParams } = new URL(req.url);
  const user_id = searchParams.get("user_id");
  if (!user_id) return NextResponse.json({ error: tResponse('System.m_95f8fe866ff4') }, { status: 400 });

  const { userId: viewerId } = await auth();
  if (!await canViewProfile(user_id, viewerId)) return new NextResponse(null, { status: 404, headers: { "Cache-Control": "private, no-store" } });

  const { data: credits, error } = await db
    .from("project_credits")
    .select("id, role, created_at, project_id, projects(id, title, year, type, director, poster_url, metadata, created_by)")
    .eq("user_id", user_id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: tResponse('System.requestFailed') }, { status: 500 });
  return NextResponse.json({ credits: publicProjectCredits(credits ?? []) });
}
