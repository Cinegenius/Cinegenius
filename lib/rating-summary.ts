export type RatingReviewRow = {
  id?: string | null;
  reviewer_id?: string | null;
  rating?: number | null;
};

export type QuickRatingRow = {
  id?: string | null;
  liker_id?: string | null;
  rating?: number | null;
};

export function summarizeRatingRows(reviews: RatingReviewRow[], quickRatings: QuickRatingRow[] = []) {
  const ratingsByReviewer = new Map<string, { rating: number; kind: "review" | "quick" }>();
  const reviewKeys = new Set<string>();

  for (const [index, row] of reviews.entries()) {
    const rating = Number(row.rating);
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) continue;
    const key = row.reviewer_id ? `user:${row.reviewer_id}` : `review:${row.id ?? index}`;
    reviewKeys.add(key);
    ratingsByReviewer.set(key, { rating, kind: "review" });
  }

  let ratingOnlyCount = 0;
  for (const [index, row] of quickRatings.entries()) {
    const rating = Number(row.rating);
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) continue;
    const key = row.liker_id ? `user:${row.liker_id}` : `quick:${row.id ?? index}`;
    if (reviewKeys.has(key) || ratingsByReviewer.has(key)) continue;
    ratingsByReviewer.set(key, { rating, kind: "quick" });
    ratingOnlyCount++;
  }

  const entries = [...ratingsByReviewer.values()];
  const sum = entries.reduce((total, entry) => total + entry.rating, 0);
  return {
    avg: entries.length ? Math.round((sum / entries.length) * 10) / 10 : 0,
    count: entries.length,
    reviewCount: entries.filter((entry) => entry.kind === "review").length,
    ratingOnlyCount,
  };
}
