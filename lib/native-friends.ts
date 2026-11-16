import 'server-only';
import { db } from '@/lib/db';
import { contactId } from '@/lib/contact-connections';
import { crewOccupationIds, additionalCrewOccupation, profileOccupationPreview } from '@/lib/crew-occupations';
import { occupationById, occupationReference, primaryOccupationForPositions } from '@/lib/primary-occupation';
import { FRIENDSHIPS_V1 } from '@/lib/native-contact-contract';

type FriendProfile = Parameters<typeof crewOccupationIds>[0];
export function friendOccupations(profile?: FriendProfile) {
  const ids = profile ? crewOccupationIds(profile) : [];
  const primary = profile ? primaryOccupationForPositions(profile.crew?.primaryOccupation, profile.positions ?? [], profile.role) : null;
  return {
    department_ids: [...new Set(ids.flatMap(id => occupationById(id)?.departmentId ?? []))],
    occupation_ids: ids,
    display_positions: profile ? profileOccupationPreview(profile) : [],
    additional_occupation: profile ? additionalCrewOccupation(profile) : null,
    primary_occupation: primary && ids.includes(primary.roleId) ? occupationReference(primary) : null,
  };
}

/** Missing additive migration is an honest absent capability, never a saved empty selection. */
export async function readFriendFavorites(actor: string) {
  const {data, error} = await db.rpc('contact_favorites_v1', {p_actor: actor});
  if (error?.code === 'PGRST202' || error?.code === '42883') return {read: false, write: false, values: new Map<string, boolean>()};
  if (error || data?.contract !== FRIENDSHIPS_V1 || typeof data.writable !== 'boolean' || !Array.isArray(data.favorites)) throw new Error('favorite_contract_unavailable');
  const values = new Map<string, boolean>();
  for (const row of data.favorites) {
    if (!contactId.test(row?.friendship_id ?? '') || typeof row?.is_favorite !== 'boolean' || values.has(row.friendship_id)) throw new Error('favorite_contract_unavailable');
    values.set(row.friendship_id, row.is_favorite);
  }
  return {read: true, write: data.writable, values};
}
