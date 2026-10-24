import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/requireAdmin";
import { NextRequest, NextResponse } from "next/server";
import { finishAdminAudit, startAdminAudit, validateAdminReason } from "@/lib/admin-audit";

// GET /api/admin/users — list all profiles for admin user management
export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = 50;

  let query = db
    .from("profiles")
    .select("user_id, display_name, location, avatar_url, profile_types, verified, created_at, tagline", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (search.startsWith("user_")) {
    query = query.eq("user_id", search.slice(0, 100));
  } else if (search) {
    query = query.ilike("display_name", `%${search}%`);
  }

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ users: data ?? [], total: count ?? 0, page, pageSize });
}

// PATCH /api/admin/users — toggle verified flag
export async function PATCH(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const body = await req.json().catch(() => null);
  const { targetUserId, verified } = body ?? {};
  const reason = validateAdminReason(body?.reason);
  if (typeof targetUserId !== "string" || !targetUserId || typeof verified !== "boolean" || !reason) {
    return NextResponse.json({ error: "Nutzer-ID, Status und eine Begründung (5–500 Zeichen) sind erforderlich." }, { status: 400 });
  }

  const audit = await startAdminAudit({ actorUserId: guard.userId, action: verified ? "profile_verify" : "profile_unverify", entityType: "profile", entityId: targetUserId, reason });
  if (!audit) return NextResponse.json({ error: "Aktion aus Sicherheitsgründen gestoppt: Das Adminprotokoll ist nicht verfügbar." }, { status: 503 });
  const { data, error } = await db
    .from("profiles")
    .update({ verified })
    .eq("user_id", targetUserId)
    .select("user_id, verified")
    .maybeSingle();

  if (error) { await finishAdminAudit(audit, "failed"); return NextResponse.json({ error: error.message }, { status: 500 }); }
  if (!data) { await finishAdminAudit(audit, "failed"); return NextResponse.json({ error: "Profil nicht gefunden." }, { status: 404 }); }

  const auditLogged = await finishAdminAudit(audit, "succeeded");
  return NextResponse.json({ success: true, auditLogged });
}
