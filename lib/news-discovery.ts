import 'server-only';
import { cache } from 'react';
import { db } from '@/lib/db';
import { collectFacetRows } from '@/lib/browse-facets';
import { newsEntryCountry } from '@/lib/news-region';
import { UNASSIGNED_COUNTRY } from '@/lib/places/core';

export type NewsIndexRow = {
  id: string; entry_type: string; topic: string | null; place_country_code: string | null;
  city: string | null; starts_at: string | null; ends_at: string | null; created_at: string;
  moderation_status: string;
  organization: {place_country_code: string | null; region: string | null} | {place_country_code: string | null; region: string | null}[];
};

/** The existing facet scan doubles as a light public discovery index. Read every
 * metadata page (no 1,000-row ceiling), never bodies, photos or private contacts.
 * React cache deduplicates within this render only; approvals aren't cached across requests. */
export const newsDiscoveryIndex = cache(async (search = ''): Promise<NewsIndexRow[]> => collectFacetRows<NewsIndexRow>((from, to) => {
  let query = db.from('organization_entries')
    .select('id,entry_type,topic,place_country_code,city,starts_at,ends_at,created_at,moderation_status,organization:organizations!inner(place_country_code,region,moderation_status)')
    .in('moderation_status', ['approved', 'ended']).eq('organization.moderation_status', 'approved');
  if (search) query = query.ilike('title', `%${search.slice(0, 120).replace(/[\\%_]/g, ' ')}%`);
  return query.order('created_at', {ascending: false}).order('id').range(from, to);
}));

export function regionalNews(rows: NewsIndexRow[], country = '', currentOnly = false, now = Date.now()) {
  return rows.filter(row => {
    if (country && (newsEntryCountry(row) || UNASSIGNED_COUNTRY) !== country) return false;
    return !currentOnly || (row.moderation_status === 'approved' && (row.entry_type === 'news' || new Date(row.ends_at ?? row.starts_at ?? '').getTime() >= now));
  });
}

export async function newsCountries(currentOnly = false) {
  return [...new Set(regionalNews(await newsDiscoveryIndex(), '', currentOnly).map(row => newsEntryCountry(row) || UNASSIGNED_COUNTRY))];
}
