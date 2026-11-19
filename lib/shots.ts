/** Shared wire contract only. No account, database, storage or provider access. */
export const SHOTS_CONTRACT = "cinegenius.shots.v1" as const;
export const SHOT_LIFETIME_MS = 30 * 60 * 60 * 1000;
export const SHOT_MAX_PHOTO_BYTES = 3 * 1024 * 1024;
export const SHOT_MAX_EDGE = 1600;
export const SHOT_MAX_ACTIVE = 6;
export const SHOT_MAX_TOTAL_BYTES = 12 * 1024 * 1024;
export const SHOT_PAGE_SIZE = 24;
export const SHOT_AUDIENCES = ["community", "homies"] as const;
export const SHOT_FORMATS = ["portrait", "landscape"] as const;
export const SHOT_LOOKS = ["original", "film", "photo", "bw"] as const;
export type ShotAudience = typeof SHOT_AUDIENCES[number];
export type ShotFormat = typeof SHOT_FORMATS[number];
export type ShotLook = typeof SHOT_LOOKS[number];
export type ShotVariant = "full" | "thumbnail";
export type ShotMetadata = { audience: ShotAudience; format: ShotFormat; look: ShotLook; grain: number };
export type Shot = ShotMetadata & {
  id: string; requestId: string | null; createdAt: string; expiresAt: string;
  isMine: boolean; width: number; height: number;
  media: { full: string; thumbnail: string };
};
export type ShotsCapabilities = { read: boolean; publish: boolean; homiesRead: boolean };
export type ShotsEnvelope = { contract: typeof SHOTS_CONTRACT; accountId: string | null; serverNow: string; capabilities: ShotsCapabilities };
export type ShotsFeed = ShotsEnvelope & { items: Shot[]; nextCursor: string | null };
export type ShotsPublish = ShotsEnvelope & { status: "published" | "pending"; requestId: string; item: Shot | null };
export type ShotsRequest = ShotsEnvelope & { status: "absent" | "pending" | "published" | "expired" | "deleted"; requestId: string; item: Shot | null; retryAllowed: boolean };
export type ShotsErrorCode = "unauthorized" | "account_changed" | "invalid" | "unavailable" | "conflict" | "capacity" | "not_found" | "expired" | "rate_limited";
export const isShotId = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
export const isShotTimestamp = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
export const shotMediaPath = (id: string, variant: ShotVariant) => `/api/shots/${id}/media/${variant}`;
export function readShotMetadata(value: Record<string, unknown>): ShotMetadata | null {
  if (!(SHOT_AUDIENCES as readonly unknown[]).includes(value.audience) || !(SHOT_FORMATS as readonly unknown[]).includes(value.format)
      || !(SHOT_LOOKS as readonly unknown[]).includes(value.look) || !Number.isInteger(value.grain) || Number(value.grain) < 0 || Number(value.grain) > 100) return null;
  return { audience: value.audience as ShotAudience, format: value.format as ShotFormat, look: value.look as ShotLook, grain: Number(value.grain) };
}
