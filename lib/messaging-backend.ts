export const MESSAGING_HEADERS = { "Cache-Control": "private, no-store, max-age=0", "CDN-Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store" };
export const messagingAccountId = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
export const messagingRequestKey = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{8,128}$/.test(value);
export const messagingUuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

/** Stable database protocols select translations; SQL details never reach a member. */
export function messagingRpcFailure(error: { code?: string; message?: string } | null) {
  if (error?.code === "PT409" || error?.code === "55P03") {
    if (error.message === "messaging_last_admin") return { key: "lastAdmin", status: 409 };
    if (error.message === "messaging_group_full") return { key: "groupFull", status: 409 };
    if (error.message === "messaging_key_reused") return { key: "keyConflict", status: 409 };
    return { key: "busy", status: 409 };
  }
  if (error?.code === "42501") return { key: error.message === "messaging_admin_required" ? "adminRequired" : "contactUnavailable", status: 403 };
  if (error?.code === "PT404" || error?.code === "P0002") return { key: "unavailable", status: 404 };
  if (error?.code === "22023" || error?.code === "22P02") return { key: "invalid", status: 400 };
  return { key: "saveError", status: 503 };
}
