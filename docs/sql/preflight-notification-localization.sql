-- Read-only preparation: schema, grants and aggregate counts only.
SELECT p.proname, md5(p.prosrc) AS body_md5, p.oid,
       p.prosecdef, p.proconfig, p.proacl,
       has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
       has_function_privilege('service_role',p.oid,'EXECUTE') AS service_execute
FROM pg_proc p
WHERE p.oid IN (
 to_regprocedure('public.invite_company_member(text,uuid,text,text[])'),
 to_regprocedure('public.respond_company_invitation(text,uuid,text)'),
 to_regprocedure('public.offer_review_transition(text,uuid,jsonb,jsonb,jsonb,text,text,text,jsonb)')
) ORDER BY p.proname;

SELECT column_name,data_type,is_nullable,column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name='notifications' AND column_name='localization';

SELECT c.relrowsecurity,c.relforcerowsecurity,c.relacl,
 (SELECT count(*) FROM pg_policy p WHERE p.polrelid=c.oid) AS policies
FROM pg_class c WHERE c.oid='public.notifications'::regclass;

SELECT 'notifications' AS kind,count(*) AS total FROM public.notifications
UNION ALL SELECT 'profiles',count(*) FROM public.profiles
UNION ALL SELECT 'companies',count(*) FROM public.companies
UNION ALL SELECT 'listings',count(*) FROM public.listings;
