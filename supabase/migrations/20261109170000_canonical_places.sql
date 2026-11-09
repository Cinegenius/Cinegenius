-- Additive rollout. Legacy values stay byte-for-byte intact during backfill.
-- GeoNames IDs identify cities; admin1 IDs identify regions; ISO alpha-2 identifies countries.
begin;
create or replace function public.place_snapshot(p_row jsonb) returns jsonb
language sql immutable set search_path=public as $$
 select jsonb_build_object('place_country_code',p_row->'place_country_code','place_region_id',p_row->'place_region_id',
 'place_city_id',p_row->'place_city_id','place_city_name',p_row->'place_city_name',
 'place_region_name',p_row->'place_region_name','place_status',p_row->'place_status','place_original',p_row->'place_original');
$$;
create or replace function public.place_profile_legacy(p_row jsonb) returns jsonb
language sql immutable set search_path=public as $$
 select jsonb_build_object('location_city',p_row->'location_city','location_region',p_row->'location_region','location_country',p_row->'location_country');
$$;
create or replace function public.place_project_sources(p_row jsonb) returns jsonb
language sql immutable set search_path=public as $$
 select jsonb_build_object('country',p_row->'country','shoot_locations',p_row->'shoot_locations',
 'metadata_location',p_row#>'{metadata,location}','metadata_country',p_row#>'{metadata,project_details,country}',
 'metadata_shoot_locations',p_row#>'{metadata,project_details,shoot_locations}');
$$;
create or replace function public.place_organization_sources(p_row jsonb) returns jsonb
language sql immutable set search_path=public as $$
 select jsonb_build_object('region',p_row->'region');
$$;
create or replace function public.place_source_text(p_value jsonb) returns text
language sql immutable set search_path=public as $$
 select case when jsonb_typeof(p_value)='string' and btrim(p_value#>>'{}')<>'' then p_value#>>'{}' end;
$$;
create or replace function public.place_legacy_value(p_table text,p_row jsonb) returns text
language sql immutable set search_path=public as $$
 select coalesce(case p_table when 'profiles' then p_row->>'location' when 'projects' then coalesce(public.place_source_text(p_row#>'{metadata,location}'),public.place_source_text(p_row->'country'),public.place_source_text(p_row#>'{metadata,project_details,country}'))
 else p_row->>'city' end,'');
$$;
create table if not exists public.place_change_journal (
 id bigint generated always as identity primary key, run_id uuid, source_table text not null,
 row_id text not null, original_text text not null, previous_value jsonb not null, next_value jsonb not null,
 changed_at timestamptz not null default now()
);
create index if not exists place_change_journal_parent_idx on public.place_change_journal(source_table,row_id);
create index if not exists place_change_journal_run_idx on public.place_change_journal(run_id,id);
create index if not exists place_change_journal_age_idx on public.place_change_journal(changed_at);
alter table public.place_change_journal enable row level security;
revoke all on public.place_change_journal from public,anon,authenticated;
grant select,insert on public.place_change_journal to service_role;
grant usage,select on sequence public.place_change_journal_id_seq to service_role;
create or replace function public.place_record_key(p_table text,p_row jsonb) returns text language sql immutable as $$
 select case when p_table='profiles' then p_row->>'user_id' else p_row->>'id' end;
$$;
-- Correct the journal key independently of ownership fields.
create or replace function public.journal_place_change() returns trigger language plpgsql security definer set search_path=public as $$
declare before_value jsonb; after_value jsonb; raw text;
begin
 if tg_op='DELETE' then
  delete from public.place_change_journal where source_table=tg_table_name
   and row_id=public.place_record_key(tg_table_name,to_jsonb(old));
  return old;
 end if;
 raw:=public.place_legacy_value(tg_table_name,to_jsonb(new));
 before_value:=case when tg_op='INSERT' then '{}'::jsonb else public.place_snapshot(to_jsonb(old)) end;
 if tg_op='UPDATE' and (raw is distinct from public.place_legacy_value(tg_table_name,to_jsonb(old)) or (tg_table_name='profiles' and public.place_profile_legacy(to_jsonb(new)) is distinct from public.place_profile_legacy(to_jsonb(old))) or (tg_table_name='projects' and public.place_project_sources(to_jsonb(new)) is distinct from public.place_project_sources(to_jsonb(old))))
 and public.place_snapshot(to_jsonb(new)) is not distinct from before_value then
  new.place_country_code:=null;new.place_region_id:=null;new.place_city_id:=null;
  new.place_city_name:=null;new.place_region_name:=null;new.place_status:=case when raw='' then 'empty' else 'pending' end;
  new.place_original:=raw;
 end if;
 after_value:=public.place_snapshot(to_jsonb(new));
 -- Ordinary saves do not create a permanent history of private member locations.
 if nullif(current_setting('cinegenius.place_run',true),'') is not null and before_value is distinct from after_value then
 insert into public.place_change_journal(run_id,source_table,row_id,original_text,previous_value,next_value)
 values(nullif(current_setting('cinegenius.place_run',true),'')::uuid,tg_table_name,
 public.place_record_key(tg_table_name,to_jsonb(new)),raw,
 case when tg_table_name='profiles' then before_value||jsonb_build_object('profile_legacy',public.place_profile_legacy(to_jsonb(old))) when tg_table_name='projects' then before_value||jsonb_build_object('project_sources',public.place_project_sources(to_jsonb(old))) when tg_table_name='organizations' then before_value||jsonb_build_object('organization_sources',public.place_organization_sources(to_jsonb(old))) else before_value end,
 case when tg_table_name='profiles' then after_value||jsonb_build_object('profile_legacy',public.place_profile_legacy(to_jsonb(new))) when tg_table_name='projects' then after_value||jsonb_build_object('project_sources',public.place_project_sources(to_jsonb(new))) when tg_table_name='organizations' then after_value||jsonb_build_object('organization_sources',public.place_organization_sources(to_jsonb(new))) else after_value end);
 end if;
 return new;
end $$;
do $$ declare t text; begin
 foreach t in array array['profiles','companies','listings','projects','organizations','organization_entries','community_posts'] loop
 if to_regclass('public.'||t) is null then continue;end if;
 execute format('alter table public.%I add column if not exists place_country_code text,
 add column if not exists place_region_id text,add column if not exists place_city_id text,
 add column if not exists place_city_name text,add column if not exists place_region_name text,
 add column if not exists place_status text not null default ''pending'',add column if not exists place_original text',t);
 if not exists(select 1 from pg_constraint where conname=t||'_place_status_check' and conrelid=to_regclass('public.'||t)) then
 execute format('alter table public.%I add constraint %I check (place_status in (''empty'',''pending'',''verified'')
 and (place_status<>''verified'' or (place_country_code is not null and place_country_code ~ ''^[A-Z]{2}$'' and ((place_city_id is null and nullif(place_city_name,'''') is null) or (place_city_id is not null and place_city_id ~ ''^geonames:[0-9]+$'' and nullif(place_city_name,'''') is not null))))
 and (place_region_id is null or (place_country_code is not null and left(place_region_id,2)=place_country_code)))',t,t||'_place_status_check');end if;
 execute format('create index if not exists %I on public.%I(place_country_code,place_region_id,place_city_id)',t||'_canonical_place_idx',t);
 execute format('drop trigger if exists canonical_place_journal on public.%I',t);
 execute format('create trigger canonical_place_journal before insert or update or delete on public.%I for each row execute function public.journal_place_change()',t);
 end loop;
end $$;
-- Only a service-authorized RPC may establish this exact table/row context.
-- Compare the complete row outside the seven derived fields: neither a media,
-- content, actor, timestamp nor moderation edit may use this exception.
create or replace function public.place_is_mapping_only(p_table text,p_before jsonb,p_after jsonb)
returns boolean language sql stable set search_path=public,pg_temp as $$
 select p_before is not null and p_after is not null
 and nullif(current_setting('cinegenius.place_run',true),'') is not null
 and current_setting('cinegenius.place_table',true)=p_table
 and current_setting('cinegenius.place_row',true)=public.place_record_key(p_table,p_before)
 and public.place_record_key(p_table,p_before)=public.place_record_key(p_table,p_after)
 and has_function_privilege(coalesce(nullif(nullif(current_setting('role',true),'none'),''),session_user),'public.apply_place_mapping(text,text,text,jsonb,jsonb,uuid)','execute')
 and public.place_snapshot(p_before) is distinct from public.place_snapshot(p_after)
 and (p_before-array['place_country_code','place_region_id','place_city_id','place_city_name','place_region_name','place_status','place_original'])
  = (p_after-array['place_country_code','place_region_id','place_city_id','place_city_name','place_region_name','place_status','place_original']);
$$;
-- Preserve the installed functions, security attributes and ACLs. The accepted
-- bodies come from 20261027180000_protected_media, the three offer moderation
-- migrations, and 20261103170000_organizations_and_news. Unknown definitions
-- abort the entire rollout instead of silently bypassing a newer guard.
do $$
declare target record; function_oid regprocedure; current_body text; original_body text; patched_body text; definition text; marker text; addition text;
 offer_addition text:=$offer$
 -- canonical_place_mapping_context: derived mappings do not revoke publication.
 IF public.place_is_mapping_only(TG_TABLE_NAME,to_jsonb(OLD),to_jsonb(NEW)) THEN
  ignored:=ignored||ARRAY['place_country_code','place_region_id','place_city_id','place_city_name','place_region_name','place_status','place_original'];
 END IF;
 $offer$;
 side_addition text:=$side$ -- canonical_place_side_effect_guard: preserve revisions, history and media origin.
 IF TG_OP='UPDATE' AND public.place_is_mapping_only(TG_TABLE_NAME,to_jsonb(OLD),to_jsonb(NEW)) THEN
  RETURN NEW;
 END IF;
$side$;
begin
 for target in select * from (values
  ('guard_offer_moderation',array['77794773bd1a8bda7c5191419d26dfc8','78d83379a006a54aa8e372f513c938ce','685655b68ad329a07c3931bdb5e7f4a4'],true),
  ('bind_media_source',array['82f80be43a6b2b402a8d877d815562a0','a519bd1c589f8c93ef1bb49940cc5b76'],false),
  ('organization_revision_guard',array['2a305ff75859719531d29bf17f03f1f2'],false),
  ('organization_revision_history',array['842a5b028e7afcea705a28c442eb07d3'],false)
 ) as checked(name,hashes,is_offer) loop
  function_oid:=to_regprocedure(format('public.%I()',target.name));
  if function_oid is null then continue;end if;
  select prosrc into current_body from pg_proc where oid=function_oid;
  addition:=case when target.is_offer then offer_addition else side_addition end;
  original_body:=replace(current_body,addition,'');
  if md5(original_body)<>all(target.hashes) then raise exception 'Unknown trigger definition for %; canonical mapping rollout requires review',target.name;end if;
  marker:=case when target.is_offer then 'changed:=(to_jsonb(NEW)-ignored)' else E'\nbegin\n' end;
  if position(marker in original_body)=0 then raise exception 'Unknown trigger marker for %',target.name;end if;
  patched_body:=case when target.is_offer then replace(original_body,marker,addition||marker) else replace(original_body,marker,marker||addition) end;
  if current_body is distinct from original_body and current_body is distinct from patched_body then raise exception 'Unexpected trigger patch for %',target.name;end if;
  if current_body=original_body then
   definition:=pg_get_functiondef(function_oid);
   execute replace(definition,original_body,patched_body);
  end if;
 end loop;
end $$;
create or replace function public.apply_place_mapping(p_table text,p_id text,p_expected_raw text,p_expected jsonb,p_fields jsonb,p_run uuid)
returns text language plpgsql security definer set search_path=public as $$
declare r jsonb; key text; previous_run text:=current_setting('cinegenius.place_run',true);previous_table text:=current_setting('cinegenius.place_table',true);previous_row text:=current_setting('cinegenius.place_row',true);
begin
 if p_run is null then raise exception 'An explicit place mapping run is required';end if;
 if p_table<>all(array['profiles','companies','listings','projects','organizations','organization_entries','community_posts']) then raise exception 'Invalid table';end if;
 key:=case when p_table='profiles' then 'user_id' else 'id' end;
 execute format('select to_jsonb(t) from public.%I t where %I::text=$1 for update',p_table,key) into r using p_id;
 if r is null then return 'missing';end if;
 if public.place_legacy_value(p_table,r) is distinct from p_expected_raw or public.place_snapshot(r) is distinct from (p_expected-array['profile_legacy','project_sources','organization_sources']) then return 'conflict';end if;
 -- A pending canonical snapshot can stay byte-for-byte equal after an edit to
 -- parallel legacy fields. Never replace this expected source with a fresh read.
 if p_table='profiles' and (not (p_expected ? 'profile_legacy') or public.place_profile_legacy(r) is distinct from p_expected->'profile_legacy') then return 'conflict';end if;
 if p_table='projects' and (not (p_expected ? 'project_sources') or public.place_project_sources(r) is distinct from p_expected->'project_sources') then return 'conflict';end if;
 if p_table='organizations' and (not (p_expected ? 'organization_sources') or public.place_organization_sources(r) is distinct from p_expected->'organization_sources') then return 'conflict';end if;
 if public.place_snapshot(r)=public.place_snapshot(p_fields) then return 'unchanged';end if;
 perform set_config('cinegenius.place_run',p_run::text,true);
 perform set_config('cinegenius.place_table',p_table,true);
 perform set_config('cinegenius.place_row',p_id,true);
 execute format('update public.%I set place_country_code=$1->>''place_country_code'',place_region_id=$1->>''place_region_id'',
 place_city_id=$1->>''place_city_id'',place_city_name=$1->>''place_city_name'',place_region_name=$1->>''place_region_name'',
 place_status=coalesce($1->>''place_status'',''pending''),place_original=$1->>''place_original'' where %I::text=$2',p_table,key) using p_fields,p_id;
 perform set_config('cinegenius.place_run',coalesce(previous_run,''),true);
 perform set_config('cinegenius.place_table',coalesce(previous_table,''),true);
 perform set_config('cinegenius.place_row',coalesce(previous_row,''),true);
 return 'applied';
end $$;
create or replace function public.rollback_place_run(p_run uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare entry record;result text;restored integer:=0;conflicts integer:=0;rollback_run uuid:=gen_random_uuid();
begin
 for entry in select * from public.place_change_journal where run_id=p_run order by id desc loop
 result:=public.apply_place_mapping(entry.source_table,entry.row_id,entry.original_text,entry.next_value,entry.previous_value,rollback_run);
 if result='applied' then restored:=restored+1;else conflicts:=conflicts+1;end if;
 end loop;
 return jsonb_build_object('restored',restored,'conflicts',conflicts,'run',rollback_run);
end $$;
-- Operational rollback window, not a statutory retention period. Operators run
-- this after completed mappings and daily maintenance; parent deletion erases
-- its journal immediately, independently of this window.
create or replace function public.purge_place_change_journal() returns integer
language plpgsql security definer set search_path=public as $$
declare removed integer;
begin
 delete from public.place_change_journal where changed_at < statement_timestamp()-interval '30 days';
 get diagnostics removed=row_count;
 return removed;
end $$;
revoke all on function public.apply_place_mapping(text,text,text,jsonb,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.rollback_place_run(uuid) from public,anon,authenticated;
grant execute on function public.apply_place_mapping(text,text,text,jsonb,jsonb,uuid) to service_role;
grant execute on function public.rollback_place_run(uuid) to service_role;
revoke all on function public.place_is_mapping_only(text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.place_is_mapping_only(text,jsonb,jsonb) to service_role;
revoke all on function public.purge_place_change_journal() from public,anon,authenticated;
grant execute on function public.purge_place_change_journal() to service_role;
revoke all on function public.journal_place_change() from public,anon,authenticated;
create or replace function public.public_place_options(p_scope text) returns jsonb language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(x.value),'[]'::jsonb) from (
 select distinct jsonb_build_object('place_country_code',place_country_code,'place_region_id',place_region_id,
 'place_city_id',case when place_status='verified' then place_city_id end,'place_city_name',case when place_status='verified' then place_city_name end,
 'place_region_name',place_region_name,'place_status',place_status) as value from public.listings
 where published=true and place_country_code is not null and
 ((p_scope='marketplace' and type in ('prop','vehicle')) or (p_scope='locations' and type='location'))
 ) x;
$$;
revoke all on function public.public_place_options(text) from public,anon,authenticated;
grant execute on function public.public_place_options(text) to service_role;
commit;
