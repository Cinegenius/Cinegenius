export function shouldSkipProfileSetup(input: {
  hasExistingProfile: boolean;
  hasInProgressDraft: boolean;
  isNewRegistration: boolean;
}): boolean {
  if (input.hasInProgressDraft || input.isNewRegistration) return false;
  return input.hasExistingProfile;
}
