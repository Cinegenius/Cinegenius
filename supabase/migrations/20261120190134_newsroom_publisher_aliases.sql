-- No content is moved/published here. The separately reviewed operator cutover
-- checks ownership, exact revisions and canonical media origins first.
create table public.organization_route_aliases (
 slug text primary key check (slug ~ '^[a-z0-9][a-z0-9-]*$'),
 organization_id uuid not null references public.organizations(id),
 original_organization_id uuid not null references public.organizations(id),
 created_at timestamptz not null default now()
);
create table public.organization_entry_route_aliases (
 organization_slug text not null check (organization_slug ~ '^[a-z0-9][a-z0-9-]*$'),
 entry_slug text not null check (entry_slug ~ '^[a-z0-9][a-z0-9-]*$'),
 entry_id uuid not null references public.organization_entries(id),
 original_organization_id uuid not null references public.organizations(id),
 created_at timestamptz not null default now(),
 primary key (organization_slug,entry_slug)
);
create index organization_route_alias_target on public.organization_route_aliases(organization_id);
create index organization_route_alias_origin on public.organization_route_aliases(original_organization_id);
create index organization_entry_route_alias_target on public.organization_entry_route_aliases(entry_id);
create index organization_entry_route_alias_origin on public.organization_entry_route_aliases(original_organization_id);
create table public.newsroom_consolidation_events (
 id uuid primary key default gen_random_uuid(), actor text not null, reason text not null,
 target_organization_id uuid not null references public.organizations(id),
 before_state jsonb not null, after_entry_ids uuid[] not null,
 created_at timestamptz not null default now()
);
alter table public.organization_route_aliases enable row level security;
alter table public.organization_entry_route_aliases enable row level security;
alter table public.newsroom_consolidation_events enable row level security;
create index newsroom_consolidation_target on public.newsroom_consolidation_events(target_organization_id);
revoke all on public.organization_route_aliases,public.organization_entry_route_aliases,public.newsroom_consolidation_events from public,anon,authenticated;
grant select on public.organization_route_aliases,public.organization_entry_route_aliases to service_role;
comment on table public.organization_route_aliases is 'Historical routes only; readers recheck current target approval.';
comment on table public.organization_entry_route_aliases is 'Historical routes only; no authorization, publication or media rights are granted.';

-- Never describe this data-preserving operation as a new human approval.
do $patch$
declare definition text; original text := $old$'Reviewed and explicitly approved by administrator.'$old$;
begin
 definition:=pg_get_functiondef('public.organization_revision_history()'::regprocedure);
 if position(original in definition)=0 then raise exception 'Review installed history function before consolidation'; end if;
 execute replace(definition,original,$new$case when new.last_actor_user_id='cinegenius-newsroom-consolidation' then 'Publisher consolidated; existing approval preserved.' else 'Reviewed and explicitly approved by administrator.' end$new$);
end $patch$;

