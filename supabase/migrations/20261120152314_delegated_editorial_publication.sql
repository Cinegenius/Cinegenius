-- Delegated editorial publication: no site-admin or organization-profile rights.
create table public.organization_editorial_grants (
 organization_id uuid primary key references public.organizations(id) on delete cascade,
 enabled boolean not null default false,
 granted_by text not null,
 reason text not null check (char_length(reason) between 5 and 500),
 updated_at timestamptz not null default clock_timestamp()
);
create table public.organization_editorial_events (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 entry_id uuid references public.organization_entries(id),
 actor_user_id text not null,
 action text not null check (action in ('grant','revoke','publish','hide')),
 revision_at timestamptz not null,
 source_url text,
 checked_at timestamptz,
 reason text not null,
 created_at timestamptz not null default clock_timestamp()
);
alter table public.organization_editorial_grants enable row level security;
alter table public.organization_editorial_events enable row level security;
create index organization_editorial_events_org on public.organization_editorial_events(organization_id,created_at desc);
create index organization_editorial_events_entry on public.organization_editorial_events(entry_id,created_at desc);
revoke all on public.organization_editorial_grants,public.organization_editorial_events from public,anon,authenticated;
grant select,insert,update on public.organization_editorial_grants to service_role;
grant select,insert on public.organization_editorial_events to service_role;

-- Server-only; grant changes require requireAdmin(). No member/admin role is added.
create function public.set_organization_editorial_grant(p_actor text,p_organization uuid,p_enabled boolean,p_expected timestamptz,p_reason text)
returns public.organization_editorial_grants language plpgsql security invoker set search_path=public,pg_temp as $$
declare parent public.organizations; current_grant public.organization_editorial_grants; result public.organization_editorial_grants;
begin
 if p_actor is null or btrim(p_actor)='' or p_enabled is null or char_length(btrim(p_reason)) not between 5 and 500 then raise sqlstate 'PT400' using message='required'; end if;
 -- Serialize first grant and revocation with organization withdrawal.
 select * into parent from organizations where id=p_organization for update;
 if not found then raise sqlstate 'PT404' using message='not_found'; end if;
 select * into current_grant from organization_editorial_grants where organization_id=p_organization for update;
 if (current_grant.organization_id is null and p_expected is not null) or
    (current_grant.organization_id is not null and current_grant.updated_at is distinct from p_expected) then
  raise sqlstate 'PT409' using message='conflict';
 end if;
 if p_enabled and parent.moderation_status<>'approved' then raise sqlstate 'PT409' using message='parent_required'; end if;
 insert into organization_editorial_grants(organization_id,enabled,granted_by,reason,updated_at)
 values(parent.id,p_enabled,p_actor,btrim(p_reason),greatest(clock_timestamp(),coalesce(current_grant.updated_at+interval '1 microsecond','-infinity'::timestamptz)))
 on conflict(organization_id) do update set enabled=excluded.enabled,granted_by=excluded.granted_by,reason=excluded.reason,updated_at=excluded.updated_at returning * into result;
 insert into organization_editorial_events(organization_id,actor_user_id,action,revision_at,reason)
 values(parent.id,p_actor,case when p_enabled then 'grant' else 'revoke' end,result.updated_at,btrim(p_reason));
 return result;
end $$;

