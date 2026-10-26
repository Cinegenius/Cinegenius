import { PROFILE_CATEGORY_MAP, type ProfileType } from './profile-types';
import { departments, getDepartmentRoleSearchTerms } from './departments';

export type PrimaryOccupation = { departmentId: string; roleId: string };
export type OccupationOption = PrimaryOccupation & { label: string; departmentLabel: string; aliases: string[] };
const exactKey = (value: string) => value.trim().normalize('NFC').toLocaleLowerCase('de');
// Keys use the canonical (untranslated) catalogue title, never a display alias or array index.
export const occupationCatalogue: OccupationOption[] = departments.flatMap(department => [...new Set(department.roles)].map(label => ({
  departmentId: department.id, roleId: `${department.id}/${encodeURIComponent(label)}`,
  label, departmentLabel: department.label, aliases: getDepartmentRoleSearchTerms(department, label),
})));
const byId = new Map(occupationCatalogue.map(option => [option.roleId, option]));
// Preserve references generated for older catalogue titles now consolidated as synonyms.
for (const option of occupationCatalogue) {
  for (const alias of option.aliases) {
    const id = `${option.departmentId}/${encodeURIComponent(alias)}`;
    if (!byId.has(id)) byId.set(id, option);
  }
}
export function occupationId(departmentId: string, label: string): string {
  return `${departmentId}/${encodeURIComponent(label)}`;
}
export function occupationById(id: string): OccupationOption | null { return byId.get(id) ?? null; }
export function readPrimaryOccupation(value: unknown): OccupationOption | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Partial<PrimaryOccupation>;
  const option = typeof record.roleId === 'string' ? byId.get(record.roleId) : null;
  return option && option.departmentId === record.departmentId ? option : null;
}
export function occupationChoices(positions: readonly string[]): OccupationOption[] {
  const keys = new Set(positions.map(exactKey));
  return occupationCatalogue.filter(option => option.aliases.some(alias => keys.has(exactKey(alias))));
}
export function primaryOccupationForPositions(value: unknown, positions: readonly string[], legacyPrimaryRole?: string | null): OccupationOption | null {
  const explicit = readPrimaryOccupation(value);
  if (explicit) return occupationChoices(positions).some(option => option.roleId === explicit.roleId) ? explicit : null;
  // `role` was the explicit main title before crew.primaryOccupation existed.
  // Never use a generic profile-type label synthesized for display here.
  if (value == null && legacyPrimaryRole?.trim()) {
    const legacy = occupationChoices([legacyPrimaryRole]);
    if (legacy.length === 1 && (!positions.length || occupationChoices(positions).some(option => option.roleId === legacy[0].roleId))) return legacy[0];
  }
  // An old single, unambiguous occupation is reliable. Never infer a main job from list order.
  const candidates = occupationChoices(positions);
  if (value != null || candidates.length !== 1) return null;
  const aliases = new Set(candidates[0].aliases.map(exactKey));
  return positions.every(position => !position.trim() || aliases.has(exactKey(position))) ? candidates[0] : null;
}
/** A legacy profile can have an unambiguous department without a single main job.
 * Never persist an invented main occupation or match an unknown/partial title.
 */
export function crewDepartmentForPositions(value: unknown, positions: readonly string[], legacyPrimaryRole?: string | null): string | null {
  const primary = primaryOccupationForPositions(value, positions, legacyPrimaryRole);
  if (primary) return primary.departmentId;
  if (value != null) return null; // invalid explicit references need clarification
  const titles = [...new Set(positions.map(title => title.trim()).filter(Boolean))];
  if (!titles.length) return null;
  const matches = titles.map(title => occupationChoices([title]));
  if (matches.some(options => options.length === 0)) return null;
  const ids = new Set(matches.flatMap(options => options.map(option => option.departmentId)));
  return ids.size === 1 ? [...ids][0] : null;
}

export function occupationReference(option: PrimaryOccupation | null): PrimaryOccupation | null {
  return option ? {departmentId: option.departmentId, roleId: option.roleId} : null;
}
export function primaryOccupationError(crew: unknown, positions: unknown): string | null {
  if (!crew || typeof crew !== 'object' || !Object.hasOwn(crew, 'primaryOccupation')) return null; // legacy clients remain compatible
  const list = Array.isArray(positions) ? positions.filter((p): p is string => typeof p === 'string') : [];
  const value = (crew as {primaryOccupation?: unknown}).primaryOccupation;
  if (!list.length && value == null) return null;
  return primaryOccupationForPositions(value, list) ? null : 'Bitte wähle eine Haupttätigkeit aus deinen ausgewählten Tätigkeiten aus.';
}

export function filterPrimaryOccupations<T extends {primaryOccupation?: PrimaryOccupation|null; crewDepartmentId?: string|null}>(profiles:readonly T[], departmentId:string|null, roles:readonly string[]=[]):T[] {
  const ids = new Set(roles.flatMap(role => byId.has(role) ? [byId.get(role)!.roleId] : occupationChoices([role]).map(option => option.roleId)));
  return profiles.filter(profile=>{
    const primary=readPrimaryOccupation(profile.primaryOccupation);
    return (!departmentId || (primary?.departmentId ?? profile.crewDepartmentId)===departmentId)
      && (!roles.length || !!primary && ids.has(primary.roleId));
  });
}
export function occupiedPrimaryRoles(profiles:readonly {primaryOccupation?:PrimaryOccupation|null}[]) {
  return new Set(profiles.map(profile=>readPrimaryOccupation(profile.primaryOccupation)?.label).filter((label):label is string=>!!label));
}

/** Move the selected existing title to the front without replacing or deleting saved titles. */
export function orderPositionsByPrimary(positions:readonly string[], primary:PrimaryOccupation|null):string[] {
  const option=readPrimaryOccupation(primary);
  const index=option ? positions.findIndex(position=>option.aliases.some(alias=>exactKey(alias)===exactKey(position))) : -1;
  return index>0 ? [positions[index], ...positions.slice(0,index), ...positions.slice(index+1)] : [...positions];
}

/** Exclude offer-only accounts; a person can have a crew job and offers together. */
export function isCrewDirectoryProfile(profile: {positions?: string[] | null; role?: string | null; profile_type?: string | null; profile_types?: string[] | null; display_name?: string | null; bio?: string | null; portfolio_images?: string[] | null}): boolean {
  const types = [profile.profile_type, ...(profile.profile_types ?? [])].filter(Boolean) as string[];
  if (types.some(type => PROFILE_CATEGORY_MAP[type as ProfileType] && PROFILE_CATEGORY_MAP[type as ProfileType] !== 'vendor')) return true;
  if (types.length && types.every(type => PROFILE_CATEGORY_MAP[type as ProfileType] === 'vendor' || type === 'company')) return false;
  if (occupationChoices(profile.positions ?? []).length > 0 || occupationChoices(profile.role ? [profile.role] : []).length > 0) return true;
  // Older public personal profiles may predate type/occupation selection entirely.
  // Keep actual authored profiles discoverable in All areas, without guessing a job.
  // Visibility checks run in the caller; empty account stubs still do not qualify.
  return types.length === 0 && !!profile.display_name?.trim()
    && (!!profile.bio?.trim() || !!profile.portfolio_images?.length);
}
