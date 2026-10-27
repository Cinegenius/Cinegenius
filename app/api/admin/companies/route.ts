import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/requireAdmin";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const params = request.nextUrl.searchParams;
  const search = (params.get("search") ?? "").trim().slice(0, 80).replace(/[%,()]/g, " ").trim();
  const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
  const pageSize = 30;
  let query = db.from("companies")
    .select("id, slug, owner_user_id, name, logo_url, logo_background, city, categories, services, verified, published, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (search) query = query.or(`name.ilike.%${search}%,city.ilike.%${search}%`);

  const { data: companies, error, count } = await query;
  if (error) return NextResponse.json({ error: "Firmen konnten nicht geladen werden." }, { status: 500 });

  const rows = companies ?? [];
  const companyIds = rows.map((company) => company.id);
  const ownerIds = [...new Set(rows.map((company) => company.owner_user_id).filter(Boolean))];
  const [membersResult, profilesResult, requestsResult] = await Promise.all([
    companyIds.length ? db.from("company_members").select("company_id, status").in("company_id", companyIds) : Promise.resolve({ data: [] as { company_id: string; status: string }[], error: null }),
    ownerIds.length ? db.from("profiles").select("user_id, display_name").in("user_id", ownerIds) : Promise.resolve({ data: [] as { user_id: string; display_name: string | null }[], error: null }),
    companyIds.length ? db.from("company_members").select("company_id").in("company_id", companyIds).eq("status", "pending") : Promise.resolve({ data: [] as { company_id: string }[], error: null }),
  ]);
  if (membersResult.error || profilesResult.error || requestsResult.error) {
    return NextResponse.json({ error: "Team- oder Inhaberdaten konnten nicht geladen werden." }, { status: 500 });
  }
  const ownerName = new Map((profilesResult.data ?? []).map((profile: { user_id: string; display_name: string | null }) => [profile.user_id, profile.display_name]));
  const memberCounts = new Map<string, number>();
  for (const member of membersResult.data ?? []) {
    if (member.status === "accepted") memberCounts.set(member.company_id, (memberCounts.get(member.company_id) ?? 0) + 1);
  }
  const requestCounts = new Map<string, number>();
  for (const request of requestsResult.data ?? []) requestCounts.set(request.company_id, (requestCounts.get(request.company_id) ?? 0) + 1);

  return NextResponse.json({
    companies: rows.map((company) => ({
      ...company,
      owner_name: ownerName.get(company.owner_user_id) ?? null,
      owner_profile_missing: !ownerName.has(company.owner_user_id),
      member_count: memberCounts.get(company.id) ?? 0,
      pending_request_count: requestCounts.get(company.id) ?? 0,
    })),
    total: count ?? 0,
    page,
    pageSize,
  }, { headers: { "Cache-Control": "private, no-store" } });
}
