import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import { NextRequest, NextResponse } from "next/server";

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// POST — find-or-create unclaimed profile by name
export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const { allowed } = await rateLimit(`unclaimed:${userId}`, 20, 60);
  if (!allowed) return NextResponse.json({ error: "Zu viele Anfragen" }, { status: 429 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });

  const name = (body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Name ist Pflichtfeld" }, { status: 400 });

  const baseSlug = toSlug(name);
  if (!baseSlug) return NextResponse.json({ error: "Ungültiger Name" }, { status: 400 });

  // Find existing unclaimed profile with same name (case-insensitive)
  const { data: existing } = await db
    .from("unclaimed_profiles")
    .select("*")
    .ilike("name", name)
    .is("claimed_by", null)
    .maybeSingle();

  if (existing) return NextResponse.json({ profile: existing, created: false });

  // Find unique slug
  let slug = baseSlug;
  let suffix = 2;
  for (;;) {
    const { data: taken } = await db
      .from("unclaimed_profiles")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!taken) break;
    slug = `${baseSlug}-${suffix++}`;
  }

  const { data: profile, error } = await db
    .from("unclaimed_profiles")
    .insert({
      name,
      slug,
      primary_role: (body.primary_role ?? "").trim() || null,
      created_by: userId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profile, created: true }, { status: 201 });
}

// GET — search unclaimed profiles by name query
export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ profiles: [] });

  const { data, error } = await db
    .from("unclaimed_profiles")
    .select("id, name, slug, primary_role, avatar_url, claimed_by")
    .ilike("name", `%${q}%`)
    .is("claimed_by", null)
    .limit(10);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profiles: data ?? [] });
}
