import { departments } from './departments';
import { selectedCrewOccupations } from './crew-occupations';
import { DEPARTMENTS, marketplaceCategory } from './marketplaceCategories';
import { COMPANY_CATEGORIES } from './companyCategories';
import { canonicalCompanyServiceIds } from './company-service-filter';
import { JOB_EMPLOYMENT_TYPES, jobSchedule } from './job-metadata';
import { isCurrencyCode, listingCurrency } from './currency';
import { placeCatalog } from './places/catalog';
import { COUNTRY_CODES } from './places/countries';
import { publicMapPoint } from './places/public-map-point';
import { locationDistanceKm } from './location-map';
import { readPublicLocationArea } from './location-privacy';
import { matchesLocationDetails, readLocationDetailFilters, type LocationDetailFilters } from './location-browse-details';

export type SearchBrowseFilters = {
  version: 1; country?: string; region?: string; city?: string; radiusKm?: number;
  departments?: string[]; marketplace?: string[]; locationTypes?: string[];
  companyCategories?: string[]; jobTypes?: string[]; projectTypes?: string[];
  location?: LocationDetailFilters & { indoorOutdoor?: 'innen' | 'außen' | 'beides'; currency?: string; min?: string; max?: string; power?: '1' };
};
export type PublicBrowseFacets = { departments?: string[]; marketplace?: string; locationType?: string; companyCategories?: string[]; jobType?: string; projectType?: string;
  place?: { country: string; region: string; city: string; cityName: string; regionName: string } };
export const BROWSE_LOCATION_TYPES = ['Wohnen', 'Villa', 'Büro', 'Industrie', 'Natur', 'Gastronomie', 'Studio', 'Fotostudio', 'Speziallocation'] as const;
export const BROWSE_PROJECT_TYPES = ['Spielfilm', 'Kurzfilm', 'Serie', 'Werbung', 'Musikvideo', 'Dokumentation'] as const;
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const keys = (v: Record<string, unknown>, allowed: readonly string[]) => Object.keys(v).every(k => allowed.includes(k));
const text = (v: unknown, n = 100): v is string => typeof v === 'string' && v.length <= n && !/[\u0000-\u001f\u007f<>\\]/.test(v);
const present = (v: unknown) => v !== undefined && v !== '';
const cityById = new Map(placeCatalog.cities.map(v => [v.id, v]));
const regionById = new Map(placeCatalog.regions.map(v => [v.id, v]));
const options: Record<string, Set<string>> = {
  departments: new Set(departments.map(v => v.id)),
  marketplace: new Set(DEPARTMENTS.flatMap(v => [v.id, ...v.groups.flatMap(g => [g.id, ...g.items.map(i => i.value)])])),
  locationTypes: new Set(BROWSE_LOCATION_TYPES), companyCategories: new Set(COMPANY_CATEGORIES.map(v => v.id)), jobTypes: new Set(JOB_EMPLOYMENT_TYPES),
};
const projectAliases: Record<string, string> = { 'Werbefilm': 'Werbung', 'Werbefilm / Commercial': 'Werbung', 'Commercial': 'Werbung', 'TV / Serie': 'Serie', 'TV / Episodic': 'Serie', 'Serie / TV': 'Serie', 'Dokumentarfilm': 'Dokumentation' };
const catalogueKey = (value: string) => value.normalize('NFKC').toLowerCase();
const projectTypes = new Map<string, string>([...BROWSE_PROJECT_TYPES.map(v => [catalogueKey(v), v] as [string, string]), ...Object.entries(projectAliases).map(([alias, value]) => [catalogueKey(alias), value] as [string, string])]);
const locationTypes = new Map<string, string>([...BROWSE_LOCATION_TYPES.map(v => [catalogueKey(v), v] as [string, string]), ['filmstudio', 'Studio']]);
// Match known catalogue IDs and their documented aliases like the directories.
// Existing public custom values retain their exact persisted identity.
export const browseProjectType = (v: unknown) => text(v) && v.trim() ? projectTypes.get(catalogueKey(v.trim())) ?? v.trim() : '';
export const browseLocationType = (v: unknown) => text(v) && v.trim() ? locationTypes.get(catalogueKey(v.trim())) ?? v.trim() : '';

