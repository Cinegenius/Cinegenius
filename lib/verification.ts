/** The profile flag is authoritative; a historical request must not restore a revoked badge. */
export function memberVerificationStatus(verified: boolean, status: unknown): "none" | "pending" | "approved" | "rejected" {
  if (verified) return "approved";
  return status === "pending" || status === "rejected" ? status : "none";
}
export function verificationDocument(notes: unknown): string | null {
  if (typeof notes !== "string") return null;
  try { const value = JSON.parse(notes); return typeof value?.id_doc === "string" ? value.id_doc : null; } catch { return null; }
}
