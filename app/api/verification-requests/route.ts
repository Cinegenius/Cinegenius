import { db } from "@/lib/db";
import { requireAuth, isAdminSession } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { finishAdminAudit, startAdminAudit, validateAdminReason } from "@/lib/admin-audit";

// GET /api/verification-requests — user: own status | admin: all requests
export async function GET(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const isAdmin = await isAdminSession();

  // Admin gets all
  if (isAdmin) {
    const pageSize = 50;
    const page = Math.max(1, Number.parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10) || 1);
    const { data, error, count } = await db
      .from("verification_requests")
      .select("id, user_id, display_name, status, notes, submitted_at, reviewed_at", { count: "exact" })
      .order("submitted_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data: (data ?? []).slice(0, pageSize), total: count ?? 0, page });
  }

  // Regular user gets own latest request
  const { data } = await db
    .from("verification_requests")
    .select("id, status, submitted_at, reviewed_at")
    .eq("user_id", userId)
    .order("submitted_at", { ascending: false })
    .limit(1);

  return NextResponse.json({ data: data ?? [] });
}

// POST /api/verification-requests — user submits verification request
export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  // Check for existing pending request
  const { data: existing } = await db
    .from("verification_requests")
    .select("id, status")
    .eq("user_id", userId)
    .in("status", ["pending", "approved"])
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: existing.status === "approved" ? "Bereits verifiziert" : "Bereits eine Anfrage gestellt" },
      { status: 400 }
    );
  }

  let notes: string | null = null;
  try {
    const body = await req.json();
    notes = body?.notes ?? null;
  } catch { /* no body */ }

  const { data: p } = await db
    .from("profiles")
    .select("display_name")
    .eq("user_id", userId)
    .maybeSingle();

  const { data, error } = await db
    .from("verification_requests")
    .insert({
      user_id: userId,
      display_name: p?.display_name ?? null,
      status: "pending",
      notes,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}

// PATCH /api/verification-requests — admin approves or rejects
export async function PATCH(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const isAdmin = await isAdminSession();
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const { requestId, action } = body ?? {};
  const reason = validateAdminReason(body?.reason);
  if (typeof requestId !== "string" || !requestId || !["approve", "reject"].includes(action) || !reason) {
    return NextResponse.json({ error: "Anfrage, Aktion und eine Begründung (5–500 Zeichen) sind erforderlich." }, { status: 400 });
  }

  const status = action === "approve" ? "approved" : "rejected";
  const audit = await startAdminAudit({ actorUserId: userId, action: `verification_${status}`, entityType: "verification_request", entityId: requestId, reason });
  if (!audit) return NextResponse.json({ error: "Aktion aus Sicherheitsgründen gestoppt: Das Adminprotokoll ist nicht verfügbar." }, { status: 503 });

  const { data: request, error: requestError } = await db
    .from("verification_requests")
    .update({ status, reviewed_at: new Date().toISOString(), reviewed_by: userId })
    .eq("id", requestId)
    .select("user_id")
    .single();

  if (requestError) { await finishAdminAudit(audit, "failed"); return NextResponse.json({ error: "Die Anfrage konnte nicht aktualisiert werden." }, { status: 500 }); }
  if (!request) { await finishAdminAudit(audit, "failed"); return NextResponse.json({ error: "Anfrage nicht gefunden." }, { status: 404 }); }

  // If approved, set verified on profile
  if (action === "approve") {
    const { error: profileError } = await db
      .from("profiles")
      .update({ verified: true })
      .eq("user_id", request.user_id);
    if (profileError) { await finishAdminAudit(audit, "failed"); return NextResponse.json({ error: "Anfrage wurde aktualisiert, aber das Profil konnte nicht verifiziert werden. Bitte Status prüfen." }, { status: 500 }); }
  }

  const auditLogged = await finishAdminAudit(audit, "succeeded");
  return NextResponse.json({ ok: true, auditLogged });
}
