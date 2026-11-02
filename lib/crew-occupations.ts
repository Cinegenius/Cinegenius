import { occupationChoices, occupationById, occupationReference, readPrimaryOccupation, type PrimaryOccupation } from './primary-occupation';
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
