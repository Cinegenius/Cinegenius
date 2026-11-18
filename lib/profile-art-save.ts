import { isArtUUID } from "@/lib/profile-art-refill-contract";

export type ProfileArtClaim = {kind: "avatar" | "cover"; token: string; revision: number; requestKey: string};
export type ProfileArtSave = {requestKey: string; expectedUpdatedAt: string | null; choices: ProfileArtClaim[]};
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
export function validProfileArtSave(value: unknown): value is ProfileArtSave {
  if (!record(value) || Object.keys(value).some(k => !["requestKey", "expectedUpdatedAt", "choices"].includes(k)) || !isArtUUID(value.requestKey)) return false;
  if (value.expectedUpdatedAt !== null && (typeof value.expectedUpdatedAt !== "string" || value.expectedUpdatedAt.length > 40 || !Number.isFinite(Date.parse(value.expectedUpdatedAt)))) return false;
  if (!Array.isArray(value.choices) || value.choices.length < 1 || value.choices.length > 2) return false;
  const kinds = new Set<string>();
  for (const c of value.choices) {
    if (!record(c) || Object.keys(c).some(k => !["kind", "token", "revision", "requestKey"].includes(k)) || (c.kind !== "avatar" && c.kind !== "cover") || kinds.has(c.kind) || !isArtUUID(c.token) || !isArtUUID(c.requestKey) || !Number.isSafeInteger(c.revision) || (c.revision as number) < 0) return false;
    kinds.add(c.kind);
  }
  return true;
}
