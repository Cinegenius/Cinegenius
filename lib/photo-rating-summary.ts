export type PhotoRatingRow = { reviewer_id?: string | null; rating?: number | null };

export function summarizePhotoRatings(rows: readonly PhotoRatingRow[]) {
  const byReviewer = new Map<string, number>();
  rows.forEach((row, index) => {
    const rating = Number(row.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return;
    byReviewer.set(row.reviewer_id || `anonymous:${index}`, rating);
  });
  const values = [...byReviewer.values()];
  return {
    avg: values.length ? Math.round((values.reduce((sum, rating) => sum + rating, 0) / values.length) * 10) / 10 : 0,
    count: values.length,
  };
}
