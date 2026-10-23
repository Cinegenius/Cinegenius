import type { ProfileType } from "./profile-types";

export function normalizeProfileTypes(
  profileTypes: readonly string[] | null | undefined,
  primaryType?: string | null,
): ProfileType[] {
  const candidates = [primaryType, ...(profileTypes ?? [])].filter(
    (type): type is string => typeof type === "string" && type.trim().length > 0,
  );
  return [...new Set(candidates)] as ProfileType[];
}

export function getProfileDisplayPositions({
  positions,
  role,
  profileTypes,
  primaryType,
  labels,
}: {
  positions?: readonly string[] | null;
  role?: string | null;
  profileTypes?: readonly string[] | null;
  primaryType?: string | null;
  labels: Record<string, string>;
}): string[] {
  const explicitPositions = (positions ?? []).filter((position) => typeof position === "string" && position.trim());
  if (explicitPositions.length === 0 && role?.trim()) explicitPositions.push(role.trim());
  const categoryLabels = normalizeProfileTypes(profileTypes, primaryType)
    .map((type) => labels[type])
    .filter((label): label is string => Boolean(label));
  const seen = new Set<string>();
  return [...explicitPositions, ...categoryLabels].filter((label) => {
    const normalized = label.trim().toLocaleLowerCase("de");
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

/** Keeps long occupation lists compact on profile pages without dropping saved roles. */
export const PROFILE_POSITIONS_PREVIEW_LIMIT = 5;

export function getProfilePositionsPreview(
  positions: readonly string[],
  expanded: boolean,
  visibleCount = PROFILE_POSITIONS_PREVIEW_LIMIT,
): { visible: string[]; remaining: number } {
  const limit = Math.max(1, Number.isFinite(visibleCount) ? Math.floor(visibleCount) : PROFILE_POSITIONS_PREVIEW_LIMIT);
  const visible = expanded ? [...positions] : positions.slice(0, limit);
  return { visible, remaining: Math.max(0, positions.length - visible.length) };
}

export function hasProfileType(
  profileTypes: readonly string[] | null | undefined,
  primaryType: string | null | undefined,
  type: string,
): boolean {
  return normalizeProfileTypes(profileTypes, primaryType).includes(type as ProfileType);
}

/** Converts the profile editor's Markdown-like text to safe, readable plain text. */
export function cleanProfileBio(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/`{1,3}/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
