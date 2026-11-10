-- Read-only after migration: both functions must report known_nine_locales.
-- Function OIDs, ACL/security/search_path and every aggregate must match preflight.
-- Read-only. If an object is missing/unknown, stop and inspect migration 20261110120000.
-- The final count SELECT requires that original migration to be installed.
select expected.signature, p.oid::text function_oid, md5(p.prosrc) body_md5,
 p.proacl::text acl, p.prosecdef security_definer, p.proconfig settings,
 case when p.oid is null then 'missing_20261110120000'
  when not p.prosecdef or p.proconfig is distinct from array['search_path=public, pg_temp']::text[] then 'unknown_security_or_search_path'
  when exists(select 1 from pg_catalog.pg_roles r where r.rolname in ('anon','authenticated') and has_function_privilege(r.oid,p.oid,'EXECUTE'))
    or exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE') then 'unexpected_public_execute'
  when md5(p.prosrc)=expected.old_hash then 'known_six_locales'
  when md5(p.prosrc)=expected.new_hash then 'known_nine_locales'
  else 'unknown_function_body' end readiness
from (values
 ('public.listing_freshness_transition(uuid,text,text,bigint,bigint,uuid,text)','a66fff611b15bcd825c3883eedd52dda','0ea5831a591a6b58ba16684c9d229e3d'),
 ('public.bind_listing_freshness_delivery(uuid,uuid,text,jsonb)','13202900e316261323561ada7eff2546','24563c1810f14b6e44f0b5868d5a651d')
) expected(signature,old_hash,new_hash)
left join pg_catalog.pg_proc p on p.oid=to_regprocedure(expected.signature)
order by expected.signature;

select to_regclass('public.listing_freshness_state')::text state_table,
 c.conname, c.convalidated, pg_get_constraintdef(c.oid) provider_locale_check
from (values(1)) marker(n)
left join pg_catalog.pg_constraint c on c.conrelid=to_regclass('public.listing_freshness_state')
 and c.conname='listing_freshness_state_provider_locale_check';

-- Aggregates only. Compare these exact values before/after; no payloads or identities.
select (select count(*) from public.listings) listings,
 (select count(*) from public.listing_freshness_settings) settings,
 (select count(*) from public.listing_freshness_settings where enabled) enabled_settings,
 (select count(*) from public.listing_freshness_state) state_rows,
 (select count(*) from public.listing_freshness_outbox) outbox_rows,
 (select count(*) from public.listing_freshness_outbox where status='sent') sent_rows,
 (select count(*) from public.listing_freshness_events) event_rows;
