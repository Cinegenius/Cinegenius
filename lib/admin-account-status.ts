import { hasProfileBasics, requiredSetupDestination, type SetupProgress } from "./profile-setup-flow";

export type AdminAccountUser = {
  id: string; firstName: string | null; lastName: string | null;
  primaryEmailAddressId: string | null;
  emailAddresses: { id: string; emailAddress: string }[];
  createdAt: number; lastSignInAt: number | null;
  privateMetadata: Record<string, unknown>;
};
export type AdminAccountProfile = {
  user_id: string; display_name: string | null; slug: string | null; avatar_url: string | null;
  location: string | null; positions: string[] | null; role: string | null;
  profile_type: string | null; profile_types: string[] | null;
};

/** Project only the account fields needed by the protected admin list, never Clerk metadata. */
export function adminAccountRow(user: AdminAccountUser, profile: AdminAccountProfile | null, visibility: string | null) {
  const raw = user.privateMetadata.cinegeniusOnboarding;
  const progress = raw && typeof raw === "object" ? raw as SetupProgress : null;
  const setupUrl = requiredSetupDestination(profile, progress);
  const profileStatus = !profile ? "missing" : !hasProfileBasics(profile) ? "incomplete" : visibility === "private" ? "private" : "available";
  return {
    userId: user.id,
    name: profile?.display_name?.trim() || [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || null,
    email: user.emailAddresses.find(email => email.id === user.primaryEmailAddressId)?.emailAddress ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    profileUrl: profile && profileStatus === "available" ? "/profile/" + encodeURIComponent(profile.slug || user.id) : null,
    profileStatus, needsSetup: setupUrl !== null, createdAt: user.createdAt, lastSignInAt: user.lastSignInAt,
  };
}
