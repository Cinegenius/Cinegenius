import "server-only";

import { db } from "@/lib/db";
import { canCompanyRole } from "@/lib/company-roles";

/** The listing creator can edit their own listing; a company's accepted offer editors can edit company-owned offers. */
export async function canEditListing(userId: string, listing: { user_id: string | null; company_id: string | null }) {
  if (listing.user_id === userId && !listing.company_id) return true;
  if (!listing.company_id) return false;

  const { data: company, error: companyError } = await db.from("companies")
    .select("owner_user_id").eq("id", listing.company_id).maybeSingle();
  if (companyError) throw new Error("Firmenberechtigung konnte nicht geprüft werden.");
  if (!company) return false;
  if (company.owner_user_id === userId) return true;

  const { data: membership, error: membershipError } = await db.from("company_members")
    .select("role").eq("company_id", listing.company_id).eq("user_id", userId)
    .eq("status", "accepted").maybeSingle();
  if (membershipError) throw new Error("Firmenberechtigung konnte nicht geprüft werden.");
  return canCompanyRole(membership?.role, "edit_offers");
}

export async function editableCompanyIdsForUser(userId: string): Promise<string[]> {
  const [{ data: owned, error: ownedError }, { data: memberships, error: membershipError }] = await Promise.all([
    db.from("companies").select("id").eq("owner_user_id", userId),
    db.from("company_members").select("company_id, role").eq("user_id", userId).eq("status", "accepted"),
  ]);
  if (ownedError || membershipError) throw new Error("Firmenberechtigungen konnten nicht geladen werden.");
  return [...new Set([
    ...(owned ?? []).map((company) => company.id),
    ...(memberships ?? []).filter((member) => canCompanyRole(member.role, "edit_offers")).map((member) => member.company_id),
  ])];
}
