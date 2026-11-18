/** Inactive contract for a future exclusive artwork picker. No HTTP route imports it. */
export const PROFILE_ART_RESERVATIONS_ENABLED = true;
export const PROFILE_ART_LEASE_SECONDS = 300;
export type ProfileArtKind = "avatar" | "cover";
export type ProfileArtFailure = { ok: false; status: number; code: string };
export type ProfileArtCommand = { ok: true; rpc: string; args: Record<string, unknown> };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const kindIsValid = (value: unknown): value is ProfileArtKind => value === "avatar" || value === "cover";
const failure = (status: number, code: string): ProfileArtFailure => ({ ok: false, status, code });
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);

/** userId comes exclusively from the existing authenticated server context, never body/query. */
export function prepareProfileArtCommand(userId: string | null, input: unknown): ProfileArtCommand | ProfileArtFailure {
  if (!userId || userId.length > 128) return failure(401, "ART_AUTH_REQUIRED");
  if (!isRecord(input) || !kindIsValid(input.kind)) return failure(400, "ART_INVALID");
  if (input.action === "read") {
    if (Object.keys(input).some(key => !["action", "kind"].includes(key))) return failure(400, "ART_INVALID");
    return { ok: true, rpc: "profile_art_choices_v2", args: { p_user: userId, p_kind: input.kind } };
  }
  if (input.action !== "lease" && input.action !== "cancel") return failure(400, "ART_INVALID");
  const allowed = ["action", "kind", "expectedRevision", "requestKey", ...(input.action === "lease" ? ["artworkId"] : [])];
  if (Object.keys(input).some(key => !allowed.includes(key)) ||
      !Number.isSafeInteger(input.expectedRevision) || (input.expectedRevision as number) < 0 ||
      typeof input.requestKey !== "string" || !uuid.test(input.requestKey) ||
      (input.action === "lease" && (typeof input.artworkId !== "string" || !uuid.test(input.artworkId)))) {
    return failure(400, "ART_INVALID");
  }
  return { ok: true, rpc: input.action === "lease" ? "profile_art_lease" : "profile_art_cancel", args: {
    p_user: userId, p_kind: input.kind, p_expected: input.expectedRevision,
    p_request: input.requestKey.toLowerCase(),
    ...(input.action === "lease" ? { p_artwork: (input.artworkId as string).toLowerCase() } : {}),
  } };
}

/** No confirmation RPC is exposed here: confirmation belongs inside the future atomic profile save. */
export function profileArtDatabaseFailure(error: { code?: string; message?: string } | null): ProfileArtFailure {
  const conflicts = new Set(["ART_BUSY", "ART_REVISION", "ART_UNAVAILABLE", "ART_EXPIRED", "ART_KEY_REUSED", "ART_STALE_RETRY", "ART_PROFILE_CHANGED", "ART_NOT_OWNED"]);
  if (error?.code === "PT429") return failure(429, "ART_RATE_LIMIT");
  if (error?.code === "PT409") return failure(409, conflicts.has(error.message ?? "") ? error!.message! : "ART_CONFLICT");
  if (error?.code === "23505" || error?.code === "55P03") return failure(409, "ART_BUSY");
  if (error?.code === "PT400") return failure(400, "ART_INVALID");
  if (error?.code === "PT503" || error?.code === "PGRST202" || error?.code === "42P01") return failure(503, "ART_UNAVAILABLE");
  // A network timeout may have lost an acknowledgement. Never invent a successful save;
  // retry the identical operation key or read current state before making another choice.
  return failure(503, "ART_RETRY_REQUIRED");
}
