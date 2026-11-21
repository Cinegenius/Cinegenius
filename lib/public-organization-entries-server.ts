import 'server-only';
import { db } from '@/lib/db';
import { scanOrganizationRows } from '@/lib/organization-entry-browser-server';
import { browsePublicEntries, type PublicEntryFilters, type PublicEntryIndex } from '@/lib/public-organization-entries';
import { newsPreviewImage } from '@/lib/news-gallery';

const INDEX = 'id,title,topic,entry_type,place_country_code,external_url,created_at';
const PARENT = ',organization:organizations!inner(moderation_status)';
type CardRow = PublicEntryIndex & {
  slug: string; summary: string | null; image_url: string | null; image_gallery: unknown;
  starts_at: string | null; ends_at: string | null;
};

/** This public reader has no workspace/admin endpoint or membership scope.
 * Each database read requires current public entry AND publisher approval. */
export async function publicOrganizationEntries(organizationId: string, filters: PublicEntryFilters) {
  const publicQuery = (columns: string) => db.from('organization_entries').select(columns + PARENT)
    .eq('organization_id', organizationId).in('moderation_status', ['approved', 'ended'])
    .eq('organization.moderation_status', 'approved');
  const index = await scanOrganizationRows<PublicEntryIndex>(after => {
    let query = publicQuery(INDEX).order('id').limit(500);
    if (after) query = query.gt('id', after);
    return query.then(result => ({ data: result.data as unknown as PublicEntryIndex[] | null, error: result.error }));
  });
  const result = browsePublicEntries(index, filters);
  if (!result.ids.length) return { ...result, entries: [] };
  const { data, error } = await publicQuery(`${INDEX},slug,summary,image_url,image_gallery,starts_at,ends_at`).in('id', result.ids);
  if (error || !data) throw new Error('public_organization_entries_unavailable');
  const rows = data as unknown as CardRow[];
  // A concurrent withdrawal must not leave stale totals or partially filled pages.
  // Fail retryably rather than presenting the earlier index as a current success.
  if (rows.length !== result.ids.length || rows.some(row => {
    const previous = index.find(item => item.id === row.id);
    return !previous || Object.keys(previous).some(key => key !== 'organization' && previous[key as keyof PublicEntryIndex] !== row[key as keyof PublicEntryIndex]);
  })) throw new Error('public_organization_entries_changed');
  const byId = new Map(rows.map(row => [row.id, row]));
  const entries = result.ids.map(id => {
    const row = byId.get(id)!;
    // Explicit projection: no nested moderation data, contacts, body or full gallery.
    return { id: row.id, slug: row.slug, title: row.title, summary: row.summary, topic: row.topic,
      entry_type: row.entry_type, place_country_code: row.place_country_code, external_url: row.external_url,
      created_at: row.created_at, starts_at: row.starts_at, ends_at: row.ends_at,
      image: newsPreviewImage(row.image_url, row.image_gallery) };
  });
  return { ...result, entries };
}
