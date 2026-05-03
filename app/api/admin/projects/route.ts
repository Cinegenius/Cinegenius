import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/guards";
import { NextRequest, NextResponse } from "next/server";

// GET /api/admin/projects?search=&page=1
export async function GET(req: NextRequest) {
  const adminResult = await requireAdmin();
  if (adminResult instanceof NextResponse) return adminResult;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = 30;
  const offset = (page - 1) * limit;

  let query = db
    .from("projects")
    .select("id, title, year, type, verified, created_at, created_by, director", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) query = query.ilike("title", `%${search}%`);

  const { data: projects, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch crew counts
  const ids = (projects ?? []).map((p: { id: string }) => p.id);
  const crewCounts: Record<string, number> = {};
  if (ids.length > 0) {
    const { data: credits } = await db
      .from("project_credits")
      .select("project_id")
      .in("project_id", ids);
    for (const c of credits ?? []) {
      crewCounts[c.project_id] = (crewCounts[c.project_id] ?? 0) + 1;
    }
  }

  const result = (projects ?? []).map((p: Record<string, unknown>) => ({
    ...p,
    crew_count: crewCounts[p.id as string] ?? 0,
  }));

  return NextResponse.json({ projects: result, total: count ?? 0 });
}

// PATCH /api/admin/projects — toggle verified
export async function PATCH(req: NextRequest) {
  const adminResult = await requireAdmin();
  if (adminResult instanceof NextResponse) return adminResult;

  const body = await req.json().catch(() => null);
  if (!body?.projectId) return NextResponse.json({ error: "projectId fehlt" }, { status: 400 });

  const { error } = await db
    .from("projects")
    .update({ verified: body.verified })
    .eq("id", body.projectId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
