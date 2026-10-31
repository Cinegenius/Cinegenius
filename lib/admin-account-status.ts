import { ACCOUNT_RESPONSIBLE_PERSON_KEY, responsibleAccountName } from "./responsible-person";
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
  const source = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const quickStart = source.quickStart && typeof source.quickStart === "object" ? source.quickStart as Record<string, unknown> : {};
  const knownPurposes = ["crew", "talent", "company", "location", "equipment", "search"] as const;
  const selected = Array.isArray(quickStart.intents) && quickStart.intents.some(intent => knownPurposes.includes(intent as typeof knownPurposes[number])) ? quickStart.intents : [source.intent];
  const purposes = knownPurposes.filter(purpose => selected.includes(purpose));
  const accountKind = purposes.some(purpose => ["company", "location", "equipment"].includes(purpose)) ? "provider"
    : purposes.includes("search") && !purposes.some(purpose => purpose === "crew" || purpose === "talent") ? "search" : "personal";
  const identity = responsibleAccountName(user.privateMetadata[ACCOUNT_RESPONSIBLE_PERSON_KEY]) ?? responsibleAccountName(user);
  const accountName = identity ? `${identity.firstName} ${identity.lastName}` : "";
  const profileStatus = !profile ? "missing" : !hasProfileBasics(profile) ? "incomplete" : visibility === "private" ? "private" : "available";
  return {
    userId: user.id,
    name: profile?.display_name?.trim() || accountName || null,
    email: user.emailAddresses.find(email => email.id === user.primaryEmailAddressId)?.emailAddress ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    profileUrl: profile && profileStatus === "available" ? "/profile/" + encodeURIComponent(profile.slug || user.id) : null,
    purposes, accountKind, profileStatus, needsSetup: setupUrl !== null, createdAt: user.createdAt, lastSignInAt: user.lastSignInAt,
  };
}
