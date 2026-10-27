import { auth } from "@clerk/nextjs/server";
import { visibleLinkedProfileIds } from "@/lib/linked-profile-access";
import { db } from "@/lib/db";
import { requireAuth, assertOwner } from "@/lib/guards";
import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { saveProjectDraft } from "@/lib/project-drafts-server";
import { getProjectRecord } from "@/lib/project-records-server";
import { toPublicProjectRecord } from "@/lib/project-record";

// GET /api/projects/[id] — public project detail (no auth required)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const projectResult = await getProjectRecord(id);
  if (projectResult.kind === "not_found") return NextResponse.json({ error: "Projekt nicht gefunden" }, { status: 404 });
  if (projectResult.kind === "error") return NextResponse.json({ error: "Projekt konnte nicht geladen werden." }, { status: 500 });

  const { data: credits, error: creditsError } = await db
    .from("project_credits")
    .select("id, user_id, role, created_at")
    .eq("project_id", id)
    .order("created_at", { ascending: true });
  if (creditsError) return NextResponse.json({ error: "Projektmitwirkende konnten nicht geladen werden." }, { status: 500 });

  const { userId: viewerId } = await auth();
  const visibleIds = await visibleLinkedProfileIds((credits ?? []).map((c) => c.user_id), viewerId);
  const userIds = [...visibleIds];
  let profiles: Record<string, { display_name: string; avatar_url: string | null; role: string | null }> = {};

  if (userIds.length > 0) {
    const { data: profileData, error: profilesError } = await db
      .from("profiles")
      .select("user_id, display_name, avatar_url, role")
      .in("user_id", userIds);
    if (profilesError) return NextResponse.json({ error: "Mitwirkendenprofile konnten nicht geladen werden." }, { status: 500 });

    profiles = Object.fromEntries(
      (profileData ?? []).map((p) => [p.user_id, p])
    );
  }

  const creditsWithProfiles = (credits ?? []).map((c) => ({
    id: c.id,
    role: c.role,
    created_at: c.created_at,
    profile: profiles[c.user_id] ? {
      display_name: profiles[c.user_id].display_name,
      avatar_url: profiles[c.user_id].avatar_url,
      role: profiles[c.user_id].role,
    } : null,
  }));

  return NextResponse.json({ project: toPublicProjectRecord(projectResult.project), credits: creditsWithProfiles });
}

// PATCH /api/projects/[id] — save an owner-only working copy; public data changes on publish.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length === 0) {
    return NextResponse.json({ error: "Keine gültigen Felder" }, { status: 400 });
  }
  const result = await saveProjectDraft(userId, { sourceProjectId: id, draftData: body });
  if (result.error) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ success: true, draftId: result.draft.id });
}

// DELETE /api/projects/[id] — delete own project
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const { id } = await params;

  // Pre-fetch to verify existence and ownership
  const { data: project } = await db
    .from("projects")
    .select("id, created_by")
    .eq("id", id)
    .maybeSingle();

  const ownershipError = assertOwner(project?.created_by, userId);
  if (ownershipError) return ownershipError;

  // Delete credits first (referential integrity)
  await db.from("project_credits").delete().eq("project_id", id);
  await db.from("project_festivals").delete().eq("project_id", id);

  const { error } = await db
    .from("projects")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  revalidateTag("profiles", "max");
  revalidateTag("projects", "max");
  return NextResponse.json({ success: true });
}