/** Closed request envelope. Empty controls normalize to the one reset value. */
export function readSearchBrowseFilters(value: unknown): SearchBrowseFilters | null {
  if (value === undefined) return { version: 1 };
  if (!object(value) || value.version !== 1 || !keys(value, ['version', 'country', 'region', 'city', 'radiusKm', ...Object.keys(options), 'projectTypes', 'location'])) return null;
  const result: SearchBrowseFilters = { version: 1 };
  for (const key of ['country', 'region', 'city'] as const) {
    if (!present(value[key])) continue;
    if (!text(value[key]) || !value[key].trim()) return null;
    result[key] = value[key];
  }
  if (result.country && !(COUNTRY_CODES as readonly string[]).includes(result.country)) return null;
  const city = result.city ? cityById.get(result.city) : undefined, region = result.region ? regionById.get(result.region) : undefined;
  if (result.city && !city || result.region && !region || city && result.region && city.region !== result.region || city && result.country && city.country !== result.country || region && result.country && region.country !== result.country) return null;
  if (city) { result.country = city.country; result.region = city.region; }
  else if (region) result.country = region.country;
  if (present(value.radiusKm) && value.radiusKm !== 0) {
    if (!Number.isInteger(value.radiusKm) || Number(value.radiusKm) < 1 || Number(value.radiusKm) > 200 || !city) return null;
    const point = publicMapPoint({ place_city_id: city.id, place_country_code: city.country, place_status: 'verified' });
    if (point.lat === null || point.lng === null) return null;
    result.radiusKm = Number(value.radiusKm);
  }
  for (const key of [...Object.keys(options), 'projectTypes'] as (keyof typeof options | 'projectTypes')[]) {
    const values = value[key]; if (values === undefined) continue;
    if (!Array.isArray(values) || values.length > 100 || values.some(v => !text(v) || !v.trim())) return null;
    const normalized = values.map(v => key === 'locationTypes' ? browseLocationType(v) : key === 'projectTypes' ? browseProjectType(v) : v);
    if (normalized.some(v => !v || !['projectTypes', 'locationTypes'].includes(key) && !options[key].has(v))) return null;
    if (normalized.length) Object.assign(result, { [key]: [...new Set(normalized)].sort() });
  }
  if (value.location !== undefined) {
    const l = value.location;
    if (!object(l) || !keys(l, ['indoorOutdoor', 'currency', 'min', 'max', 'sqm', 'ceiling', 'parking', 'loading', 'blackout', 'natural', 'power'])) return null;
    const location: NonNullable<SearchBrowseFilters['location']> = {};
    if (present(l.indoorOutdoor)) { if (!['innen', 'außen', 'beides'].includes(String(l.indoorOutdoor))) return null; location.indoorOutdoor = l.indoorOutdoor as typeof location.indoorOutdoor; }
    if (present(l.currency)) { if (!isCurrencyCode(l.currency)) return null; location.currency = l.currency; }
    for (const key of ['min', 'max', 'sqm', 'ceiling', 'parking'] as const) {
      if (!present(l[key])) continue;
      if (typeof l[key] !== 'string' || !/^\d{1,7}(?:[.,]\d{1,6})?$/.test(l[key])) return null;
      const number = Number(l[key].replace(',', '.')); if (!Number.isFinite(number) || number < 0 || number > 1_000_000) return null;
      if (key === 'min' || key === 'max' || number > 0) location[key] = String(number);
    }
    for (const key of ['loading', 'blackout', 'natural', 'power'] as const) { if (!present(l[key])) continue; if (l[key] !== '1') return null; location[key] = '1'; }
    if (location.min !== undefined && location.max !== undefined && Number(location.min) > Number(location.max)) return null;
    if ((location.min !== undefined || location.max !== undefined) && !location.currency) location.currency = 'EUR';
    // The shared details helper has the same accepted numeric precision.
    const details = readLocationDetailFilters(location);
    for (const key of ['sqm', 'ceiling', 'parking'] as const) if (location[key] && !details[key]) return null;
    if (Object.keys(location).length) result.location = location;
  }
  return JSON.stringify(result).length <= 16_000 ? result : null;
}

export function hasSearchBrowseFilters(filters: SearchBrowseFilters | undefined, area?: string): boolean {
  if (!filters) return false;
  if (filters.country || filters.region || filters.city || filters.radiusKm) return true;
  const fields: Record<string, keyof SearchBrowseFilters> = { crew: 'departments', marketplace: 'marketplace', locations: 'locationTypes', companies: 'companyCategories', jobs: 'jobTypes', projects: 'projectTypes' };
  return area ? Boolean((filters[fields[area]] as unknown[] | undefined)?.length || area === 'locations' && filters.location) : Object.keys(filters).some(k => k !== 'version');
}

