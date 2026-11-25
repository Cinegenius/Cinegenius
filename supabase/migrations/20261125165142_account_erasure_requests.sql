-- Account-scoped erasure queue. No hosted activation or fabricated retention periods.
begin;
create schema account_erasure_private;
revoke all on schema account_erasure_private from public,anon,authenticated,service_role;
create table account_erasure_private.policy(
 singleton boolean primary key default true check(singleton), revision integer not null default 1,
 enabled boolean not null default false, evidence text, valid_until timestamptz,
 backup_days integer check(backup_days between 0 and 365), provider_days integer check(provider_days between 0 and 365),
 receipt_days integer check(receipt_days between 1 and 365), updated_by text, updated_at timestamptz not null default clock_timestamp(),
 check(not enabled or (evidence is not null and length(evidence) between 20 and 1000 and valid_until is not null and backup_days is not null and provider_days is not null and receipt_days is not null))
);
insert into account_erasure_private.policy(singleton) values(true);
create table account_erasure_private.policy_history(revision integer primary key,snapshot jsonb not null,created_at timestamptz not null default clock_timestamp());
create table account_erasure_private.requests(
 id uuid primary key default gen_random_uuid(), owner_id text not null unique check(owner_id ~ '^[A-Za-z0-9_-]{3,128}$'),
 source text not null check(source in('self_service','clerk_webhook')),
 state text not null default 'pending' check(state in('pending','running','needs_review','waiting','completed')),
 revision integer not null default 1, requested_at timestamptz not null default clock_timestamp(),
 response_due_at timestamptz not null default(clock_timestamp()+interval '1 month'),
 updated_at timestamptz not null default clock_timestamp(), due_at timestamptz not null default clock_timestamp(),
 attempts integer not null default 0, alerted_at timestamptz, lease uuid, lease_until timestamptz, reason text,
 identity_ready_at timestamptz, notification_email text, notification_locale text, active_notice_at timestamptz, identity_deleted_at timestamptz, active_removed_at timestamptz, completed_at timestamptz, purge_after timestamptz,
 rate_digests text[] not null default '{}', policy_revision integer, backup_days integer, provider_days integer, receipt_days integer
);
create index account_erasure_due on account_erasure_private.requests(due_at,requested_at) where state<>'completed';
create index account_erasure_page on account_erasure_private.requests(requested_at,id);
create table account_erasure_private.events(
 id bigint generated always as identity primary key, request_id uuid not null references account_erasure_private.requests(id) on delete cascade,
 actor_id text not null, action text not null, created_at timestamptz not null default clock_timestamp(), detail jsonb not null default '{}'
);
create table account_erasure_private.files(
 request_id uuid not null references account_erasure_private.requests(id) on delete cascade,
 bucket text not null check(bucket='protected-media'), path text not null, removed_at timestamptz,
 primary key(request_id,bucket,path)
);
-- Only explicitly reviewed personal records are deleted. Merely having a user-ID
-- column never makes a table eligible for automatic deletion.
create table account_erasure_private.delete_rules(position integer primary key,schema_name text,table_name text,field text);
insert into account_erasure_private.delete_rules values
 (10,'public','private_form_drafts','user_id'),(20,'public','project_drafts','user_id'),
 (30,'public','message_reads','user_id'),(40,'public','favorites','user_id'),
 (50,'public','external_profiles','user_id'),(60,'public','notifications','user_id'),
 (70,'public','user_roles','user_id'),(80,'public','profile_views','viewer_id'),
 (90,'public','profile_view_daily','viewer_id'),(100,'public','profile_image_likes','liker_id'),
 (110,'public','profile_image_ratings','reviewer_id'),(120,'public','listing_likes','liker_id'),
 (130,'public','listing_ratings','liker_id'),(140,'public','workspace_team_preferences','user_id'),
 (150,'public','work_mail_oauth_states','owner_id'),
 (160,'native_push_private','deliveries','recipient_id'),(170,'native_push_private','installations','user_id'),
 (180,'profile_art_private','profile_saves','user_id'),(190,'profile_art_private','operations','user_id'),
 (200,'profile_art_private','leases','user_id'),(210,'profile_art_private','slots','user_id'),(220,'profile_art_private','claims','user_id');
