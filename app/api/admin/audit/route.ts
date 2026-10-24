import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/requireAdmin";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const page = Math.max(1, Number.parseInt(request.nextUrl.searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = 50;
  const { data, error, count } = await db.from("admin_audit_log")
    .select("id, actor_user_id, action, entity_type, entity_id, reason, metadata, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (error) return NextResponse.json({ error: "Das Aktionsprotokoll ist noch nicht verfügbar. Prüfe die Admin-Migration." }, { status: 503 });
  return NextResponse.json({ entries: data ?? [], total: count ?? 0, page, pageSize }, { headers: { "Cache-Control": "private, no-store" } });
}
