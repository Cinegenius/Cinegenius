import { isOfferStatus, offerStatus } from "./offer-moderation";

export type SetupOfferState = "loading" | "draft" | "pending" | "published" | "changes_requested" | "rejected" | "hidden" | "unavailable";
export function setupOfferState(value: unknown): SetupOfferState {
  if (!value || typeof value !== "object") return "unavailable";
  const row = value as { moderation_status?: unknown; published?: boolean };
  if (typeof row.published !== "boolean") return "unavailable";
  if (row.moderation_status != null && !isOfferStatus(row.moderation_status)) return "unavailable";
  if (row.published === true) return "published";
  const status = offerStatus(row);
  return ["draft", "pending", "changes_requested", "rejected", "hidden"].includes(status) ? status as SetupOfferState : "unavailable";
}

/** Use only the existing authenticated, revision-checked publication endpoint.
 * A failed/ambiguous response is never treated as public or submitted. */
export async function submitSetupOffer(id: string, errorMessage: string, request: typeof fetch = fetch): Promise<"pending" | "published"> {
  const response = await request(`/api/listings/${encodeURIComponent(id)}/publish`, { method: "POST" });
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.success !== true) throw new Error(typeof body?.error === "string" ? body.error : errorMessage);
  if (body.published === true) return "published";
  if (body.submitted === true || body.moderation_status === "pending") return "pending";
  throw new Error(errorMessage);
}