/** Input must already be permission projected. No raw/private coordinates are consulted. */
export function publicBrowseFacets(area: string, row: Record<string, unknown>): PublicBrowseFacets {
  const result: PublicBrowseFacets = {};
  if (area === 'crew') {
    const crew = object(row.crew) ? row.crew : undefined;
    result.departments = [...new Set(selectedCrewOccupations(Array.isArray(row.positions) ? row.positions as string[] : [], crew?.occupations, typeof row.role === 'string' ? row.role : null, crew?.primaryOccupation).map(v => v.departmentId))];
  } else if (area === 'marketplace') { const v = marketplaceCategory(row.category, String(row.type)); if (v) result.marketplace = v.department; }
  else if (area === 'locations') { const v = browseLocationType(row.category); if (v) result.locationType = v; }
  else if (area === 'companies') {
    const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
    result.companyCategories = canonicalCompanyServiceIds({ categories: strings(row.categories), services: strings(row.services) });
  } else if (area === 'jobs') { const v = jobSchedule(row.job)?.employmentType; if (v) result.jobType = v; }
  else if (area === 'projects') { const v = browseProjectType(row.type); if (v) result.projectType = v; }
  if (typeof row.place_country_code === 'string' && row.place_country_code) result.place = {
    country: row.place_country_code, region: String(row.place_region_id ?? ''), city: String(row.place_city_id ?? ''),
    cityName: typeof row.place_city_name === 'string' ? row.place_city_name : '', regionName: typeof row.place_region_name === 'string' ? row.place_region_name : '',
  };
  return result;
}

export function matchesBrowseFilters(area: string, row: Record<string, unknown>, filters: SearchBrowseFilters): boolean {
  const facets = publicBrowseFacets(area, row);
  // Country/region select the origin hierarchy. A radius crosses borders.
  if (filters.country && !filters.radiusKm && facets.place?.country !== filters.country) return false;
  if (filters.region && !filters.radiusKm && facets.place?.region !== filters.region) return false;
  if (filters.city && !filters.radiusKm && facets.place?.city !== filters.city) return false;
  if (filters.radiusKm && filters.city) {
    const city = cityById.get(filters.city)!;
    const origin = publicMapPoint({ place_city_id: city.id, place_country_code: city.country, place_status: 'verified' });
    const point = area === 'locations' ? readPublicLocationArea({ location_area: row.location_area }) ?? publicMapPoint(row) : publicMapPoint(row);
    if (origin.lat === null || origin.lng === null || point.lat === null || point.lng === null || locationDistanceKm([origin.lat, origin.lng], [point.lat, point.lng]) > filters.radiusKm) return false;
  }
  if (area === 'crew' && filters.departments?.length && !facets.departments?.some(v => filters.departments!.includes(v))) return false;
  if (area === 'marketplace' && filters.marketplace?.length) { const value = marketplaceCategory(row.category, String(row.type)); if (!filters.marketplace.some(v => v === value?.department || v === value?.subcategory || v === row.category)) return false; }
  if (area === 'companies' && filters.companyCategories?.length && !facets.companyCategories?.some(v => filters.companyCategories!.includes(v))) return false;
  if (area === 'jobs' && filters.jobTypes?.length && !filters.jobTypes.includes(facets.jobType ?? '')) return false;
  if (area === 'projects' && filters.projectTypes?.length && !filters.projectTypes.includes(facets.projectType ?? '')) return false;
  if (area === 'locations') {
    if (filters.locationTypes?.length && !filters.locationTypes.includes(facets.locationType ?? '')) return false;
    const l = filters.location;
    if (l) {
      if (!matchesLocationDetails(row, l) || l.power && row.power_available !== true) return false;
      if (l.indoorOutdoor && row.indoor_outdoor !== l.indoorOutdoor && !(l.indoorOutdoor !== 'beides' && row.indoor_outdoor === 'beides')) return false;
      if (l.currency && listingCurrency(row) !== l.currency) return false;
      if (l.min !== undefined || l.max !== undefined) {
        if (row.price_on_request === true || typeof row.price !== 'number' || !Number.isFinite(row.price) || row.price <= 0) return false;
        if (l.min !== undefined && row.price < Number(l.min) || l.max !== undefined && row.price > Number(l.max)) return false;
      }
    }
  }
  return true;
}
