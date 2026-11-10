import { publicProjectCredits } from "@/lib/project-media-rights";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { getTranslations as getResponseTranslations } from "next-intl/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const tResponse = await getResponseTranslations();
  const { slug } = await params;

  const { data: profile } = await db
    .from("unclaimed_profiles")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (!profile) return NextResponse.json({ error: tResponse('System.m_621ca4c037d3') }, { status: 404 });

  const { data: credits } = await db
    .from("project_credits")
    .select("id, role, created_at, projects(id, title, year, type, director, poster_url, metadata, created_by)")
    .eq("unclaimed_profile_id", profile.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ profile, credits: publicProjectCredits(credits ?? []) });
}
