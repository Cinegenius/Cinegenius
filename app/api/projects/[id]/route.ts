import { db } from "@/lib/db";
import { requireAuth, assertOwner } from "@/lib/guards";
import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

// GET /api/projects/[id] — public project detail (no auth required)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: project, error } = await db
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !project) {
    return NextResponse.json({ error: "Projekt nicht gefunden" }, { status: 404 });
  }

  const { data: credits } = await db
    .from("project_credits")
    .select("id, user_id, role, created_at")
    .eq("project_id", id)
    .order("created_at", { ascending: true });

  const userIds = (credits ?? []).map((c) => c.user_id);
  let profiles: Record<string, { display_name: string; avatar_url: string | null; role: string | null }> = {};

  if (userIds.length > 0) {
    const { data: profileData } = await db
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

// PATCH /api/projects/[id] — update own project
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const { id } = await params;

  // Fetch project — never trust client on ownership
  const { data: project } = await db
    .from("projects")
    .select("id, created_by")
    .eq("id", id)
    .maybeSingle();

  const ownershipError = assertOwner(project?.created_by, userId);
  if (ownershipError) return ownershipError;

  const body = await req.json();

  // Explicit allowlist — prevents injection of id, created_by, or arbitrary columns
  const ALLOWED_KEYS = [
    "title", "year", "type", "description", "director",
    "poster_url", "images", "metadata", "genre",
  ] as const;

  const updates: Record<string, unknown> = {};
  for (const key of ALLOWED_KEYS) {
    if (key in body) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Keine gültigen Felder" }, { status: 400 });
  }

  updates["updated_at"] = new Date().toISOString();

  const { error } = await db
    .from("projects")
    .update(updates)
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
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
