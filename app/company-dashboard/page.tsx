import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import OrganizationAccessPanel from "@/components/organizations/OrganizationAccessPanel";
import DashboardClient from "./DashboardClient";
import { normalizeCompanyPermissionRole, type CompanyPermissionRole } from "@/lib/company-roles";

export const dynamic = "force-dynamic";

export default async function CompanyDashboardPage({ searchParams }: { searchParams: Promise<{ company_id?: string }> }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const { company_id: requestedCompanyId } = await searchParams;

  const [{ data: ownedCompanies, error: ownedError }, { data: memberships, error: membershipError }] = await Promise.all([
    db.from("companies").select("id").eq("owner_user_id", userId),
    db.from("company_members").select("company_id, role").eq("user_id", userId).eq("status", "accepted"),
  ]);
  if (ownedError || membershipError) throw new Error("Company access lookup failed");
  const membershipRoles = new Map((memberships ?? []).map((member) => [member.company_id, member.role]));
  const companyIds = [...new Set([...(ownedCompanies ?? []).map((company) => company.id), ...membershipRoles.keys()])];
  if (!companyIds.length) {
    if (requestedCompanyId) notFound();
    redirect("/company-setup");
  }

  // A member can open the dashboard without receiving private company contacts.
  const { data: companyRows, error: companiesError } = await db.from("companies")
    .select("id, slug, owner_user_id, name, logo_url, city, categories, published, tagline, description, social_links")
    .in("id", companyIds).order("created_at", { ascending: false }).order("id");
  if (companiesError) throw new Error("Company lookup failed");
  const choices = (companyRows ?? []).flatMap((company) => {
    const isOwner = company.owner_user_id === userId;
    const memberRole = normalizeCompanyPermissionRole(membershipRoles.get(company.id));
    const permissionRole: CompanyPermissionRole | null = isOwner ? "owner" : memberRole === "owner" ? null : memberRole;
    if (!permissionRole) return [];
    const summary = {
      id: company.id, slug: company.slug, name: company.name, logo_url: company.logo_url,
      city: company.city, categories: company.categories, published: company.published,
      tagline: company.tagline, description: company.description, social_links: company.social_links,
    };
    return [{ company: summary, permissionRole }];
  });
  if (!choices.length) {
    if (requestedCompanyId) notFound();
    redirect(memberships?.length ? "/companies" : "/company-setup");
  }

  const selected = requestedCompanyId ? choices.find((choice) => choice.company.id === requestedCompanyId) : choices[0];
  if (!selected) notFound();
  const companyOptions = choices.map(({ company }) => ({
    id: company.id,
    name: company.name,
    slug: company.slug,
    logo_url: company.logo_url,
    city: company.city,
  }));
  return <><DashboardClient key={`${userId}:${selected.company.id}:${selected.permissionRole}`} company={selected.company} permissionRole={selected.permissionRole} companyOptions={companyOptions} />{["owner", "admin"].includes(selected.permissionRole) && <div className="site-container pb-28"><OrganizationAccessPanel key={selected.company.id} companyId={selected.company.id} /></div>}</>;
}
