import { normalizeProfileTypes } from './profile-display';
import { isCrewDirectoryProfile } from './primary-occupation';

type ProviderProfile = Parameters<typeof isCrewDirectoryProfile>[0] & {name?: string};
export const CREW_PROVIDER_FILTER = '__crew';
export const LOCATION_PROVIDER_FILTER = '__locations';
export const MARKETPLACE_PROVIDER_FILTER = '__marktplatz';
export function isProviderFilter(value: string | null): boolean {
  return value === CREW_PROVIDER_FILTER || value === LOCATION_PROVIDER_FILTER || value === MARKETPLACE_PROVIDER_FILTER;
}
export function filterProviderProfiles<T extends ProviderProfile>(profiles: readonly T[], area: string): T[] {
  if (area === CREW_PROVIDER_FILTER) return profiles.filter(profile => isCrewDirectoryProfile({...profile, display_name: profile.display_name ?? profile.name}));
  const types = area === LOCATION_PROVIDER_FILTER ? ['location', 'studio'] : area === MARKETPLACE_PROVIDER_FILTER ? ['equipment', 'vehicle', 'props'] : [];
  return profiles.filter(profile => normalizeProfileTypes(profile.profile_types, profile.profile_type).some(type => types.includes(type)));
}
/** People can offer a place or equipment without acquiring an invented crew occupation. */
export function isPeopleDirectoryProfile(profile: Parameters<typeof isCrewDirectoryProfile>[0]): boolean {
  return isCrewDirectoryProfile(profile) || filterProviderProfiles([profile], LOCATION_PROVIDER_FILTER).length > 0
    || filterProviderProfiles([profile], MARKETPLACE_PROVIDER_FILTER).length > 0;
}
