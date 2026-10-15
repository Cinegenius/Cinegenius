import { db } from "@/lib/db";
import { summarizeRatingRows } from "@/lib/rating-summary";

export type RatingSummary = {
  rating: number;
  reviews: number;
  ratingOnly: number;
};

/** Fetch one canonical rating summary for a group of profile or listing IDs. */
export async function fetchRatingSummaries(
  targetIds: string[],
  targetType: string,
): Promise<Record<string, RatingSummary>> {
  if (!targetIds.length) return {};
  const normalizedType = targetType === "location" ? "listing" : targetType;

  const reviewQuery = db
    .from("reviews")
    .select("id, target_id, reviewer_id, rating")
    .eq("target_type", normalizedType)
    .in("target_id", targetIds);
  const quickRatingQuery = normalizedType === "listing"
    ? db.from("listing_ratings").select("id, listing_id, liker_id, rating").in("listing_id", targetIds)
    : Promise.resolve({ data: [], error: null });

  const [reviewResult, quickRatingResult] = await Promise.all([reviewQuery, quickRatingQuery]);
  if (reviewResult.error) throw new Error(`Rating-Reviews konnten nicht geladen werden: ${reviewResult.error.message}`);
  if (quickRatingResult.error) throw new Error(`Sternebewertungen konnten nicht geladen werden: ${quickRatingResult.error.message}`);

  const reviewsByTarget = new Map<string, Array<{ id: string; reviewer_id: string | null; rating: number }>>();
  for (const row of reviewResult.data ?? []) {
    const rows = reviewsByTarget.get(row.target_id) ?? [];
    rows.push(row);
    reviewsByTarget.set(row.target_id, rows);
  }
  const quickByTarget = new Map<string, Array<{ id: string; liker_id: string | null; rating: number }>>();
  for (const row of quickRatingResult.data ?? []) {
    const rows = quickByTarget.get(row.listing_id) ?? [];
    rows.push(row);
    quickByTarget.set(row.listing_id, rows);
  }

  return Object.fromEntries(targetIds.map((id) => {
    const summary = summarizeRatingRows(reviewsByTarget.get(id) ?? [], quickByTarget.get(id) ?? []);
    return [id, { rating: summary.avg, reviews: summary.count, ratingOnly: summary.ratingOnlyCount }];
  }));
}

/** Compatibility wrapper for list cards that only need score and count. */
export async function fetchRatings(
  targetIds: string[],
  targetType: string,
): Promise<Record<string, { rating: number; reviews: number }>> {
  const summaries = await fetchRatingSummaries(targetIds, targetType);
  return Object.fromEntries(Object.entries(summaries).map(([id, summary]) => [id, {
    rating: summary.rating,
    reviews: summary.reviews,
  }]));
}
