-- UNPUBLISHED PROTOTYPE: DO NOT APPLY before HTTP/native integration and full
-- rights review. See docs/workspace-team-channels.md for missing dependencies.
-- PREPARED ONLY. No import of local Workspace archives and no push activation.
-- Clerk identity is verified by the server. Only service_role may call the
-- public entry points; clients cannot supply a database actor directly.
begin;
create schema workspace_private;
revoke all on schema workspace_private from public, anon, authenticated, service_role;

create table workspace_private.teams (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null,
  name text not null check (length(btrim(name)) between 1 and 80),
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default clock_timestamp()
);
create table workspace_private.team_members (
  team_id uuid not null references workspace_private.teams(id) on delete cascade,
  user_id text not null,
  role text not null check (role in ('owner','admin','member')),
  status text not null check (status in ('invited','active','removed')),
  active_since timestamptz,
  primary key(team_id,user_id),
  check (status <> 'active' or active_since is not null)
);
create index workspace_members_by_account on workspace_private.team_members(user_id,team_id)
  where status in ('invited','active');
create table workspace_private.channels (
  conversation_id uuid primary key references public.conversations(id) on delete cascade,
  team_id uuid not null references workspace_private.teams(id) on delete cascade,
  visibility text not null check (visibility in ('team','restricted')),
  join_policy text not null check (join_policy in ('open','invited')),
  write_policy text not null check (write_policy in ('participants','admins'))
);
create index workspace_channels_by_team on workspace_private.channels(team_id,conversation_id);
create table workspace_private.channel_grants (
  conversation_id uuid not null references workspace_private.channels(conversation_id) on delete cascade,
  user_id text not null,
  access text not null check (access in ('allowed','denied')),
  can_write boolean not null default true,
  primary key(conversation_id,user_id)
);
create table workspace_private.operations (
  actor text not null,
  request_key text not null,
  fingerprint bytea not null,
  team_id uuid not null references workspace_private.teams(id),
  result jsonb not null,
  primary key(actor,request_key)
);
-- Personal display preference only. Never copied to another account or used
-- as membership/visibility authority. Missing preference means no opt-in.
create table workspace_private.inbox_preferences (
  user_id text primary key,
  show_team_conversations boolean not null default false,
  revision bigint not null default 0 check (revision >= 0)
);
alter table workspace_private.teams enable row level security;
alter table workspace_private.team_members enable row level security;
alter table workspace_private.channels enable row level security;
alter table workspace_private.channel_grants enable row level security;
alter table workspace_private.operations enable row level security;
alter table workspace_private.inbox_preferences enable row level security;
revoke all on all tables in schema workspace_private from public,anon,authenticated,service_role;

-- Metadata administration is independent of participation. Explicit denial also
-- stops an admin from joining/reading; administrative repair remains possible.
create function workspace_private.channel_rights(actor text, conversation uuid)
returns table(team_id uuid, visible boolean, eligible boolean, reading boolean,
  writing boolean, managing boolean, history_from timestamptz)
language sql stable security definer set search_path='' as $$
  with rights as (
    select ch.team_id, cm.joined_at, cm.left_at, tm.active_since,
      coalesce(tm.status='active',false) active,
      coalesce(tm.status='active' and tm.role in ('owner','admin'),false) manager,
      coalesce(g.access='denied',false) denied,
      (ch.visibility='team' or coalesce(g.access='allowed',false)) discoverable,
      (ch.join_policy='open' or coalesce(g.access='allowed',false)) joinable,
      ch.write_policy, coalesce(g.can_write,true) person_write
    from workspace_private.channels ch
    left join workspace_private.team_members tm on tm.team_id=ch.team_id and tm.user_id=actor
    left join workspace_private.channel_grants g on g.conversation_id=ch.conversation_id and g.user_id=actor
    left join public.conversation_members cm on cm.conversation_id=ch.conversation_id and cm.user_id=actor
    where ch.conversation_id=conversation
  ), allowed as (
    select *, active and not denied and (manager or (discoverable and joinable)) may_join
    from rights
  ), participation as (
    select *, may_join and joined_at is not null and left_at is null
      and joined_at>=active_since may_read from allowed
  )
  select team_id, active and (manager or (not denied and discoverable)), may_join,
    may_read, may_read and person_write and (write_policy='participants' or manager),
    manager, case when may_read then greatest(joined_at,active_since) end
  from participation;
$$;

create function workspace_private.lock_channel(conversation uuid)
returns uuid language plpgsql security definer set search_path='' set lock_timeout='2s' as $$
declare team uuid;
begin
  select ch.team_id into team from workspace_private.channels ch where ch.conversation_id=conversation;
  if team is not null then perform 1 from workspace_private.teams t where t.id=team for update; end if;
  return team;
