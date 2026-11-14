/** One entitlement boundary for web and native clients. No paid tier is active. */
export function unifiedSearchAccess(userId: string | null) {
  return { canReadResults: !!userId, canInterpret: !!userId, tier: "included" as const };
}
