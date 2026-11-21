import { readableOrganizations, readOrganizationEntries } from '@/lib/organization-entry-browser-server';
import { UNASSIGNED_COUNTRY } from "@/lib/places/core";
import { newsDiscoveryIndex, regionalNews } from '@/lib/news-discovery';
import { newsEntryCountry } from '@/lib/news-region';
import { geographicPage,type BrowsePlace } from "@/lib/browse-geography";
import { db } from "@/lib/db";
import "server-only";

export async function newsFacetRows() {
  const rows = await newsDiscoveryIndex();
  return [...new Map(rows.map(row => {
    const facet = { type: row.entry_type, topic: row.topic ?? '', country: newsEntryCountry(row) };
    return [JSON.stringify(facet), facet];
  })).values()];
}

export const ORGANIZATION_SELECT = "place_country_code,place_region_id,place_city_id,place_city_name,place_region_name,place_status,id,slug,name,description,logo_url,topics,city,region,website_url,public_contact_email,moderation_status,created_at,updated_at";
export const ORGANIZATION_ENTRY_SELECT = "place_country_code,place_region_id,place_city_id,place_city_name,place_region_name,place_status,id,organization_id,slug,entry_type,title,summary,description,topic,format,city,venue,starts_at,ends_at,registration_url,external_url,image_url,image_gallery,moderation_status,publication_authority,created_at,updated_at";

export async function approvedOrganizations() {
  const { data, error } = await db.from("organizations").select(ORGANIZATION_SELECT)
    .eq("moderation_status", "approved").order("name", { ascending: true });
  if (error) throw new Error("organization_read_failed", { cause: error.code });
  return data ?? [];
}

export async function approvedEntries(filters: { type?: string; topic?: string; q?: string; page?: number; country?: string; preferred?: BrowsePlace | null } = {}) {
  const page = Math.max(1, Math.min(10000, Math.floor(filters.page || 1)));
  const pageSize = 24;
  // Use the same effective source/entry country as the facet choices. Pagination
  // selects at most 24 IDs, then rechecks both approvals before loading content.
  if (filters.country) {
    const matching = regionalNews(await (filters.q ? newsDiscoveryIndex(filters.q) : newsDiscoveryIndex()), filters.country)
      .filter(row => (!filters.type || row.entry_type === filters.type) && (!filters.topic || row.topic === filters.topic));
    const ids = matching.slice((page - 1) * pageSize, page * pageSize).map(row => row.id);
    if (!ids.length) return {entries: [], hasMore: false, page, count: matching.length};
    const {data, error} = await db.from('organization_entries')
      .select(`${ORGANIZATION_ENTRY_SELECT},organization:organizations!inner(id,slug,name,logo_url,moderation_status,place_country_code,region)`)
      .in('moderation_status', ['approved', 'ended']).eq('organization.moderation_status', 'approved')
      .in('id', ids).order('created_at', {ascending: false}).order('id');
    if (error) throw new Error('organization_entries_read_failed', {cause: error.code});
    const entries = (data ?? []).filter(row => (newsEntryCountry(row) || UNASSIGNED_COUNTRY) === filters.country) as unknown as OrganizationNewsEntry[];
    return {entries, hasMore: matching.length > page * pageSize, page, count: matching.length};
  }
  const { data, error, count } = await geographicPage<Record<string, unknown>>((clause, range) => {
  let query = db.from("organization_entries")
    .select(`${ORGANIZATION_ENTRY_SELECT},organization:organizations!inner(id,slug,name,logo_url,moderation_status)`, { count: "exact", head: !range })
    .in("moderation_status", ["approved", "ended"]).eq("organization.moderation_status", "approved")
    .order("created_at", { ascending: false }).order("id", { ascending: true });
  if (filters.type) query = query.eq("entry_type", filters.type);
  if (filters.topic) query = query.eq("topic", filters.topic);
  if (filters.q) query = query.ilike("title", `%${filters.q.slice(0, 120).replace(/[\\%_]/g, " ")}%`);
  if (clause) query = query.or(clause);
  return range ? query.range(range.from, range.to) : query;
  }, (page - 1) * pageSize, page * pageSize, filters.country ? null : filters.preferred ?? null);
  if (error) throw new Error("organization_entries_read_failed", { cause: error.code });
  const rows = (data ?? []) as unknown as OrganizationNewsEntry[];
  return { entries: rows.slice(0, pageSize), hasMore: rows.length > pageSize, page, count: count ?? rows.length };
}

