/** One entitlement boundary for web and native clients. No paid tier is active. */
export function unifiedSearchAccess(userId: string | null) {
  return { canReadResults: true, canInterpret: !!userId, tier: "included" as const };
}
