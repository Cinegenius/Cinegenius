/**
 * Server-side rate limiter backed by Supabase (rate_limit_buckets table).
 * Per-user or per-IP keyed fixed-window counters.
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
  try {
    const windowEnd = new Date(Date.now() + windowS * 1000);
    const { data, error } = await db.rpc("upsert_rate_limit", {
      p_key:        key,
      p_limit:      limit,
      p_window_end: windowEnd.toISOString(),
    });

    // A missing or malformed counter must never become a fresh allowance.
    if (!error && typeof data === "number" && Number.isSafeInteger(data) && data > 0) {
      return { allowed: data <= limit, remaining: Math.max(0, limit - data) };
    }
  } catch {
    // Transport failures follow the same fail-closed path as RPC failures.
  }

  // Backend diagnostics can contain private values; never log their details.
  console.error("[rateLimit] backend unavailable or invalid — denying request");
  return { allowed: false, remaining: 0 };
}
