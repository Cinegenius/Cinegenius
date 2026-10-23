import "server-only";
import { db } from "@/lib/db";
import { canCompanyRole, normalizeCompanyPermissionRole, type CompanyCapability } from "@/lib/company-roles";

export type CompanyAccess = {
  companyId: string;
  ownerUserId: string;
  role: "owner" | "admin" | "editor" | "member";
  status: "accepted";
};

export async function getCompanyAccess(companyId: string, userId: string): Promise<CompanyAccess | null> {
  const { data: company } = await db.from("companies").select("id, owner_user_id").eq("id", companyId).maybeSingle();
  if (!company) return null;
  if (company.owner_user_id === userId) {
    return { companyId, ownerUserId: company.owner_user_id, role: "owner", status: "accepted" };
  }

  const { data: membership } = await db.from("company_members")
    .select("role, status")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!membership || membership.status !== "accepted") return null;
  const role = normalizeCompanyPermissionRole(membership.role);
  if (!role || role === "owner") return null;
  return { companyId, ownerUserId: company.owner_user_id, role, status: "accepted" };
}

export async function hasCompanyCapability(companyId: string, userId: string, capability: CompanyCapability): Promise<boolean> {
  const access = await getCompanyAccess(companyId, userId);
  return !!access && canCompanyRole(access.role, capability);
}
