import { selectedCrewOccupations, type OccupationProfile } from './crew-occupations';
import type { NewsTopicChoice } from './news-topic';

// Canonical catalogue IDs shared by setup, profile editing and Crew search.
// These are interests inferred from an actual chosen job, not from free text,
// company ownership, profile labels or the order of a member's occupations.
const TECHNICAL_DEPARTMENTS = new Set([
  'kamera', 'licht', 'grip', 'ton', 'post', 'sfx', 'broadcast', 'virtual', 'foto',
]);

export function profileNewsTopic(profile: OccupationProfile | null | undefined): NewsTopicChoice {
  if (!profile) return 'all';
  const occupations = selectedCrewOccupations(
    profile.positions ?? [], profile.crew?.occupations, profile.role, profile.crew?.primaryOccupation,
  );
  return occupations.some(occupation => TECHNICAL_DEPARTMENTS.has(occupation.departmentId)) ? 'technology' : 'all';
}
