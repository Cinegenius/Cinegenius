import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/requireAdmin";
import { NextRequest, NextResponse } from "next/server";

// GET /api/admin/users — list all profiles for admin user management
export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = 50;

  let query = db
    .from("profiles")
    .select("user_id, display_name, location, avatar_url, profile_types, verified, created_at, tagline", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (search) {
    query = query.ilike("display_name", `%${search}%`);
  }

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ users: data ?? [], total: count ?? 0, page, pageSize });
}

// PATCH /api/admin/users — toggle verified flag
export async function PATCH(req: NextRequest) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const { targetUserId, verified } = await req.json();
  if (!targetUserId || typeof verified !== "boolean") {
    return NextResponse.json({ error: "Ungültige Parameter" }, { status: 400 });
  }

  const { error } = await db
    .from("profiles")
    .update({ verified })
    .eq("user_id", targetUserId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
