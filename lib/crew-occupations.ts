import { occupationChoices, occupationById, occupationReference, readPrimaryOccupation, primaryOccupationForPositions, orderPositionsByPrimary, type PrimaryOccupation } from './primary-occupation';
import { PROFILE_CATEGORY_MAP, type ProfileType } from './profile-types';

/** Stored selections only: never pass display positions containing inferred type labels. */
export function selectedCrewOccupations(positions: readonly string[], storedSelections?: unknown, legacyMain?: string | null, primary?: unknown): PrimaryOccupation[] {
  const titles = positions.length ? positions : legacyMain?.trim() ? [legacyMain] : [];
  const explicit = Array.isArray(storedSelections) ? storedSelections.map(readPrimaryOccupation).filter(option => option !== null) : [];
  const main = readPrimaryOccupation(primary);
  const resolved = titles.flatMap(title => {
    const choices = occupationChoices([title]);
    const selected = choices.filter(option => explicit.some(saved => saved.roleId === option.roleId));
    if (selected.length) return selected;
    const chosenMain = main ? choices.filter(option => option.roleId === main.roleId) : [];
    if (chosenMain.length) return chosenMain;
    // Literal selectable titles outrank a synonym in another department.
    const key = title.trim().normalize('NFC').toLocaleLowerCase('de');
    const literal = choices.filter(option => option.label.normalize('NFC').toLocaleLowerCase('de') === key);
    const candidates = literal.length ? literal : choices;
    if (new Set(candidates.map(option => option.departmentId)).size === 1) return candidates;
    // Same literal title in two departments requires its saved group selection.
    return [];
  });
  return [...new Map(resolved.map(option => [option.roleId, occupationReference(option)!])).values()];
}

export function crewOccupationIds(profile: {positions?: string[] | null; role?: string | null; crew?: {occupations?: unknown; primaryOccupation?: unknown} | null}): string[] {
  return selectedCrewOccupations(profile.positions ?? [], profile.crew?.occupations, profile.role, profile.crew?.primaryOccupation).map(option => option.roleId);
}

export function filterCrewOccupations<T extends {occupationIds?: readonly string[]; profile_type?: string | null; profile_types?: readonly string[] | null}>(profiles: readonly T[], departmentId: string | null, roles: readonly string[] = []): T[] {
  if (!departmentId && !roles.length) return [...profiles];
  const ids = new Set(roles.flatMap(role => {
    const option = occupationById(role);
    return option ? [option.roleId] : occupationChoices([role]).map(choice => choice.roleId);
  }));
  return profiles.filter(profile => {
    // Legacy talent profiles sometimes have a stable talent type but no saved
    // occupation ID. Keep them in the Cast & Performance department and count
    // them there; role-specific filters still require an exact saved role.
    if (departmentId === 'cast' && !roles.length) {
      const profileTypes = [profile.profile_type, ...(profile.profile_types ?? [])].filter((type): type is string => !!type);
      if (profileTypes.some(type => PROFILE_CATEGORY_MAP[type as ProfileType] === 'talent')) return true;
    }
    return (profile.occupationIds ?? []).some(id => {
      const option = occupationById(id);
      return !!option && (!departmentId || option.departmentId === departmentId) && (!roles.length || ids.has(option.roleId));
    });
  });
}

export function crewOccupationsError(crew: unknown, positions: unknown): string | null {
  if (!crew || typeof crew !== 'object' || !Object.hasOwn(crew, 'occupations')) return null;
  const value = (crew as {occupations?: unknown}).occupations;
  if (!Array.isArray(value)) return 'Bitte wähle deine Tätigkeiten erneut aus dem Berufskatalog aus.';
  const titles = Array.isArray(positions) ? positions.filter((title): title is string => typeof title === 'string') : [];
  const allowed = new Set(occupationChoices(titles).map(option => option.roleId));
  return value.every(item => {
    const option = readPrimaryOccupation(item);
    return !!option && allowed.has(option.roleId);
  }) ? null : 'Die gewählten Tätigkeiten passen nicht zu den gespeicherten Berufen. Bitte prüfe deine Auswahl.';
}

