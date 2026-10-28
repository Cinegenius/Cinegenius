/** `published` is the effective public flag, maintained by the database guard.
 * Legacy public rows are explicitly marked for a human decision, never silently approved. */
export const OFFER_STATUSES = ["draft", "pending", "approved", "changes_requested", "rejected", "hidden", "legacy_review_required"] as const;
export type OfferStatus = typeof OFFER_STATUSES[number];
export type OfferKind = "listing" | "company_equipment";
export const OFFER_MODERATION_COLUMNS = "moderation_status,content_revision,reviewed_revision,submitted_at,reviewed_at,moderation_reason";
export function isOfferStatus(value: unknown): value is OfferStatus {
  return typeof value === "string" && OFFER_STATUSES.includes(value as OfferStatus);
}
export function offerStatus(row: { moderation_status?: unknown; published?: boolean | null }): OfferStatus {
  return isOfferStatus(row.moderation_status) ? row.moderation_status : row.published ? "legacy_review_required" : "draft";
}
export function attemptedApproval(body: Record<string, unknown>) {
  return body.published === true || ["moderation_status", "content_revision", "reviewed_revision", "reviewed_at", "reviewed_by", "moderation_reason", "submitted_by", "last_editor_id"].some(key => Object.hasOwn(body, key));
}
