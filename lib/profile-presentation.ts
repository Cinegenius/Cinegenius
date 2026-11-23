import type { UserProfile } from "./profile-types";

/** Photo layout only. Profile types, occupations and visibility stay independent. */
export const PROFILE_PRESENTATIONS = ["auto", "compact", "portrait", "cover"] as const;
export type ProfilePresentation = typeof PROFILE_PRESENTATIONS[number];

export function isProfilePresentation(value: unknown): value is ProfilePresentation {
  return typeof value === "string" && (PROFILE_PRESENTATIONS as readonly string[]).includes(value);
}

export function normalizeProfilePresentation(value: unknown): ProfilePresentation {
  return isProfilePresentation(value) ? value : "auto";
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function profilePresentationFromCrew(crew: unknown): ProfilePresentation {
  return normalizeProfilePresentation(record(crew)?.profilePresentation);
}

export function hasInvalidProfilePresentation(crew: unknown): boolean {
  const value = record(crew);
  return !!value && Object.hasOwn(value, "profilePresentation") && !isProfilePresentation(value.profilePresentation);
}

/** Older clients may omit the preference or send null crew. Only an explicit
 * auto resets the choice; other fields retain their existing write semantics. */
export function preserveProfilePresentation(previous: unknown, next: unknown): unknown {
  if (hasInvalidProfilePresentation(next)) throw new TypeError("Invalid profile presentation");
  const incoming = record(next);
  const choice = incoming && Object.hasOwn(incoming, "profilePresentation")
    ? normalizeProfilePresentation(incoming.profilePresentation) : profilePresentationFromCrew(previous);
  if (incoming) {
    const result = { ...incoming };
    delete result.profilePresentation;
    if (choice !== "auto") result.profilePresentation = choice;
    return result;
  }
  return next == null && choice !== "auto" ? { profilePresentation: choice } : next;
}

export function wantsProfileCover(choice: unknown, isTalent: boolean): boolean {
  const mode = normalizeProfilePresentation(choice);
  return mode === "cover" || (mode === "auto" && !isTalent);
}

export function presentationPortrait(profile: UserProfile): string | null {
  return profile.avatar_url || profile.profile_images?.find(image => image.featured)?.url
    || profile.profile_images?.[0]?.url || (profile as UserProfile & { portfolio_images?: string[] }).portfolio_images?.[0] || null;
}
