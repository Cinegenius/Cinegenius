-- Nullable, compatible snapshots; no guessed names or bulk publication.
BEGIN;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS responsible_person jsonb;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS responsible_person jsonb;

-- These snapshots can contain names deliberately kept internal. Preserve all
-- existing public columns, but never expose the new column to direct clients.
-- Table-level SELECT would override a simple column REVOKE.
DO $$
DECLARE tbl text; client_role text; columns_sql text; capability text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['companies','listings'] LOOP
    SELECT string_agg(quote_ident(column_name), ', ') INTO columns_sql
      FROM information_schema.columns WHERE table_schema='public' AND table_name=tbl AND column_name <> 'responsible_person';
    FOREACH client_role IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=client_role) THEN
        FOREACH capability IN ARRAY ARRAY['SELECT','INSERT','UPDATE'] LOOP
          IF has_table_privilege(client_role, format('public.%I',tbl), capability) THEN
            EXECUTE format('REVOKE %s ON public.%I FROM %I',capability,tbl,client_role);
            EXECUTE format('GRANT %s (%s) ON public.%I TO %I',capability,columns_sql,tbl,client_role);
          END IF;
        END LOOP;
        EXECUTE format('REVOKE SELECT (responsible_person), INSERT (responsible_person), UPDATE (responsible_person) ON public.%I FROM %I',tbl,client_role);
        IF has_column_privilege(client_role, format('public.%I',tbl), 'responsible_person', 'SELECT')
          OR has_column_privilege(client_role, format('public.%I',tbl), 'responsible_person', 'INSERT')
          OR has_column_privilege(client_role, format('public.%I',tbl), 'responsible_person', 'UPDATE') THEN
          RAISE EXCEPTION 'Unexpected inherited access to %.responsible_person for %. Migration rolled back.',tbl,client_role;
        END IF;
      END IF;
    END LOOP;
  END LOOP;
END $$;
NOTIFY pgrst, 'reload schema';
COMMIT;
