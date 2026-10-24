import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/requireAdmin";
import { NextRequest, NextResponse } from "next/server";

const STATUSES = new Set(["all", "pending", "confirmed", "rejected"]);

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const params = request.nextUrl.searchParams;
  const rawStatus = params.get("status") ?? "all";
  if (!STATUSES.has(rawStatus)) return NextResponse.json({ error: "Ungültiger Statusfilter." }, { status: 400 });
  const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
  const pageSize = 30;
  let query = db.from("bookings")
    .select("id, ref, user_id, listing_id, listing_title, listing_type, start_date, end_date, days, daily_rate, subtotal, platform_fee, total, status, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (rawStatus !== "all") query = query.eq("status", rawStatus);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: "Buchungsanfragen konnten nicht geladen werden." }, { status: 500 });
  const rows = data ?? [];
  const userIds = [...new Set(rows.map((row) => row.user_id))];
  const { data: profiles, error: profileError } = userIds.length
    ? await db.from("profiles").select("user_id, display_name").in("user_id", userIds)
    : { data: [], error: null };
  if (profileError) return NextResponse.json({ error: "Profilzuordnungen konnten nicht geladen werden." }, { status: 500 });
  const names = new Map((profiles ?? []).map((profile: { user_id: string; display_name: string | null }) => [profile.user_id, profile.display_name]));
  return NextResponse.json({ bookings: rows.map((row) => ({ ...row, requester_name: names.get(row.user_id) ?? null })), total: count ?? 0, page, pageSize }, { headers: { "Cache-Control": "private, no-store" } });
}