export const MAX_PROFILE_OCCUPATIONS = 4;
export const MAX_VISIBLE_PROFILE_OCCUPATIONS = 3;
export type OccupationProfile = {
  positions?: readonly string[] | null;
  role?: string | null;
  crew?: { primaryOccupation?: unknown; occupations?: unknown; additionalOccupation?: unknown } | null;
};

/** Additional is an explicit slot, never inferred from the fourth array item. */
export function additionalCrewOccupation(profile: OccupationProfile): PrimaryOccupation | null {
  const option = readPrimaryOccupation(profile.crew?.additionalOccupation);
  const selected = selectedCrewOccupations(profile.positions ?? [], profile.crew?.occupations, profile.role, profile.crew?.primaryOccupation);
  const main = primaryOccupationForPositions(profile.crew?.primaryOccupation, profile.positions ?? [], profile.role);
  return option && option.roleId !== main?.roleId && selected.some(item => item.roleId === option.roleId)
    ? occupationReference(option) : null;
}

/** Presentation only. Search continues to use all saved positions/occupation IDs. */
export function profileOccupationPreview(profile: OccupationProfile): string[] {
  const positions = (profile.positions ?? []).filter(title => typeof title === 'string' && title.trim());
  const primary = primaryOccupationForPositions(profile.crew?.primaryOccupation, positions, profile.role);
  const additional = additionalCrewOccupation(profile);
  const ordered = orderPositionsByPrimary(positions.length ? positions : profile.role?.trim() ? [profile.role] : [], primary);
  return ordered.filter(title => {
    const matches = selectedCrewOccupations([title], profile.crew?.occupations);
    return !additional || !matches.length || matches.some(item => item.roleId !== additional.roleId);
  })
    .slice(0, MAX_VISIBLE_PROFILE_OCCUPATIONS);
}

export function profileOccupationCount(profile: OccupationProfile): number {
  const titles = new Set((profile.positions ?? []).map(title => title.trim().normalize('NFC').toLocaleLowerCase('de')).filter(Boolean));
  return Math.max(titles.size, selectedCrewOccupations(profile.positions ?? [], profile.crew?.occupations).length);
}

function occupationSignature(profile: OccupationProfile): string {
  return JSON.stringify({
    positions: [...new Set(profile.positions ?? [])].sort(),
    occupations: selectedCrewOccupations(profile.positions ?? [], profile.crew?.occupations, profile.role, profile.crew?.primaryOccupation).map(item => item.roleId).sort(),
    primary: occupationReference(primaryOccupationForPositions(profile.crew?.primaryOccupation, profile.positions ?? [], profile.role)) ?? profile.crew?.primaryOccupation ?? null,
    additional: occupationReference(readPrimaryOccupation(profile.crew?.additionalOccupation)) ?? profile.crew?.additionalOccupation ?? null,
  });
}

export function profileOccupationsUnchanged(profile: OccupationProfile, previous?: OccupationProfile | null): boolean {
  if (!previous || (profile.positions != null && (!Array.isArray(profile.positions) || profile.positions.some(value => typeof value !== "string")))) return false;
  return occupationSignature(profile) === occupationSignature(previous);
}

/** Existing oversized selections survive unrelated edits. Changing the selection
 * requires a deliberate reduction; reads and draft recovery never truncate it. */
export function profileOccupationFocusError(profile: OccupationProfile, previous?: OccupationProfile | null): 'limit' | 'mainRequired' | 'invalidAdditional' | 'invalidSelection' | null {
  if (profile.positions != null && (!Array.isArray(profile.positions) || profile.positions.some(value => typeof value !== 'string' || !value.trim()))) return 'invalidSelection';
  const unchanged = profileOccupationsUnchanged(profile, previous);
  const count = profileOccupationCount(profile);
  if (count > MAX_PROFILE_OCCUPATIONS) return unchanged ? null : 'limit';
  const main = primaryOccupationForPositions(profile.crew?.primaryOccupation, profile.positions ?? [], profile.role);
  if (profile.crew?.additionalOccupation != null && !additionalCrewOccupation(profile)) return 'invalidAdditional';
  if (unchanged) return null;
  if (count && !main) return 'mainRequired';
  // Choosing a fourth occupation does not make the additional slot mandatory.
  // Preserve every selected occupation; the card preview remains capped at three.
  return null;
}
