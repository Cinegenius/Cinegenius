-- Per-participant message receipts and secure group conversations.
-- Existing direct conversations and messages are retained and backfilled.

alter table public.conversations
  add column if not exists kind text not null default 'direct',
  add column if not exists group_name text,
  add column if not exists created_by text;

-- Group conversations have no single receiver. Direct conversations keep the
-- existing sender_id/receiver_id representation and are distinguished by kind.
alter table public.conversations alter column receiver_id drop not null;

do $$ begin
  alter table public.conversations
    add constraint conversations_kind_check check (kind in ('direct', 'group'));
exception when duplicate_object then null;
end $$;

create index if not exists conversations_kind_updated_at_idx
  on public.conversations(kind, updated_at desc);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id text not null,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (conversation_id, user_id)
);

create index if not exists conversation_members_user_active_idx
  on public.conversation_members(user_id, conversation_id)
  where left_at is null;

alter table public.conversation_members enable row level security;
revoke all on public.conversation_members from anon, authenticated;
grant select, insert, update, delete on public.conversation_members to service_role;

-- Make every existing direct-chat participant explicit. The conversation
-- creation date is the history boundary, so existing messages remain visible.
insert into public.conversation_members (conversation_id, user_id, role, joined_at)
select c.id, participant.user_id, 'member', coalesce(c.created_at, now())
from public.conversations c
cross join lateral (values (c.sender_id), (c.receiver_id)) as participant(user_id)
where c.kind = 'direct'
  and participant.user_id is not null
on conflict (conversation_id, user_id) do nothing;

