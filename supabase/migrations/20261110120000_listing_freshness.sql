-- Per-offer freshness is opt-in by type. Applying this migration sends nothing,
-- publishes nothing, and does not backfill or modify existing offers.
begin;

create table if not exists public.listing_freshness_settings (
  listing_type text primary key check (listing_type in ('prop','vehicle','location','job','animal')),
  enabled boolean not null default false,
  initial_days integer not null check (initial_days between 1 and 3650),
  followup_days integer not null default 7 check (followup_days between 1 and 730),
  response_days integer not null default 14 check (response_days between 1 and 730),
  activated_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by text
);
insert into public.listing_freshness_settings(listing_type,initial_days)
values ('prop',90),('vehicle',90),('location',180),('job',90),('animal',180)
on conflict (listing_type) do nothing;

create table if not exists public.listing_freshness_state (
  listing_id uuid primary key references public.listings(id) on delete cascade,
  version bigint not null default 1 check (version > 0),
  cycle bigint not null default 1 check (cycle > 0),
  status text not null default 'active' check (status in ('active','paused','ended','suspended')),
  confirmed_at timestamptz not null,
  due_at timestamptz not null,
  reminder_sent_at timestamptz,
  followup_sent_at timestamptz,
  response_deadline_at timestamptz,
  provider_user_id text not null,
  provider_company_id uuid,
  content_revision bigint not null,
  publication_fingerprint text not null,
  settings_activated_at timestamptz not null,
  provider_locale text check (provider_locale in ('de','en','es','it','cs','hu')),
  updated_at timestamptz not null default now(),
  check ((followup_sent_at is null and response_deadline_at is null) or
         (followup_sent_at is not null and reminder_sent_at is not null and (response_deadline_at is null or response_deadline_at >= followup_sent_at)))
);
create index if not exists listing_freshness_due_idx on public.listing_freshness_state(due_at) where status='active';

create table if not exists public.listing_freshness_outbox (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  cycle bigint not null,
  stage text not null check (stage in ('initial','followup')),
  grace_days integer not null check (grace_days between 1 and 730),
  status text not null default 'pending' check (status in ('pending','claimed','sent','retry','skipped','unknown')),
  provider_user_id text not null,
  provider_company_id uuid,
  content_revision bigint not null,
  publication_fingerprint text not null,
  settings_activated_at timestamptz not null,
  claim_token uuid,
  worker_id text,
  lease_until timestamptz,
  attempts integer not null default 0,
  first_attempt_at timestamptz,
  frozen_payload jsonb,
  idempotency_key text not null unique default ('listing-freshness/' || gen_random_uuid()::text),
  sent_at timestamptz,
  provider_message_id text,
  delivery_status text not null default 'pending' check (delivery_status in ('pending','delivered','bounced','failed','suppressed','complained','canceled','recipient_changed','unavailable')),
  delivery_checked_at timestamptz,
  delivered_at timestamptz,
  error_code text,
  next_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(listing_id,cycle,stage),
  check ((first_attempt_at is null and frozen_payload is null) or (first_attempt_at is not null and frozen_payload is not null)),
  check (status <> 'sent' or (sent_at is not null and provider_message_id is not null))
);
create index if not exists listing_freshness_outbox_queue_idx on public.listing_freshness_outbox(next_attempt_at,created_at)
where status in ('pending','retry','claimed');

