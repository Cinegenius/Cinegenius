import "server-only";
import { db } from "@/lib/db";

export const ORGANIZATION_SELECT = "place_country_code,place_region_id,place_city_id,place_city_name,place_region_name,place_status,id,slug,name,description,logo_url,topics,city,region,website_url,public_contact_email,moderation_status,created_at,updated_at";
export const ORGANIZATION_ENTRY_SELECT = "place_country_code,place_region_id,place_city_id,place_city_name,place_region_name,place_status,id,organization_id,slug,entry_type,title,summary,description,topic,format,city,venue,starts_at,ends_at,registration_url,external_url,image_url,moderation_status,created_at,updated_at";

export async function approvedOrganizations() {
  const { data, error } = await db.from("organizations").select(ORGANIZATION_SELECT)
    .eq("moderation_status", "approved").order("name", { ascending: true });
  if (error) throw new Error("organization_read_failed", { cause: error.code });
  return data ?? [];
}

export async function approvedEntries(filters: { type?: string; topic?: string; q?: string; page?: number } = {}) {
  const page = Math.max(1, Math.min(10000, Math.floor(filters.page || 1)));
  const pageSize = 24;
  let query = db.from("organization_entries")
    .select(`${ORGANIZATION_ENTRY_SELECT},organization:organizations!inner(id,slug,name,logo_url,moderation_status)`)
    .in("moderation_status", ["approved", "ended"]).eq("organization.moderation_status", "approved")
    .order("created_at", { ascending: false }).order("id", { ascending: true });
  if (filters.type) query = query.eq("entry_type", filters.type);
  if (filters.topic) query = query.eq("topic", filters.topic);
  if (filters.q) query = query.ilike("title", `%${filters.q.slice(0, 120).replace(/[\\%_]/g, " ")}%`);
  const { data, error } = await query.range((page - 1) * pageSize, page * pageSize);
  if (error) throw new Error("organization_entries_read_failed", { cause: error.code });
  const rows = data ?? [];
  return { entries: rows.slice(0, pageSize), hasMore: rows.length > pageSize, page };
}

export async function approvedOrganizationBySlug(slug: string) {
  const { data, error } = await db.from("organizations").select(ORGANIZATION_SELECT)
    .eq("slug", slug).eq("moderation_status", "approved").maybeSingle();
  if (error) throw new Error("organization_read_failed", { cause: error.code });
  if (!data) return null;
  const { data: entries, error: entriesError } = await db.from("organization_entries").select(ORGANIZATION_ENTRY_SELECT)
    .eq("organization_id", data.id).in("moderation_status", ["approved", "ended"])
    .order("starts_at", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false });
  if (entriesError) throw new Error("organization_entries_read_failed", { cause: entriesError.code });
  return { organization: data, entries: entries ?? [] };
}

export async function approvedEntryBySlugs(organizationSlug: string, entrySlug: string) {
  const { data: organization, error: organizationError } = await db.from("organizations").select(ORGANIZATION_SELECT)
    .eq("slug", organizationSlug).eq("moderation_status", "approved").maybeSingle();
  if (organizationError) throw new Error("organization_read_failed", { cause: organizationError.code });
  if (!organization) return null;
  const { data: entry, error } = await db.from("organization_entries").select(ORGANIZATION_ENTRY_SELECT)
    .eq("organization_id", organization.id).eq("slug", entrySlug).in("moderation_status", ["approved", "ended"]).maybeSingle();
  if (error) throw new Error("organization_entries_read_failed", { cause: error.code });
  return entry ? { organization, entry } : null;
}

export async function organizationWorkspace(userId: string) {
  const [{ data: owned, error: ownedError }, { data: memberships, error: membershipsError }] = await Promise.all([
    db.from("organizations").select("*").eq("owner_user_id", userId).order("created_at", { ascending: false }),
    db.from("organization_members").select("organization_id").eq("user_id", userId).eq("status", "active").in("role", ["owner", "admin"]),
  ]);
  if (ownedError || membershipsError) throw new Error("organization_workspace_read_failed");
  const ids = [...new Set([...(owned ?? []).map((row) => row.id), ...(memberships ?? []).map((row) => row.organization_id)])];
  if (!ids.length) return { organizations: [], entries: [] };
  const { data: organizations, error: organizationsError } = await db.from("organizations").select("*")
    .in("id", ids).order("created_at", { ascending: false });
  if (organizationsError) throw new Error("organization_workspace_read_failed");
  const { data: entries, error: entriesError } = await db.from("organization_entries").select("*").in("organization_id", ids).order("created_at", { ascending: false });
  if (entriesError) throw new Error("organization_workspace_read_failed");
  return { organizations: organizations ?? [], entries: entries ?? [] };
}
