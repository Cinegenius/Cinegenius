import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { auth } from "@clerk/nextjs/server";
import CompanyDetail from "./CompanyDetail";

export const dynamic = "force-dynamic";

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

  const [listingsRes, membersRes, servicesRes, equipmentRes] = await Promise.all([
    supabaseAdmin
      .from("listings")
      .select("id, title, type, category, price, city, image_url, created_at")
      .eq("company_id", company.id)
      .eq("published", true)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("company_members")
      .select("id, user_id, role, title, status, created_at")
      .eq("company_id", company.id)
      .order("created_at", { ascending: true })
      .then(async ({ data: rawMembers }) => {
        const visible = isOwner
          ? (rawMembers ?? [])
          : (rawMembers ?? []).filter((m) => m.status === "accepted");
        if (!visible.length) return [];
        const userIds = visible.map((m) => m.user_id);
        const { data: profiles } = await supabaseAdmin
          .from("profiles")
          .select("user_id, display_name, avatar_url, slug, role")
          .in("user_id", userIds);
        const profileMap = Object.fromEntries(
          (profiles ?? []).map((p) => [p.user_id, p])
        );
        return visible.map((m) => ({ ...m, profile: profileMap[m.user_id] ?? null }));
      }),
    supabaseAdmin
      .from("company_services")
      .select("*")
      .eq("company_id", company.id)
      .order("order", { ascending: true }),
    supabaseAdmin
      .from("company_equipment")
      .select("*")
      .eq("company_id", company.id)
      .eq("published", true)
      .order("created_at", { ascending: false }),
  ]);

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

  return (
    <CompanyDetail
      company={company}
      listings={listingsRes.data ?? []}
      members={membersRes}
      services={servicesRes.data ?? []}
      equipment={equipmentRes.data ?? []}
      myMembership={myMembership}
      currentUserId={userId ?? null}
    />
  );
}
