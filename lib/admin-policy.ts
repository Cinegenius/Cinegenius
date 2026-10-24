export function isConfiguredAdmin(userId: string | null | undefined, configuredIds: string | undefined): boolean {
  if (!userId) return false;
  const allowedIds = new Set((configuredIds ?? "").split(",").map((id) => id.trim()).filter(Boolean));
  return allowedIds.has(userId);
}

export function validateAdminReason(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const reason = value.trim();
  return reason.length >= 5 && reason.length <= 500 ? reason : null;
}
