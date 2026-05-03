import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

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
      .select("id, title, year, type, director, poster_url, metadata")
      .eq("created_by", userId)
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ projects: data ?? [] });
  }

  let query = db
    .from("projects")
    .select("id, title, year, type, director, poster_url, metadata")
    .order("year", { ascending: false })
    .limit(limit);

  if (q) {
    query = query.ilike("title", `%${q}%`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ projects: data ?? [] });
}

// POST /api/projects — create new project
export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const body = await req.json();
  const { title, year, type, description, director, poster_url, images, myRole,
          genre, productionCompany, location, equipment, link, alsoOnCrewUnited,
          linked_companies, linked_locations, crew_entries } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: "Titel ist Pflichtfeld" }, { status: 400 });
  }

  const metadata = {
    genre: genre || null,
    production_company: productionCompany || null,
    location: location || null,
    equipment: equipment || null,
    link: link || null,
    also_on_crew_united: alsoOnCrewUnited ?? false,
    linked_companies: linked_companies ?? [],
    linked_locations: linked_locations ?? [],
    crew_entries: crew_entries ?? [],
  };

  // Try insert with metadata; if column doesn't exist yet, retry without
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let insertPayload: any = {
    title: title.trim(),
    year: year ? parseInt(year) : null,
    type: type || null,
    description: description?.trim() || null,
    director: director?.trim() || null,
    poster_url: poster_url || null,
    images: images ?? [],
    created_by: userId,
    metadata,
  };

  let { data: project, error: projError } = await db
    .from("projects")
    .insert(insertPayload)
    .select()
    .single();

  // Gracefully degrade if metadata column doesn't exist
  if (projError?.code === "PGRST204" || (projError?.message ?? "").includes("metadata")) {
    const { metadata: _m, ...withoutMeta } = insertPayload;
    void _m;
    ({ data: project, error: projError } = await db
      .from("projects")
      .insert(withoutMeta)
      .select()
      .single());
  }

  if (projError) return NextResponse.json({ error: projError.message }, { status: 500 });

  // Auto-add creator with their role
  let credit: { id: string; created_at: string } | null = null;
  if (myRole?.trim()) {
    const { data: creditData } = await db
      .from("project_credits")
      .insert({ project_id: project.id, user_id: userId, role: myRole.trim() })
      .select("id, created_at")
      .single();
    credit = creditData ?? null;
  }

  revalidateTag("projects", "max");
  return NextResponse.json({ project, credit });
}
