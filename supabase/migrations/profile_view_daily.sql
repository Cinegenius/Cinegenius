-- Preserve existing profile_views history and add a race-safe, daily unique event table.
CREATE TABLE IF NOT EXISTS public.profile_view_daily (
  profile_id text NOT NULL,
  viewer_id  text NOT NULL,
  viewed_on  date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profile_view_daily_unique UNIQUE (profile_id, viewer_id, viewed_on)
);

CREATE INDEX IF NOT EXISTS profile_view_daily_profile_date_idx
  ON public.profile_view_daily (profile_id, viewed_on);

ALTER TABLE public.profile_view_daily ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.profile_view_daily FROM anon, authenticated;
GRANT ALL ON TABLE public.profile_view_daily TO service_role;