export async function approvedOrganizationBySlug(slug: string, includeEntries = true) {
  const {data: alias, error: aliasError} = await db.from('organization_route_aliases')
    .select('organization_id').eq('slug', slug).maybeSingle();
  if (aliasError) throw new Error('organization_alias_read_failed', {cause: aliasError.code});
  let organizationQuery = db.from("organizations").select(ORGANIZATION_SELECT).eq("moderation_status", "approved");
  organizationQuery = alias ? organizationQuery.eq('id', alias.organization_id) : organizationQuery.eq('slug', slug);
  const { data, error } = await organizationQuery.maybeSingle();
  if (error) throw new Error("organization_read_failed", { cause: error.code });
  if (!data) return null;
  if (!includeEntries) return { organization: data, entries: [] };
  const { data: entries, error: entriesError } = await db.from("organization_entries").select(ORGANIZATION_ENTRY_SELECT)
    .eq("organization_id", data.id).in("moderation_status", ["approved", "ended"])
    .order("starts_at", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false });
  if (entriesError) throw new Error("organization_entries_read_failed", { cause: entriesError.code });
  return { organization: data, entries: entries ?? [] };
}

export async function approvedEntryBySlugs(organizationSlug: string, entrySlug: string) {
  // Historical links grant no access: recheck both current approvals before
  // returning content or its canonical destination. No cross-request cache.
  const {data: alias, error: aliasError} = await db.from('organization_entry_route_aliases')
    .select('entry_id').eq('organization_slug', organizationSlug).eq('entry_slug', entrySlug).maybeSingle();
  if (aliasError) throw new Error('organization_alias_read_failed', {cause: aliasError.code});
  if (alias) {
    const {data: entry, error} = await db.from('organization_entries').select(ORGANIZATION_ENTRY_SELECT)
      .eq('id', alias.entry_id).in('moderation_status', ['approved', 'ended']).maybeSingle();
    if (error) throw new Error('organization_entries_read_failed', {cause: error.code});
    if (!entry) return null;
    const {data: organization, error: parentError} = await db.from('organizations').select(ORGANIZATION_SELECT)
      .eq('id', entry.organization_id).eq('moderation_status', 'approved').maybeSingle();
    if (parentError) throw new Error('organization_read_failed', {cause: parentError.code});
    return organization ? {organization, entry} : null;
  }
  const { data: organization, error: organizationError } = await db.from("organizations").select(ORGANIZATION_SELECT)
    .eq("slug", organizationSlug).eq("moderation_status", "approved").maybeSingle();
  if (organizationError) throw new Error("organization_read_failed", { cause: organizationError.code });
  if (!organization) return null;
  const { data: entry, error } = await db.from("organization_entries").select(ORGANIZATION_ENTRY_SELECT)
    .eq("organization_id", organization.id).eq("slug", entrySlug).in("moderation_status", ["approved", "ended"]).maybeSingle();
  if (error) throw new Error("organization_entries_read_failed", { cause: error.code });
  return entry ? { organization, entry } : null;
}

export async function organizationWorkspace(userId: string, includeEntries = true) {
  const organizations = await readableOrganizations({ userId });
  organizations.sort((a, b) => b.created_at.localeCompare(a.created_at));
  const entries = includeEntries ? await readOrganizationEntries(organizations.map(item => item.id)) : [];
  entries.sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
  return { organizations, entries };
}

export type OrganizationNewsEntry = { id: string; slug: string; entry_type: string; title: string; summary: string | null; topic: string | null; city: string | null; starts_at: string | null; ends_at: string | null; image_url: string | null; moderation_status: string; organization: { name: string; slug: string } | { name: string; slug: string }[] };
