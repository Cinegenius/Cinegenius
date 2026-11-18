/** Platform-owned decorative artwork only. Never a member upload or identity record. */
export const PROFILE_ART_REFILL_ENABLED = true;
export const PROFILE_ART_READER_ENABLED = true;
export const PROFILE_ART_BUCKET = "platform-profile-art";
export const PROFILE_ART_REFILL_POLICY = Object.freeze({
  version: "cg-profile-art-v2" as const,
  model: "gpt-image-2.6-flare" as const,
  maxResponseBytes: 12 * 1024 * 1024,
  maxInputBytes: 8 * 1024 * 1024,
  maxOutputBytes: { avatar: 64_000, cover: 180_000 },
  providerTimeoutMs: 45_000,
  workerTimeoutMs: 110_000,
  storageTimeoutMs: 8_000,
  maxQueued: 36,
  maxJobsPerDay: 48,
  targetBufferPerKind: 18,
  visiblePerKind: 12,
  targetPerPresentation: 6,
  maxCatalogReferences: 20_000,
});
export type PlatformArtKind = "avatar" | "cover";
export type ArtPresentation = "feminine" | "masculine" | "neutral";
export const ART_PRESENTATIONS = ["feminine", "masculine", "neutral"] as const;
export const isArtPresentation = (value: unknown): value is ArtPresentation => ART_PRESENTATIONS.some(p => p === value);
export const isPlatformArtKind = (value: unknown): value is PlatformArtKind => value === "avatar" || value === "cover";
export const isArtUUID = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
export const isArtSHA = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
export function profileArtObjectKey(kind: PlatformArtKind, mediaKey: string): string {
  if (!isPlatformArtKind(kind) || !isArtUUID(mediaKey)) throw new Error("ART_INVALID");
  return `v2/${kind}-${mediaKey}.webp`;
}
export function profileArtPublicPath(kind: PlatformArtKind, mediaKey: string): string {
  return `/profile-art/${profileArtObjectKey(kind, mediaKey)}`;
}
export function parseProfileArtPublicPath(value: unknown): {kind: PlatformArtKind; mediaKey: string} | null {
  if (typeof value !== "string") return null;
  const match = /^\/profile-art\/v2\/(avatar|cover)-([0-9a-f-]+)\.webp$/.exec(value);
  if (!match || !isArtUUID(match[2])) return null;
  return { kind: match[1] as PlatformArtKind, mediaKey: match[2] };
}
export type ArtJob = { id: string; kind: PlatformArtKind; presentation?: ArtPresentation | null; mediaKey: string; token: string; expiresAt: string };
export type ArtReadDescriptor = { kind: PlatformArtKind; mediaKey: string; sha256: string; byteLength: number; revision: number };
export function validArtReadDescriptor(value: unknown): value is ArtReadDescriptor {
  const v = value as ArtReadDescriptor | null;
  return !!v && isPlatformArtKind(v.kind) && isArtUUID(v.mediaKey) && isArtSHA(v.sha256)
    && Number.isInteger(v.byteLength) && v.byteLength > 0 && v.byteLength <= PROFILE_ART_REFILL_POLICY.maxOutputBytes[v.kind]
    && Number.isSafeInteger(v.revision) && v.revision >= 0;
}
