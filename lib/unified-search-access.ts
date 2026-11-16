import { isConfiguredAdmin } from "./admin-policy";

/** Temporary development access. Only the server supplies configured admin IDs. */
export function unifiedSearchAccess(userId: string | null, adminUserIds?: string) {
  const allowed = isConfiguredAdmin(userId, adminUserIds);
  return { canReadResults: allowed, canInterpret: allowed, tier: "development" as const };
}