create table account_erasure_private.guarded_tables(schema_name text,table_name text,fields text[] not null,primary key(schema_name,table_name));
create function account_erasure_private.write_guard() returns trigger
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare account text; field text;
begin
 foreach field in array tg_argv loop
  account=to_jsonb(new)->>field;
  if account is null then continue; end if;
  if not pg_try_advisory_xact_lock(hashtextextended('account-erasure:'||account,0)) then raise exception 'busy' using errcode='PT409'; end if;
  if exists(select 1 from account_erasure_private.requests where owner_id=account) then
   raise exception 'erasure_pending' using errcode='PT409';
  end if;
 end loop;
 return new;
end $$;
do $$ declare r record; begin
 for r in select n.nspname schema_name,c.relname table_name,array_agg(a.attname::text order by a.attname) fields,
  string_agg(quote_literal(a.attname),',' order by a.attname) args
 from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped
 where c.relkind='r' and n.nspname in('public','profile_art_private','native_push_private','shots_private','content_translation_private')
 and c.relname<>'user_settings' and a.atttypid in('text'::regtype,'varchar'::regtype)
 and a.attname in('user_id','owner_id','owner_user_id','author_id','author_user_id','sender_id','receiver_id','applicant_id','created_by','claimed_by',
 'recipient_id','reviewer_id','reporter_id','liker_id','viewer_id','profile_id','actor_user_id','provider_user_id','responsible_user_id',
 'blocker_id','blocked_id','recipient_user_id','invited_by','accepted_by','submitted_by','reviewed_by','last_editor_id','last_actor_user_id',
 'support_user_id','updated_by','requested_by','decided_by','granted_by','original_author_user_id','actor')
 group by n.nspname,c.relname loop
 insert into account_erasure_private.guarded_tables values(r.schema_name,r.table_name,r.fields);
 execute format('create trigger account_erasure_activity before insert or update on %I.%I for each row execute function account_erasure_private.write_guard(%s)',r.schema_name,r.table_name,r.args);
 end loop;
end $$;
create function account_erasure_private.visibility_guard() returns trigger
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare account text;
begin
 account=case when tg_op='DELETE' then old.user_id else new.user_id end;
 if not pg_try_advisory_xact_lock(hashtextextended('account-erasure:'||account,0)) then raise exception 'busy' using errcode='PT409'; end if;
 if exists(select 1 from account_erasure_private.requests where owner_id=account) then
  if tg_op='DELETE' then raise exception 'erasure_tombstone_required' using errcode='PT409'; end if;
  new.ghost_mode=true;new.profile_visibility='private';new.show_in_home_crew=false;
 end if;
 if tg_op='DELETE' then return old; end if; return new;
end $$;
create trigger account_erasure_visibility before insert or update or delete on public.user_settings for each row execute function account_erasure_private.visibility_guard();
-- Prevent late uploads from recreating files after a worker's inventory. Storage
-- bytes are still removed through the Storage API, never by deleting SQL rows.
create function account_erasure_private.storage_guard() returns trigger
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare account text;
begin
 if new.bucket_id='protected-media' then
  account=(regexp_match(new.name,'^(?:(?:profile-media/avatars|profile-media|avatars)/)?([A-Za-z0-9_-]{1,128})/[a-fA-F0-9]{32}\.(?:jpg|png|webp)$'))[1];
 elsif new.bucket_id='work-mail-private' then account=split_part(new.name,'/',1);
 elsif new.bucket_id='shots-ephemeral-v1' and to_regclass('shots_private.shots') is not null then
  execute 'select owner_id from shots_private.shots where id::text=$1' into account using split_part(new.name,'/',1);
 end if;
 if account is not null then
  if not pg_try_advisory_xact_lock(hashtextextended('account-erasure:'||account,0)) then raise exception 'busy' using errcode='PT409'; end if;
  if exists(select 1 from account_erasure_private.requests where owner_id=account) then raise exception 'erasure_pending' using errcode='PT409'; end if;
 end if;
 return new;
