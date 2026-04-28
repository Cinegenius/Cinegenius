import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const { data: profile } = await db
    .from("unclaimed_profiles")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (!profile) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  const { data: credits } = await db
    .from("project_credits")
    .select("id, role, created_at, projects(id, title, year, type, director, poster_url)")
    .eq("unclaimed_profile_id", profile.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ profile, credits: credits ?? [] });
}
