import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const { slug } = await params;

  const { data: profile } = await db
    .from("unclaimed_profiles")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (!profile) return NextResponse.json({ error: "Profil nicht gefunden" }, { status: 404 });
  if (profile.claimed_by) return NextResponse.json({ error: "Profil bereits übernommen" }, { status: 409 });

  // Find projects where the user already has a credit (to avoid duplicates)
  const { data: existingCredits } = await db
    .from("project_credits")
    .select("project_id")
    .eq("user_id", userId);

  const alreadyIn = new Set(
    (existingCredits ?? []).map((c: { project_id: string }) => c.project_id)
  );

  // Get all unclaimed credits for this profile
  const { data: unclaimedCredits } = await db
    .from("project_credits")
    .select("id, project_id")
    .eq("unclaimed_profile_id", profile.id);

  const toMigrate = (unclaimedCredits ?? [])
    .filter((c: { project_id: string }) => !alreadyIn.has(c.project_id))
    .map((c: { id: string }) => c.id);

  if (toMigrate.length > 0) {
    await db
      .from("project_credits")
      .update({ user_id: userId, unclaimed_profile_id: null })
      .in("id", toMigrate);
  }

  await db
    .from("unclaimed_profiles")
    .update({ claimed_by: userId, claimed_at: new Date().toISOString() })
    .eq("id", profile.id);

  const skipped = (unclaimedCredits ?? []).length - toMigrate.length;
  return NextResponse.json({ success: true, migrated: toMigrate.length, skipped });
}
