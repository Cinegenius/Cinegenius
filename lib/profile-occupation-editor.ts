import { selectedCrewOccupations } from './crew-occupations';
import { readPrimaryOccupation, type PrimaryOccupation } from './primary-occupation';

export type ProfileOccupationEdit = { positions: string[]; occupations: PrimaryOccupation[] };

/** Remove exact saved titles through their resolved selection, not a translated label.
 * A shared title stays while another explicitly selected department still uses it.
 */
function withoutOccupations(positions: readonly string[], current: PrimaryOccupation[], removed: Set<string>, exactTitle?: string): ProfileOccupationEdit {
  const nextPositions = positions.filter(title => {
    if (title === exactTitle) return false;
    const represented = selectedCrewOccupations([title], current);
    return represented.length === 0 || represented.some(option => !removed.has(option.roleId));
  });
  return {
    positions: nextPositions,
    occupations: selectedCrewOccupations(nextPositions, current.filter(option => !removed.has(option.roleId))),
  };
}

export function toggleProfileOccupation(positions: readonly string[], selections: unknown, value: PrimaryOccupation): ProfileOccupationEdit {
  const current = selectedCrewOccupations(positions, selections);
  const option = readPrimaryOccupation(value);
  if (!option) return { positions: [...positions], occupations: current };
  if (current.some(selected => selected.roleId === option.roleId)) {
    return withoutOccupations(positions, current, new Set([option.roleId]));
  }
  const nextPositions = positions.includes(option.label) ? [...positions] : [...positions, option.label];
  return { positions: nextPositions, occupations: [...current, {departmentId: option.departmentId, roleId: option.roleId}] };
}

/** The X on a saved chip must work even for unknown, renamed or legacy titles. */
export function removeProfilePosition(positions: readonly string[], selections: unknown, title: string): ProfileOccupationEdit {
  const current = selectedCrewOccupations(positions, selections);
  if (!positions.includes(title)) return { positions: [...positions], occupations: current };
  const removed = new Set(selectedCrewOccupations([title], current).map(option => option.roleId));
  return withoutOccupations(positions, current, removed, title);
}
