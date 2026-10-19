import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { anyBlockExists } from "@/lib/trust";
import { resolveReviewEligibility } from "@/lib/review-eligibility";
import { NextRequest, NextResponse } from "next/server";

// GET /api/reviews/eligible?target_id=xxx&target_type=user|listing
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ eligible: false, already_reviewed: false, can_edit: false });

  const { userId } = user;
  const targetId = req.nextUrl.searchParams.get("target_id");
  const requestedType = req.nextUrl.searchParams.get("target_type");
  const targetType = requestedType === "profile" ? "user" : requestedType;
  if (!targetId || !targetType || (targetType !== "user" && targetType !== "listing")) {
    return NextResponse.json({ eligible: false, already_reviewed: false, can_edit: false });
  }

  let ownerId = targetId;
  if (targetType === "listing") {
    const { data: listing } = await db.from("listings").select("user_id").eq("id", targetId).maybeSingle();
    if (!listing) return NextResponse.json({ eligible: false, already_reviewed: false, can_edit: false });
    ownerId = listing.user_id;
  }
  if (ownerId === userId || await anyBlockExists(userId, ownerId)) {
    return NextResponse.json({ eligible: false, already_reviewed: false, can_edit: false });
  }

  const [{ data: existing }, via] = await Promise.all([
    db.from("reviews").select("id").eq("target_id", targetId).eq("target_type", targetType).eq("reviewer_id", userId).maybeSingle(),
    resolveReviewEligibility(userId, targetType, targetId, ownerId),
  ]);
  const eligible = Boolean(via);
  const alreadyReviewed = Boolean(existing);
  return NextResponse.json({ eligible, already_reviewed: alreadyReviewed, can_edit: eligible && alreadyReviewed });
}
