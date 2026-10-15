import { db } from "@/lib/db";
import { utcDayStart } from "@/lib/utc-day";

function dailyTableMissing(error: { code?: string } | null) {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

/** Count one signed-in viewer once per profile and UTC calendar day. */
export async function recordProfileView(profileId: string, viewerId: string | null | undefined) {
  if (!viewerId || viewerId === profileId) return;

  const now = new Date();
  const dayStart = utcDayStart(now);
  const day = dayStart.slice(0, 10);

  // Keep legacy history intact and avoid counting an already-recorded view again
  // on the release day while the new unique daily table takes over.
  const [legacyResult, dailyResult] = await Promise.all([
    db.from("profile_views")
      .select("id")
      .eq("profile_id", profileId)
      .eq("viewer_id", viewerId)
      .gte("viewed_at", dayStart)
      .limit(1)
      .maybeSingle(),
    db.from("profile_view_daily")
      .select("profile_id")
      .eq("profile_id", profileId)
      .eq("viewer_id", viewerId)
      .eq("viewed_on", day)
      .limit(1)
      .maybeSingle(),
  ]);

  if (legacyResult.error) {
    console.error("[profile_views] Could not check daily view state");
    return;
  }
  if (legacyResult.data || dailyResult.data) return;

  if (dailyResult.error) {
    if (!dailyTableMissing(dailyResult.error)) {
      console.error("[profile_views] Could not check daily view state");
      return;
    }
    const { error } = await db.from("profile_views").insert({ profile_id: profileId, viewer_id: viewerId });
    if (error) console.error("[profile_views] Could not record legacy view");
    return;
  }

  const { error } = await db.from("profile_view_daily").insert({
    profile_id: profileId,
    viewer_id: viewerId,
    viewed_on: day,
  });
  if (error && error.code !== "23505") {
    console.error("[profile_views] Could not record daily view");
  }
}