create table if not exists public.listing_freshness_events (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings(id) on delete set null,
  cycle bigint,
  actor_user_id text,
  action text not null check (action in ('enrolled','renewed','paused','ended','suspended','reminder_sent','followup_sent','delivery_failed','delivery_unknown','delivery_skipped','settings_updated')),
  request_id uuid unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists listing_freshness_events_listing_idx on public.listing_freshness_events(listing_id,created_at desc);

alter table public.listing_freshness_settings enable row level security;
alter table public.listing_freshness_state enable row level security;
alter table public.listing_freshness_outbox enable row level security;
alter table public.listing_freshness_events enable row level security;
revoke all on public.listing_freshness_settings, public.listing_freshness_state, public.listing_freshness_outbox, public.listing_freshness_events from public, anon, authenticated;
grant select,insert,update,delete on public.listing_freshness_settings, public.listing_freshness_state, public.listing_freshness_outbox, public.listing_freshness_events to service_role;

-- Observe withdrawal at the source, even if an unchanged marketplace offer is
-- republished before the next worker run. A former deadline cannot pause a new
-- publication. No offer, moderation result, or media is changed by this trigger.
create or replace function public._suspend_listing_freshness_on_withdrawal()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare previous_cycle bigint; stamp timestamptz:=clock_timestamp();
begin
 if old.published is true and new.published is not true then
   update public.listing_freshness_state set status='suspended',version=version+1,updated_at=stamp
     where listing_id=new.id and status='active' returning cycle into previous_cycle;
   if found then
     update public.listing_freshness_outbox set status='skipped',lease_until=null,error_code='listing_unpublished',updated_at=stamp
       where listing_id=new.id and status in ('pending','retry','claimed');
     insert into public.listing_freshness_events(listing_id,cycle,action,metadata)
       values(new.id,previous_cycle,'suspended',jsonb_build_object('reason','listing_unpublished'));
   end if;
 end if;
 return new;
end $$;
drop trigger if exists suspend_listing_freshness_on_withdrawal on public.listings;
create trigger suspend_listing_freshness_on_withdrawal after update of published on public.listings
for each row when (old.published is true and new.published is not true)
execute function public._suspend_listing_freshness_on_withdrawal();
revoke all on function public._suspend_listing_freshness_on_withdrawal() from public,anon,authenticated;

-- The service layer supplies the authenticated actor. No browser role can invoke
-- these functions. Mutators consistently lock listing -> company/member -> state
-- -> outbox, so withdrawal and delivery cannot deadlock in opposite lock order.
create or replace function public._listing_freshness_context(p_listing_id uuid,p_actor text default null,p_lock boolean default false)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare l public.listings%rowtype; c jsonb; member_role text; provider text; allowed boolean := false; eligible boolean; fingerprint text;
begin
  if p_lock then select * into l from public.listings where id=p_listing_id for update;
  else select * into l from public.listings where id=p_listing_id; end if;
  if not found then return null; end if;
  if l.company_id is not null then
    if p_lock then select to_jsonb(x) into c from public.companies x where id=l.company_id for share;
    else select to_jsonb(x) into c from public.companies x where id=l.company_id; end if;
    provider := nullif(c->>'owner_user_id','');
    allowed := p_actor is not null and p_actor=provider;
    if not coalesce(allowed,false) and p_actor is not null then
      if p_lock then select role into member_role from public.company_members where company_id=l.company_id and user_id=p_actor and status='accepted' for share;
      else select role into member_role from public.company_members where company_id=l.company_id and user_id=p_actor and status='accepted'; end if;
      allowed := member_role in ('owner','admin','editor','manager');
    end if;
  else provider := nullif(l.user_id,''); allowed := p_actor is not null and p_actor=provider; end if;
  eligible := coalesce(l.published,false) and provider is not null and l.type in ('prop','vehicle','location','job','animal')
    and (l.company_id is null or (c is not null and coalesce((c->>'published')::boolean,false)))
    and ((l.moderation_status='approved' and l.reviewed_revision=l.content_revision)
      or (l.type in ('prop','vehicle') and l.moderation_status='owner_published'));
  fingerprint := md5(jsonb_build_array(l.moderation_status,l.content_revision,l.reviewed_revision,l.reviewed_at,l.reviewed_by)::text);
  return jsonb_build_object('listing',jsonb_build_object('id',l.id,'title',l.title,'type',l.type,'published',l.published,'moderation_status',l.moderation_status,'content_revision',l.content_revision,'company_slug',c->>'slug'),
    'provider_user_id',provider,'provider_company_id',l.company_id,'content_revision',l.content_revision,'publication_fingerprint',fingerprint,'can_edit',coalesce(allowed,false),'eligible',coalesce(eligible,false));
end $$;

create or replace function public._listing_freshness_matches(p_context jsonb,p_state public.listing_freshness_state)
returns boolean language sql immutable set search_path=public,pg_temp as $$
 select coalesce((p_context->>'eligible')::boolean,false)
   and p_state.status='active'
   and p_state.provider_user_id=p_context->>'provider_user_id'
   and p_state.provider_company_id is not distinct from (p_context->>'provider_company_id')::uuid
   and p_state.content_revision=(p_context->>'content_revision')::bigint
   and p_state.publication_fingerprint=p_context->>'publication_fingerprint'
$$;

create or replace function public.get_listing_freshness(p_listing_id uuid,p_actor text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare ctx jsonb; s public.listing_freshness_state; enabled_now boolean;
begin
 ctx:=public._listing_freshness_context(p_listing_id,p_actor,false);
 if ctx is null then return jsonb_build_object('status','missing'); end if;
 if not (ctx->>'can_edit')::boolean then return jsonb_build_object('status','forbidden'); end if;
 select * into s from public.listing_freshness_state where listing_id=p_listing_id;
 select enabled and activated_at=s.settings_activated_at into enabled_now from public.listing_freshness_settings where listing_type=ctx->'listing'->>'type';
 return jsonb_build_object('status','ok','listing',ctx->'listing','state',case when s.listing_id is null then null else to_jsonb(s) end,
   'canRenew',s.listing_id is not null and coalesce(enabled_now,false) and public._listing_freshness_matches(ctx,s),
   'canEnd',s.listing_id is not null and s.status in ('active','paused') and s.provider_user_id=ctx->>'provider_user_id'
     and s.provider_company_id is not distinct from (ctx->>'provider_company_id')::uuid and s.content_revision=(ctx->>'content_revision')::bigint);
end $$;

create or replace function public.configure_listing_freshness(p_listing_type text,p_enabled boolean,p_initial_days integer,p_followup_days integer,p_response_days integer,p_actor text,p_reason text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare prev public.listing_freshness_settings; result public.listing_freshness_settings;
begin
 if nullif(btrim(p_actor),'') is null or char_length(btrim(coalesce(p_reason,''))) not between 5 and 500
   or p_enabled is null or p_initial_days is null or p_initial_days not between 1 and 3650
   or p_followup_days is null or p_followup_days not between 1 and 730 or p_response_days is null or p_response_days not between 1 and 730 then
   return jsonb_build_object('status','invalid'); end if;
 select * into prev from public.listing_freshness_settings where listing_type=p_listing_type for update;
 if not found then return jsonb_build_object('status','invalid'); end if;
 if prev.enabled=p_enabled and prev.initial_days=p_initial_days and prev.followup_days=p_followup_days and prev.response_days=p_response_days then
   return jsonb_build_object('status','unchanged','settings',to_jsonb(prev)); end if;
 update public.listing_freshness_settings set enabled=p_enabled, initial_days=p_initial_days,followup_days=p_followup_days,response_days=p_response_days,
   activated_at=case when p_enabled and not prev.enabled then clock_timestamp() else prev.activated_at end, updated_at=clock_timestamp(),updated_by=p_actor
   where listing_type=p_listing_type returning * into result;
 insert into public.listing_freshness_events(actor_user_id,action,metadata) values(p_actor,'settings_updated',jsonb_build_object('listing_type',p_listing_type,'before',to_jsonb(prev),'after',to_jsonb(result),'reason',btrim(p_reason)));
 return jsonb_build_object('status','saved','settings',to_jsonb(result));
end $$;

-- Validate the entire request before the first settings write. The API may
-- update several types atomically; invalid/duplicate types cannot partially save.
create or replace function public.configure_listing_freshness_batch(p_settings jsonb,p_actor text,p_reason text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare entry jsonb; result jsonb; results jsonb:='[]'::jsonb; count_rows integer; count_types integer;
begin
 if nullif(btrim(p_actor),'') is null or char_length(btrim(coalesce(p_reason,''))) not between 5 and 500
   or p_settings is null or jsonb_typeof(p_settings)<>'array' then return jsonb_build_object('status','invalid'); end if;
 count_rows:=jsonb_array_length(p_settings);
 if count_rows not between 1 and 5 then return jsonb_build_object('status','invalid'); end if;
 select count(distinct x->>'listing_type') into count_types from jsonb_array_elements(p_settings) x;
 if count_types<>count_rows then return jsonb_build_object('status','invalid'); end if;
 for entry in select value from jsonb_array_elements(p_settings) loop
   if jsonb_typeof(entry)<>'object' or coalesce(entry->>'listing_type','') not in ('prop','vehicle','location','job','animal')
     or jsonb_typeof(entry->'enabled') is distinct from 'boolean'
     or jsonb_typeof(entry->'initial_days') is distinct from 'number' or coalesce(entry->>'initial_days','') !~ '^[0-9]{1,4}$'
     or jsonb_typeof(entry->'followup_days') is distinct from 'number' or coalesce(entry->>'followup_days','') !~ '^[0-9]{1,4}$'
     or jsonb_typeof(entry->'response_days') is distinct from 'number' or coalesce(entry->>'response_days','') !~ '^[0-9]{1,4}$' then
     return jsonb_build_object('status','invalid'); end if;
   if (entry->>'initial_days')::integer not between 1 and 3650
     or (entry->>'followup_days')::integer not between 1 and 730 or (entry->>'response_days')::integer not between 1 and 730 then
     return jsonb_build_object('status','invalid'); end if;
 end loop;
 -- Deterministic lock order for concurrent multi-type updates.
 perform 1 from public.listing_freshness_settings where listing_type in (select x->>'listing_type' from jsonb_array_elements(p_settings) x) order by listing_type for update;
 for entry in select value from jsonb_array_elements(p_settings) order by value->>'listing_type' loop
   result:=public.configure_listing_freshness(entry->>'listing_type',(entry->>'enabled')::boolean,
     (entry->>'initial_days')::integer,(entry->>'followup_days')::integer,(entry->>'response_days')::integer,p_actor,p_reason);
   if result->>'status' not in ('saved','unchanged') then raise exception 'Freshness configuration changed during validation'; end if;
   results:=results || jsonb_build_array(result->'settings');
 end loop;
 return jsonb_build_object('status','saved','settings',results);
end $$;

create or replace function public.listing_freshness_transition(p_listing_id uuid,p_actor text,p_action text,p_expected_version bigint,p_expected_cycle bigint,p_request_id uuid,p_locale text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare ctx jsonb; s public.listing_freshness_state; cfg public.listing_freshness_settings; ev public.listing_freshness_events; request jsonb; stamp timestamptz:=clock_timestamp();
begin
 if p_request_id is null or nullif(btrim(p_actor),'') is null or p_action not in ('renew','end','pause') or p_action is null
   or p_expected_version is null or p_expected_cycle is null or (p_locale is not null and p_locale not in ('de','en','es','it','cs','hu')) then return jsonb_build_object('status','invalid'); end if;
 ctx:=public._listing_freshness_context(p_listing_id,p_actor,true);
 if ctx is null then return jsonb_build_object('status','missing'); end if;
 if not (ctx->>'can_edit')::boolean then return jsonb_build_object('status','forbidden'); end if;
 select * into cfg from public.listing_freshness_settings where listing_type=ctx->'listing'->>'type' for share;
 select * into s from public.listing_freshness_state where listing_id=p_listing_id for update;
 if s.listing_id is null then return jsonb_build_object('status','restricted'); end if;
 request:=jsonb_build_object('action',p_action,'version',p_expected_version,'cycle',p_expected_cycle,'locale',p_locale);
 select * into ev from public.listing_freshness_events where request_id=p_request_id;
 if found then
   if ev.listing_id=p_listing_id and ev.actor_user_id=p_actor and ev.metadata->'request'=request then return jsonb_build_object('status','unchanged','state',to_jsonb(s)); end if;
   return jsonb_build_object('status','invalid');
 end if;
 if s.version<>p_expected_version or s.cycle<>p_expected_cycle or s.provider_user_id is distinct from ctx->>'provider_user_id'
   or s.provider_company_id is distinct from (ctx->>'provider_company_id')::uuid or s.content_revision is distinct from (ctx->>'content_revision')::bigint then
   return jsonb_build_object('status','stale','state',to_jsonb(s)); end if;
 if p_action='renew' then
   if not coalesce(cfg.enabled,false) or cfg.activated_at is distinct from s.settings_activated_at or not public._listing_freshness_matches(ctx,s) then return jsonb_build_object('status','restricted','state',to_jsonb(s)); end if;
   update public.listing_freshness_state set version=version+1,cycle=cycle+1,confirmed_at=stamp,due_at=stamp+make_interval(days=>cfg.initial_days),reminder_sent_at=null,followup_sent_at=null,response_deadline_at=null,
     provider_locale=coalesce(p_locale,provider_locale),updated_at=stamp where listing_id=p_listing_id returning * into s;
 else
   if s.status not in ('active','paused') then return jsonb_build_object('status','restricted','state',to_jsonb(s)); end if;
   -- Existing moderation triggers remain authoritative; this never sets published=true.
   update public.listings set published=false where id=p_listing_id and published=true;
   update public.listing_freshness_state set version=version+1,status=case when p_action='end' then 'ended' else 'paused' end,provider_locale=coalesce(p_locale,provider_locale),updated_at=stamp where listing_id=p_listing_id returning * into s;
 end if;
 update public.listing_freshness_outbox set status='skipped',lease_until=null,error_code='provider_response',updated_at=stamp
   where listing_id=p_listing_id and status in ('pending','retry','claimed');
 insert into public.listing_freshness_events(listing_id,cycle,actor_user_id,action,request_id,metadata)
 values(p_listing_id,s.cycle,p_actor,case p_action when 'renew' then 'renewed' when 'end' then 'ended' else 'paused' end,p_request_id,jsonb_build_object('request',request));
 return jsonb_build_object('status','saved','state',to_jsonb(s));
end $$;

create or replace function public._listing_freshness_delivery_valid(p_context jsonb,p_state public.listing_freshness_state,p_outbox public.listing_freshness_outbox,p_settings public.listing_freshness_settings)
returns boolean language sql immutable set search_path=public,pg_temp as $$
 select coalesce(public._listing_freshness_matches(p_context,p_state)
   and p_settings.enabled and p_settings.activated_at=p_state.settings_activated_at
   and p_outbox.listing_id=p_state.listing_id and p_outbox.cycle=p_state.cycle
   and p_outbox.provider_user_id=p_state.provider_user_id
   and p_outbox.provider_company_id is not distinct from p_state.provider_company_id
   and p_outbox.content_revision=p_state.content_revision
   and p_outbox.publication_fingerprint=p_state.publication_fingerprint
   and p_outbox.settings_activated_at=p_state.settings_activated_at
   and ((p_outbox.stage='initial' and p_state.reminder_sent_at is null)
     or (p_outbox.stage='followup' and p_state.reminder_sent_at is not null and p_state.followup_sent_at is null)),false)
$$;

-- Maintenance is bounded separately from the mail batch. Existing eligible offers
-- receive a new initial period; applying or enabling a rule never archives them.
create or replace function public.claim_listing_freshness_reminders(p_limit integer,p_worker_id text)
returns table(outbox_id uuid,listing_id uuid,title text,type text,cycle bigint,stage text,claim_token uuid,lease_until timestamptz,provider_user_id text,provider_company_id uuid,content_revision bigint,frozen_payload jsonb,idempotency_key text,first_attempt_at timestamptz,grace_days integer,provider_locale text)
language plpgsql security definer set search_path=public,pg_temp as $$
declare candidate record; ctx jsonb; s public.listing_freshness_state; cfg public.listing_freshness_settings; o public.listing_freshness_outbox;
 stamp timestamptz:=clock_timestamp(); selected_stage text; emitted integer:=0; token uuid;
begin
 if p_limit is null or p_limit<1 or nullif(btrim(p_worker_id),'') is null then return; end if;
 for candidate in
   select l.id from public.listings l
   join public.listing_freshness_settings settings on settings.listing_type=l.type and settings.enabled
   left join public.listing_freshness_state st on st.listing_id=l.id
   left join public.companies co on co.id=l.company_id
   cross join lateral (select coalesce(l.published,false)
     and nullif(case when l.company_id is null then l.user_id else co.owner_user_id end,'') is not null
     and (l.company_id is null or coalesce(co.published,false))
     and coalesce((l.moderation_status='approved' and l.reviewed_revision=l.content_revision)
       or (l.type in ('prop','vehicle') and l.moderation_status='owner_published'),false) as eligible) readiness
   where (st.listing_id is null and readiness.eligible)
     or (st.listing_id is not null and (
       (st.status='active' and not readiness.eligible)
       or (readiness.eligible and (
         st.status<>'active' or st.settings_activated_at is distinct from settings.activated_at
         or st.content_revision is distinct from l.content_revision
         or st.provider_company_id is distinct from l.company_id
         or st.provider_user_id is distinct from case when l.company_id is null then l.user_id else co.owner_user_id end
         or st.publication_fingerprint is distinct from md5(jsonb_build_array(l.moderation_status,l.content_revision,l.reviewed_revision,l.reviewed_at,l.reviewed_by)::text)
         or (st.status='active' and (
           (st.reminder_sent_at is null and st.due_at<=stamp and not exists(select 1 from public.listing_freshness_outbox ob where ob.listing_id=l.id and ob.cycle=st.cycle and ob.stage='initial'))
           or (st.reminder_sent_at is not null and st.followup_sent_at is null and st.due_at<=stamp
             and not exists(select 1 from public.listing_freshness_outbox ob where ob.listing_id=l.id and ob.cycle=st.cycle and ob.stage='followup'))
           ))))))
   order by st.updated_at nulls first,l.id limit 100 for update of l skip locked
 loop
   ctx:=public._listing_freshness_context(candidate.id,null,true);
   select * into cfg from public.listing_freshness_settings where listing_type=ctx->'listing'->>'type' for share;
   if not coalesce(cfg.enabled,false) or cfg.activated_at is null then continue; end if;
   select * into s from public.listing_freshness_state st where st.listing_id=candidate.id for update;
   if not coalesce((ctx->>'eligible')::boolean,false) then
     if s.listing_id is not null and s.status='active' then
       update public.listing_freshness_state st set status='suspended',version=st.version+1,updated_at=stamp where st.listing_id=candidate.id;
       update public.listing_freshness_outbox ob set status='skipped',lease_until=null,error_code='listing_unavailable',updated_at=stamp where ob.listing_id=candidate.id and ob.status in ('pending','retry','claimed');
       insert into public.listing_freshness_events(listing_id,cycle,action,metadata) values(candidate.id,s.cycle,'suspended',jsonb_build_object('reason','listing_unavailable'));
     end if;
     continue;
   end if;
   if s.listing_id is null then
     insert into public.listing_freshness_state(listing_id,confirmed_at,due_at,provider_user_id,provider_company_id,content_revision,publication_fingerprint,settings_activated_at)
       values(candidate.id,stamp,stamp+make_interval(days=>cfg.initial_days),ctx->>'provider_user_id',(ctx->>'provider_company_id')::uuid,(ctx->>'content_revision')::bigint,ctx->>'publication_fingerprint',cfg.activated_at) returning * into s;
     insert into public.listing_freshness_events(listing_id,cycle,action,metadata) values(candidate.id,s.cycle,'enrolled',jsonb_build_object('reason','initial_period'));
     continue;
   end if;
   if not public._listing_freshness_matches(ctx,s) or s.settings_activated_at is distinct from cfg.activated_at then
     update public.listing_freshness_outbox ob set status='skipped',lease_until=null,error_code='listing_changed',updated_at=stamp where ob.listing_id=candidate.id and ob.status in ('pending','retry','claimed');
     update public.listing_freshness_state st set status='active',version=st.version+1,cycle=st.cycle+1,confirmed_at=stamp,due_at=stamp+make_interval(days=>cfg.initial_days),
       reminder_sent_at=null,followup_sent_at=null,response_deadline_at=null,
       provider_locale=case when st.provider_user_id=ctx->>'provider_user_id' then st.provider_locale else null end,
       provider_user_id=ctx->>'provider_user_id',provider_company_id=(ctx->>'provider_company_id')::uuid,content_revision=(ctx->>'content_revision')::bigint,
       publication_fingerprint=ctx->>'publication_fingerprint',settings_activated_at=cfg.activated_at,updated_at=stamp where st.listing_id=candidate.id returning * into s;
     insert into public.listing_freshness_events(listing_id,cycle,action,metadata) values(candidate.id,s.cycle,'enrolled',jsonb_build_object('reason','new_publication_or_provider_or_activation'));
     continue;
   end if;
   selected_stage:=case when s.reminder_sent_at is null and s.due_at<=stamp then 'initial'
     when s.reminder_sent_at is not null and s.followup_sent_at is null and s.due_at<=stamp then 'followup' end;
   if selected_stage is not null then
     insert into public.listing_freshness_outbox(listing_id,cycle,stage,grace_days,provider_user_id,provider_company_id,content_revision,publication_fingerprint,settings_activated_at)
       values(s.listing_id,s.cycle,selected_stage,case when selected_stage='initial' then cfg.followup_days else cfg.response_days end,s.provider_user_id,s.provider_company_id,s.content_revision,s.publication_fingerprint,s.settings_activated_at)
       on conflict on constraint listing_freshness_outbox_listing_id_cycle_stage_key do nothing;
   end if;
 end loop;

 for candidate in select ob.id,ob.listing_id from public.listing_freshness_outbox ob
   join public.listings l on l.id=ob.listing_id join public.listing_freshness_settings settings on settings.listing_type=l.type and settings.enabled
   where (ob.status in ('pending','retry') and ob.next_attempt_at<=stamp) or (settings.enabled and ob.status='claimed' and ob.lease_until<=stamp)
   order by ob.next_attempt_at,ob.created_at,ob.id limit 100
 loop
   exit when emitted>=least(p_limit,10);
   perform 1 from public.listings where id=candidate.listing_id for update skip locked;
   if not found then continue; end if;
   ctx:=public._listing_freshness_context(candidate.listing_id,null,true);
   select * into cfg from public.listing_freshness_settings where listing_type=ctx->'listing'->>'type' for share;
   select * into s from public.listing_freshness_state st where st.listing_id=candidate.listing_id for update;
   select * into o from public.listing_freshness_outbox ob where ob.id=candidate.id for update skip locked;
   if not found or not ((o.status in ('pending','retry') and o.next_attempt_at<=stamp) or (o.status='claimed' and o.lease_until<=stamp)) then continue; end if;
   if not public._listing_freshness_delivery_valid(ctx,s,o,cfg) then
     update public.listing_freshness_outbox ob set status='skipped',lease_until=null,error_code='stale_listing',updated_at=stamp where ob.id=o.id;
     insert into public.listing_freshness_events(listing_id,cycle,action,metadata) values(o.listing_id,o.cycle,'delivery_skipped',jsonb_build_object('stage',o.stage,'reason','stale_listing'));
     continue;
   end if;
   if o.first_attempt_at is not null and o.first_attempt_at<=stamp-interval '23 hours' then
     update public.listing_freshness_outbox ob set status='unknown',lease_until=null,error_code='idempotency_window_elapsed',updated_at=stamp where ob.id=o.id;
     insert into public.listing_freshness_events(listing_id,cycle,action,metadata) values(o.listing_id,o.cycle,'delivery_unknown',jsonb_build_object('stage',o.stage,'reason','idempotency_window_elapsed'));
     continue;
   end if;
   token:=gen_random_uuid();
   update public.listing_freshness_outbox ob set status='claimed',claim_token=token,worker_id=left(p_worker_id,100),lease_until=stamp+interval '5 minutes',attempts=ob.attempts+1,updated_at=stamp where ob.id=o.id returning * into o;
   emitted:=emitted+1;
   return query select o.id,o.listing_id,ctx->'listing'->>'title',ctx->'listing'->>'type',o.cycle,o.stage,o.claim_token,o.lease_until,o.provider_user_id,o.provider_company_id,o.content_revision,o.frozen_payload,o.idempotency_key,o.first_attempt_at,
     o.grace_days,s.provider_locale;
 end loop;
end $$;

-- The email payload and idempotency key become immutable before sending. A
-- retry uses exactly that payload; a changed verified recipient cancels it.
create or replace function public.bind_listing_freshness_delivery(p_outbox_id uuid,p_claim_token uuid,p_recipient_user_id text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare listing uuid; ctx jsonb; s public.listing_freshness_state; cfg public.listing_freshness_settings; o public.listing_freshness_outbox; stamp timestamptz:=clock_timestamp(); failure text; result_status text;
begin
 select ob.listing_id into listing from public.listing_freshness_outbox ob where ob.id=p_outbox_id;
 if listing is null then return jsonb_build_object('status','stale'); end if;
 ctx:=public._listing_freshness_context(listing,null,true);
 select * into cfg from public.listing_freshness_settings where listing_type=ctx->'listing'->>'type' for share;
 select * into s from public.listing_freshness_state where listing_id=listing for update;
 select * into o from public.listing_freshness_outbox where id=p_outbox_id for update;
 if o.status<>'claimed' or o.claim_token is distinct from p_claim_token or o.lease_until<=stamp then return jsonb_build_object('status','stale'); end if;
 if not public._listing_freshness_delivery_valid(ctx,s,o,cfg) or p_recipient_user_id is distinct from o.provider_user_id then failure:='stale_listing_or_recipient'; end if;
 if o.first_attempt_at is not null and o.first_attempt_at<=stamp-interval '23 hours' then failure:='idempotency_window_elapsed'; end if;
 if failure is null and (p_payload is null or jsonb_typeof(p_payload)<>'object'
   or p_payload->>'from' is distinct from 'CineGenius <noreply@cinegenius.co>' or p_payload->>'replyTo' is distinct from 'cinegenius.co@gmail.com'
   or jsonb_typeof(p_payload->'to') is distinct from 'string' or char_length(p_payload->>'to') not between 3 and 320 or (p_payload->>'to') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
   or jsonb_typeof(p_payload->'subject') is distinct from 'string' or char_length(p_payload->>'subject') not between 1 and 500 or (p_payload->>'subject') ~ E'[\r\n]'
   or jsonb_typeof(p_payload->'html') is distinct from 'string' or char_length(p_payload->>'html') not between 1 and 100000
   or jsonb_typeof(p_payload->'text') is distinct from 'string' or char_length(p_payload->>'text') not between 1 and 20000
   or coalesce(p_payload->>'locale','') not in ('de','en','es','it','cs','hu')) then failure:='invalid_payload'; end if;
 if failure is null and o.frozen_payload is not null and o.frozen_payload->>'to' is distinct from p_payload->>'to' then failure:='recipient_changed'; end if;
 if failure is not null then
   result_status:=case when o.first_attempt_at is not null then 'unknown' else 'skipped' end;
   update public.listing_freshness_outbox set status=result_status,lease_until=null,error_code=failure,updated_at=stamp where id=o.id;
   insert into public.listing_freshness_events(listing_id,cycle,action,metadata) values(o.listing_id,o.cycle,case when result_status='unknown' then 'delivery_unknown' else 'delivery_skipped' end,jsonb_build_object('stage',o.stage,'reason',failure));
   return jsonb_build_object('status','stale');
 end if;
 result_status:=case when o.frozen_payload is null then 'bound' else 'existing' end;
 if o.frozen_payload is null then
   update public.listing_freshness_outbox set frozen_payload=p_payload,first_attempt_at=stamp,updated_at=stamp where id=o.id returning * into o;
 end if;
 return jsonb_build_object('status',result_status,'frozen_payload',o.frozen_payload,'idempotency_key',o.idempotency_key,'first_attempt_at',o.first_attempt_at);
end $$;

create or replace function public.finish_listing_freshness_delivery(p_outbox_id uuid,p_claim_token uuid,p_outcome text,p_provider_message_id text default null,p_error_code text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare listing uuid; ctx jsonb; s public.listing_freshness_state; cfg public.listing_freshness_settings; o public.listing_freshness_outbox; stamp timestamptz:=clock_timestamp(); valid_now boolean; result_status text; code text;
begin
 if p_outcome is null or p_outcome not in ('sent','retry','skipped','unknown') then return jsonb_build_object('status','stale'); end if;
 select ob.listing_id into listing from public.listing_freshness_outbox ob where ob.id=p_outbox_id;
 if listing is null then return jsonb_build_object('status','stale'); end if;
 ctx:=public._listing_freshness_context(listing,null,true);
 select * into cfg from public.listing_freshness_settings where listing_type=ctx->'listing'->>'type' for share;
 select * into s from public.listing_freshness_state where listing_id=listing for update;
 select * into o from public.listing_freshness_outbox where id=p_outbox_id for update;
 if o.status='sent' and p_outcome='sent' and o.provider_message_id=p_provider_message_id then return jsonb_build_object('status','sent'); end if;
 if o.status<>'claimed' or o.claim_token is distinct from p_claim_token or o.lease_until<=stamp then return jsonb_build_object('status','stale'); end if;
 valid_now:=public._listing_freshness_delivery_valid(ctx,s,o,cfg);
 if p_outcome='sent' then
   if nullif(btrim(p_provider_message_id),'') is null or char_length(p_provider_message_id)>200 or o.frozen_payload is null or o.first_attempt_at is null then return jsonb_build_object('status','stale'); end if;
   -- Keep the provider receipt even if the offer changed during the network call,
   -- but never apply its deadline to another version, owner, or disabled rule.
   update public.listing_freshness_outbox set status='sent',sent_at=stamp,provider_message_id=p_provider_message_id,lease_until=null,error_code=case when valid_now then null else 'stale_after_send' end,updated_at=stamp where id=o.id;
   if valid_now then
     if o.stage='initial' then
       update public.listing_freshness_state st set reminder_sent_at=stamp,due_at=stamp+make_interval(days=>o.grace_days),version=st.version+1,updated_at=stamp where st.listing_id=listing;
     else
       -- API acceptance is not delivery. A separate provider check starts the
       -- full response period; failed or unobservable mail never pauses offers.
       update public.listing_freshness_state st set followup_sent_at=stamp,response_deadline_at=null,version=st.version+1,updated_at=stamp where st.listing_id=listing;
     end if;
   end if;
   insert into public.listing_freshness_events(listing_id,cycle,action,metadata) values(o.listing_id,o.cycle,case when o.stage='initial' then 'reminder_sent' else 'followup_sent' end,jsonb_build_object('stage',o.stage,'provider_message_id',p_provider_message_id,'applied',valid_now));
   return jsonb_build_object('status',case when valid_now then 'sent' else 'stale' end);
 end if;
 result_status:=p_outcome;
 if not valid_now then result_status:=case when o.first_attempt_at is null then 'skipped' else 'unknown' end;
 elsif p_outcome='retry' and o.first_attempt_at is not null and o.first_attempt_at<=stamp-interval '23 hours' then result_status:='unknown'; end if;
 code:=left(regexp_replace(coalesce(p_error_code,'delivery_failed'),'[^A-Za-z0-9_.:-]','_','g'),100);
 update public.listing_freshness_outbox set status=result_status,lease_until=null,error_code=code,next_attempt_at=stamp+interval '1 hour',updated_at=stamp where id=o.id;
 insert into public.listing_freshness_events(listing_id,cycle,action,metadata) values(o.listing_id,o.cycle,case result_status when 'unknown' then 'delivery_unknown' when 'skipped' then 'delivery_skipped' else 'delivery_failed' end,jsonb_build_object('stage',o.stage,'reason',code));
 return jsonb_build_object('status',result_status);
end $$;

-- Read-only, bounded candidates. No elapsed deadline alone can unpublish an
-- offer: record_listing_freshness_delivery_check requires a fresh positive
-- provider observation, revalidates the exact current publication, and locks it.
create or replace function public.get_listing_freshness_delivery_checks(p_limit integer)
returns table(outbox_id uuid,provider_message_id text,provider_user_id text,recipient text,delivery_checked_at timestamptz)
language sql stable security definer set search_path=public,pg_temp as $$
 select ob.id,ob.provider_message_id,ob.provider_user_id,ob.frozen_payload->>'to',ob.delivery_checked_at
 from public.listing_freshness_outbox ob
 join public.listing_freshness_state st on st.listing_id=ob.listing_id and st.cycle=ob.cycle and st.status='active'
 join public.listings l on l.id=ob.listing_id and l.published
 join public.listing_freshness_settings cfg on cfg.listing_type=l.type and cfg.enabled and cfg.activated_at=st.settings_activated_at
 where ob.status='sent' and ob.stage='followup' and st.followup_sent_at is not null
   and ob.error_code is null and ob.provider_message_id is not null
   and ob.content_revision=st.content_revision and ob.content_revision=l.content_revision
   and ob.provider_user_id=st.provider_user_id and ob.provider_company_id is not distinct from st.provider_company_id
   and ob.publication_fingerprint=st.publication_fingerprint
   and ob.delivery_status in ('pending','delivered','unavailable')
   and (ob.delivery_checked_at is null or
     (st.response_deadline_at is null and ob.delivery_checked_at<=now()-interval '1 day') or
     (st.response_deadline_at<=now() and ob.delivery_checked_at<=now()-interval '1 hour'))
 order by ob.delivery_checked_at nulls first,ob.sent_at,ob.id
 limit greatest(0,least(coalesce(p_limit,0),10))
$$;

create or replace function public.record_listing_freshness_delivery_check(
 p_outbox_id uuid,p_provider_message_id text,p_expected_checked_at timestamptz,p_delivery_status text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare listing uuid; ctx jsonb; s public.listing_freshness_state; cfg public.listing_freshness_settings;
 o public.listing_freshness_outbox; stamp timestamptz:=clock_timestamp(); terminal boolean;
begin
 if p_delivery_status is null or p_delivery_status not in ('pending','delivered','bounced','failed','suppressed','complained','canceled','recipient_changed','unavailable') then
   return jsonb_build_object('status','stale');
 end if;
 select ob.listing_id into listing from public.listing_freshness_outbox ob where ob.id=p_outbox_id;
 if listing is null then return jsonb_build_object('status','stale'); end if;
 ctx:=public._listing_freshness_context(listing,null,true);
 select * into cfg from public.listing_freshness_settings where listing_type=ctx->'listing'->>'type' for share;
 select * into s from public.listing_freshness_state where listing_id=listing for update;
 select * into o from public.listing_freshness_outbox where id=p_outbox_id for update;
 if not coalesce(cfg.enabled,false) or not public._listing_freshness_matches(ctx,s)
   or s.settings_activated_at is distinct from cfg.activated_at
   or o.status<>'sent' or o.stage<>'followup' or o.error_code is not null or s.followup_sent_at is null
   or o.cycle<>s.cycle or o.provider_message_id is distinct from p_provider_message_id
   or o.provider_user_id is distinct from s.provider_user_id or o.provider_company_id is distinct from s.provider_company_id
   or o.content_revision<>s.content_revision or o.publication_fingerprint<>s.publication_fingerprint
   or o.settings_activated_at is distinct from s.settings_activated_at
   or o.delivery_checked_at is distinct from p_expected_checked_at
   or o.delivery_status not in ('pending','delivered','unavailable') then
   return jsonb_build_object('status','stale');
 end if;
 terminal:=p_delivery_status in ('bounced','failed','suppressed','complained','canceled','recipient_changed');
 update public.listing_freshness_outbox set delivery_status=p_delivery_status,delivery_checked_at=stamp,
   delivered_at=case when p_delivery_status='delivered' then coalesce(delivered_at,stamp)
     when terminal or p_delivery_status='pending' then null else delivered_at end,updated_at=stamp where id=o.id;
 if terminal or p_delivery_status='pending' then
   if s.response_deadline_at is not null then
     update public.listing_freshness_state st set response_deadline_at=null,version=st.version+1,updated_at=stamp where st.listing_id=listing;
   end if;
   if terminal then
     insert into public.listing_freshness_events(listing_id,cycle,action,metadata)
       values(listing,s.cycle,'delivery_failed',jsonb_build_object('stage','followup','reason',p_delivery_status,'automatic_pause_blocked',true));
   end if;
   return jsonb_build_object('status','not_delivered');
 elsif p_delivery_status='unavailable' then
   return jsonb_build_object('status','unavailable');
 elsif o.delivered_at is null or s.response_deadline_at is null then
   update public.listing_freshness_state st set response_deadline_at=stamp+make_interval(days=>o.grace_days),version=st.version+1,updated_at=stamp where st.listing_id=listing;
   return jsonb_build_object('status','delivered');
 elsif s.response_deadline_at<=stamp then
   update public.listings set published=false where id=listing and published;
   update public.listing_freshness_state st set status='paused',version=st.version+1,updated_at=stamp where st.listing_id=listing;
   insert into public.listing_freshness_events(listing_id,cycle,action,metadata)
     values(listing,s.cycle,'paused',jsonb_build_object('reason','delivered_response_deadline_elapsed','followup_sent_at',s.followup_sent_at,'delivered_at',o.delivered_at,'response_deadline_at',s.response_deadline_at));
   return jsonb_build_object('status','paused');
 end if;
 return jsonb_build_object('status','delivered');
end $$;

revoke all on function public.get_listing_freshness_delivery_checks(integer),public.record_listing_freshness_delivery_check(uuid,text,timestamptz,text) from public,anon,authenticated;
grant execute on function public.get_listing_freshness_delivery_checks(integer),public.record_listing_freshness_delivery_check(uuid,text,timestamptz,text) to service_role;

revoke all on function public._listing_freshness_context(uuid,text,boolean), public._listing_freshness_matches(jsonb,public.listing_freshness_state), public._listing_freshness_delivery_valid(jsonb,public.listing_freshness_state,public.listing_freshness_outbox,public.listing_freshness_settings) from public,anon,authenticated;
revoke all on function public.configure_listing_freshness_batch(jsonb,text,text) from public,anon,authenticated;
grant execute on function public.configure_listing_freshness_batch(jsonb,text,text) to service_role;
revoke all on function public.get_listing_freshness(uuid,text), public.configure_listing_freshness(text,boolean,integer,integer,integer,text,text), public.listing_freshness_transition(uuid,text,text,bigint,bigint,uuid,text), public.claim_listing_freshness_reminders(integer,text), public.bind_listing_freshness_delivery(uuid,uuid,text,jsonb), public.finish_listing_freshness_delivery(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.get_listing_freshness(uuid,text), public.configure_listing_freshness(text,boolean,integer,integer,integer,text,text), public.listing_freshness_transition(uuid,text,text,bigint,bigint,uuid,text), public.claim_listing_freshness_reminders(integer,text), public.bind_listing_freshness_delivery(uuid,uuid,text,jsonb), public.finish_listing_freshness_delivery(uuid,uuid,text,text,text) to service_role;

notify pgrst,'reload schema';
commit;