-- Invoked only after a dedicated machine credential is authenticated. Locks protect against a
-- concurrent revoke, parent withdrawal, edit or admin restriction.
create function public.moderate_own_editorial_entry(p_actor text,p_entry uuid,p_expected timestamptz,p_action text,p_source text,p_checked timestamptz,p_verified boolean,p_reason text)
returns public.organization_entries language plpgsql security invoker set search_path=public,pg_temp as $$
declare parent public.organizations; item public.organization_entries; authority public.organization_editorial_grants; result public.organization_entries; org_id uuid;
begin
 if p_actor is null or btrim(p_actor)='' or p_action is null or p_action not in ('publish','hide') or p_expected is null or p_verified is distinct from true or
    p_checked is null or p_checked<clock_timestamp()-interval '10 minutes' or p_checked>clock_timestamp()+interval '30 seconds' or
    p_source is null or p_source !~ '^https://' or p_source ~ '#' or p_source ~* '[?&](token|secret|password|session|unsubscribe|activation|email|authorization|api_key)=' or char_length(p_source)>2048 or
    p_reason is null or char_length(btrim(p_reason)) not between 5 and 500 then raise sqlstate 'PT400' using message='review_required'; end if;
 select organization_id into org_id from organization_entries where id=p_entry;
 if not found then raise sqlstate 'PT404' using message='not_found'; end if;
 select * into parent from organizations where id=org_id for share;
 select * into authority from organization_editorial_grants where organization_id=org_id for share;
 if authority.enabled is distinct from true or p_actor is distinct from 'cinegenius-editorial' then
  raise sqlstate 'PT403' using message='forbidden';
 end if;
 select * into item from organization_entries where id=p_entry for update;
 if item.organization_id is distinct from org_id or item.author_user_id is distinct from p_actor or item.last_actor_user_id is distinct from p_actor then raise sqlstate 'PT403' using message='forbidden'; end if;
 if item.updated_at is distinct from p_expected then raise sqlstate 'PT409' using message='conflict'; end if;
 if item.external_url is distinct from p_source then raise sqlstate 'PT409' using message='source_changed'; end if;
 if p_action='publish' then
  if parent.moderation_status<>'approved' then raise sqlstate 'PT409' using message='parent_required'; end if;
  if item.moderation_status<>'submitted' or coalesce(item.moderation_reason,'')<>'' or item.reviewed_by is not null then raise sqlstate 'PT409' using message='review_required'; end if;
  if item.ends_at is not null and item.ends_at<=clock_timestamp() then raise sqlstate 'PT409' using message='expired'; end if;
 else
  if item.moderation_status not in ('approved','ended') then raise sqlstate 'PT409' using message='review_required'; end if;
 end if;
 update organization_entries set moderation_status=case when p_action='publish' then 'approved' else 'hidden' end,
  moderation_reason=case when p_action='publish' then '' else btrim(p_reason) end,
  reviewed_by=null,reviewed_at=null,last_actor_user_id=p_actor,
  published_at=case when p_action='publish' then clock_timestamp() else published_at end,
  publication_authority=case when p_action='publish' then 'editorial' else publication_authority end
 where id=p_entry returning * into result;
 insert into organization_editorial_events(organization_id,entry_id,actor_user_id,action,revision_at,source_url,checked_at,reason)
 values(org_id,p_entry,p_actor,p_action,result.updated_at,p_source,p_checked,btrim(p_reason));
 return result;
end $$;
revoke all on function public.set_organization_editorial_grant(text,uuid,boolean,timestamptz,text) from public,anon,authenticated;
revoke all on function public.moderate_own_editorial_entry(text,uuid,timestamptz,text,text,timestamptz,boolean,text) from public,anon,authenticated;
grant execute on function public.set_organization_editorial_grant(text,uuid,boolean,timestamptz,text) to service_role;
grant execute on function public.moderate_own_editorial_entry(text,uuid,timestamptz,text,text,timestamptz,boolean,text) to service_role;

alter table public.organization_entries add column publication_authority text check (publication_authority in ('admin','editorial'));
-- Do not falsely record automated editorial publication as a human admin review.
do $patch$
declare definition text; original text := $old$'Reviewed and explicitly approved by administrator.'$old$;
 replacement text := $new$case when tg_table_name='organization_entries' and to_jsonb(new)->>'publication_authority'='editorial' then 'Published under delegated editorial authority.' else 'Reviewed and explicitly approved by administrator.' end$new$;
begin
 definition:=pg_get_functiondef('public.organization_revision_history()'::regprocedure);
 if position('Published under delegated editorial authority.' in definition)=0 then
  if position(original in definition)=0 then raise exception 'Unknown organization history definition; review required'; end if;
  -- Preserve the installed canonical-place guard, function security and ACLs.
  execute replace(definition,original,replacement);
 end if;
end $patch$;

