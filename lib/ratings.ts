import { supabaseAdmin } from "@/lib/supabaseAdmin";

/** Fetch avg rating + review count for a list of target IDs in one query */
export async function fetchRatings(
  targetIds: string[],
  targetType: string
): Promise<Record<string, { rating: number; reviews: number }>> {
  if (targetIds.length === 0) return {};

  const { data } = await supabaseAdmin
    .from("reviews")
    .select("target_id, rating")
    .eq("target_type", targetType)
    .in("target_id", targetIds);

  const map: Record<string, { sum: number; count: number }> = {};
  for (const row of data ?? []) {
    if (!map[row.target_id]) map[row.target_id] = { sum: 0, count: 0 };
    map[row.target_id].sum += row.rating;
    map[row.target_id].count += 1;
  }

  const result: Record<string, { rating: number; reviews: number }> = {};
  for (const [id, { sum, count }] of Object.entries(map)) {
    result[id] = {
      rating: Math.round((sum / count) * 10) / 10,
      reviews: count,
    };
  }
  return result;
}