end $$;
create trigger account_erasure_storage before insert or update on storage.objects for each row execute function account_erasure_private.storage_guard();
create function account_erasure_private.translation_guard() returns trigger
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
begin
 if new.kind='profile' then
  if not pg_try_advisory_xact_lock(hashtextextended('account-erasure:'||new.source_id,0)) then raise exception 'busy' using errcode='PT409';end if;
  if exists(select 1 from account_erasure_private.requests where owner_id=new.source_id) then raise exception 'erasure_pending' using errcode='PT409';end if;
 end if;
 return new;
end $$;
do $$ begin
 if to_regclass('content_translation_private.cache') is not null then
  create trigger account_erasure_translation before insert or update on content_translation_private.cache for each row execute function account_erasure_private.translation_guard();
 end if;
end $$;
create function account_erasure_private.rate_guard() returns trigger
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
begin
 if exists(select 1 from account_erasure_private.requests r where r.owner_id=any(string_to_array(new.key,':'))
  or split_part(reverse(new.key),':',1)=any(select reverse(d) from unnest(r.rate_digests) d)) then
  raise exception 'erasure_pending' using errcode='PT409';
 end if;
 return new;
end $$;
do $$ begin
 if to_regclass('public.rate_limit_buckets') is not null then
  create trigger account_erasure_rate before insert or update on public.rate_limit_buckets for each row execute function account_erasure_private.rate_guard();
 end if;
end $$;
create function account_erasure_private.fingerprint() returns text language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 with relations as (
  select c.oid,n.nspname||'.'||c.relname name,c.relkind from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where c.relkind in('r','p') and (n.nspname in('public','profile_art_private','native_push_private','shots_private','content_translation_private') or(n.nspname='storage' and c.relname='objects'))
 ), parts as (
  select 'column:'||r.name||'.'||a.attname||':'||r.relkind::text||':'||a.atttypid||':'||a.attnotnull value
  from relations r join pg_attribute a on a.attrelid=r.oid and a.attnum>0 and not a.attisdropped
  union all
  -- A new cascade can delete someone else's records without adding a column.
  select 'constraint:'||r.name||':'||k.conname||':'||pg_get_constraintdef(k.oid)
  from relations r join pg_constraint k on k.conrelid=r.oid or k.confrelid=r.oid
  union all
  -- Changed/disabled triggers, including late translation/rate guards, also stop work.
  select 'trigger:'||r.name||':'||t.tgname||':'||t.tgenabled::text||':'||pg_get_triggerdef(t.oid)||':'||pg_get_functiondef(t.tgfoid)
  from relations r join pg_trigger t on t.tgrelid=r.oid and not t.tgisinternal
 ) select md5(coalesce(string_agg(value,',' order by value),'')) from parts;
