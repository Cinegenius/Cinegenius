export type RankedRating<T> = T & {
  rating: number;
  count: number;
  rankingScore: number;
};

/** Shrinks small samples toward the platform prior so a lone 5-star rating cannot dominate. */
export function rankByRatingConfidence<T>(
  rows: readonly T[],
  getRating: (row: T) => number,
  getCount: (row: T) => number,
  getStableKey: (row: T) => string,
  priorMean = 4,
  priorWeight = 3,
): RankedRating<T>[] {
  return rows
    .map((row) => {
      const rating = getRating(row);
      const count = getCount(row);
      const rankingScore = (count * rating + priorWeight * priorMean) / (count + priorWeight);
      return { ...row, rating, count, rankingScore };
    })
    .sort((a, b) =>
      b.rankingScore - a.rankingScore ||
      b.count - a.count ||
      getStableKey(a).localeCompare(getStableKey(b), "de"),
    );
}