-- Operator-only one-time cutover; not exposed by an HTTP route or editorial role.
create function public.consolidate_own_newsrooms(p_target uuid,p_snapshot jsonb)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare org_ids uuid[]; entry_ids uuid[]; owner_id text; actual_snapshot jsonb; item jsonb;
begin
 if jsonb_typeof(p_snapshot->'organizations') is distinct from 'array' or jsonb_typeof(p_snapshot->'entries') is distinct from 'array' then raise exception 'Snapshot required'; end if;
 select array_agg((x->>'id')::uuid) into org_ids from jsonb_array_elements(p_snapshot->'organizations') x;
 select array_agg((x->>'id')::uuid) into entry_ids from jsonb_array_elements(p_snapshot->'entries') x;
 if cardinality(org_ids)<>8 or not p_target=any(org_ids) or cardinality(entry_ids)<>17 then raise exception 'Unexpected reviewed scope'; end if;
 perform 1 from organizations where id=any(org_ids) order by id for update;
 perform 1 from organization_entries where organization_id=any(org_ids) order by id for update;
 select owner_user_id into owner_id from organizations where id=p_target and slug='cinegenius-film-newsroom' and moderation_status='approved';
 if owner_id is null or (select count(*) from organizations where id=any(org_ids) and owner_user_id=owner_id and moderation_status='approved')<>8 then raise exception 'Ownership or approval changed'; end if;
 if exists(select 1 from organizations where id=any(org_ids) and slug not in ('cinegenius-film-newsroom','cinegenius-czechia-newsroom','cinegenius-spain-newsroom','cinegenius-hungary-newsroom','cinegenius-italy-newsroom','cinegenius-mexico-newsroom','cinegenius-maske-kostum-redaktion','cinegenius-technik-redaktion')) then raise exception 'Unexpected source organization'; end if;
 if exists(select 1 from organization_members where organization_id=any(org_ids) and (user_id<>owner_id or role<>'owner' or status<>'active')) or
    exists(select 1 from organization_invitations where organization_id=any(org_ids)) or
    exists(select 1 from organization_company_links where organization_id=any(org_ids)) then raise exception 'Review linked access before consolidation'; end if;
 if (select count(*) from organization_entries where organization_id=any(org_ids))<>17 or
    exists(select 1 from organization_entries where organization_id=any(org_ids) and (not id=any(entry_ids) or moderation_status not in ('approved','ended'))) then raise exception 'Entry scope or visibility changed'; end if;
 foreach item in array array(select value from jsonb_array_elements(p_snapshot->'organizations')) loop
  if not exists(select 1 from organizations where id=(item->>'id')::uuid and updated_at=(item->>'updated_at')::timestamptz) then raise exception 'Stale organization revision'; end if;
 end loop;
 foreach item in array array(select value from jsonb_array_elements(p_snapshot->'entries')) loop
  if not exists(select 1 from organization_entries where id=(item->>'id')::uuid and updated_at=(item->>'updated_at')::timestamptz) then raise exception 'Stale entry revision'; end if;
 end loop;
 if exists(select slug from organization_entries where id=any(entry_ids) group by slug having count(*)>1) then raise exception 'Entry slug collision'; end if;
 if exists(select 1 from organization_entries e where e.id=any(entry_ids) and nullif(e.image_url,'') is not null and not exists(select 1 from media_assets m where m.reference_url=e.image_url and m.source_type='organization_entry' and m.source_id=e.id::text)) then raise exception 'Review image origin before consolidation'; end if;
 select jsonb_build_object('organizations',(select jsonb_agg(to_jsonb(o)) from organizations o where id=any(org_ids)), 'entries',(select jsonb_agg(to_jsonb(e)) from organization_entries e where id=any(entry_ids))) into actual_snapshot;
 insert into organization_route_aliases(slug,organization_id,original_organization_id) select slug,p_target,id from organizations where id=any(org_ids);
 insert into organization_entry_route_aliases(organization_slug,entry_slug,entry_id,original_organization_id) select o.slug,e.slug,e.id,o.id from organization_entries e join organizations o on o.id=e.organization_id where e.id=any(entry_ids);
 update organization_entries set organization_id=p_target,last_actor_user_id='cinegenius-newsroom-consolidation' where id=any(entry_ids);
 update organizations set slug='cinegenius-redaktion',name='CineGenius Redaktion',
  description='Independent editorial news for film professionals: industry, technology, training and events. Each article links to its original source. Country labels describe the relevance of individual articles, not a local editorial office.',
  topics=coalesce((select array_agg(distinct topic order by topic) from organizations o cross join lateral unnest(o.topics) topic where o.id=any(org_ids)),'{}'::text[]),
  last_actor_user_id='cinegenius-newsroom-consolidation' where id=p_target;
 update organizations set moderation_status='hidden',moderation_reason='Consolidated into CineGenius Redaktion by operator request; originals, history and routes retained.',last_actor_user_id='cinegenius-newsroom-consolidation' where id=any(org_ids) and id<>p_target;
 insert into newsroom_consolidation_events(actor,reason,target_organization_id,before_state,after_entry_ids)
 values('cinegenius-newsroom-consolidation','Markus authorized central newsroom and publication on 20 November 2026.',p_target,actual_snapshot,entry_ids);
 return jsonb_build_object('organizations',8,'entries',17,'publisherId',p_target,'slug','cinegenius-redaktion');
end $$;
revoke all on function public.consolidate_own_newsrooms(uuid,jsonb) from public,anon,authenticated,service_role;