$$;
create table account_erasure_private.schema_review(fingerprint text not null);
insert into account_erasure_private.schema_review values(account_erasure_private.fingerprint());
create function account_erasure_private.inventory(account text) returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare resource record; predicate text; matched bigint; result jsonb='[]';
begin
 for resource in select * from account_erasure_private.guarded_tables order by schema_name,table_name loop
  select string_agg(format('%I=$1',field),' or ') into predicate from unnest(resource.fields) field;
  execute format('select count(*) from %I.%I where %s',resource.schema_name,resource.table_name,predicate) into matched using account;
  if matched>0 then result=result||jsonb_build_array(jsonb_build_object('schema',resource.schema_name,'table',resource.table_name,'matchingRows',matched));end if;
 end loop;
 if to_regclass('public.rate_limit_buckets') is not null then
  execute 'select count(*) from public.rate_limit_buckets where $1=any(string_to_array(key,'':'')) or split_part(reverse(key),'':'',1)=any(select reverse(d) from account_erasure_private.requests r,unnest(r.rate_digests) d where r.owner_id=$1)' into matched using account;
  if matched>0 then result=result||jsonb_build_array(jsonb_build_object('schema','public','table','rate_limit_buckets','matchingRows',matched));end if;
 end if;
 select count(*) into matched from storage.objects where account=any(string_to_array(name,'/'));
 if matched>0 then result=result||jsonb_build_array(jsonb_build_object('schema','storage','table','objects','matchingRows',matched));end if;
 select count(*) into matched from account_erasure_private.policy_history where snapshot->>'updated_by'=account;
 if matched>0 then result=result||jsonb_build_array(jsonb_build_object('schema','account_erasure_private','table','policy_history','matchingRows',matched));end if;
 select count(*) into matched from account_erasure_private.policy where updated_by=account;
 if matched>0 then result=result||jsonb_build_array(jsonb_build_object('schema','account_erasure_private','table','policy','matchingRows',matched));end if;
 return result;
end $$;
create function account_erasure_private.summary(r account_erasure_private.requests) returns jsonb language sql immutable set search_path=pg_catalog,pg_temp as $$
 select jsonb_build_object('id',r.id,'state',r.state,'requestedAt',r.requested_at);
