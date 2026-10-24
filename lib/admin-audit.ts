import { db } from "@/lib/db";
export { validateAdminReason } from "@/lib/admin-policy";

export type AdminAuditInput = {
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  reason: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export type AdminAuditRecord = { id: string };

/** Writes only administrative action context; never pass user secrets or message bodies. */
export async function startAdminAudit(input: AdminAuditInput): Promise<AdminAuditRecord | null> {
  const { data, error } = await db.from("admin_audit_log").insert({
    actor_user_id: input.actorUserId,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId,
    reason: input.reason,
    metadata: input.metadata ?? {},
    outcome: "started",
  }).select("id").single();
  if (error || !data) return null;
  return { id: data.id };
}

export async function finishAdminAudit(record: AdminAuditRecord, outcome: "succeeded" | "failed"): Promise<boolean> {
  const { error } = await db.from("admin_audit_log").update({ outcome }).eq("id", record.id);
  return !error;
}
