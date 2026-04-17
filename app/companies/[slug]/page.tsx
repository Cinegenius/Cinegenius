import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import CompanyDetail from "./CompanyDetail";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { data: company } = await supabaseAdmin
    .from("companies")
    .select("name, description, city, logo_url, categories")
    .eq("slug", slug)
    .maybeSingle();

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

  // Fetch by slug without published filter first — owners must always see their own page
  const { data: company } = await supabaseAdmin
    .from("companies")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  // Non-owners only see published companies
  if (!company || (company.published === false && userId !== company.owner_user_id)) notFound();

  const isOwner = userId === company.owner_user_id;

  const [listingsRes, rawMembersRes, servicesRes, equipmentRes] = await Promise.all([
    supabaseAdmin
      .from("listings")
      .select("id, title, type, category, price, city, image_url, created_at")
      .eq("company_id", company.id)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("company_members")
      .select("id, user_id, role, title, status, created_at")
      .eq("company_id", company.id)
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("company_services")
      .select("*")
      .eq("company_id", company.id)
      .order("order", { ascending: true }),
    supabaseAdmin
      .from("company_equipment")
      .select("*")
      .eq("company_id", company.id)
      .order("created_at", { ascending: false }),
  ]);

  // Enrich members with profiles
  const rawMembers = rawMembersRes.data ?? [];
  const visible = isOwner ? rawMembers : rawMembers.filter((m) => m.status === "accepted");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let membersRes: any[] = [];
  if (visible.length > 0) {
    const userIds = visible.map((m) => m.user_id);
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("user_id, display_name, avatar_url, slug, role")
      .in("user_id", userIds);
    const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.user_id, p]));
    membersRes = visible.map((m) => ({ ...m, profile: profileMap[m.user_id] ?? null }));
  }

  // Check if current user has already requested to join
  let myMembership: { id: string; status: string } | null = null;
  if (userId && !isOwner) {
    const { data: mm } = await supabaseAdmin
      .from("company_members")
      .select("id, status")
      .eq("company_id", company.id)
      .eq("user_id", userId)
      .maybeSingle();
    myMembership = mm ?? null;
  }

  // Normalise JSONB arrays that Supabase types as Json
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      listings={listingsRes.data ?? []}
      members={membersRes}
      services={servicesRes.data ?? []}
      equipment={equipmentRes.data ?? []}
      myMembership={myMembership}
      currentUserId={userId ?? null}
    />
  );
}
