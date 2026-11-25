import { publicProjectCredits } from "@/lib/project-media-rights";
import { requireAuth } from "@/lib/auth";
import { visibleLinkedProfileIds } from "@/lib/linked-profile-access";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { getTranslations as getResponseTranslations } from "next-intl/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;
  const tResponse = await getResponseTranslations();
  const { slug } = await params;

  const { data: profile } = await db
    .from("unclaimed_profiles")
    .select("id,name,slug,primary_role,avatar_url,bio,claimed_by")
    .eq("slug", slug)
    .maybeSingle();

  const visible = !profile?.claimed_by || (await visibleLinkedProfileIds([profile.claimed_by], userId)).has(profile.claimed_by);
  if (!profile || !visible) return NextResponse.json({ error: tResponse('System.m_621ca4c037d3') }, { status: 404, headers: { "Cache-Control": "private, no-store", "CDN-Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store" } });

  const { data: credits } = await db
    .from("project_credits")
    .select("id, role, created_at, projects(id, title, year, type, director, poster_url, metadata, created_by)")
    .eq("unclaimed_profile_id", profile.id)
    .order("created_at", { ascending: false });

  const { claimed_by: claimedBy, ...publicProfile } = profile;
  void claimedBy;
  return NextResponse.json({ profile: publicProfile, credits: publicProjectCredits(credits ?? []) }, {
    headers: { "Cache-Control": "private, no-store", "CDN-Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store" },
  });
}
