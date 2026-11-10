-- Add the three supported display languages without changing any listing,
-- provider preference, frozen delivery, retry key or delivery status.
-- One atomic statement; the checked-in 20261110120000 migration stays intact.
do $freshness_locales$
declare
 target record;
 function_oid oid;
 function_row pg_catalog.pg_proc%rowtype;
 -- pg_proc belongs to pg_catalog; use JSON snapshots to retain all attributes.
 metadata_before jsonb := '{}'::jsonb;
 source_before text;
 source_after text;
 definition text;
 locale_constraint record;
 old_list constant text := '(''de'',''en'',''es'',''it'',''cs'',''hu'')';
 new_list constant text := '(''de'',''en'',''es'',''it'',''cs'',''hu'',''nl'',''nl-BE'',''sv'')';
 old_check constant text := '(provider_locale = ANY (ARRAY[''de''::text, ''en''::text, ''es''::text, ''it''::text, ''cs''::text, ''hu''::text]))';
 new_check constant text := '(provider_locale = ANY (ARRAY[''de''::text, ''en''::text, ''es''::text, ''it''::text, ''cs''::text, ''hu''::text, ''nl''::text, ''nl-BE''::text, ''sv''::text]))';
begin
 -- Validate every known body before applying any schema change. Unexpected
 -- production edits fail closed instead of being overwritten by a stale copy.
 for target in select * from (values
  ('public.listing_freshness_transition(uuid,text,text,bigint,bigint,uuid,text)', 'a66fff611b15bcd825c3883eedd52dda', '0ea5831a591a6b58ba16684c9d229e3d'),
  ('public.bind_listing_freshness_delivery(uuid,uuid,text,jsonb)', '13202900e316261323561ada7eff2546', '24563c1810f14b6e44f0b5868d5a651d')
 ) expected(signature,old_hash,new_hash) loop
  function_oid := to_regprocedure(target.signature);
  if function_oid is null then raise exception 'Missing listing freshness function: %', target.signature; end if;
  select * into function_row from pg_catalog.pg_proc where oid=function_oid;
  if function_row.prokind<>'f' or not function_row.prosecdef
    or function_row.prolang<>(select oid from pg_catalog.pg_language where lanname='plpgsql')
    or function_row.proconfig is distinct from array['search_path=public, pg_temp']::text[]
    or exists(select 1 from pg_catalog.pg_roles r where r.rolname in ('anon','authenticated')
      and has_function_privilege(r.oid,function_oid,'EXECUTE'))
    or exists(select 1 from aclexplode(coalesce(function_row.proacl,acldefault('f',function_row.proowner))) a
      where a.grantee=0 and a.privilege_type='EXECUTE')
    or md5(function_row.prosrc) not in (target.old_hash,target.new_hash) then
   raise exception 'Unexpected listing freshness function definition: %', target.signature;
  end if;
  metadata_before := metadata_before || jsonb_build_object(function_oid::text,to_jsonb(function_row)-'prosrc');
 end loop;

 lock table public.listing_freshness_state in access exclusive mode;
 select oid,contype,convalidated,connoinherit,pg_get_expr(conbin,conrelid) expression into locale_constraint
  from pg_catalog.pg_constraint where conrelid='public.listing_freshness_state'::regclass
   and conname='listing_freshness_state_provider_locale_check';
 if not found or locale_constraint.contype<>'c' or not locale_constraint.convalidated or locale_constraint.connoinherit
   or locale_constraint.expression not in (old_check,new_check) then
  raise exception 'Unexpected listing freshness provider locale constraint';
 end if;

 for target in select * from (values
  ('public.listing_freshness_transition(uuid,text,text,bigint,bigint,uuid,text)', 'a66fff611b15bcd825c3883eedd52dda', '0ea5831a591a6b58ba16684c9d229e3d'),
  ('public.bind_listing_freshness_delivery(uuid,uuid,text,jsonb)', '13202900e316261323561ada7eff2546', '24563c1810f14b6e44f0b5868d5a651d')
 ) expected(signature,old_hash,new_hash) loop
  function_oid := to_regprocedure(target.signature);
  select prosrc into source_before from pg_catalog.pg_proc where oid=function_oid;
  if md5(source_before)=target.old_hash then
   source_after := replace(source_before,old_list,new_list);
   if md5(source_after)<>target.new_hash then raise exception 'Unexpected listing freshness locale replacement'; end if;
   definition := pg_get_functiondef(function_oid);
   if strpos(definition,source_before)=0 then raise exception 'Missing listing freshness function body'; end if;
   execute replace(definition,source_before,source_after);
  end if;
  select * into function_row from pg_catalog.pg_proc where oid=function_oid;
  if md5(function_row.prosrc)<>target.new_hash
    or to_jsonb(function_row)-'prosrc' is distinct from metadata_before->function_oid::text then
   raise exception 'Listing freshness function metadata changed: %', target.signature;
  end if;
 end loop;

 if locale_constraint.expression=old_check then
  alter table public.listing_freshness_state drop constraint listing_freshness_state_provider_locale_check;
  alter table public.listing_freshness_state add constraint listing_freshness_state_provider_locale_check
   check (provider_locale in ('de','en','es','it','cs','hu','nl','nl-BE','sv'));
 end if;
end
$freshness_locales$;
