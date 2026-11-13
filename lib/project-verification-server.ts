import { db } from "@/lib/db";
import { startAdminAudit, finishAdminAudit } from "@/lib/admin-audit";

/** Called only after requireAdmin; binds verification to the revision reviewed. */
export async function setProjectVerification(input: {
  projectId: string; actorUserId: string; verified: boolean; reason: string; expectedUpdatedAt: string | null;
}) {
  const { data: current, error } = await db.from("projects").select("id, metadata, updated_at")
    .eq("id", input.projectId).maybeSingle();
  if (error) return { kind: "error" as const };
  if (!current) return { kind: "missing" as const };
  if (current.updated_at !== input.expectedUpdatedAt) return { kind: "conflict" as const };
  const audit = await startAdminAudit({ actorUserId: input.actorUserId, action: input.verified ? "project_verify" : "project_unverify",
    entityType: "project", entityId: input.projectId, reason: input.reason,
    metadata: { reviewedUpdatedAt: current.updated_at } });
  if (!audit) return { kind: "error" as const };
  const metadata = current.metadata && typeof current.metadata === "object" && !Array.isArray(current.metadata) ? current.metadata : {};
  const details = metadata.project_details && typeof metadata.project_details === "object" && !Array.isArray(metadata.project_details) ? metadata.project_details : {};
  const updatedAt = new Date().toISOString();
  let update = db.from("projects").update({ metadata: { ...metadata, project_details: { ...details, verified: input.verified } }, updated_at: updatedAt }).eq("id", input.projectId);
  update = current.updated_at === null ? update.is("updated_at", null) : update.eq("updated_at", current.updated_at);
  const result = await update.select("id, updated_at").maybeSingle();
  if (result.error || !result.data) {
    await finishAdminAudit(audit, "failed");
    return { kind: result.error ? "error" as const : "conflict" as const };
  }
  const auditLogged = await finishAdminAudit(audit, "succeeded");
  return { kind: "success" as const, verified: input.verified, updatedAt: result.data.updated_at, auditLogged };
}
