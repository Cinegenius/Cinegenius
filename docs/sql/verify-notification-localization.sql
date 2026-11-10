-- Read-only, aggregate/schema-only verification. No names, titles, bodies or row IDs.
SELECT column_name,data_type,is_nullable,column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name='notifications' AND column_name='localization';

SELECT p.proname,pg_get_function_identity_arguments(p.oid) AS arguments,
       md5(p.prosrc) AS body_md5,p.prosecdef,p.proconfig,p.proacl,
       has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
       has_function_privilege('service_role',p.oid,'EXECUTE') AS service_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public'
  AND p.oid IN (
    to_regprocedure('public.invite_company_member(text,uuid,text,text[])'),
    to_regprocedure('public.respond_company_invitation(text,uuid,text)'),
    to_regprocedure('public.offer_review_transition(text,uuid,jsonb,jsonb,jsonb,text,text,text,jsonb)')
  )
ORDER BY p.proname;

SELECT c.relrowsecurity,c.relforcerowsecurity,c.relacl,
       (SELECT count(*) FROM pg_policy p WHERE p.polrelid=c.oid) AS policies
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname='notifications';

-- Works before and after the additive column exists. Full rows stay inside the expression.
SELECT count(*) AS total_notifications,
       count(*) FILTER (WHERE NULLIF(to_jsonb(n)->'localization','null'::jsonb) IS NOT NULL) AS with_metadata_value,
       count(*) FILTER (WHERE (to_jsonb(n)->'localization')->>'version'='1') AS metadata_version_1
FROM public.notifications n;
