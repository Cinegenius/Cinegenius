import "server-only";
import { db } from "@/lib/db";

export async function canManageOrganization(organizationId: string, userId: string) {
  const [organization, membership] = await Promise.all([
    db.from("organizations").select("owner_user_id").eq("id", organizationId).maybeSingle(),
    db.from("organization_members").select("user_id").eq("organization_id", organizationId)
      .eq("user_id", userId).eq("status", "active").in("role", ["owner", "admin"]).maybeSingle(),
  ]);
  if (organization.error || membership.error) return false;
  return organization.data?.owner_user_id === userId || !!membership.data;
}

export async function ownOrganizations(userId: string) {
  const { data, error } = await db.from("organizations")
    .select("place_country_code,place_region_id,place_city_id,place_city_name,place_region_name,place_status,id,slug,name,description,logo_url,topics,city,region,website_url,public_contact_email,responsible_person,moderation_status,moderation_reason,created_at,updated_at")
    .eq("owner_user_id", userId).order("created_at", { ascending: false });
  return error ? [] : data ?? [];
}