$$;
create function public.account_erasure(p_actor text,p_action text,p_id uuid default null,p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp set lock_timeout='2s' as $$
declare r account_erasure_private.requests%rowtype; cfg account_erasure_private.policy%rowtype; resource record;
 result jsonb; cursor_row account_erasure_private.requests%rowtype; days integer;
begin
 if p_actor is null or p_actor !~ '^[A-Za-z0-9_-]{3,128}$' or jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'invalid' using errcode='PT400';end if;
 select * into cfg from account_erasure_private.policy where singleton;
 if p_action='policy_read' then return to_jsonb(cfg);end if;
 if p_action='policy_save' then
  if p_payload->>'revision' is distinct from cfg.revision::text or jsonb_typeof(p_payload->'enabled') is distinct from 'boolean' then raise exception 'conflict' using errcode='PT409';end if;
  update account_erasure_private.policy set enabled=(p_payload->>'enabled')::boolean,evidence=p_payload->>'evidence',valid_until=(p_payload->>'validUntil')::timestamptz,
   backup_days=(p_payload->>'backupDays')::integer,provider_days=(p_payload->>'providerDays')::integer,receipt_days=(p_payload->>'receiptDays')::integer,
   revision=revision+1,updated_by=p_actor,updated_at=clock_timestamp() where singleton and revision=cfg.revision returning * into cfg;
  if not found then raise exception 'conflict' using errcode='PT409';end if;
  if cfg.enabled and (cfg.valid_until<=clock_timestamp() or cfg.valid_until>clock_timestamp()+interval '1 year') then raise exception 'invalid' using errcode='PT400';end if;
  insert into account_erasure_private.policy_history(revision,snapshot) values(cfg.revision,to_jsonb(cfg));
  return to_jsonb(cfg);
 end if;
 if p_action in('request','external_deleted') then
  if not pg_try_advisory_xact_lock(hashtextextended('account-erasure:'||p_actor,0)) then raise exception 'busy' using errcode='PT409';end if;
  insert into account_erasure_private.requests(owner_id,source) values(p_actor,case when p_action='external_deleted' then 'clerk_webhook' else 'self_service' end)
   on conflict(owner_id) do nothing returning * into r;
  if found then insert into account_erasure_private.events(request_id,actor_id,action) values(r.id,p_actor,'requested');
  else select * into r from account_erasure_private.requests where owner_id=p_actor for update nowait;end if;
  insert into public.user_settings(user_id,ghost_mode,profile_visibility,show_in_home_crew) values(p_actor,true,'private',false)
   on conflict(user_id) do update set ghost_mode=true,profile_visibility='private',show_in_home_crew=false;
  if p_action='external_deleted' and r.identity_deleted_at is null then
   update account_erasure_private.requests set identity_deleted_at=clock_timestamp(),updated_at=clock_timestamp(),revision=revision+1 where id=r.id returning * into r;
   insert into account_erasure_private.events(request_id,actor_id,action) values(r.id,p_actor,'external_identity_deleted');
  end if;
  return account_erasure_private.summary(r);
 end if;
 if p_action='read_own' then select * into r from account_erasure_private.requests where owner_id=p_actor;return case when found then account_erasure_private.summary(r) else null end;end if;
 if p_action='list' then
  if p_id is not null then select * into cursor_row from account_erasure_private.requests where id=p_id;if not found then raise exception 'invalid_cursor' using errcode='PT400';end if;end if;
  select coalesce(jsonb_agg(to_jsonb(rows)),'[]') into result from(
   select id,owner_id,state,requested_at,response_due_at,revision,reason,attempts,active_removed_at,completed_at from account_erasure_private.requests
   where p_id is null or(requested_at,id)>(cursor_row.requested_at,cursor_row.id) order by requested_at,id limit 51) rows;return result;
 end if;
 if p_action='claim' then
  if not cfg.enabled or cfg.valid_until<=clock_timestamp() then return jsonb_build_object('disabled',true);end if;
  -- Completed receipts expire only according to the reviewed policy snapshot.
  for r in select * from account_erasure_private.requests where state='completed' and purge_after<=clock_timestamp() limit 20 for update skip locked loop
   delete from account_erasure_private.requests where id=r.id;
   delete from public.user_settings where user_id=r.owner_id;
  end loop;
  select * into r from account_erasure_private.requests where (state in('pending','running','waiting') or(state='needs_review' and alerted_at is null)) and due_at<=clock_timestamp()
   and(lease_until is null or lease_until<=clock_timestamp()) and(p_id is null or id=p_id)
   and(state<>'waiting' or active_notice_at is null or clock_timestamp()>=active_removed_at+make_interval(days=>greatest(backup_days,provider_days,cfg.backup_days,cfg.provider_days))) order by requested_at limit 1 for update skip locked;
  if not found then return null;end if;
  update account_erasure_private.requests set lease=gen_random_uuid(),lease_until=clock_timestamp()+interval '4 minutes',attempts=attempts+1,
   state=case when state in('waiting','needs_review') then state else 'running' end,policy_revision=coalesce(policy_revision,cfg.revision),
   backup_days=greatest(backup_days,cfg.backup_days),provider_days=greatest(provider_days,cfg.provider_days),receipt_days=greatest(receipt_days,cfg.receipt_days),
   revision=revision+1,updated_at=clock_timestamp() where id=r.id returning * into r;
  return jsonb_build_object('id',r.id,'ownerId',r.owner_id,'token',r.lease,'state',r.state,'identityDeleted',r.identity_deleted_at is not null,'identityReady',r.identity_ready_at is not null);
 end if;
 select * into r from account_erasure_private.requests where id=p_id for update nowait;
 if not found then raise exception 'not_found' using errcode='PT404';end if;
 if p_action='admin_read' then return (to_jsonb(r)-'lease'-'notification_email')||jsonb_build_object('inventory',account_erasure_private.inventory(r.owner_id));end if;
 if p_action='retry' then
  if p_payload->>'revision' is distinct from r.revision::text or r.state not in('needs_review','pending') then raise exception 'conflict' using errcode='PT409';end if;
  update account_erasure_private.requests set state=case when active_removed_at is null then 'pending' else 'waiting' end,reason=null,attempts=0,alerted_at=null,due_at=clock_timestamp(),revision=revision+1 where id=r.id;
  insert into account_erasure_private.events(request_id,actor_id,action) values(r.id,p_actor,'retry');return jsonb_build_object('queued',true);
 end if;
 if r.lease::text is distinct from p_payload->>'token' or r.lease_until<=clock_timestamp() or r.state not in('running','waiting','needs_review') then raise exception 'conflict' using errcode='PT409';end if;
 if p_action='alert_sent' and r.state='needs_review' then
  update account_erasure_private.requests set alerted_at=clock_timestamp(),lease=null,lease_until=null where id=r.id;return '{}';
 end if;
 if p_action='continue' then
  update account_erasure_private.requests set lease=null,lease_until=null,due_at=clock_timestamp(),attempts=0 where id=r.id;return '{}';
 end if;
 if p_action='failed' then
  update account_erasure_private.requests set state=case when attempts>=8 then 'needs_review' else state end,
   reason='worker_unavailable',lease=null,lease_until=null,due_at=clock_timestamp()+make_interval(secs=>least(3600,30*power(2,least(attempts,7)))::integer),revision=revision+1 where id=r.id;
  insert into account_erasure_private.events(request_id,actor_id,action) values(r.id,p_actor,'worker_unavailable');return '{}';
 end if;
 if p_action='review_required' then
  if p_payload->>'reason' is null or p_payload->>'reason' not in('account_data_remaining','legacy_media','schema_changed','provider_review') then raise exception 'invalid' using errcode='PT400';end if;
  update account_erasure_private.requests set state='needs_review',reason=p_payload->>'reason',alerted_at=null,due_at=clock_timestamp(),lease=null,lease_until=null,revision=revision+1 where id=r.id;
  insert into account_erasure_private.events(request_id,actor_id,action,detail) values(r.id,p_actor,'review_required',jsonb_build_object('reason',p_payload->>'reason'));return '{}';
 end if;
 if not cfg.enabled or cfg.valid_until<=clock_timestamp() then raise exception 'policy_required' using errcode='PT409';end if;
 -- Drift and disabled safety triggers prevent automated deletion, not just its acknowledgement.
 if not exists(select 1 from account_erasure_private.schema_review where fingerprint=account_erasure_private.fingerprint())
 or exists(select 1 from account_erasure_private.guarded_tables g where not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
  where n.nspname=g.schema_name and c.relname=g.table_name and t.tgname='account_erasure_activity' and t.tgenabled in('O','A')))
 or not exists(select 1 from pg_trigger where tgrelid='public.user_settings'::regclass and tgname='account_erasure_visibility' and tgenabled in('O','A'))
 or not exists(select 1 from pg_trigger where tgrelid='storage.objects'::regclass and tgname='account_erasure_storage' and tgenabled in('O','A')) then
  return jsonb_build_object('review','schema_changed');
 end if;
 if p_action='prepare' then
  -- Legacy originals/CDN copies need their separately verified cutover. Shared
  -- canonical parents are never reclassified merely because the uploader leaves.
  if exists(select 1 from public.media_assets where owner_user_id=r.owner_id and (legacy_reference is not null or source_type not in('profile','project_draft')))
   or exists(select 1 from public.profiles p where p.user_id=r.owner_id and
    jsonb_build_array(p.avatar_url,p.cover_image_url,p.portfolio_images,p.profile_images)::text ~ 'https?://') then
   return jsonb_build_object('review','legacy_media');
  end if;
  insert into account_erasure_private.files(request_id,bucket,path)
   select r.id,'protected-media',storage_path from public.media_assets where owner_user_id=r.owner_id on conflict do nothing;
  -- Exact owner segment only, including unbound files left by interrupted uploads.
  insert into account_erasure_private.files(request_id,bucket,path)
   select r.id,'protected-media',o.name from storage.objects o where o.bucket_id='protected-media'
   and (regexp_match(o.name,'^(?:(?:profile-media/avatars|profile-media|avatars)/)?([A-Za-z0-9_-]{1,128})/[a-fA-F0-9]{32}\.(?:jpg|png|webp)$'))[1]=r.owner_id
   and not exists(select 1 from public.media_assets m where m.storage_path=o.name and m.owner_user_id<>r.owner_id) on conflict do nothing;
  select coalesce(jsonb_agg(jsonb_build_object('bucket',bucket,'path',path)),'[]') into result from(
   select bucket,path from account_erasure_private.files where request_id=r.id and removed_at is null order by path limit 100) f;
  return jsonb_build_object('files',result);
 end if;
 if p_action='files_removed' then
  if jsonb_typeof(p_payload->'paths') is distinct from 'array' or jsonb_array_length(p_payload->'paths')>100 then raise exception 'invalid' using errcode='PT400';end if;
  -- Independently confirm absence in the storage catalogue after the Storage API.
  if exists(select 1 from account_erasure_private.files f join storage.objects o on o.bucket_id=f.bucket and o.name=f.path
   where f.request_id=r.id and p_payload->'paths' ? f.path) then raise exception 'storage_remaining' using errcode='PT409';end if;
  update account_erasure_private.files set removed_at=clock_timestamp() where request_id=r.id and p_payload->'paths' ? path;
  return '{}';
 end if;
 if p_action='cleanup' then
  if jsonb_typeof(p_payload->'rateDigests') is distinct from 'array' or jsonb_array_length(p_payload->'rateDigests')>2
   or exists(select 1 from jsonb_array_elements_text(p_payload->'rateDigests') d where d !~ '^[a-f0-9]{64}$') then raise exception 'invalid' using errcode='PT400';end if;
  update account_erasure_private.requests set rate_digests=array(select jsonb_array_elements_text(p_payload->'rateDigests')) where id=r.id;
  if to_regclass('public.rate_limit_buckets') is not null then
   execute 'delete from public.rate_limit_buckets where $1=any(string_to_array(key,'':'')) or split_part(reverse(key),'':'',1)=any(select reverse(d) from unnest($2::text[]) d) or window_end<clock_timestamp()-interval ''1 hour'''
    using r.owner_id,array(select jsonb_array_elements_text(p_payload->'rateDigests'));
  end if;
  if exists(select 1 from account_erasure_private.files where request_id=r.id and removed_at is null) then return jsonb_build_object('more',true);end if;
  -- Delete safe personal records; shared/business/audit/mail/shot records remain
  -- explicit exceptions. Never cascade a conversation or someone else's project.
  if to_regclass('profile_art_private.claims') is not null then
   execute 'update profile_art_private.artworks set state=''retired'' where id in(select artwork_id from profile_art_private.claims where user_id=$1)' using r.owner_id;
  end if;
  for resource in select * from account_erasure_private.delete_rules order by position loop
   if to_regclass(format('%I.%I',resource.schema_name,resource.table_name)) is not null then
    execute format('delete from %I.%I where %I=$1',resource.schema_name,resource.table_name,resource.field) using r.owner_id;
   end if;
  end loop;
  if to_regclass('content_translation_private.cache') is not null then
   execute 'delete from content_translation_private.cache where kind=''profile'' and source_id=$1' using r.owner_id;
  end if;
  if to_regclass('content_translation_private.usage') is not null then
   execute 'delete from content_translation_private.usage where principal=encode(sha256(convert_to(''content-translation:''||day::text||'':''||$1,''UTF8'')),''hex'')' using r.owner_id;
  end if;
  delete from public.media_assets where owner_user_id=r.owner_id and (source_type is null or source_type in('profile','project_draft'))
   and exists(select 1 from account_erasure_private.files f where f.request_id=r.id and f.path=storage_path and f.removed_at is not null);
  delete from public.profiles where user_id=r.owner_id;
  result=account_erasure_private.inventory(r.owner_id);
  if jsonb_array_length(result)>0 then return jsonb_build_object('review','account_data_remaining');end if;
  return jsonb_build_object('ready',true);
 end if;
 if p_action='identity_prepare' then
  if jsonb_array_length(account_erasure_private.inventory(r.owner_id))>0 then raise exception 'data_remaining' using errcode='PT409';end if;
  if p_payload->>'email' is null or length(p_payload->>'email') not between 3 and 254 or p_payload->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+$'
   or p_payload->>'locale' is null or p_payload->>'locale' not in('de','en','es','it','cs','hu','nl','nl-BE','sv','fr','pl','pt-PT','zh-Hans','ja','ko','ru','uk') then raise exception 'invalid' using errcode='PT400';end if;
  update account_erasure_private.requests set identity_ready_at=coalesce(identity_ready_at,clock_timestamp()),notification_email=p_payload->>'email',notification_locale=p_payload->>'locale' where id=r.id;
  return '{}';
 end if;
 if p_action='identity_deleted' then
  if r.identity_ready_at is null then raise exception 'provider_review' using errcode='PT409';end if;
  if jsonb_array_length(account_erasure_private.inventory(r.owner_id))>0 or exists(select 1 from account_erasure_private.files where request_id=r.id and removed_at is null) then raise exception 'data_remaining' using errcode='PT409';end if;
  update account_erasure_private.requests set identity_deleted_at=coalesce(identity_deleted_at,clock_timestamp()),active_removed_at=coalesce(active_removed_at,clock_timestamp()),
   state='waiting',lease=null,lease_until=null,due_at=clock_timestamp(),reason=null,revision=revision+1 where id=r.id;
  insert into account_erasure_private.events(request_id,actor_id,action) values(r.id,p_actor,'active_removed');return jsonb_build_object('state','waiting');
 end if;
 if p_action='notice' and r.state='waiting' then
  if r.notification_email is null or r.active_removed_at is null then raise exception 'notice_missing' using errcode='PT409';end if;
  if jsonb_array_length(account_erasure_private.inventory(r.owner_id))>0 then return jsonb_build_object('review','account_data_remaining');end if;
  return jsonb_build_object('email',r.notification_email,'locale',r.notification_locale,'kind',case when r.active_notice_at is null then 'active' else 'complete' end,
   'ready',r.active_notice_at is null or clock_timestamp()>=r.active_removed_at+make_interval(days=>greatest(r.backup_days,r.provider_days,cfg.backup_days,cfg.provider_days)));
 end if;
 if p_action='notice_sent' and r.state='waiting' then
  if p_payload->>'kind'='active' and r.active_notice_at is null then
   update account_erasure_private.requests set active_notice_at=clock_timestamp(),due_at=active_removed_at+make_interval(days=>greatest(backup_days,provider_days)),lease=null,lease_until=null,attempts=0 where id=r.id;
   return jsonb_build_object('state','waiting');
  end if;
  if p_payload->>'kind' is distinct from 'complete' or r.active_notice_at is null or clock_timestamp()<r.active_removed_at+make_interval(days=>greatest(r.backup_days,r.provider_days,cfg.backup_days,cfg.provider_days)) then raise exception 'not_due' using errcode='PT409';end if;
  update account_erasure_private.requests set state='completed',completed_at=clock_timestamp(),purge_after=clock_timestamp()+make_interval(days=>receipt_days),notification_email=null,lease=null,lease_until=null,revision=revision+1 where id=r.id;
  delete from account_erasure_private.files where request_id=r.id;
  insert into account_erasure_private.events(request_id,actor_id,action) values(r.id,p_actor,'completed');return jsonb_build_object('state','completed');
 end if;
 raise exception 'invalid_action' using errcode='PT400';
exception when lock_not_available then raise exception 'busy' using errcode='PT409';
end $$;
do $$ declare tab record;begin
 for tab in select tablename from pg_tables where schemaname='account_erasure_private' loop
  execute format('alter table account_erasure_private.%I enable row level security',tab.tablename);
 end loop;
end $$;
revoke all on all tables in schema account_erasure_private from public,anon,authenticated,service_role;
revoke all on all sequences in schema account_erasure_private from public,anon,authenticated,service_role;
revoke all on all functions in schema account_erasure_private from public,anon,authenticated,service_role;
revoke all on function public.account_erasure(text,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.account_erasure(text,text,uuid,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
