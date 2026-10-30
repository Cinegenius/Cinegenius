import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { saveProjectDraft } from "@/lib/project-drafts-server";
import { publicProjectMedia } from "@/lib/project-media-rights";

function privateNoStoreJson(body: unknown, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

// GET /api/projects?q=titel&limit=10&mine=true
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const rawLimit = Number.parseInt(searchParams.get("limit") ?? "20", 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 50) : 20;
  const mine = searchParams.get("mine") === "true";

  if (mine) {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) return authResult;
    const { userId } = authResult;

    const { data, error } = await db
      .from("projects")
      .select("id, title, year, type, director, poster_url")
      .eq("created_by", userId)
      .order("created_at", { ascending: false });
    if (error) return privateNoStoreJson({ error: error.message }, 500);
    return privateNoStoreJson({ projects: data ?? [] });
  }

  let query = db
    .from("projects")
    .select("id, title, year, type, director, poster_url, metadata, created_by")
    .order("year", { ascending: false })
    .limit(limit);

  if (q) {
    query = query.ilike("title", `%${q}%`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ projects: (data ?? []).map(project => publicProjectMedia(project)) }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

// POST /api/projects — create a private draft; publication is a separate action.
export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }
  const result = await saveProjectDraft(userId, { draftData: body });
  if (result.error) return privateNoStoreJson({ error: result.error }, result.status);
  return privateNoStoreJson({ draft: result.draft, status: "draft" }, 201);
}
