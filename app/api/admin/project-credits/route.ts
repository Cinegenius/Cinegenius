import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/guards";
import { NextRequest, NextResponse } from "next/server";
import { finishAdminAudit, startAdminAudit, validateAdminReason } from "@/lib/admin-audit";

// GET /api/admin/project-credits?project_id=xxx
export async function GET(req: NextRequest) {
  const adminResult = await requireAdmin();
  if (adminResult instanceof NextResponse) return adminResult;

  const { searchParams } = new URL(req.url);
  const project_id = searchParams.get("project_id");
  if (!project_id) return NextResponse.json({ error: "project_id fehlt" }, { status: 400 });
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = 50;

  const { data: credits, error, count } = await db
    .from("project_credits")
    .select("*", { count: "exact" })
    .eq("project_id", project_id)
    .order("created_at", { ascending: true })
    .range((page - 1) * pageSize, page * pageSize - 1);

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

  return NextResponse.json({ credits: result, page, pageSize, total: count ?? 0 });
}

// PATCH /api/admin/project-credits — update role
export async function PATCH(req: NextRequest) {
  const adminResult = await requireAdmin();
  if (adminResult instanceof NextResponse) return adminResult;

  const body = await req.json().catch(() => null);
  const reason = validateAdminReason(body?.reason);
  if (typeof body?.id !== "string" || !body.id || typeof body?.role !== "string" || !body.role.trim() || !reason) {
    return NextResponse.json({ error: "ID, Funktion und eine Begründung (5–500 Zeichen) sind erforderlich." }, { status: 400 });
  }

  const audit = await startAdminAudit({ actorUserId: adminResult.userId, action: "project_credit_role_change", entityType: "project_credit", entityId: body.id, reason });
  if (!audit) return NextResponse.json({ error: "Aktion aus Sicherheitsgründen gestoppt: Das Adminprotokoll ist nicht verfügbar." }, { status: 503 });
  const { data, error } = await db
    .from("project_credits")
    .update({ role: body.role.trim() })
    .eq("id", body.id)
    .select("id, project_id")
    .maybeSingle();

  if (error) { await finishAdminAudit(audit, "failed"); return NextResponse.json({ error: error.message }, { status: 500 }); }
  if (!data) { await finishAdminAudit(audit, "failed"); return NextResponse.json({ error: "Crewzuordnung nicht gefunden." }, { status: 404 }); }
  const auditLogged = await finishAdminAudit(audit, "succeeded");
  return NextResponse.json({ success: true, auditLogged });
}

// DELETE /api/admin/project-credits?id=xxx
export async function DELETE(req: NextRequest) {
  const adminResult = await requireAdmin();
  if (adminResult instanceof NextResponse) return adminResult;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const reason = validateAdminReason(searchParams.get("reason"));
  if (!id || !reason || searchParams.get("confirm") !== "true") return NextResponse.json({ error: "ID, Begründung und ausdrückliche Bestätigung erforderlich." }, { status: 400 });

  const audit = await startAdminAudit({ actorUserId: adminResult.userId, action: "project_credit_delete", entityType: "project_credit", entityId: id, reason });
  if (!audit) return NextResponse.json({ error: "Aktion aus Sicherheitsgründen gestoppt: Das Adminprotokoll ist nicht verfügbar." }, { status: 503 });
  const { data, error } = await db.from("project_credits").delete().eq("id", id).select("id").maybeSingle();
  if (error) { await finishAdminAudit(audit, "failed"); return NextResponse.json({ error: error.message }, { status: 500 }); }
  if (!data) { await finishAdminAudit(audit, "failed"); return NextResponse.json({ error: "Crewzuordnung nicht gefunden." }, { status: 404 }); }
  const auditLogged = await finishAdminAudit(audit, "succeeded");
  return NextResponse.json({ success: true, auditLogged });
}
