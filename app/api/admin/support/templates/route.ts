import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/requireAdmin";
import { finishAdminAudit, startAdminAudit, validateAdminReason } from "@/lib/admin-audit";
import { validateSupportTemplateBody } from "@/lib/admin-support";
import { getTranslations } from "next-intl/server";
import { SETUP_TEMPLATE_KEY, setupSupportTemplate } from "@/lib/support-setup-template";
import { STARTED_OFFER_TEMPLATE_KEY, startedOfferTemplate } from "@/lib/support-started-offer-template";
import { getTranslations as getResponseTranslations } from "next-intl/server";

export async function GET() {
  const tResponse = await getResponseTranslations();
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const { data, error } = await db.from("support_message_templates")
    .select("template_key, label, body, enabled, updated_at")
    .order("label", { ascending: true });
  if (error) return NextResponse.json({ error: tResponse('System.m_2b2ee587f27e') }, { status: 503 });
  const templates = data ?? [];
  if (!templates.some(template => template.template_key === SETUP_TEMPLATE_KEY)) {
    templates.push({ ...setupSupportTemplate(await getTranslations("AdminAccounts")), updated_at: null });
  }
  if (!templates.some(template => template.template_key === STARTED_OFFER_TEMPLATE_KEY)) {
    templates.push({ ...startedOfferTemplate(await getTranslations("AdminStartedOffers")), updated_at: null });
  }
  return NextResponse.json({ templates }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: NextRequest) {
  const tResponse = await getResponseTranslations();
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const body = await request.json().catch(() => null);
  const key = typeof body?.templateKey === "string" ? body.templateKey.trim() : "";
  const label = typeof body?.label === "string" ? body.label.trim() : "";
  const content = typeof body?.body === "string" ? body.body : "";
  const reason = validateAdminReason(body?.reason);
  const validation = validateSupportTemplateBody(content,tResponse);
  if (!/^[a-z0-9_-]{2,64}$/.test(key) || !label || label.length > 120 || !reason || validation) {
    return NextResponse.json({ error: validation ?? tResponse("ServerCopy.s_da25f225da64") }, { status: 400 });
  }
  const audit = await startAdminAudit({
    actorUserId: admin.userId, action: "support_template_create", entityType: "support_template",
    entityId: key, reason, metadata: { templateKey: key },
  });
  if (!audit) return NextResponse.json({ error: tResponse('System.m_47715bffda08') }, { status: 503 });
  const { data, error } = await db.from("support_message_templates")
    .insert({ template_key: key, label, body: content, updated_by: admin.userId })
    .select("template_key, label, body, enabled, updated_at").maybeSingle();
  if (error || !data) {
    await finishAdminAudit(audit, "failed");
    return NextResponse.json({ error: error?.code === "23505" ? tResponse("System.supportTemplateKeyTaken") : tResponse("Ui.text_e9c68d231f1fa4") }, { status: error?.code === "23505" ? 409 : 500 });
  }
  const auditLogged = await finishAdminAudit(audit, "succeeded");
  return NextResponse.json({ template: data, auditLogged }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const tResponse = await getResponseTranslations();
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const body = await request.json().catch(() => null);
  const key = typeof body?.templateKey === "string" ? body.templateKey.trim() : "";
  const label = typeof body?.label === "string" ? body.label.trim() : "";
  const content = typeof body?.body === "string" ? body.body : "";
  const enabled = body?.enabled;
  const reason = validateAdminReason(body?.reason);
  const validation = validateSupportTemplateBody(content,tResponse);
  if (!/^[a-z0-9_-]{2,64}$/.test(key) || !label || label.length > 120 || typeof enabled !== "boolean" || !reason || validation) {
    return NextResponse.json({ error: validation ?? tResponse("ServerCopy.s_7f086358889c") }, { status: 400 });
  }
  const audit = await startAdminAudit({
    actorUserId: admin.userId, action: "support_template_update", entityType: "support_template",
    entityId: key, reason, metadata: { templateKey: key, enabled },
  });
  if (!audit) return NextResponse.json({ error: tResponse('System.m_47715bffda08') }, { status: 503 });
  const values = { label, body: content, enabled, updated_by: admin.userId, updated_at: new Date().toISOString() };
  const query = [SETUP_TEMPLATE_KEY, STARTED_OFFER_TEMPLATE_KEY].includes(key)
    ? db.from("support_message_templates").upsert({ template_key: key, ...values }, { onConflict: "template_key" })
    : db.from("support_message_templates").update(values).eq("template_key", key);
  const { data, error } = await query.select("template_key, label, body, enabled, updated_at").maybeSingle();
  if (error || !data) {
    await finishAdminAudit(audit, "failed");
    return NextResponse.json({ error: error ? tResponse("Ui.text_e9c68d231f1fa4") : tResponse("System.supportTemplateMissing") }, { status: error ? 500 : 404 });
  }
  const auditLogged = await finishAdminAudit(audit, "succeeded");
  return NextResponse.json({ template: data, auditLogged });
}