create table if not exists public.message_reads (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id text not null,
  read_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create index if not exists message_reads_user_id_idx
  on public.message_reads(user_id, message_id);

alter table public.message_reads enable row level security;
revoke all on public.message_reads from anon, authenticated;
grant select, insert, update, delete on public.message_reads to service_role;

-- Preserve old per-message read states as receipts for the direct recipient.
insert into public.message_reads (message_id, user_id, read_at)
select
  m.id,
  case when m.sender_id = c.sender_id then c.receiver_id else c.sender_id end,
  m.read_at
from public.messages m
join public.conversations c on c.id = m.conversation_id
where c.kind = 'direct'
  and m.read_at is not null
  and m.sender_id in (c.sender_id, c.receiver_id)
on conflict (message_id, user_id) do nothing;

create or replace function public.unread_message_counts(p_user_id text)
returns table (conversation_id text, unread_count bigint)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select m.conversation_id::text, count(*)::bigint
  from public.messages m
  join public.conversation_members cm
    on cm.conversation_id = m.conversation_id
   and cm.user_id = p_user_id
   and cm.left_at is null
   and m.created_at >= cm.joined_at
  where m.sender_id <> p_user_id
    and not exists (
      select 1
      from public.message_reads mr
      where mr.message_id = m.id
        and mr.user_id = p_user_id
    )
  group by m.conversation_id;
$$;

revoke all on function public.unread_message_counts(text) from public, anon, authenticated;
grant execute on function public.unread_message_counts(text) to service_role;

-- Functions below are only callable through the authenticated server API,
-- which supplies Clerk's verified user ID while using the service-role client.
create or replace function public.create_group_conversation(
  p_creator_id text,
  p_name text,
  p_member_ids text[]
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_conversation_id uuid;
  v_members text[];
  v_member_count integer;
begin
  if nullif(btrim(p_name), '') is null or length(btrim(p_name)) > 80 then
    raise exception using errcode = 'P0001', message = 'Der Gruppenname muss 1 bis 80 Zeichen lang sein.';
  end if;
  if p_creator_id is null or p_creator_id = '' then
    raise exception using errcode = 'P0001', message = 'Ersteller fehlt.';
  end if;

  select coalesce(array_agg(distinct member_id), array[]::text[])
    into v_members
  from unnest(coalesce(p_member_ids, array[]::text[])) as candidates(member_id)
  where member_id is not null and member_id <> '' and member_id <> p_creator_id;

  v_member_count := cardinality(v_members);
  if v_member_count < 1 or v_member_count > 49 then
    raise exception using errcode = 'P0001', message = 'Wähle 1 bis 49 weitere Mitglieder aus.';
  end if;
  if (select count(*) from public.profiles p where p.user_id = any(v_members)) <> v_member_count then
    raise exception using errcode = 'P0001', message = 'Mindestens ein ausgewähltes Profil ist nicht verfügbar.';
  end if;

  insert into public.conversations (
    sender_id, receiver_id, listing_id, listing_title, listing_type,
    kind, group_name, created_by
  ) values (
    p_creator_id, null, null, null, null, 'group', btrim(p_name), p_creator_id
  ) returning id into v_conversation_id;

  insert into public.conversation_members (conversation_id, user_id, role, joined_at)
  values (v_conversation_id, p_creator_id, 'admin', now());

  insert into public.conversation_members (conversation_id, user_id, role, joined_at)
  select v_conversation_id, selected.member_id, 'member', now()
  from unnest(v_members) as selected(member_id);

  return v_conversation_id;
end;
$$;

create or replace function public.manage_group_conversation(
  p_conversation_id uuid,
  p_actor_id text,
  p_action text,
  p_target_user_id text default null,
  p_name text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_kind text;
  v_actor_role text;
  v_target_role text;
  v_promote_user text;
  v_rows integer;
begin
  select c.kind into v_kind
  from public.conversations c
  where c.id = p_conversation_id
  for update;
  if not found or v_kind <> 'group' then
    raise exception using errcode = 'P0001', message = 'Gruppe nicht gefunden.';
  end if;

  select cm.role into v_actor_role
  from public.conversation_members cm
  where cm.conversation_id = p_conversation_id
    and cm.user_id = p_actor_id
    and cm.left_at is null
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'Du bist kein aktives Gruppenmitglied.';
  end if;

  if p_action = 'leave' then
    if v_actor_role = 'admin' then
      select cm.user_id into v_promote_user
      from public.conversation_members cm
      where cm.conversation_id = p_conversation_id
        and cm.left_at is null
        and cm.user_id <> p_actor_id
        and cm.role = 'member'
      order by cm.joined_at asc, cm.user_id asc
      limit 1;
      if v_promote_user is not null then
        update public.conversation_members
        set role = 'admin'
        where conversation_id = p_conversation_id and user_id = v_promote_user;
      elsif not exists (
        select 1 from public.conversation_members cm
        where cm.conversation_id = p_conversation_id
          and cm.left_at is null
          and cm.user_id <> p_actor_id
          and cm.role = 'admin'
      ) then
        raise exception using errcode = 'P0001', message = 'Du bist der letzte Admin. Füge zuerst ein weiteres Mitglied hinzu, bevor du die Gruppe verlässt.';
      end if;
    end if;
    update public.conversation_members
    set left_at = now()
    where conversation_id = p_conversation_id and user_id = p_actor_id and left_at is null;
    return;
  end if;

  if v_actor_role <> 'admin' then
    raise exception using errcode = 'P0001', message = 'Nur Gruppenadmins dürfen diese Aktion ausführen.';
  end if;

  if p_action = 'rename' then
    if nullif(btrim(p_name), '') is null or length(btrim(p_name)) > 80 then
      raise exception using errcode = 'P0001', message = 'Der Gruppenname muss 1 bis 80 Zeichen lang sein.';
    end if;
    update public.conversations set group_name = btrim(p_name)
    where id = p_conversation_id;
    return;
  elsif p_action = 'add' then
    if p_target_user_id is null or p_target_user_id = '' or p_target_user_id = p_actor_id then
      raise exception using errcode = 'P0001', message = 'Mitglied ist ungültig.';
    end if;
    if not exists (select 1 from public.profiles p where p.user_id = p_target_user_id) then
      raise exception using errcode = 'P0001', message = 'Profil ist nicht verfügbar.';
    end if;
    insert into public.conversation_members (conversation_id, user_id, role, joined_at, left_at)
    values (p_conversation_id, p_target_user_id, 'member', now(), null)
    on conflict (conversation_id, user_id) do update
      set role = 'member', joined_at = now(), left_at = null
      where public.conversation_members.left_at is not null;
    get diagnostics v_rows = row_count;
    if v_rows = 0 then
      raise exception using errcode = 'P0001', message = 'Mitglied ist bereits in der Gruppe.';
    end if;
    return;
  elsif p_action = 'remove' then
    if p_target_user_id is null or p_target_user_id = p_actor_id then
      raise exception using errcode = 'P0001', message = 'Zum Verlassen nutze die Gruppenfunktion „Gruppe verlassen“.';
    end if;
    select cm.role into v_target_role
    from public.conversation_members cm
    where cm.conversation_id = p_conversation_id
      and cm.user_id = p_target_user_id
      and cm.left_at is null
    for update;
    if not found then
      raise exception using errcode = 'P0001', message = 'Mitglied nicht gefunden.';
    end if;
    if v_target_role = 'admin' and not exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = p_conversation_id and cm.left_at is null
        and cm.role = 'admin' and cm.user_id <> p_target_user_id
    ) then
      raise exception using errcode = 'P0001', message = 'Der letzte Admin kann nicht entfernt werden.';
    end if;
    update public.conversation_members set left_at = now()
    where conversation_id = p_conversation_id and user_id = p_target_user_id and left_at is null;
    return;
  end if;

  raise exception using errcode = 'P0001', message = 'Aktion nicht unterstützt.';
end;
$$;

create or replace function public.send_conversation_message(
  p_conversation_id uuid,
  p_sender_id text,
  p_content text
)
returns setof public.messages
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_kind text;
begin
  -- This shared row lock serializes sending against member removal/leave.
  select c.kind into v_kind
  from public.conversations c
  where c.id = p_conversation_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'Unterhaltung nicht gefunden.';
  end if;

  perform 1 from public.conversation_members cm
  where cm.conversation_id = p_conversation_id
    and cm.user_id = p_sender_id
    and cm.left_at is null
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'Du bist kein aktives Mitglied dieser Unterhaltung.';
  end if;

  return query
    insert into public.messages (conversation_id, sender_id, content)
    values (p_conversation_id, p_sender_id, p_content)
    returning *;

  update public.conversations set updated_at = now()
  where id = p_conversation_id;
end;
$$;

revoke all on function public.create_group_conversation(text, text, text[]) from public, anon, authenticated;
revoke all on function public.manage_group_conversation(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.send_conversation_message(uuid, text, text) from public, anon, authenticated;
grant execute on function public.create_group_conversation(text, text, text[]) to service_role;
grant execute on function public.manage_group_conversation(uuid, text, text, text, text) to service_role;
grant execute on function public.send_conversation_message(uuid, text, text) to service_role;
