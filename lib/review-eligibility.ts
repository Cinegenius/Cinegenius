import "server-only";
import { db } from "@/lib/db";

/** Existing review qualification, shared with photo ratings to keep the same proof standard. */
export async function resolveReviewEligibility(
  reviewerId: string,
  targetType: string,
  targetId: string,
  ownerId: string,
): Promise<"booking" | "application" | null> {
  if (targetType === "listing") {
    const { data } = await db
      .from("bookings")
      .select("id")
      .eq("user_id", reviewerId)
      .eq("listing_id", targetId)
      .eq("status", "confirmed")
      .limit(1)
      .maybeSingle();
    return data ? "booking" : null;
  }

  const [appA, appB, { data: ownerListings }] = await Promise.all([
    db.from("applications").select("id")
      .eq("owner_id", ownerId)
      .eq("applicant_id", reviewerId)
      .eq("status", "accepted")
      .limit(1).maybeSingle(),
    db.from("applications").select("id")
      .eq("owner_id", reviewerId)
      .eq("applicant_id", ownerId)
      .eq("status", "accepted")
      .limit(1).maybeSingle(),
    db.from("listings").select("id").eq("user_id", ownerId),
  ]);

  if (appA.data || appB.data) return "application";
  const ownerListingIds = (ownerListings ?? []).map((listing: { id: string }) => listing.id);
  if (ownerListingIds.length === 0) return null;

  const { data: booking } = await db
    .from("bookings")
    .select("id")
    .eq("user_id", reviewerId)
    .eq("status", "confirmed")
    .in("listing_id", ownerListingIds)
    .limit(1)
    .maybeSingle();
  return booking ? "booking" : null;
}
