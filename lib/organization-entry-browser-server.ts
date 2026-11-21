import 'server-only';
import { db } from '@/lib/db';
import { browseOrganizationEntries, parseEntryFilters, type EntrySummary, type EntryPublisher, type OrganizationEntryRecord } from '@/lib/organization-entry-browser';

export type OrganizationReadScope = { userId: string; admin?: false } | { admin: true };
const BATCH = 500;
/** Keyset iteration also works when the provider caps responses below our batch
 * size. Never treat a short page as proof that every row was returned. */
export async function scanOrganizationRows<T extends { id: string }>(query: (after: string) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  let after = '';
  for (;;) {
    const result = await query(after);
    if (result.error || !result.data) throw new Error('organization_workspace_read_failed');
    if (!result.data.length) return rows;
    const next = result.data[result.data.length - 1].id;
    if (!next || next <= after) throw new Error('organization_workspace_pagination_failed');
    rows.push(...result.data); after = next;
  }
}

export async function readableOrganizations(scope: OrganizationReadScope) {
  if (scope.admin) return scanOrganizationRows(after => {
    let query = db.from('organizations').select('*').order('id').limit(BATCH);
    if (after) query = query.gt('id', after);
    return query;
  });
  const [owned, members] = await Promise.all([
    scanOrganizationRows(after => {
      let query = db.from('organizations').select('id').eq('owner_user_id', scope.userId).order('id').limit(BATCH);
      if (after) query = query.gt('id', after); return query;
    }),
    scanOrganizationRows(after => {
      let query = db.from('organization_members').select('organization_id').eq('user_id', scope.userId).eq('status', 'active').in('role', ['owner', 'admin']).order('organization_id').limit(BATCH);
      if (after) query = query.gt('organization_id', after);
      return query.then(result => ({ ...result, data: result.data?.map(item => ({ ...item, id: item.organization_id })) ?? null }));
    }),
  ]);
  const ids = [...new Set([...owned.map(item => item.id), ...members.map(item => item.organization_id)])];
  const organizations = [];
  for (let start = 0; start < ids.length; start += 100) {
    organizations.push(...await scanOrganizationRows(after => {
      let query = db.from('organizations').select('*').in('id', ids.slice(start, start + 100)).order('id').limit(BATCH);
      if (after) query = query.gt('id', after); return query;
    }));
  }
  return organizations;
}

const INDEX_COLUMNS = 'id,organization_id,slug,title,topic,entry_type,moderation_status,image_url,place_country_code,external_url,created_at,updated_at';
export async function readOrganizationEntries<T extends { id: string } = OrganizationEntryRecord>(ids: string[], columns = '*') {
  const entries: T[] = [];
  for (let start = 0; start < ids.length; start += 100) {
    entries.push(...await scanOrganizationRows(after => {
      let query = db.from('organization_entries').select(columns).in('organization_id', ids.slice(start, start + 100)).order('id').limit(BATCH);
      if (after) query = query.gt('id', after);
      return query.then(result => ({ data: result.data as unknown as T[] | null, error: result.error }));
    }));
  }
  return entries;
}

export async function organizationEntryBrowse(scope: OrganizationReadScope, params: URLSearchParams) {
  const organizations = await readableOrganizations(scope);
  const ids = organizations.map(item => item.id);
  const id = params.get('id');
  if (id) {
    if (!/^[a-f0-9-]{36}$/i.test(id)) return null;
    // A detail read rechecks access in this request, including membership revocation.
    if (!ids.length) return null;
    const { data, error } = await db.from('organization_entries').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error('organization_workspace_read_failed');
    if (!data || !ids.includes(data.organization_id)) return null;
    const parent = organizations.find(item => item.id === data.organization_id)!;
    return { entry: { ...data, organization: { id: parent.id, name: parent.name, slug: parent.slug, moderation_status: parent.moderation_status } } };
  }
  const entries = await readOrganizationEntries<EntrySummary>(ids, INDEX_COLUMNS);
  const publishers: EntryPublisher[] = organizations.map(item => ({ id: item.id, name: item.name, slug: item.slug, moderation_status: item.moderation_status }));
  return browseOrganizationEntries(entries, publishers, parseEntryFilters(params));
}
