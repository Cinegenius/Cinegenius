/**
 * Server-side rate limiter backed by Supabase (rate_limit_buckets table).
 * Per-user or per-IP keyed sliding-window counters.
 *
 * IMPORTANT: fails CLOSED — if the backend is unavailable the request is
 * denied (429). This is intentional: a limiter that fails open provides
 * no protection at all.
 *
 * Schema required (see supabase/migrations/rate_limit.sql):
 *   rate_limit_buckets table + upsert_rate_limit() function
 */

import { db } from "./db";

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

/**
 * @param key     Unique bucket key — include entity type + ID to avoid
 *                collisions, e.g. `review:user_abc123` or `upload:user_xyz`.
 * @param limit   Max requests allowed within the window.
 * @param windowS Window duration in seconds.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowS: number
): Promise<RateLimitResult> {
  const windowEnd = new Date(Date.now() + windowS * 1000);

  const { data, error } = await db.rpc("upsert_rate_limit", {
    p_key:        key,
    p_limit:      limit,
    p_window_end: windowEnd.toISOString(),
  });

  if (error) {
    // Backend unavailable — deny the request rather than silently allow it.
    // Apply migration supabase/migrations/rate_limit.sql if this fires on startup.
    console.error("[rateLimit] backend error — denying request:", error.message);
    return { allowed: false, remaining: 0 };
  }

  const count = (data as number) ?? 1;
  return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
}
