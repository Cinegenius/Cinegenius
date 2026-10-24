import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/requireAdmin";
import { finishAdminAudit, startAdminAudit, validateAdminReason } from "@/lib/admin-audit";
import { validateSupportTemplateBody } from "@/lib/admin-support";

export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const { data, error } = await db.from("support_message_templates")
    .select("template_key, label, body, enabled, updated_at")
    .order("label", { ascending: true });
  if (error) return NextResponse.json({ error: "Supportvorlagen konnten nicht geladen werden. Bitte Migration prüfen." }, { status: 503 });
  return NextResponse.json({ templates: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const body = await request.json().catch(() => null);
  const key = typeof body?.templateKey === "string" ? body.templateKey.trim() : "";
  const label = typeof body?.label === "string" ? body.label.trim() : "";
  const content = typeof body?.body === "string" ? body.body : "";
  const reason = validateAdminReason(body?.reason);
  const validation = validateSupportTemplateBody(content);
  if (!/^[a-z0-9_-]{2,64}$/.test(key) || !label || label.length > 120 || !reason || validation) {
    return NextResponse.json({ error: validation ?? "Vorlagenschlüssel, Name und Begründung prüfen." }, { status: 400 });
  }
  const audit = await startAdminAudit({
    actorUserId: admin.userId, action: "support_template_create", entityType: "support_template",
    entityId: key, reason, metadata: { templateKey: key },
  });
  if (!audit) return NextResponse.json({ error: "Adminprotokoll nicht verfügbar; Vorlage wurde nicht gespeichert." }, { status: 503 });
  const { data, error } = await db.from("support_message_templates")
    .insert({ template_key: key, label, body: content, updated_by: admin.userId })
    .select("template_key, label, body, enabled, updated_at").maybeSingle();
  if (error || !data) {
    await finishAdminAudit(audit, "failed");
    return NextResponse.json({ error: error?.code === "23505" ? "Dieser Vorlagenschlüssel ist bereits vergeben." : "Vorlage konnte nicht gespeichert werden." }, { status: error?.code === "23505" ? 409 : 500 });
  }
  const auditLogged = await finishAdminAudit(audit, "succeeded");
  return NextResponse.json({ template: data, auditLogged }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const body = await request.json().catch(() => null);
  const key = typeof body?.templateKey === "string" ? body.templateKey.trim() : "";
  const label = typeof body?.label === "string" ? body.label.trim() : "";
  const content = typeof body?.body === "string" ? body.body : "";
  const enabled = body?.enabled;
  const reason = validateAdminReason(body?.reason);
  const validation = validateSupportTemplateBody(content);
  if (!/^[a-z0-9_-]{2,64}$/.test(key) || !label || label.length > 120 || typeof enabled !== "boolean" || !reason || validation) {
    return NextResponse.json({ error: validation ?? "Vorlage und Begründung prüfen." }, { status: 400 });
  }
  const audit = await startAdminAudit({
    actorUserId: admin.userId, action: "support_template_update", entityType: "support_template",
    entityId: key, reason, metadata: { templateKey: key, enabled },
  });
  if (!audit) return NextResponse.json({ error: "Adminprotokoll nicht verfügbar; Vorlage wurde nicht gespeichert." }, { status: 503 });
  const { data, error } = await db.from("support_message_templates")
    .update({ label, body: content, enabled, updated_by: admin.userId, updated_at: new Date().toISOString() })
    .eq("template_key", key)
    .select("template_key, label, body, enabled, updated_at").maybeSingle();
  if (error || !data) {
    await finishAdminAudit(audit, "failed");
    return NextResponse.json({ error: error ? "Vorlage konnte nicht gespeichert werden." : "Vorlage nicht gefunden." }, { status: error ? 500 : 404 });
  }
  const auditLogged = await finishAdminAudit(audit, "succeeded");
  return NextResponse.json({ template: data, auditLogged });
}

