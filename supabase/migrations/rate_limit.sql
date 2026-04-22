-- Rate limiting backing store
-- Used by lib/rateLimit.ts (server-side, per-user keyed buckets)

CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  key        text        PRIMARY KEY,
  count      integer     NOT NULL DEFAULT 1,
  window_end timestamptz NOT NULL
);

-- No RLS needed — only the service role (server) ever touches this table.
-- Do not expose via PostgREST to anon/authenticated roles.
REVOKE ALL ON rate_limit_buckets FROM anon, authenticated;

-- Upsert function: increments the counter within the active window,
-- or resets it when the window has expired.
-- Returns the updated count (callers compare against their limit).
CREATE OR REPLACE FUNCTION upsert_rate_limit(
  p_key        text,
  p_limit      integer,
  p_window_end timestamptz
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER   -- runs as the table owner, not the caller
AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO rate_limit_buckets (key, count, window_end)
  VALUES (p_key, 1, p_window_end)
  ON CONFLICT (key) DO UPDATE
    SET
      -- If the stored window has expired: reset to 1 and start a new window.
      -- Otherwise: increment within the current window.
      count      = CASE
                     WHEN rate_limit_buckets.window_end < now() THEN 1
                     ELSE rate_limit_buckets.count + 1
                   END,
      window_end = CASE
                     WHEN rate_limit_buckets.window_end < now() THEN p_window_end
                     ELSE rate_limit_buckets.window_end
                   END
  RETURNING count INTO v_count;

  RETURN v_count;
END;
$$;

-- Periodic cleanup: remove rows whose window expired more than 1 hour ago.
-- Call this from a cron job or Supabase scheduled function.
-- Example: SELECT cleanup_rate_limit_buckets();
CREATE OR REPLACE FUNCTION cleanup_rate_limit_buckets()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  DELETE FROM rate_limit_buckets WHERE window_end < now() - interval '1 hour';
$$;
