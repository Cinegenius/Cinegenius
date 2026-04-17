/**
 * Lightweight server-side rate limiter using Supabase as backing store.
 * Falls back gracefully if the table doesn't exist yet.
 *
 * Required SQL (run once in Supabase):
 * CREATE TABLE IF NOT EXISTS rate_limit_buckets (
 *   key        text PRIMARY KEY,
 *   count      integer NOT NULL DEFAULT 1,
 *   window_end timestamptz NOT NULL
 * );
 */

import { supabaseAdmin } from "./supabaseAdmin";

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

/**
 * @param key     Unique key, e.g. `msg:user_abc123` or `upload:ip_1.2.3.4`
 * @param limit   Max requests per window
 * @param windowS Window size in seconds
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowS: number
): Promise<RateLimitResult> {
  try {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + windowS * 1000);

    // Upsert: if window expired reset count, otherwise increment
    const { data, error } = await supabaseAdmin.rpc("upsert_rate_limit", {
      p_key: key,
      p_limit: limit,
      p_window_end: windowEnd.toISOString(),
    });

    if (error) {
      // Table or function doesn't exist yet — fail open (don't block users)
      console.warn("[rateLimit] skipped:", error.message);
      return { allowed: true, remaining: limit };
    }

    const count: number = data ?? 1;
    return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
  } catch {
    // Always fail open — better to allow than break the app
    return { allowed: true, remaining: limit };
  }
}
