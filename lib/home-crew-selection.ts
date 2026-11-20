export const HOME_CREW_NEW_WINDOW_MS = 24 * 60 * 60 * 1000;
export const HOME_CREW_ROTATION_MS = 15 * 60 * 1000;

type Candidate = { user_id: string; created_at?: string | null };

function rotationScore(id: string, epoch: number): number {
  let value = 2166136261;
  for (const character of `${epoch}:${id}`) {
    value = Math.imul(value ^ character.charCodeAt(0), 16777619);
  }
  value = Math.imul(value ^ (value >>> 16), 0x85ebca6b);
  value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35);
  return (value ^ (value >>> 16)) >>> 0;
}

/** Server-only candidate ordering: never treats an edit as a new registration.
 * Permissions/people eligibility must be checked before cards are serialized.
 * No timer changes a rail already open in the browser.
 */
export function orderHomeCrew<T extends Candidate>(profiles: readonly T[], now: number): T[] {
  const epoch = Math.floor(now / HOME_CREW_ROTATION_MS);
  const unique = new Map<string, T>();
  for (const profile of profiles) if (profile.user_id && !unique.has(profile.user_id)) unique.set(profile.user_id, profile);
  const ranked = [...unique.values()].map(profile => {
    const created = Date.parse(profile.created_at ?? "");
    const age = now - created;
    return { profile, recent: Number.isFinite(age) && age >= 0 && age < HOME_CREW_NEW_WINDOW_MS, created, score: rotationScore(profile.user_id, epoch) };
  });
  ranked.sort((a, b) => Number(b.recent) - Number(a.recent)
    || (a.recent && b.recent ? b.created - a.created : 0)
    || a.score - b.score
    || (a.profile.user_id < b.profile.user_id ? -1 : a.profile.user_id > b.profile.user_id ? 1 : 0));
  return ranked.map(row => row.profile);
}
