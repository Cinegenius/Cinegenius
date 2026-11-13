import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/guards";
import { NextRequest, NextResponse } from "next/server";
import { validateAdminReason } from "@/lib/admin-audit";
import { setProjectVerification } from "@/lib/project-verification-server";
import { revalidatePath, revalidateTag } from "next/cache";
import { projectRecordWithDetails } from "@/lib/project-record";
import { getTranslations as getResponseTranslations } from "next-intl/server";

// GET /api/admin/projects?search=&page=1
export async function GET(req: NextRequest) {
  const tResponse = await getResponseTranslations();
  const adminResult = await requireAdmin();
  if (adminResult instanceof NextResponse) return adminResult;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = 30;
  const offset = (page - 1) * limit;

  let query = db
    .from("projects")
    .select("id, title, year, type, created_at, updated_at, created_by, director, metadata", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) query = query.ilike("title", `%${search.slice(0, 80).replace(/[%,()]/g, " ")}%`);

  const { data: projects, count, error } = await query;
  if (error) return NextResponse.json({ error: tResponse('System.requestFailed') }, { status: 500 });

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

  const result = (projects ?? []).map((p: Record<string, unknown>) => {
    const details = projectRecordWithDetails(p);
    return {
      id: p.id,
      title: p.title,
      year: p.year,
      type: p.type,
      verified: details.verified === true,
      created_at: p.created_at,
      updated_at: p.updated_at,
      created_by: p.created_by,
      director: p.director,
      crew_count: crewCounts[p.id as string] ?? 0,
    };
  });

  return NextResponse.json({ projects: result, total: count ?? 0 });
}

// PATCH /api/admin/projects — toggle verified
export async function PATCH(req: NextRequest) {
  const tResponse = await getResponseTranslations();
  const adminResult = await requireAdmin();
  if (adminResult instanceof NextResponse) return adminResult;

  const body = await req.json().catch(() => null);
  const reason = validateAdminReason(body?.reason);
  if (typeof body?.projectId !== "string" || typeof body?.verified !== "boolean" || !reason) {
    return NextResponse.json({ error: tResponse('System.m_55aca4e2b3ab') }, { status: 400 });
  }

  if (!(typeof body.expectedUpdatedAt === "string" || body.expectedUpdatedAt === null)) return NextResponse.json({ error: tResponse("projects.reviewChanged") }, { status: 409 });
  const result = await setProjectVerification({ projectId: body.projectId, actorUserId: adminResult.userId, verified: body.verified, reason, expectedUpdatedAt: body.expectedUpdatedAt });
  if (result.kind !== "success") return NextResponse.json({ error: tResponse(result.kind === "conflict" ? "projects.reviewChanged" : "System.requestFailed") }, { status: result.kind === "conflict" ? 409 : result.kind === "missing" ? 404 : 503 });
  revalidatePath(`/projects/${body.projectId}`);
  revalidateTag("projects", { expire: 0 });
  return NextResponse.json({ ...result, success: true });
}
