type SetupProfile = {
  display_name?: unknown; location?: unknown; positions?: unknown; role?: unknown;
  profile_type?: unknown; profile_types?: unknown;
} | null | undefined;
export type SetupProgress = { setupComplete?: unknown; intent?: unknown; quickStart?: unknown; companyDraft?: unknown; profileDraft?: unknown; listingDraft?: unknown; listingDrafts?: unknown } | null | undefined;

/** A placeholder database row is not a finished personal profile. Optional media/bio are irrelevant. */
export function hasProfileBasics(profile: SetupProfile): boolean {
  const text = (value: unknown) => typeof value === "string" && !!value.trim();
  const values = (value: unknown) => Array.isArray(value) && value.some(text);
  return !!profile && text(profile.display_name) && text(profile.location)
    && (values(profile.positions) || text(profile.role) || text(profile.profile_type) || values(profile.profile_types));
}

/** Searchers and offer-only providers can finish setup without creating a Crew profile. */
export function hasCompletedNonPersonalSetup(saved: SetupProgress): boolean {
  return saved?.setupComplete === true && ["search", "company", "location", "equipment"].includes(String(saved.intent));
}

export function requiredSetupDestination(profile: SetupProfile, saved: SetupProgress): string | null {
  if (hasCompletedNonPersonalSetup(saved)) return null;
  if (saved?.quickStart && saved.setupComplete !== true) return "/profile-setup?resume=1";
  if (hasProfileBasics(profile)) return null;
  // Preserve older unfinished drafts in their existing editor.
  if (saved?.setupComplete !== true) {
    if (saved?.intent === "company" && saved.companyDraft) return "/company-setup?onboarding=1&resume=1";
    if (saved?.intent === "talent" && saved.profileDraft) return "/guided-profile?resume=1";
    if ((saved?.intent === "location" || saved?.intent === "equipment") && (saved.listingDraft || saved.listingDrafts)) return `/guided-listing?type=${saved.intent}&resume=1`;
  }
  return "/profile-setup?welcome=1";
}

export function shouldSkipProfileSetup(input: {
  hasExistingProfile: boolean;
  hasInProgressDraft: boolean;
  isNewRegistration: boolean;
}): boolean {
  if (input.hasInProgressDraft || input.isNewRegistration) return false;
  return input.hasExistingProfile;
}
