-- Add a member-initiated general support thread without changing existing chats.
-- Re-applying this migration preserves every message and read receipt.
alter table public.conversations add column if not exists member_support_contact boolean not null default false;
create unique index if not exists conversations_member_support_contact_idx
  on public.conversations(support_user_id) where kind = 'support' and member_support_contact;

create table if not exists public.support_contact_sends (
  user_id text not null,
  idempotency_key uuid not null,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, idempotency_key)
);
alter table public.support_contact_sends enable row level security;
revoke all on public.support_contact_sends from public, anon, authenticated;
grant select, insert, update, delete on public.support_contact_sends to service_role;

create or replace function public.contact_support(p_user_id text, p_content text, p_idempotency_key uuid, p_label text)
returns table (conversation_id uuid, message_id uuid, created boolean)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_conversation_id uuid;
  v_message_id uuid;
  v_previous_content text;
begin
  if nullif(btrim(p_user_id), '') is null or p_user_id = 'cinegenius-support'
    or p_idempotency_key is null or nullif(btrim(p_content), '') is null or length(p_content) > 5000
    or nullif(btrim(p_label), '') is null or length(p_label) > 160 then
    raise exception using errcode = '22023', message = 'invalid_support_contact';
  end if;
  -- A lost acknowledgement or concurrent tab must not create duplicate threads/messages.
  if not pg_try_advisory_xact_lock(hashtextextended('member-support:' || p_user_id, 0)) then
    raise exception using errcode = 'PT409', message = 'support_contact_busy';
  end if;
  select s.conversation_id, s.message_id, m.content into v_conversation_id, v_message_id, v_previous_content
    from public.support_contact_sends s join public.messages m on m.id = s.message_id
    where s.user_id = p_user_id and s.idempotency_key = p_idempotency_key;
  if found then
    if v_previous_content is distinct from btrim(p_content) then
      raise exception using errcode = 'PT409', message = 'support_contact_key_reused';
    end if;
    return query select v_conversation_id, v_message_id, false; return;
  end if;

  select c.id into v_conversation_id from public.conversations c
    where c.kind = 'support' and c.member_support_contact and c.support_user_id = p_user_id for update;
  if not found then
    v_conversation_id := gen_random_uuid();
    insert into public.conversations(id, sender_id, receiver_id, kind, created_by, support_user_id,
      support_target_type, support_target_id, support_target_label, support_edit_url, support_idempotency_key, member_support_contact)
    values(v_conversation_id, 'cinegenius-support', p_user_id, 'support', p_user_id, p_user_id,
      'profile', p_user_id, btrim(p_label), '/messages?conv=' || v_conversation_id::text, 'member-contact:' || p_user_id, true);
    insert into public.conversation_members(conversation_id, user_id, role, joined_at)
      values(v_conversation_id, 'cinegenius-support', 'admin', now()), (v_conversation_id, p_user_id, 'member', now());
  end if;
  perform 1 from public.conversation_members cm
    where cm.conversation_id = v_conversation_id and cm.user_id = p_user_id and cm.left_at is null;
  if not found then raise exception using errcode = '42501', message = 'support_contact_inactive'; end if;
  insert into public.messages(conversation_id, sender_id, content)
    values(v_conversation_id, p_user_id, btrim(p_content)) returning id into v_message_id;
  insert into public.support_contact_sends(user_id, idempotency_key, conversation_id, message_id)
    values(p_user_id, p_idempotency_key, v_conversation_id, v_message_id);
  update public.conversations set updated_at = now() where id = v_conversation_id;
  return query select v_conversation_id, v_message_id, true;
end $$;
revoke all on function public.contact_support(text,text,uuid,text) from public, anon, authenticated;
grant execute on function public.contact_support(text,text,uuid,text) to service_role;
