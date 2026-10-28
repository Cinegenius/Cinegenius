import { publicResponsiblePerson, responsibleForCompany } from "@/lib/responsible-person-server";
import { visibleLinkedProfileIds } from "@/lib/linked-profile-access";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import CompanyDetail from "./CompanyDetail";
import { isPublicCompanyMembership } from "@/lib/company-membership-requests";

async function getCompany(slug: string) {
  const { data } = await db.from("companies")
    .select("id, slug, owner_user_id, responsible_person, name, logo_url, cover_url, description, city, website, email_public, phone_public, categories, services, portfolio_images, tagline, bio_short, usp, founded_year, legal_form, hq_address_public, countries, industry_focus, social_links, catering_details, published, verified, created_at")
    .eq("slug", slug).maybeSingle();
  if (!data) return null;

  // Contact consent can change at any time; keep it out of shared cached data.
  const publicContactColumns = [
    ...(data.email_public === true ? ["email"] : []),
    ...(data.phone_public === true ? ["phone"] : []),
    ...(data.hq_address_public === true ? ["hq_address"] : []),
  ];
  if (publicContactColumns.length === 0) return data;
  const { data: publicContacts } = await db.from("companies")
    .select(publicContactColumns.join(", "))
    .eq("id", data.id)
    .maybeSingle();
  return { ...data, ...((publicContacts ?? {}) as Record<string, unknown>) };
}

async function getCompanyPublicData(companyId: string, ownerUserId: string, viewerId: string | null = null) {
    const [listingsRes, rawMembersRes, servicesRes, equipmentRes] = await Promise.all([
      db.from("listings")
        .select("id, title, type, category, price, city, image_url, created_at")
        .eq("company_id", companyId)
        .eq("published", true)
        .order("created_at", { ascending: false }),
      db.from("company_members")
        .select("id, user_id, role, title, public_titles, status, created_at")
        .eq("company_id", companyId)
        .eq("status", "accepted")
        .order("created_at", { ascending: true }),
      db.from("company_services")
        .select("id, type, title, description, use_cases, price_on_request, price_note")
        .eq("company_id", companyId)
        .order("order", { ascending: true }),
      db.from("company_equipment")
        .select("id, category, subcategory, name, brand, model, condition, available, price_day, price_week, price_on_request, pickup_available, delivery_available, insured, quantity")
        .eq("company_id", companyId)
        .eq("published", true)
        .order("created_at", { ascending: false }),
    ]);

    const visibleIds = await visibleLinkedProfileIds((rawMembersRes.data ?? []).map((member) => member.user_id), viewerId);
    const rawMembers = (rawMembersRes.data ?? []).filter((member) => isPublicCompanyMembership(member.status) && visibleIds.has(member.user_id));
    let members: object[] = [];
    if (rawMembers.length > 0) {
      const { data: profiles } = await db
        .from("profiles")
        .select("user_id, display_name, avatar_url, slug, role")
        .in("user_id", rawMembers.map((m) => m.user_id));
      const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.user_id, {
        user_id: p.user_id,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        slug: p.slug,
        role: p.role,
      }]));
      members = rawMembers.map((m) => ({
        id: m.id,
        title: m.title,
        public_titles: m.public_titles?.length ? m.public_titles : m.title ? [m.title] : [],
        status: m.status,
        created_at: m.created_at,
        is_company_owner: m.user_id === ownerUserId,
        profile: profileMap[m.user_id] ?? null,
      }));
    }

    return {
      listings: listingsRes.data ?? [],
      members,
      services: servicesRes.data ?? [],
      equipment: equipmentRes.data ?? [],
    };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const company = await getCompany(slug);
  if (!company || company.published !== true) return {};

  const cats = Array.isArray(company.categories) ? (company.categories as string[]).join(", ") : "";
  const description = company.description
    ? company.description.slice(0, 155)
    : `${company.name}${company.city ? ` in ${company.city}` : ""}${cats ? ` — ${cats}` : ""} auf CineGenius.`;

  return {
    title: company.name,
    description,
    openGraph: {
      title: `${company.name} | CineGenius`,
      description,
      images: company.logo_url ? [{ url: company.logo_url, width: 400, height: 400, alt: company.name }] : [],
    },
  };
}

export default async function CompanyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { userId } = await auth();

  const company = await getCompany(slug);

  if (!company || (company.published !== true && userId !== company.owner_user_id)) notFound();

  const isOwner = userId === company.owner_user_id;

  // Public data is accepted-only. Pending requests are private and only shown
  // in the company dashboard to authorized team managers.
  const [publicData, myMembership, myTitleChangeRequest] = await Promise.all([
    getCompanyPublicData(company.id, company.owner_user_id, userId),
    // Check current user's membership status
    userId && !isOwner
      ? db.from("company_members")
          .select("id, status, role, title, public_titles")
          .eq("company_id", company.id)
          .eq("user_id", userId)
          .maybeSingle()
          .then((r) => r.data ?? null)
      : Promise.resolve(null),
    userId && !isOwner
      ? db.from("company_member_title_change_requests")
          .select("id, status, created_at")
          .eq("company_id", company.id)
          .eq("user_id", userId)
          .eq("status", "pending")
          .maybeSingle()
          .then((r) => r.data ?? null)
      : Promise.resolve(null),
  ]);

  const publicCompany = { ...company };
  delete (publicCompany as Record<string, unknown>).owner_user_id;
  delete (publicCompany as Record<string, unknown>).responsible_person;
  const normalised = {
    ...publicCompany,
    responsible: await publicResponsiblePerson(await responsibleForCompany(company.responsible_person, company.id, company.owner_user_id), userId),
    email: company.email_public === true ? (company as typeof company & { email?: string | null }).email ?? null : null,
    phone: company.phone_public === true ? (company as typeof company & { phone?: string | null }).phone ?? null : null,
    hq_address: company.hq_address_public === true ? (company as typeof company & { hq_address?: string | null }).hq_address ?? null : null,
    contact_requires_sign_in: Boolean(!userId && (
      company.email_public !== true || company.phone_public !== true || company.hq_address_public !== true
    )),
    portfolio_images: Array.isArray(company.portfolio_images) ? company.portfolio_images as string[] : [],
    categories:       Array.isArray(company.categories)       ? company.categories       as string[] : [],
    services:         Array.isArray(company.services)         ? company.services         as string[] : [],
    countries:        Array.isArray(company.countries)        ? company.countries        as string[] : [],
    industry_focus:   Array.isArray(company.industry_focus)   ? company.industry_focus   as string[] : [],
    social_links:     (company.social_links && typeof company.social_links === "object" && !Array.isArray(company.social_links))
                        ? company.social_links as Record<string, string>
                        : {},
  };

  return (
    <CompanyDetail
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      company={normalised as any}
      listings={publicData.listings}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      members={publicData.members as any[]}
      services={publicData.services}
      equipment={publicData.equipment}
      myMembership={myMembership}
      myTitleChangeRequest={myTitleChangeRequest}
      currentUserId={userId ?? null}
      initialIsOwner={isOwner}
    />
  );
}
