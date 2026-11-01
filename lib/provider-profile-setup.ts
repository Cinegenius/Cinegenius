import { normalizeProfileTypes } from "./profile-display";
import { getQuickStartProfileTypesForRoles, type QuickStartDraft, type QuickStartRoleSelection } from "./quick-start-flow";
import { occupationReference, orderPositionsByPrimary, primaryOccupationForPositions } from "./primary-occupation";
import { selectedCrewOccupations } from "./crew-occupations";

export function needsPublicSetupProfile(intents: readonly string[]) {
  return intents.some(intent => ["crew", "talent", "location", "equipment"].includes(intent));
}

/** Build only the fields explicitly changed in this setup. Provider-only setup
 * preserves existing occupations, media, privacy and company memberships. */
export function setupProfilePayload(draft: QuickStartDraft, existing: { profile_type?: string | null; profile_types?: string[] | null; crew?: Record<string, unknown> } | null, roles: QuickStartRoleSelection[]) {
  const personal = draft.intents.includes("crew") || draft.intents.includes("talent");
  const types = [...new Set([
    ...normalizeProfileTypes(existing?.profile_types, existing?.profile_type),
    ...(personal ? getQuickStartProfileTypesForRoles(roles) : []),
    ...(draft.intents.includes("location") ? ["location"] : []),
    ...(draft.intents.includes("equipment") ? ["equipment"] : []),
  ])];
  const primary = personal ? primaryOccupationForPositions(draft.primaryOccupation, roles.map(role => role.role)) : null;
  const positions = personal ? orderPositionsByPrimary(roles.map(role => role.role), primary) : [];
  const photo = personal ? draft.sections.crew?.imageUrl || draft.sections.talent?.imageUrl : draft.providerImageUrl;
  return {
    display_name: draft.name.trim(),
    location: [draft.personCity.trim(), draft.personCountry.trim()].filter(Boolean).join(", "),
    profile_types: types, profile_type: types[0] ?? null,
    ...(personal ? { positions, crew: { ...existing?.crew, primaryOccupation: occupationReference(primary), occupations: selectedCrewOccupations(positions, roles.map(item => ({ departmentId: item.departmentId, roleId: `${item.departmentId}/${encodeURIComponent(item.role)}` }))) } } : {}),
    ...(!existing ? { bio: draft.talentIntro.trim(), avatar_url: photo || null, available: true } : {
      ...(draft.talentIntro.trim() ? { bio: draft.talentIntro.trim() } : {}),
      ...(photo ? { avatar_url: photo } : {}),
    }),
  };
}

/** An optional self-service entry for existing offer-only accounts. No automatic
 * public profile is created by reading a dashboard or logging in. */
export function providerProfileEntry(hasProfile: boolean, saved: { intent?: unknown; setupComplete?: unknown } | null) {
  return !hasProfile && saved?.setupComplete === true && (saved.intent === "location" || saved.intent === "equipment")
    ? `/profile-setup?provider=${saved.intent}` : null;
}
