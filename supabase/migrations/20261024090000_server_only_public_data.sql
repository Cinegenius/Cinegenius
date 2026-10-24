-- All application database reads and writes go through CineGenius server
-- routes using the service-role client. Browser roles must not bypass those
-- route projections through Supabase REST/GraphQL, including tables whose
-- older RLS policies used USING (true) (for example unclaimed_profiles).
-- Storage object policies are separate and are not changed here.
DO $$
DECLARE
  relation record;
BEGIN
  FOR relation IN
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', relation.schemaname, relation.tablename);
  END LOOP;
END $$;

-- Also cover views and sequences, including views created by later features.
-- Every application query uses the server-only service-role client.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Security-definer RPCs must not be callable directly through PostgREST.
-- The server uses the service role, so route-level authorization remains the
-- only path to these functions.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL PRIVILEGES ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL PRIVILEGES ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO service_role;

COMMENT ON TABLE public.profiles IS
  'Read and write through CineGenius server routes only; public profile responses are allowlisted and contact fields are consent-filtered.';
COMMENT ON TABLE public.companies IS
  'Read and write through CineGenius server routes only; public business contacts require explicit company consent.';
COMMENT ON TABLE public.listings IS
  'Read and write through CineGenius server routes only; public responses omit owner IDs and private listing metadata.';
