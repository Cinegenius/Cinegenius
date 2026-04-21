import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getCurrentUser } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

// GET /api/reviews/eligible?target_id=xxx&target_type=xxx
// Returns whether the current user can leave a review for this target
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ eligible: false });

  const { userId } = user;
  const { searchParams } = new URL(req.url);
  const target_id = searchParams.get("target_id");
  const target_type = searchParams.get("target_type");

  if (!target_id || !target_type) {
    return NextResponse.json({ eligible: false });
  }

  // Check if already reviewed
  const { data: existing } = await supabaseAdmin
    .from("reviews")
    .select("id")
    .eq("target_id", target_id)
    .eq("reviewer_id", userId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ eligible: false, already_reviewed: true });
  }

  let eligible = false;

  if (target_type === "location" || target_type === "prop" || target_type === "vehicle") {
    // Eligible if user has a confirmed booking for this listing
    const { data } = await supabaseAdmin
      .from("bookings")
      .select("id")
      .eq("user_id", userId)
      .eq("listing_id", target_id)
      .eq("status", "confirmed")
      .maybeSingle();
    eligible = !!data;
  } else if (target_type === "creator") {
    // Eligible if user owns a job where this creator had an accepted application
    const { data: ownedJobs } = await supabaseAdmin
      .from("listings")
      .select("id")
      .eq("user_id", userId)
      .eq("type", "job");

    const jobIds = (ownedJobs ?? []).map((j) => j.id);
    if (jobIds.length > 0) {
      const { data } = await supabaseAdmin
        .from("applications")
        .select("id")
        .eq("applicant_id", target_id)
        .in("job_id", jobIds)
        .eq("status", "accepted")
        .maybeSingle();
      eligible = !!data;
    }

    // Also eligible if creator was booked (for crew bookings)
    if (!eligible) {
      const { data } = await supabaseAdmin
        .from("bookings")
        .select("id")
        .eq("user_id", userId)
        .eq("listing_id", target_id)
        .eq("status", "confirmed")
        .maybeSingle();
      eligible = !!data;
    }
  } else if (target_type === "profile") {
    // target_id is the profile owner's user_id
    // Eligible if current user booked a listing owned by this person
    const { data: theirListings } = await supabaseAdmin
      .from("listings")
      .select("id")
      .eq("user_id", target_id);

    const listingIds = (theirListings ?? []).map((l) => l.id);
    if (listingIds.length > 0) {
      const { data } = await supabaseAdmin
        .from("bookings")
        .select("id")
        .eq("user_id", userId)
        .in("listing_id", listingIds)
        .eq("status", "confirmed")
        .maybeSingle();
      eligible = !!data;
    }

    // Also eligible if current user posted a job where this person had an accepted application
    if (!eligible) {
      const { data: ownedJobs } = await supabaseAdmin
        .from("listings")
        .select("id")
        .eq("user_id", userId)
        .eq("type", "job");
      const jobIds = (ownedJobs ?? []).map((j) => j.id);
      if (jobIds.length > 0) {
        const { data } = await supabaseAdmin
          .from("applications")
          .select("id")
          .eq("applicant_id", target_id)
          .in("job_id", jobIds)
          .eq("status", "accepted")
          .maybeSingle();
        eligible = !!data;
      }
    }
  }

  return NextResponse.json({ eligible, already_reviewed: false });
}
