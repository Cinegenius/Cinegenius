/** Optional self-description; never inferred from name, photograph or avatar. */
export function validPronouns(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && [...value].length <= 60 && !/[\p{Cc}<>]/u.test(value));
}
export function publicPronouns(profile: { pronouns?: string | null; show_pronouns?: boolean }): string | null {
  return profile.show_pronouns === true && validPronouns(profile.pronouns) ? profile.pronouns?.trim() || null : null;
}
