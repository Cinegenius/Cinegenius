import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/guards";
import { NextRequest, NextResponse } from "next/server";
import { finishAdminAudit, startAdminAudit, validateAdminReason } from "@/lib/admin-audit";

// GET /api/admin/projects?search=&page=1
export async function GET(req: NextRequest) {
  const adminResult = await requireAdmin();
  if (adminResult instanceof NextResponse) return adminResult;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = 30;
  const offset = (page - 1) * limit;

  let query = db
    .from("projects")
    .select("id, title, year, type, verified, created_at, created_by, director", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) query = query.ilike("title", `%${search.slice(0, 80).replace(/[%,()]/g, " ")}%`);

  const { data: projects, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch crew counts
  const ids = (projects ?? []).map((p: { id: string }) => p.id);
  const crewCounts: Record<string, number> = {};
  if (ids.length > 0) {
    const { data: credits } = await db
      .from("project_credits")
      .select("project_id")
      .in("project_id", ids);
    for (const c of credits ?? []) {
      crewCounts[c.project_id] = (crewCounts[c.project_id] ?? 0) + 1;
    }
  }

  const result = (projects ?? []).map((p: Record<string, unknown>) => ({
    ...p,
    crew_count: crewCounts[p.id as string] ?? 0,
  }));

  return NextResponse.json({ projects: result, total: count ?? 0 });
}

// PATCH /api/admin/projects — toggle verified
export async function PATCH(req: NextRequest) {
  const adminResult = await requireAdmin();
  if (adminResult instanceof NextResponse) return adminResult;

  const body = await req.json().catch(() => null);
  const reason = validateAdminReason(body?.reason);
  if (typeof body?.projectId !== "string" || typeof body?.verified !== "boolean" || !reason) {
    return NextResponse.json({ error: "Projekt, Status und eine Begründung (5–500 Zeichen) sind erforderlich." }, { status: 400 });
  }

  const audit = await startAdminAudit({ actorUserId: adminResult.userId, action: body.verified ? "project_verify" : "project_unverify", entityType: "project", entityId: body.projectId, reason });
  if (!audit) return NextResponse.json({ error: "Aktion aus Sicherheitsgründen gestoppt: Das Adminprotokoll ist nicht verfügbar." }, { status: 503 });
  const { data, error } = await db
    .from("projects")
    .update({ verified: body.verified })
    .eq("id", body.projectId)
    .select("id, verified")
    .maybeSingle();

  if (error) { await finishAdminAudit(audit, "failed"); return NextResponse.json({ error: error.message }, { status: 500 }); }
  if (!data) { await finishAdminAudit(audit, "failed"); return NextResponse.json({ error: "Projekt nicht gefunden." }, { status: 404 }); }
  const auditLogged = await finishAdminAudit(audit, "succeeded");
  return NextResponse.json({ success: true, auditLogged });
}
