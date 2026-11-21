import { entryCountry, entrySource, parseEntryFilters } from '@/lib/organization-entry-browser';
import { isOrganizationEntryType, isOrganizationTopic } from '@/lib/organization-taxonomy';

export const PUBLIC_ENTRY_PAGE_SIZE = 12;
export const PUBLIC_ENTRY_FILTER_KEYS = ['country', 'topic', 'type', 'source', 'search', 'sort', 'page'] as const;
export type PublicEntryFilters = {
  country: string; topic: string; type: string; source: string; search: string; sort: string; page: number;
};
export const emptyPublicEntryFilters: PublicEntryFilters = {
  country: '', topic: '', type: '', source: '', search: '', sort: 'newest', page: 1,
};
export function parsePublicEntryFilters(params: URLSearchParams): PublicEntryFilters {
  const parsed = parseEntryFilters(params);
  return {
    country: parsed.country, topic: parsed.topic === 'none' || isOrganizationTopic(parsed.topic) ? parsed.topic : '',
    type: isOrganizationEntryType(params.get('type')) ? params.get('type')! : '',
    source: parsed.source, search: parsed.search, sort: parsed.sort, page: parsed.page,
  };
}
export function publicEntryHref(pathname: string, filters: PublicEntryFilters) {
  const params = new URLSearchParams();
  for (const key of PUBLIC_ENTRY_FILTER_KEYS) {
    if (filters[key] !== emptyPublicEntryFilters[key]) params.set(key, String(filters[key]));
  }
  return pathname + (params.size ? `?${params}` : '');
}
export type PublicEntryIndex = {
  id: string; title: string; topic: string | null; entry_type: string;
  place_country_code: string | null; external_url: string | null; created_at: string;
};
const normalize = (value: string) => value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
type Facet = 'country' | 'topic' | 'type' | 'source';
const facets: Facet[] = ['country', 'topic', 'type', 'source'];
const facetValue = (entry: PublicEntryIndex, facet: Facet) => facet === 'country' ? entryCountry(entry)
  : facet === 'source' ? entrySource(entry.external_url) || 'none'
  : facet === 'type' ? entry.entry_type : entry.topic || 'none';

/** Input must already be public. Only IDs and aggregate choices leave this index;
 * never serialize the whole catalogue or administrative publication metadata. */
export function browsePublicEntries(rows: PublicEntryIndex[], filters: PublicEntryFilters) {
  const unique = [...new Map(rows.map(row => [row.id, row])).values()];
  const terms = normalize(filters.search).split(/\s+/).filter(Boolean);
  const searched = unique.filter(row => terms.every(term => normalize(`${row.title} ${entrySource(row.external_url)}`).includes(term)));
  const matches = (row: PublicEntryIndex, except?: Facet) => facets.every(key => key === except || !filters[key] || facetValue(row, key) === filters[key]);
  const choices = Object.fromEntries(facets.map(key => {
    const counts: Record<string, number> = Object.create(null);
    for (const row of searched) if (matches(row, key)) {
      const value = facetValue(row, key); counts[value] = (counts[value] ?? 0) + 1;
    }
    // Server-component props must be plain serializable objects, not null-prototype maps.
    return [key, { ...counts }];
  })) as Record<Facet, Record<string, number>>;
  const filtered = searched.filter(row => matches(row)).sort((a, b) =>
    (a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)) * (filters.sort === 'oldest' ? 1 : -1));
  const total = filtered.length, pages = Math.max(1, Math.ceil(total / PUBLIC_ENTRY_PAGE_SIZE));
  const page = Math.min(filters.page, pages);
  return {
    ids: filtered.slice((page - 1) * PUBLIC_ENTRY_PAGE_SIZE, page * PUBLIC_ENTRY_PAGE_SIZE).map(row => row.id),
    total, page, pages, available: unique.length, facets: choices,
  };
}
export type PublicEntryBrowse = ReturnType<typeof browsePublicEntries>;
