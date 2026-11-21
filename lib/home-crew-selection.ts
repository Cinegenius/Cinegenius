import { geographicRank, type BrowsePlace } from "./browse-geography";

export const HOME_CREW_ROTATION_MS = 15 * 60 * 1000;

type Candidate = { user_id: string };

function rotationScore(id: string, epoch: number): number {
  let value = 2166136261;
  for (const character of `${epoch}:${id}`) {
    value = Math.imul(value ^ character.charCodeAt(0), 16777619);
  }
  value = Math.imul(value ^ (value >>> 16), 0x85ebca6b);
  value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35);
  return (value ^ (value >>> 16)) >>> 0;
}

/** Registration dates never influence homepage exposure.
 * Permissions/people eligibility must be checked before cards are serialized.
 * No timer changes a rail already open in the browser.
 */
export function orderHomeCrew<T extends Candidate>(profiles: readonly T[], now: number, preferred: BrowsePlace | null = null): T[] {
  const epoch = Math.floor(now / HOME_CREW_ROTATION_MS);
  const unique = new Map<string, T>();
  for (const profile of profiles) if (profile.user_id && !unique.has(profile.user_id)) unique.set(profile.user_id, profile);
  const ranked = [...unique.values()].map(profile => ({ profile, score: rotationScore(profile.user_id, epoch) }));
  ranked.sort((a, b) => (preferred ? geographicRank(a.profile, preferred) - geographicRank(b.profile, preferred) : 0)
    || a.score - b.score
    || (a.profile.user_id < b.profile.user_id ? -1 : a.profile.user_id > b.profile.user_id ? 1 : 0));
  return ranked.map(row => row.profile);
}