end $$;

create function workspace_private.assert_channel(actor text, conversation uuid, permission text)
returns void language plpgsql security definer set search_path='' set lock_timeout='2s' as $$
declare team uuid; r record;
begin
  team:=workspace_private.lock_channel(conversation);
  if team is null then return; end if; -- Existing non-team authorization stays authoritative.
  select * into r from workspace_private.channel_rights(actor,conversation);
  if not coalesce(case permission when 'read' then r.reading when 'write' then r.writing else false end,false) then
    raise exception using errcode='PT404',message='messaging_unavailable';
  end if;
end $$;

create function workspace_private.reconcile(team uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  -- Called while holding the team row lock. Rights withdrawal and loss of
  -- active participation commit together; restoring grants never rejoins.
  update public.conversation_members cm set left_at=clock_timestamp()
  from workspace_private.channels ch
  where ch.team_id=team and ch.conversation_id=cm.conversation_id and cm.left_at is null
    and not exists(select 1 from workspace_private.channel_rights(cm.user_id,cm.conversation_id) r where r.reading);
end $$;

create function public.workspace_conversation_access(p_actor text,p_conversations uuid[])
returns table(conversation_id uuid,team_id uuid,can_read boolean,can_write boolean,
  can_manage boolean,history_from timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if p_actor is null or p_actor !~ '^[A-Za-z0-9_-]{1,128}$'
    or coalesce(cardinality(p_conversations),0)>200 then
    raise exception using errcode='22023',message='messaging_invalid';
  end if;
  return query
  select c.id, case when r.visible then r.team_id end,
    case when ch.conversation_id is null then
      cm.user_id is not null and cm.left_at is null and (c.kind<>'support' or c.receiver_id=p_actor)
      else coalesce(r.reading,false) end,
    case when ch.conversation_id is null then
      cm.user_id is not null and cm.left_at is null and (c.kind<>'support' or c.receiver_id=p_actor)
      else coalesce(r.writing,false) end,
    -- Generic group management is deliberately unavailable for team channels.
    coalesce(ch.conversation_id is null and c.kind='group' and cm.left_at is null and cm.role='admin',false),
    case when ch.conversation_id is null then cm.joined_at else r.history_from end
  from public.conversations c
  left join public.conversation_members cm on cm.conversation_id=c.id and cm.user_id=p_actor
  left join workspace_private.channels ch on ch.conversation_id=c.id
  left join lateral workspace_private.channel_rights(p_actor,c.id) r on true
  where c.id=any(p_conversations);
end $$;
revoke all on function public.workspace_conversation_access(text,uuid[]) from public,anon,authenticated;
grant execute on function public.workspace_conversation_access(text,uuid[]) to service_role;

create function public.workspace_inbox_preference_v1(
  p_actor text,p_show boolean default null,p_expected bigint default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare preference workspace_private.inbox_preferences;
begin
  if p_actor is null or p_actor !~ '^[A-Za-z0-9_-]{1,128}$' or p_actor='cinegenius-support' then
    raise exception using errcode='22023',message='messaging_invalid'; end if;
  if p_show is not null then
    if p_expected is null or p_expected<0 then
      raise exception using errcode='22023',message='messaging_invalid'; end if;
    if not pg_try_advisory_xact_lock(hashtextextended('workspace-inbox:'||p_actor,0)) then
      raise exception using errcode='PT409',message='messaging_busy'; end if;
    insert into workspace_private.inbox_preferences(user_id) values(p_actor) on conflict do nothing;
    select * into preference from workspace_private.inbox_preferences where user_id=p_actor;
    if preference.revision<>p_expected then
      raise exception using errcode='PT409',message='workspace_version_conflict'; end if;
    if preference.show_team_conversations<>p_show then
      update workspace_private.inbox_preferences set show_team_conversations=p_show,revision=revision+1
        where user_id=p_actor returning * into preference;
    end if;
  else
    if p_expected is not null then raise exception using errcode='22023',message='messaging_invalid'; end if;
    select * into preference from workspace_private.inbox_preferences where user_id=p_actor;
  end if;
  return jsonb_build_object('accountId',p_actor,
    'showTeamConversations',coalesce(preference.show_team_conversations,false),
    'revision',coalesce(preference.revision,0));
end $$;
revoke all on function public.workspace_inbox_preference_v1(text,boolean,bigint) from public,anon,authenticated;
grant execute on function public.workspace_inbox_preference_v1(text,boolean,bigint) to service_role;

-- One predicate for a complete feed, its pagination and its unread counts.
-- A channel has one conversation ID and history, regardless of where shown.
create function workspace_private.feed_conversations(actor text,surface text,team uuid)
returns table(conversation_id uuid,updated_at timestamptz,history_from timestamptz,team_id uuid)
language sql stable security definer set search_path='' as $$
  select c.id,c.updated_at,cm.joined_at,ch.team_id
  from public.conversations c
  join public.conversation_members cm on cm.conversation_id=c.id and cm.user_id=actor and cm.left_at is null
  left join workspace_private.channels ch on ch.conversation_id=c.id
  where (c.kind<>'support' or c.receiver_id=actor)
    and (ch.conversation_id is null or exists(
      select 1 from workspace_private.channel_rights(actor,c.id) where reading))
    and ((surface='team' and ch.team_id=team)
      or (surface='community' and team is null and (ch.conversation_id is null or exists(
        select 1 from workspace_private.inbox_preferences where user_id=actor and show_team_conversations))));
$$;

create function public.workspace_conversation_page_v1(
  p_actor text,p_surface text,p_team uuid default null,p_after_at timestamptz default null,
  p_after_id uuid default null,p_limit integer default 50
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare page jsonb; counts jsonb; total bigint;
begin
  if p_actor is null or p_actor !~ '^[A-Za-z0-9_-]{1,128}$'
    or p_surface is null or p_surface not in ('community','team')
    or p_limit is null or p_limit not between 1 and 50
    or (p_after_at is null)<>(p_after_id is null)
    or (p_surface='team')<>(p_team is not null) then
    raise exception using errcode='22023',message='messaging_invalid'; end if;
  if p_surface='team' and not exists(select 1 from workspace_private.team_members
    where team_id=p_team and user_id=p_actor and status='active') then
    raise exception using errcode='PT404',message='messaging_unavailable'; end if;
  select coalesce(jsonb_agg(to_jsonb(entry) order by entry.updated_at desc,entry.id desc),'[]')
    into page from (
      select f.conversation_id id,f.updated_at,f.history_from,f.team_id
      from workspace_private.feed_conversations(p_actor,p_surface,p_team) f
      where p_after_at is null or (f.updated_at,f.conversation_id)<(p_after_at,p_after_id)
      order by f.updated_at desc,f.conversation_id desc limit p_limit+1
    ) entry;
  select count(*) into total from workspace_private.feed_conversations(p_actor,p_surface,p_team);
  select coalesce(jsonb_object_agg(entry.conversation_id,entry.n),'{}') into counts from (
    select f.conversation_id,count(*) n
    from workspace_private.feed_conversations(p_actor,p_surface,p_team) f
    join public.messages m on m.conversation_id=f.conversation_id and m.created_at>=f.history_from
    where m.sender_id<>p_actor and not exists(
      select 1 from public.message_reads mr where mr.message_id=m.id and mr.user_id=p_actor)
    group by f.conversation_id
  ) entry;
  return jsonb_build_object('conversations',case when jsonb_array_length(page)>p_limit then page-p_limit else page end,
    'nextCursor',case when jsonb_array_length(page)>p_limit then
      jsonb_build_object('updatedAt',page->(p_limit-1)->'updated_at','id',page->(p_limit-1)->'id') end,
    'total',total,'unreadByConversation',counts);
end $$;
revoke all on function public.workspace_conversation_page_v1(text,text,uuid,timestamptz,uuid,integer)
  from public,anon,authenticated;
grant execute on function public.workspace_conversation_page_v1(text,text,uuid,timestamptz,uuid,integer) to service_role;

create function public.workspace_teams_v1(p_actor text,p_action text,p jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='2s' as $$
declare
  team_row workspace_private.teams; actor_row workspace_private.team_members;
  target_row workspace_private.team_members; channel_row workspace_private.channels;
  operation workspace_private.operations; rights record; peer record;
  team uuid; channel uuid; target text; name text; after_id uuid; operation_key text;
  fingerprint bytea; output jsonb; result_rows jsonb; manager boolean; expected bigint;
begin
  if p_actor is null or p_actor !~ '^[A-Za-z0-9_-]{1,128}$' or p_actor='cinegenius-support'
    or p is null or jsonb_typeof(p)<>'object' or octet_length(p::text)>16000 then
    raise exception using errcode='22023',message='messaging_invalid';
  end if;
  team:=nullif(p->>'teamId','')::uuid;
  channel:=nullif(p->>'channelId','')::uuid;
  after_id:=nullif(p->>'after','')::uuid;
  if p_action='list' then
    select coalesce(jsonb_agg(to_jsonb(page) order by page.id),'[]') into result_rows from (
      select t.id,t.name,t.revision,m.role,m.status
      from workspace_private.teams t join workspace_private.team_members m on m.team_id=t.id
      where m.user_id=p_actor and m.status in ('active','invited') and (after_id is null or t.id>after_id)
      order by t.id limit 51
    ) page;
    return jsonb_build_object('teams',case when jsonb_array_length(result_rows)>50 then result_rows-50 else result_rows end,
      'nextAfter',case when jsonb_array_length(result_rows)>50 then result_rows->49->>'id' end);
  end if;
  if p_action is null or p_action not in ('team','create_team','invite_member','accept_invite','remove_member',
    'set_member_role','leave_team','create_channel','update_channel','set_channel_access',
    'join_channel','leave_channel') then
    raise exception using errcode='22023',message='messaging_invalid';
  end if;
  if p_action<>'team' then
    operation_key:=p->>'idempotencyKey';
    if operation_key is null or operation_key !~ '^[A-Za-z0-9_-]{8,128}$' then
      raise exception using errcode='22023',message='messaging_invalid';
    end if;
    if not pg_try_advisory_xact_lock(hashtextextended('workspace-operation:'||p_actor||':'||operation_key,0)) then
      raise exception using errcode='PT409',message='messaging_busy';
    end if;
    fingerprint:=sha256(convert_to(jsonb_build_object('action',p_action,'input',p)::text,'UTF8'));
    select * into operation from workspace_private.operations o where o.actor=p_actor and o.request_key=operation_key;
    if found then
      if operation.fingerprint<>fingerprint then raise exception using errcode='PT409',message='messaging_key_reused'; end if;
      team:=operation.team_id;
    end if;
  end if;
  if p_action='create_team' and operation.actor is null then
    name:=btrim(p->>'name');
    if jsonb_typeof(p->'name') is distinct from 'string' or coalesce(length(name),0) not between 1 and 80
      or name ~ '[[:cntrl:]]' then raise exception using errcode='22023',message='messaging_invalid'; end if;
    insert into workspace_private.teams(owner_id,name) values(p_actor,name) returning * into team_row;
    team:=team_row.id;
    insert into workspace_private.team_members(team_id,user_id,role,status,active_since)
      values(team,p_actor,'owner','active',clock_timestamp());
  else
    if p_action='team' then
      select * into team_row from workspace_private.teams t where t.id=team;
    else
      select * into team_row from workspace_private.teams t where t.id=team for update;
    end if;
    if not found then raise exception using errcode='PT404',message='messaging_unavailable'; end if;
  end if;
  select * into actor_row from workspace_private.team_members m where m.team_id=team and m.user_id=p_actor;
  if actor_row.status is distinct from 'active'
    and not coalesce(actor_row.status='invited' and p_action in ('team','accept_invite'),false) then
    -- A removed person may repeat their own leave acknowledgement, never read team data.
    if not coalesce(p_action='leave_team' and operation.actor=p_actor and actor_row.status='removed',false) then
      raise exception using errcode='PT404',message='messaging_unavailable';
    end if;
  end if;
  manager:=coalesce(actor_row.status='active' and actor_row.role in ('owner','admin'),false);
  if p_action in ('create_channel','update_channel','set_channel_access','invite_member','remove_member')
    and not manager then raise exception using errcode='42501',message='messaging_admin_required'; end if;
  if p_action='set_member_role' and actor_row.role is distinct from 'owner' then
    raise exception using errcode='42501',message='messaging_admin_required';
  end if;
  if p_action='team' then
    if actor_row.status='invited' then
      return jsonb_build_object('team',jsonb_build_object('id',team,'name',team_row.name,'revision',team_row.revision),
        'role',actor_row.role,'status','invited','channels','[]'::jsonb,'nextAfter',null);
    end if;
    select coalesce(jsonb_agg(to_jsonb(page) order by page.id),'[]') into result_rows from (
      select ch.conversation_id id,c.group_name name,ch.visibility,ch.join_policy,ch.write_policy,
        r.eligible can_join,r.reading joined,r.writing can_write,r.managing can_manage,r.history_from
      from workspace_private.channels ch join public.conversations c on c.id=ch.conversation_id
      cross join lateral workspace_private.channel_rights(p_actor,ch.conversation_id) r
      where ch.team_id=team and r.visible and (after_id is null or ch.conversation_id>after_id)
      order by ch.conversation_id limit 51
    ) page;
    return jsonb_build_object('team',jsonb_build_object('id',team,'name',team_row.name,'revision',team_row.revision),
      'role',actor_row.role,'status',actor_row.status,
      'channels',case when jsonb_array_length(result_rows)>50 then result_rows-50 else result_rows end,
      'nextAfter',case when jsonb_array_length(result_rows)>50 then result_rows->49->>'id' end);
  end if;
  if operation.actor is not null then
    -- Never replay a former channel grant after its withdrawal.
    if channel is not null and p_action in ('join_channel','leave_channel') then
      select * into rights from workspace_private.channel_rights(p_actor,channel);
      if not coalesce(rights.eligible,false) then raise exception using errcode='PT404',message='messaging_unavailable'; end if;
    end if;
    return operation.result||jsonb_build_object('replayed',true);
  end if;
  if p_action in ('invite_member','remove_member','set_member_role','create_channel','update_channel','set_channel_access') then
    if jsonb_typeof(p->'expectedVersion') is distinct from 'number'
      or (p->>'expectedVersion') !~ '^[1-9][0-9]{0,15}$' then
      raise exception using errcode='22023',message='messaging_invalid';
    end if;
    expected:=(p->>'expectedVersion')::bigint;
    if expected<>team_row.revision then raise exception using errcode='PT409',message='workspace_version_conflict'; end if;
  end if;
  if p_action in ('invite_member','remove_member','set_member_role','set_channel_access') then
    target:=p->>'targetUserId';
    if target is null or target !~ '^[A-Za-z0-9_-]{1,128}$' or target='cinegenius-support' then
      raise exception using errcode='22023',message='messaging_invalid';
    end if;
    select * into target_row from workspace_private.team_members m where m.team_id=team and m.user_id=target;
  end if;
  if p_action='invite_member' then
    if target=p_actor then raise exception using errcode='22023',message='messaging_invalid'; end if;
    if target_row.status='active' then raise exception using errcode='PT409',message='workspace_already_member'; end if;
    if not exists(select 1 from public.profiles where user_id=target) then
      raise exception using errcode='PT404',message='messaging_member_unavailable'; end if;
    perform public.messaging_assert_group_pair(p_actor,p_actor,target);
    if (select count(*) from workspace_private.team_members where team_id=team and status in ('active','invited'))>=500
      and target_row.status is distinct from 'invited' then
      raise exception using errcode='PT409',message='workspace_team_full'; end if;
    insert into workspace_private.team_members(team_id,user_id,role,status)
      values(team,target,'member','invited')
      on conflict(team_id,user_id) do update set role='member',status='invited',active_since=null;
  elsif p_action='accept_invite' then
    if actor_row.status='invited' then
      perform public.messaging_assert_pair(p_actor,team_row.owner_id,false,false);
      update workspace_private.team_members set status='active',active_since=clock_timestamp()
        where team_id=team and user_id=p_actor;
    end if;
  elsif p_action in ('remove_member','set_member_role') then
    if target_row.user_id is null or target_row.status='removed' then
      raise exception using errcode='PT404',message='messaging_member_unavailable'; end if;
    if target=team_row.owner_id or (actor_row.role<>'owner' and target_row.role in ('owner','admin')) then
      raise exception using errcode='42501',message='messaging_admin_required'; end if;
    if p_action='remove_member' then
      update workspace_private.team_members set status='removed' where team_id=team and user_id=target;
    else
      if p->>'role' not in ('admin','member') or p->>'role' is null or target_row.status<>'active' then
        raise exception using errcode='22023',message='messaging_invalid'; end if;
      update workspace_private.team_members set role=p->>'role' where team_id=team and user_id=target;
    end if;
  elsif p_action='leave_team' then
    if actor_row.role='owner' then raise exception using errcode='PT409',message='workspace_owner_cannot_leave'; end if;
    update workspace_private.team_members set status='removed' where team_id=team and user_id=p_actor;
  elsif p_action in ('create_channel','update_channel') then
    name:=btrim(p->>'name');
    if jsonb_typeof(p->'name') is distinct from 'string' or coalesce(length(name),0) not between 1 and 80
      or name ~ '[[:cntrl:]]'
      or coalesce(p->>'visibility','') not in ('team','restricted')
      or coalesce(p->>'joinPolicy','') not in ('open','invited')
      or coalesce(p->>'writePolicy','') not in ('participants','admins') then
      raise exception using errcode='22023',message='messaging_invalid'; end if;
    if p_action='create_channel' then
      if (select count(*) from workspace_private.channels where team_id=team)>=100 then
        raise exception using errcode='PT409',message='workspace_channels_full'; end if;
      insert into public.conversations(sender_id,receiver_id,kind,group_name,created_by)
        values(p_actor,null,'group',name,p_actor) returning id into channel;
      insert into workspace_private.channels values(channel,team,p->>'visibility',p->>'joinPolicy',p->>'writePolicy');
      -- Creating a channel explicitly joins its creator; team management is not a chat role.
      insert into public.conversation_members(conversation_id,user_id,role,joined_at)
        values(channel,p_actor,'member',clock_timestamp());
    else
      select * into channel_row from workspace_private.channels where conversation_id=channel and team_id=team;
      if not found then raise exception using errcode='PT404',message='messaging_unavailable'; end if;
      update workspace_private.channels set visibility=p->>'visibility',join_policy=p->>'joinPolicy',
        write_policy=p->>'writePolicy' where conversation_id=channel;
      update public.conversations set group_name=name,updated_at=clock_timestamp() where id=channel;
    end if;
  elsif p_action='set_channel_access' then
    if target_row.status is distinct from 'active' then raise exception using errcode='PT404',message='messaging_member_unavailable'; end if;
    if not exists(select 1 from workspace_private.channels where conversation_id=channel and team_id=team) then
      raise exception using errcode='PT404',message='messaging_unavailable'; end if;
    if coalesce(p->>'access','') not in ('allowed','denied','inherit')
      or jsonb_typeof(p->'canWrite') is distinct from 'boolean' then
      raise exception using errcode='22023',message='messaging_invalid'; end if;
    if p->>'access'='inherit' then
      delete from workspace_private.channel_grants where conversation_id=channel and user_id=target;
    else
      insert into workspace_private.channel_grants values(channel,target,p->>'access',(p->>'canWrite')::boolean)
        on conflict(conversation_id,user_id) do update set access=excluded.access,can_write=excluded.can_write;
    end if;
  elsif p_action in ('join_channel','leave_channel') then
    select * into rights from workspace_private.channel_rights(p_actor,channel) where team_id=team;
    if not found or not rights.eligible then raise exception using errcode='PT404',message='messaging_unavailable'; end if;
    if p_action='join_channel' and not rights.reading then
      if (select count(*) from public.conversation_members where conversation_id=channel and left_at is null)>=50 then
        raise exception using errcode='PT409',message='messaging_group_full'; end if;
      for peer in select user_id from public.conversation_members where conversation_id=channel and left_at is null order by user_id loop
        perform public.messaging_assert_group_pair(p_actor,p_actor,peer.user_id);
      end loop;
      insert into public.conversation_members(conversation_id,user_id,role,joined_at,left_at)
        values(channel,p_actor,'member',clock_timestamp(),null)
        on conflict(conversation_id,user_id) do update set role='member',joined_at=excluded.joined_at,left_at=null;
    elsif p_action='leave_channel' then
      update public.conversation_members set left_at=clock_timestamp()
        where conversation_id=channel and user_id=p_actor and left_at is null;
    end if;
  end if;
  perform workspace_private.reconcile(team);
  if p_action not in ('create_team','join_channel','leave_channel') then
    update workspace_private.teams set revision=revision+1 where id=team returning * into team_row;
  end if;
  output:=jsonb_build_object('teamId',team,'channelId',channel,'revision',team_row.revision,'replayed',false);
  insert into workspace_private.operations values(p_actor,operation_key,fingerprint,team,output);
  return output;
end $$;
revoke all on function public.workspace_teams_v1(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.workspace_teams_v1(text,text,jsonb) to service_role;

create function workspace_private.assert_draft(actor text, draft_key text)
returns void language plpgsql security definer set search_path='' as $$
declare conversation uuid;
begin
  if draft_key ~ '^message:(conversation|group):[0-9a-f-]{36}$' then
    conversation:=split_part(draft_key,':',3)::uuid;
    if exists(select 1 from workspace_private.channels where conversation_id=conversation) then
      if split_part(draft_key,':',2)='group' then
        raise exception using errcode='PT404',message='messaging_unavailable';
      end if;
      perform workspace_private.assert_channel(actor,conversation,'write');
    end if;
  end if;
end $$;

create function workspace_private.guard_group_management(actor text, conversation uuid, action text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if workspace_private.lock_channel(conversation) is null then return false; end if;
  if action<>'leave' then raise exception using errcode='42501',message='messaging_admin_required'; end if;
  perform workspace_private.assert_channel(actor,conversation,'read');
  update public.conversation_members set left_at=clock_timestamp()
    where conversation_id=conversation and user_id=actor and left_at is null;
  return true;
end $$;

-- Guard the existing RPCs rather than creating a second message writer. Each
-- insertion is checked against its known signature/body and fails migration
-- if the upstream contract changes. Both legacy and idempotent overloads stay
-- protected. Team locks precede existing conversation/member/operation locks.
do $guards$
declare item record; definition text; patched text;
begin
  for item in select * from (values
    ('public.send_conversation_message(uuid,text,text)',
     'perform workspace_private.assert_channel(p_sender_id,p_conversation_id,''write'');'),
    ('public.send_conversation_message(uuid,text,text,text)',
     'perform workspace_private.assert_channel(p_sender_id,p_conversation_id,''write'');'),
    ('public.send_message_with_attachments(text,text,text,uuid[],uuid,text,uuid,text,text)',
     'perform workspace_private.assert_channel(p_actor,p_conversation,''write'');'),
    ('public.hide_own_conversation_message(text,uuid,uuid)',
     'perform workspace_private.assert_channel(p_actor,p_conversation,''read'');'),
    ('public.save_private_form_draft(text,text,bigint,jsonb)',
     'perform workspace_private.assert_draft(p_user,p_key);'),
    ('public.manage_group_conversation(uuid,text,text,text,text)',
     'if workspace_private.guard_group_management(p_actor_id,p_conversation_id,p_action) then return; end if;')
  ) as guards(signature,guard) loop
    if to_regprocedure(item.signature) is null then raise exception 'Missing required messaging RPC %',item.signature; end if;
    definition:=pg_get_functiondef(to_regprocedure(item.signature));
    patched:=regexp_replace(definition,'\mBEGIN\M',E'BEGIN\n  '||item.guard,'i');
    if patched=definition then raise exception 'Unsupported messaging RPC body %',item.signature; end if;
    execute patched;
  end loop;
  definition:=pg_get_functiondef('public.messaging_operation_replay(text,text,jsonb)'::regprocedure);
  patched:=replace(definition,
    'PERFORM 1 FROM public.conversations WHERE id=operation.conversation_id FOR SHARE;',
    'PERFORM workspace_private.assert_channel(p_actor,operation.conversation_id,CASE WHEN operation.message_id IS NULL THEN ''read'' ELSE ''write'' END);
  PERFORM 1 FROM public.conversations WHERE id=operation.conversation_id FOR SHARE;');
  if patched=definition then raise exception 'Unsupported messaging replay body'; end if;
  execute patched;

  -- A creator can write in a newly created team channel before others join.
  -- Ordinary free group and direct-chat recipient checks remain unchanged.
  definition:=pg_get_functiondef('public.send_conversation_message(uuid,text,text)'::regprocedure);
  patched:=replace(definition,
    'IF NOT EXISTS(SELECT 1 FROM public.conversation_members WHERE conversation_id=p_conversation_id AND left_at IS NULL AND user_id<>p_sender_id) THEN',
    'IF NOT EXISTS(SELECT 1 FROM workspace_private.channels WHERE conversation_id=p_conversation_id) AND NOT EXISTS(SELECT 1 FROM public.conversation_members WHERE conversation_id=p_conversation_id AND left_at IS NULL AND user_id<>p_sender_id) THEN');
  if patched=definition then raise exception 'Unsupported group recipient guard'; end if;
  execute patched;
  definition:=pg_get_functiondef('public.send_message_with_attachments(text,text,text,uuid[],uuid,text,uuid,text,text)'::regprocedure);
  patched:=replace(definition,
    'if not exists(select 1 from conversation_members where conversation_id=target and left_at is null and user_id<>p_actor) then',
    'if not exists(select 1 from workspace_private.channels where conversation_id=target) and not exists(select 1 from conversation_members where conversation_id=target and left_at is null and user_id<>p_actor) then');
  if patched=definition then raise exception 'Unsupported attachment recipient guard'; end if;
  execute patched;
end $guards$;

-- Apply the same right to old uploads, even before they have a message parent.
create or replace function public.message_attachment_target(p_actor text,p_destination text)
returns boolean language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare target uuid; recipient text;
begin
  if p_actor is null then return false; end if;
  if p_destination ~ '^recipient:[A-Za-z0-9_-]{1,128}$' then
    recipient:=substring(p_destination from 11);
    return recipient<>p_actor and recipient<>'cinegenius-support'
      and public.messaging_recipient_available(p_actor,recipient);
  elsif p_destination ~ '^conversation:[a-f0-9-]{36}$' then
    target:=substring(p_destination from 14)::uuid;
    if exists(select 1 from workspace_private.channels where conversation_id=target) then
      return exists(select 1 from workspace_private.channel_rights(p_actor,target) where writing);
    end if;
    return exists(select 1 from public.conversation_members cm join public.conversations c on c.id=cm.conversation_id
      where cm.user_id=p_actor and cm.conversation_id=target and cm.left_at is null
        and (c.kind<>'support' or c.receiver_id=p_actor));
  end if;
  return false;
end $$;

create or replace function public.readable_message_attachment(p_id uuid,p_viewer text)
returns setof public.message_attachments language sql stable security definer set search_path=public,pg_temp as $$
  select a.* from public.message_attachments a where a.id=p_id and p_viewer is not null and (
    (a.message_id is null and a.owner_user_id=p_viewer
      and public.message_attachment_target(p_viewer,a.destination_key)) or exists(
      select 1 from public.messages m join public.conversations c on c.id=m.conversation_id
      join public.conversation_members cm on cm.conversation_id=c.id and cm.user_id=p_viewer and cm.left_at is null
      where m.id=a.message_id and m.created_at>=cm.joined_at
        and (m.sender_id<>p_viewer or m.hidden_for_sender_at is null)
        and (c.kind<>'support' or c.receiver_id=p_viewer)
        and (not exists(select 1 from workspace_private.channels ch where ch.conversation_id=c.id)
          or exists(select 1 from workspace_private.channel_rights(p_viewer,c.id) where reading))
        and not exists(select 1 from public.blocks b where
          (b.blocker_id=m.sender_id and b.blocked_id=p_viewer) or (b.blocked_id=m.sender_id and b.blocker_id=p_viewer))
    ));
$$;

-- A protected image may still have an unbound media ledger parent while it is
-- staged for a channel. The attachment ledger already knows that destination.
do $images$
declare definition text; patched text;
begin
  definition:=pg_get_functiondef('public.readable_media_asset(text,text)'::regprocedure);
  patched:=replace(definition,
    'if a.source_type=''message'' then',
    'if exists(select 1 from public.message_attachments attachment where attachment.reference_url=a.reference_url
      and not exists(select 1 from public.readable_message_attachment(attachment.id,p_viewer))) then return; end if;
 if a.source_type=''message'' then');
  if patched=definition then raise exception 'Unsupported protected-media message contract'; end if;
  execute patched;
end $images$;

-- Normal header and community list share the personal display scope.
-- The independent team inbox uses workspace_conversation_page_v1(...,'team',...).
create or replace function public.unread_message_counts(p_user_id text)
returns table(conversation_id text,unread_count bigint) language sql stable security definer
set search_path='' as $$
  select m.conversation_id::text,count(*)::bigint
  from workspace_private.feed_conversations(p_user_id,'community',null) f
  join public.messages m on m.conversation_id=f.conversation_id and m.created_at>=f.history_from
  where m.sender_id<>p_user_id
    and not exists(select 1 from public.message_reads mr where mr.message_id=m.id and mr.user_id=p_user_id)
  group by m.conversation_id;
$$;

-- Protect writes racing a revocation, including existing receipt/upload paths.
create function workspace_private.guard_write() returns trigger
language plpgsql security definer set search_path='' as $$
declare conversation uuid;
begin
  if TG_TABLE_NAME='messages' then
    perform workspace_private.assert_channel(NEW.sender_id,NEW.conversation_id,'write');
  elsif TG_TABLE_NAME='message_reads' then
    select m.conversation_id into conversation from public.messages m where m.id=NEW.message_id;
    perform workspace_private.assert_channel(NEW.user_id,conversation,'read');
  elsif TG_TABLE_NAME='message_attachments' and NEW.destination_key ~ '^conversation:[a-f0-9-]{36}$' then
    conversation:=substring(NEW.destination_key from 14)::uuid;
    perform workspace_private.assert_channel(NEW.owner_user_id,conversation,'write');
  end if;
  return NEW;
end $$;
create trigger workspace_message_write before insert on public.messages
  for each row execute function workspace_private.guard_write();
create trigger workspace_receipt_write before insert or update on public.message_reads
  for each row execute function workspace_private.guard_write();
create trigger workspace_attachment_write before insert or update on public.message_attachments
  for each row execute function workspace_private.guard_write();

-- Optional, disabled push infrastructure is not activated by this migration.
-- Its final prepare() rechecks message_visible after any earlier queue claim.
do $push$
declare definition text; patched text;
begin
  if to_regprocedure('native_push_private.message_visible(uuid,text)') is not null then
    definition:=pg_get_functiondef('native_push_private.message_visible(uuid,text)'::regprocedure);
    patched:=replace(definition,'WHERE m.id=message_id AND m.sender_id<>recipient',
      'WHERE m.id=message_id AND m.sender_id<>recipient
 AND (NOT EXISTS(SELECT 1 FROM workspace_private.channels ch WHERE ch.conversation_id=m.conversation_id)
   OR EXISTS(SELECT 1 FROM workspace_private.channel_rights(recipient,m.conversation_id) WHERE reading))');
    if patched=definition then raise exception 'Unsupported native push visibility contract'; end if;
    execute patched;
  end if;
end $push$;

-- Grant changes, membership removal and leave commit with reconciliation.
-- No historical membership, messages, attachments, drafts or files are changed.
revoke all on all functions in schema workspace_private from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
