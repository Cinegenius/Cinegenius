import type { NewsGalleryImage } from './news-gallery';
import { COUNTRY_CODES } from '@/lib/places/countries';

export const ENTRY_STATUSES = ['draft', 'submitted', 'approved', 'hidden', 'changes_requested', 'rejected', 'ended'] as const;
export const ENTRY_PAGE_SIZE = 24;
export type EntryPublisher = { id: string; name: string; slug: string; moderation_status: string };
export type EntrySummary = {
  id: string; organization_id: string; slug: string; title: string; topic: string;
  entry_type: string; moderation_status: string; image_url: string | null;
  place_country_code: string | null; external_url: string | null;
  created_at: string; updated_at: string;
};
export type OrganizationEntryRecord = EntrySummary & {
  summary: string; description: string; format: string; city: string; venue: string;
  starts_at: string | null; ends_at: string | null; registration_url: string | null;
  image_gallery?: NewsGalleryImage[]; moderation_reason: string;
};
export type EntryFilters = { country: string; topic: string; source: string; publisher: string; status: string; search: string; sort: string; page: number };
export const emptyEntryFilters: EntryFilters = { country: '', topic: '', source: '', publisher: '', status: '', search: '', sort: 'newest', page: 1 };
export const ENTRY_FILTER_KEYS = Object.keys(emptyEntryFilters) as (keyof EntryFilters)[];
export function parseEntryFilters(params: URLSearchParams, prefix = ''): EntryFilters {
  const read = (key: string) => (params.get(prefix + key) ?? '').trim().slice(0, 160);
  const country = read('country').toUpperCase();
  return {
    country: country === 'NONE' ? 'none' : (COUNTRY_CODES as readonly string[]).includes(country) ? country : '',
    topic: read('topic'), source: read('source').toLowerCase(), publisher: read('publisher'),
    status: (ENTRY_STATUSES as readonly string[]).includes(read('status')) ? read('status') : '',
    search: read('search'), sort: read('sort') === 'oldest' ? 'oldest' : 'newest',
    page: Math.min(1000000, Math.max(1, Math.floor(Number(read('page')) || 1))),
  };
}
export function entrySource(url: string | null) {
  try { const parsed = new URL(url ?? ''); return ['https:', 'http:'].includes(parsed.protocol) ? parsed.hostname.toLowerCase().replace(/^www\./, '') : ''; }
  catch { return ''; }
}
/** Only the article's stored country. Publisher address, language and source domain
 * are not evidence of audience, eligibility or event geography. */
export function entryCountry(entry: Pick<EntrySummary, 'place_country_code'>) {
  const value = entry.place_country_code ?? '';
  return (COUNTRY_CODES as readonly string[]).includes(value) ? value : 'none';
}
const normalize = (value: string) => value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const counts = (values: string[]) => values.reduce<Record<string, number>>((result, value) => { result[value] = (result[value] ?? 0) + 1; return result; }, Object.create(null));

/** One authorized index supplies rows, totals and every facet; no independent counts. */
export function browseOrganizationEntries(entries: EntrySummary[], publishers: EntryPublisher[], filters: EntryFilters) {
  const publisherById = new Map(publishers.map(item => [item.id, item]));
  const unique = [...new Map(entries.filter(item => publisherById.has(item.organization_id)).map(item => [item.id, item])).values()];
  const search = filters.search.split(/\s+/).map(normalize).filter(Boolean);
  const base = unique.filter(item => (!filters.publisher || item.organization_id === filters.publisher)
    && search.every(term => normalize(`${item.title} ${entrySource(item.external_url)}`).includes(term)));
  const countries = counts(base.map(entryCountry));
  const inCountry = base.filter(item => !filters.country || entryCountry(item) === filters.country);
  const topics = counts(inCountry.map(item => item.topic));
  const inTopic = inCountry.filter(item => !filters.topic || item.topic === filters.topic);
  const sources = counts(inTopic.map(item => entrySource(item.external_url) || 'none'));
  const inSource = inTopic.filter(item => !filters.source || (entrySource(item.external_url) || 'none') === filters.source);
  const statuses = counts(inSource.map(item => item.moderation_status));
  const filtered = inSource.filter(item => !filters.status || item.moderation_status === filters.status)
    .sort((a, b) => (a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)) * (filters.sort === 'oldest' ? 1 : -1));
  const total = filtered.length, pages = Math.max(1, Math.ceil(total / ENTRY_PAGE_SIZE)), page = Math.min(filters.page, pages);
  return {
    entries: filtered.slice((page - 1) * ENTRY_PAGE_SIZE, page * ENTRY_PAGE_SIZE).map(item => ({ ...item, organization: publisherById.get(item.organization_id)! })),
    total, page, pages, available: unique.length,
    facets: { countries, topics, sources, statuses, statusTotal: inSource.length },
    publishers: publishers.map(item => ({ ...item, count: unique.filter(entry => entry.organization_id === item.id).length })),
  };
}
export type EntryBrowseResult = ReturnType<typeof browseOrganizationEntries>;