-- All machine writes are attributed to the editorial service, never a member.
-- Draft creation and updates use the same organization-scoped revocation lock.
create function public.save_editorial_entry(p_id uuid,p_organization uuid,p_expected timestamptz,p_submit boolean,p_document jsonb)
returns public.organization_entries language plpgsql security invoker set search_path=public,pg_temp as $$
declare item public.organization_entries; result public.organization_entries; parent public.organizations; authority public.organization_editorial_grants;
begin
 if p_id is null or p_organization is null or p_submit is null or jsonb_typeof(p_document)<>'object' then raise sqlstate 'PT400' using message='required'; end if;
 select * into parent from organizations where id=p_organization for share;
 select * into authority from organization_editorial_grants where organization_id=p_organization for share;
 if authority.enabled is distinct from true or parent.moderation_status is distinct from 'approved' then raise sqlstate 'PT403' using message='forbidden'; end if;
 perform pg_advisory_xact_lock(hashtextextended('cinegenius-editorial-save',0));
 select * into item from organization_entries where id=p_id for update;
 if exists(select 1 from organization_entries where id<>p_id and (external_url=p_document->>'external_url' or lower(title)=lower(p_document->>'title'))) then raise sqlstate 'PT409' using message='duplicate'; end if;
 if not found then
  if p_expected is not null or p_submit then raise sqlstate 'PT409' using message='save_private_first'; end if;
  insert into organization_entries(id,organization_id,author_user_id,last_actor_user_id,slug,entry_type,title,summary,description,topic,format,city,venue,starts_at,ends_at,registration_url,external_url,image_url,moderation_status)
  values(p_id,p_organization,'cinegenius-editorial','cinegenius-editorial',p_id::text,p_document->>'entry_type',p_document->>'title',p_document->>'summary',p_document->>'description',p_document->>'topic',p_document->>'format',p_document->>'city',p_document->>'venue',(p_document->>'starts_at')::timestamptz,(p_document->>'ends_at')::timestamptz,p_document->>'registration_url',p_document->>'external_url',p_document->>'image_url','draft') returning * into result;
 else
  if item.organization_id<>p_organization or item.author_user_id<>'cinegenius-editorial' or item.last_actor_user_id<>'cinegenius-editorial' then raise sqlstate 'PT403' using message='forbidden'; end if;
  if item.updated_at is distinct from p_expected then raise sqlstate 'PT409' using message='conflict'; end if;
  -- Public records and any human restrictions are never overwritten by import.
  if item.moderation_status not in ('draft','submitted') or item.reviewed_by is not null or item.moderation_reason<>'' then raise sqlstate 'PT409' using message='review_required'; end if;
  update organization_entries set entry_type=p_document->>'entry_type',title=p_document->>'title',summary=p_document->>'summary',description=p_document->>'description',topic=p_document->>'topic',format=p_document->>'format',city=p_document->>'city',venue=p_document->>'venue',starts_at=(p_document->>'starts_at')::timestamptz,ends_at=(p_document->>'ends_at')::timestamptz,registration_url=p_document->>'registration_url',external_url=p_document->>'external_url',image_url=p_document->>'image_url',moderation_status=case when p_submit then 'submitted' else 'draft' end,submitted_at=case when p_submit then clock_timestamp() else submitted_at end,last_actor_user_id='cinegenius-editorial' where id=p_id returning * into result;
 end if;
 -- Canonical place fields are applied from the server's cityWriteFields output.
 -- Optional place columns are checked against the installed schema.
 -- Only this explicit field allowlist can reach the dynamic column update.
 declare place_column text; assignments text := ''; begin
  foreach place_column in array array['place_country_code','place_region_id','place_city_id','place_city_name','place_region_name','place_status'] loop
   if p_document ? place_column and exists(select 1 from information_schema.columns c where c.table_schema='public' and c.table_name='organization_entries' and c.column_name=place_column) then
    assignments:=assignments || case when assignments='' then '' else ',' end || format('%1$I=(jsonb_populate_record(null::public.organization_entries,$1)).%1$I',place_column);
   end if;
  end loop;
  if assignments<>'' then execute 'update public.organization_entries set ' || assignments || ' where id=$2 returning *' using p_document,p_id into result; end if;
 end;
 return result;
end $$;
revoke all on function public.save_editorial_entry(uuid,uuid,timestamptz,boolean,jsonb) from public,anon,authenticated;
grant execute on function public.save_editorial_entry(uuid,uuid,timestamptz,boolean,jsonb) to service_role;
