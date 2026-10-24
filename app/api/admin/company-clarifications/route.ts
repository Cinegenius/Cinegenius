import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/requireAdmin";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const page = Math.max(1, Number.parseInt(request.nextUrl.searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = 25;
  const { data, error, count } = await db.from("admin_company_membership_clarifications")
    .select("id, company_id, user_id, title, public_titles, request_message, created_at, company_name, company_slug, owner_user_id, requester_name, owner_name", { count: "exact" })
    .order("created_at", { ascending: true })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (error) return NextResponse.json({ error: "Die Klärungsfälle konnten nicht geladen werden. Prüfe die Admin-Migration." }, { status: 503 });

  return NextResponse.json({ requests: data ?? [], total: count ?? 0, page, pageSize }, { headers: { "Cache-Control": "private, no-store" } });
}
