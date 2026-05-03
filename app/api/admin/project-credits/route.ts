import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/guards";
import { NextRequest, NextResponse } from "next/server";

// GET /api/admin/project-credits?project_id=xxx
export async function GET(req: NextRequest) {
  const adminResult = await requireAdmin();
  if (adminResult instanceof NextResponse) return adminResult;

  const { searchParams } = new URL(req.url);
  const project_id = searchParams.get("project_id");
  if (!project_id) return NextResponse.json({ error: "project_id fehlt" }, { status: 400 });

  const { data: credits, error } = await db
    .from("project_credits")
    .select("*")
    .eq("project_id", project_id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rawCredits = credits ?? [];
  const userIds = rawCredits.filter((c: { user_id: string | null }) => c.user_id).map((c: { user_id: string }) => c.user_id);
  const unclaimedIds = rawCredits.filter((c: { unclaimed_profile_id: string | null }) => c.unclaimed_profile_id).map((c: { unclaimed_profile_id: string }) => c.unclaimed_profile_id);

  const [profilesMap, ghostsMap] = await Promise.all([
    userIds.length > 0
      ? db.from("profiles").select("user_id, display_name, avatar_url").in("user_id", userIds)
          .then(({ data }) => Object.fromEntries((data ?? []).map((p: { user_id: string; display_name: string; avatar_url: string | null }) => [p.user_id, p])))
      : Promise.resolve({}),
    unclaimedIds.length > 0
      ? db.from("unclaimed_profiles").select("id, name, slug").in("id", unclaimedIds)
          .then(({ data }) => Object.fromEntries((data ?? []).map((p: { id: string; name: string; slug: string }) => [p.id, p])))
      : Promise.resolve({}),
  ]);

  const result = rawCredits.map((c: { id: string; user_id: string | null; unclaimed_profile_id: string | null; role: string; created_at: string }) => ({
    ...c,
    name: c.user_id
      ? ((profilesMap as Record<string, { display_name: string }>)[c.user_id]?.display_name ?? "Unbekannt")
      : ((ghostsMap as Record<string, { name: string }>)[c.unclaimed_profile_id ?? ""]?.name ?? "Unbekannt"),
    type: c.user_id ? "user" : "ghost",
  }));

  return NextResponse.json({ credits: result });
}

// PATCH /api/admin/project-credits — update role
export async function PATCH(req: NextRequest) {
  const adminResult = await requireAdmin();
  if (adminResult instanceof NextResponse) return adminResult;

  const body = await req.json().catch(() => null);
  if (!body?.id || !body?.role?.trim()) return NextResponse.json({ error: "id und role fehlen" }, { status: 400 });

  const { error } = await db
    .from("project_credits")
    .update({ role: body.role.trim() })
    .eq("id", body.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// DELETE /api/admin/project-credits?id=xxx
export async function DELETE(req: NextRequest) {
  const adminResult = await requireAdmin();
  if (adminResult instanceof NextResponse) return adminResult;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id fehlt" }, { status: 400 });

  const { error } = await db.from("project_credits").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
