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
export function primaryOccupationForPositions(value: unknown, positions: readonly string[]): OccupationOption | null {
  const explicit = readPrimaryOccupation(value);
  if (explicit) return occupationChoices(positions).some(option => option.roleId === explicit.roleId) ? explicit : null;
  // An old single, unambiguous occupation is reliable. Never infer a main job from list order.
  const uniquePositions = [...new Set(positions.map(exactKey))].filter(Boolean);
  const candidates = occupationChoices(positions);
  return value == null && uniquePositions.length === 1 && candidates.length === 1 ? candidates[0] : null;
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

export function filterPrimaryOccupations<T extends {primaryOccupation?: PrimaryOccupation|null}>(profiles:readonly T[], departmentId:string|null, roles:readonly string[]=[]):T[] {
  const keys = new Set(roles.map(exactKey));
  return profiles.filter(profile=>{
    const primary=readPrimaryOccupation(profile.primaryOccupation);
    return (!departmentId || primary?.departmentId===departmentId)
      && (!keys.size || !!primary?.aliases.some(alias=>keys.has(exactKey(alias))));
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
