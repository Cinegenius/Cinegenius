import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { unstable_cache } from "next/cache";
import type { Metadata } from "next";
import CompanyDetail from "./CompanyDetail";

// Cache public company data for 5 minutes
const getCompany = unstable_cache(
  async (slug: string) => {
    const { data } = await db.from("companies").select("*").eq("slug", slug).maybeSingle();
    return data;
  },
  ["company-slug"],
  { revalidate: 300, tags: ["companies"] }
);

const getCompanyPublicData = unstable_cache(
  async (companyId: string) => {
    const [listingsRes, rawMembersRes, servicesRes, equipmentRes] = await Promise.all([
      db.from("listings")
        .select("id, title, type, category, price, city, image_url, created_at")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false }),
      db.from("company_members")
        .select("id, user_id, role, title, status, created_at")
        .eq("company_id", companyId)
        .eq("status", "accepted")
        .order("created_at", { ascending: true }),
      db.from("company_services")
        .select("*")
        .eq("company_id", companyId)
        .order("order", { ascending: true }),
      db.from("company_equipment")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false }),
    ]);

    const rawMembers = rawMembersRes.data ?? [];
    let members: object[] = [];
    if (rawMembers.length > 0) {
      const { data: profiles } = await db
        .from("profiles")
        .select("user_id, display_name, avatar_url, slug, role")
        .in("user_id", rawMembers.map((m) => m.user_id));
      const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.user_id, p]));
      members = rawMembers.map((m) => ({ ...m, profile: profileMap[m.user_id] ?? null }));
    }

    return {
      listings: listingsRes.data ?? [],
      members,
      services: servicesRes.data ?? [],
      equipment: equipmentRes.data ?? [],
    };
  },
  ["company-public-data"],
  { revalidate: 300, tags: ["companies"] }
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const company = await getCompany(slug);
  if (!company) return {};

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

  if (!company || (company.published === false && userId !== company.owner_user_id)) notFound();

  const isOwner = userId === company.owner_user_id;

  // Public data from cache + owner's pending members fetched fresh
  const [publicData, ownerPendingMembers, myMembership] = await Promise.all([
    getCompanyPublicData(company.id),
    // Owner sees pending members too — fetched fresh (not cached)
    isOwner
      ? db.from("company_members")
          .select("id, user_id, role, title, status, created_at")
          .eq("company_id", company.id)
          .eq("status", "pending")
          .order("created_at", { ascending: true })
          .then(async (res) => {
            const pending = res.data ?? [];
            if (!pending.length) return [];
            const { data: profiles } = await db
              .from("profiles")
              .select("user_id, display_name, avatar_url, slug, role")
              .in("user_id", pending.map((m) => m.user_id));
            const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.user_id, p]));
            return pending.map((m) => ({ ...m, profile: profileMap[m.user_id] ?? null }));
          })
      : Promise.resolve([]),
    // Check current user's membership status
    userId && !isOwner
      ? db.from("company_members")
          .select("id, status")
          .eq("company_id", company.id)
          .eq("user_id", userId)
          .maybeSingle()
          .then((r) => r.data ?? null)
      : Promise.resolve(null),
  ]);

  const allMembers = [...publicData.members, ...ownerPendingMembers] as object[];

  const normalised = {
    ...company,
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
      members={allMembers as any[]}
      services={publicData.services}
      equipment={publicData.equipment}
      myMembership={myMembership}
      currentUserId={userId ?? null}
    />
  );
}
