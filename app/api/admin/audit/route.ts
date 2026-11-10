import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/requireAdmin";
import { NextRequest, NextResponse } from "next/server";
import { getTranslations as getResponseTranslations } from "next-intl/server";

export async function GET(request: NextRequest) {
  const tResponse = await getResponseTranslations();
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const page = Math.max(1, Number.parseInt(request.nextUrl.searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = 50;
  const { data, error, count } = await db.from("admin_audit_log")
    .select("id, actor_user_id, action, entity_type, entity_id, reason, metadata, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (error) return NextResponse.json({ error: tResponse('System.m_e17685389e4b') }, { status: 503 });
  return NextResponse.json({ entries: data ?? [], total: count ?? 0, page, pageSize }, { headers: { "Cache-Control": "private, no-store" } });
}
