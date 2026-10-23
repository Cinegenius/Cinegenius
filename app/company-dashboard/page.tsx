import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import DashboardClient from "./DashboardClient";
import { normalizeCompanyPermissionRole, type CompanyPermissionRole } from "@/lib/company-roles";

export const dynamic = "force-dynamic";

export default async function CompanyDashboardPage({ searchParams }: { searchParams: Promise<{ company_id?: string }> }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const { company_id: requestedCompanyId } = await searchParams;

  const [{ data: ownedCompanies }, { data: memberships }] = await Promise.all([
    db.from("companies").select("id").eq("owner_user_id", userId),
    db.from("company_members").select("company_id, role").eq("user_id", userId).eq("status", "accepted"),
  ]);
  const membershipRoles = new Map((memberships ?? []).map((member) => [member.company_id, member.role]));
  const companyIds = [...new Set([...(ownedCompanies ?? []).map((company) => company.id), ...membershipRoles.keys()])];
  if (!companyIds.length) redirect("/company-setup");

  const { data: companyRows } = await db.from("companies").select("*").in("id", companyIds);
  const choices = (companyRows ?? []).flatMap((company) => {
    const isOwner = company.owner_user_id === userId;
    const memberRole = normalizeCompanyPermissionRole(membershipRoles.get(company.id));
    const permissionRole: CompanyPermissionRole | null = isOwner ? "owner" : memberRole === "owner" ? null : memberRole;
    if (!permissionRole) return [];
    return [{ company, permissionRole }];
  });
  if (!choices.length) redirect(memberships?.length ? "/companies" : "/company-setup");

  const selected = choices.find((choice) => choice.company.id === requestedCompanyId) ?? choices[0];
  const companyOptions = choices.map(({ company }) => ({
    id: company.id,
    name: company.name,
    slug: company.slug,
    logo_url: company.logo_url,
    city: company.city,
  }));
  return <DashboardClient company={selected.company} permissionRole={selected.permissionRole} companyOptions={companyOptions} />;
}
