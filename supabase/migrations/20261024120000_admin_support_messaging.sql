-- Admin initiated support conversations reuse member messaging while keeping the shared
-- admin inbox and sender audit restricted to server routes.
alter table public.conversations
  add column if not exists support_user_id text,
  add column if not exists support_target_type text,
  add column if not exists support_target_id text,
  add column if not exists support_target_label text,
  add column if not exists support_edit_url text,
  add column if not exists support_idempotency_key text;

alter table public.conversations drop constraint if exists conversations_kind_check;
alter table public.conversations
  add constraint conversations_kind_check check (kind in ('direct', 'group', 'support'));
alter table public.conversations drop constraint if exists conversations_support_fields_check;
alter table public.conversations add constraint conversations_support_fields_check check (
  kind <> 'support' or (
    support_user_id is not null
    and support_target_type in ('profile', 'company', 'location', 'marketplace')
    and support_target_id is not null
    and support_target_label is not null
    and support_edit_url is not null
    and support_idempotency_key is not null
  )
);
create unique index if not exists conversations_support_request_key_idx
  on public.conversations(created_by, support_idempotency_key)
  where kind = 'support' and support_idempotency_key is not null;
create index if not exists conversations_support_inbox_idx
  on public.conversations(updated_at desc) where kind = 'support';

-- Each row records which administrator initiated an official support message.
-- The idempotency key also makes retries safe after timeouts or double clicks.
create table if not exists public.support_message_sends (
  idempotency_key text primary key,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  message_id uuid references public.messages(id) on delete cascade,
  actor_user_id text not null,
  created_at timestamptz not null default now()
);
create index if not exists support_message_sends_conversation_idx
  on public.support_message_sends(conversation_id, created_at desc);
alter table public.support_message_sends enable row level security;
revoke all on public.support_message_sends from anon, authenticated;
grant select, insert, update, delete on public.support_message_sends to service_role;

create table if not exists public.support_message_templates (
  template_key text primary key,
  label text not null check (length(btrim(label)) between 1 and 120),
  body text not null check (length(btrim(body)) between 1 and 5000),
  enabled boolean not null default true,
  updated_by text,
  updated_at timestamptz not null default now(),
  constraint support_message_templates_key_check check (template_key ~ '^[a-z0-9_-]{2,64}$')
);
alter table public.support_message_templates enable row level security;
revoke all on public.support_message_templates from anon, authenticated;
grant select, insert, update, delete on public.support_message_templates to service_role;

insert into public.support_message_templates (template_key, label, body) values
  ('crew_profile', 'Crewprofil ergänzen', 'Hallo {{Vorname}}, bei deinem Crewprofil fehlen noch {{fehlendeAngaben}}. Hier kannst du die Angaben ergänzen: {{Bearbeitungslink}}. Bei Fragen antworte uns gerne direkt. Dein CineGenius Support'),
  ('marketplace_listing', 'Marktplatzangebot vervollständigen', 'Hallo {{Vorname}}, bei deinem Angebot „{{Inserattitel}}“ fehlen noch {{fehlendeAngaben}}. Ergänze sie hier, damit Interessierte dein Angebot besser einschätzen können: {{Bearbeitungslink}}. Dein CineGenius Support'),
  ('location', 'Location ergänzen', 'Hallo {{Vorname}}, deine Location „{{Inserattitel}}“ könnte noch ein paar Angaben gebrauchen: {{fehlendeAngaben}}. Hier kannst du sie ergänzen: {{Bearbeitungslink}}. Dein CineGenius Support'),
  ('more_photos', 'Weitere Fotos hinzufügen', 'Hallo {{Vorname}}, möchtest du „{{Inserattitel}}“ noch besser zeigen? Ergänze gerne weitere Fotos mit unterschiedlichen Ansichten: {{Bearbeitungslink}}. Dein CineGenius Support'),
  ('company_profile', 'Firmenprofil ergänzen', 'Hallo {{Vorname}}, ergänze gerne die Leistungen, Fotos oder Teamangaben von „{{Firmenname}}“. Hier gelangst du direkt zur Bearbeitung: {{Bearbeitungslink}}. Dein CineGenius Support'),
  ('resume_draft', 'Unveröffentlichten Entwurf fortsetzen', 'Hallo {{Vorname}}, dein Entwurf „{{Inserattitel}}“ ist noch nicht veröffentlicht. Wenn du ihn fertigstellen möchtest, kannst du hier weitermachen: {{Bearbeitungslink}}. Bei Fragen helfen wir gerne. Dein CineGenius Support'),
  ('check_in', 'Kurze Nachfrage', 'Hallo {{Vorname}}, brauchst du Unterstützung bei deinem Profil oder Angebot? Antworte uns einfach hier und beschreibe kurz, wobei du Hilfe brauchst. Dein CineGenius Support')
on conflict (template_key) do nothing;

create or replace function public.create_support_conversation(
  p_admin_user_id text, p_recipient_user_id text, p_target_type text, p_target_id text,
  p_target_label text, p_edit_url text, p_content text, p_idempotency_key text
)
returns table (conversation_id uuid, message_id uuid, created boolean)
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_conversation_id uuid;
  v_message_id uuid;
  v_inserted_id uuid;
  v_inserted_key text;
begin
  if nullif(btrim(p_admin_user_id), '') is null or nullif(btrim(p_recipient_user_id), '') is null
    or p_admin_user_id = p_recipient_user_id
    or p_target_type not in ('profile', 'company', 'location', 'marketplace')
    or nullif(btrim(p_target_id), '') is null or nullif(btrim(p_target_label), '') is null
    or nullif(btrim(p_edit_url), '') is null or left(btrim(p_edit_url), 1) <> '/'
    or nullif(btrim(p_content), '') is null or length(p_content) > 5000
    or nullif(btrim(p_idempotency_key), '') is null then
    raise exception using errcode = 'P0001', message = 'Ungültige Supportnachricht.';
  end if;

  insert into public.conversations (
    sender_id, receiver_id, kind, created_by, support_user_id, support_target_type,
    support_target_id, support_target_label, support_edit_url, support_idempotency_key
  ) values (
    'cinegenius-support', p_recipient_user_id, 'support', p_admin_user_id, p_recipient_user_id,
    p_target_type, p_target_id, btrim(p_target_label), btrim(p_edit_url), p_idempotency_key
  )
  on conflict (created_by, support_idempotency_key)
    where kind = 'support' and support_idempotency_key is not null
  do nothing returning id into v_inserted_id;

  if v_inserted_id is null then
    select c.id, s.message_id into v_conversation_id, v_message_id
    from public.conversations c
    left join public.support_message_sends s on s.idempotency_key = p_idempotency_key
    where c.kind = 'support' and c.created_by = p_admin_user_id
      and c.support_idempotency_key = p_idempotency_key;
    if v_conversation_id is null or v_message_id is null then
      raise exception using errcode = 'P0001', message = 'Vorheriger Versand wird noch verarbeitet.';
    end if;
    return query select v_conversation_id, v_message_id, false;
    return;
  end if;

  v_conversation_id := v_inserted_id;
  insert into public.conversation_members (conversation_id, user_id, role, joined_at)
  values (v_conversation_id, 'cinegenius-support', 'admin', now()),
    (v_conversation_id, p_recipient_user_id, 'member', now())
  on conflict (conversation_id, user_id) do nothing;

  insert into public.support_message_sends (idempotency_key, conversation_id, actor_user_id)
  values (p_idempotency_key, v_conversation_id, p_admin_user_id)
  on conflict (idempotency_key) do nothing returning idempotency_key into v_inserted_key;
  if v_inserted_key is null then
    select s.message_id into v_message_id from public.support_message_sends s
    where s.idempotency_key = p_idempotency_key and s.conversation_id = v_conversation_id;
    if v_message_id is null then
      raise exception using errcode = 'P0001', message = 'Vorheriger Versand wird noch verarbeitet.';
    end if;
    return query select v_conversation_id, v_message_id, false;
    return;
  end if;

  insert into public.messages (conversation_id, sender_id, content)
  values (v_conversation_id, 'cinegenius-support', btrim(p_content))
  returning id into v_message_id;
  update public.support_message_sends set message_id = v_message_id where idempotency_key = p_idempotency_key;
  update public.conversations set updated_at = now() where id = v_conversation_id;
  return query select v_conversation_id, v_message_id, true;
end;
$$;

create or replace function public.send_support_message(
  p_conversation_id uuid, p_admin_user_id text, p_content text, p_idempotency_key text
)
returns table (message_id uuid, created boolean)
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_message_id uuid;
  v_inserted_key text;
begin
  if nullif(btrim(p_admin_user_id), '') is null or nullif(btrim(p_content), '') is null
    or length(p_content) > 5000 or nullif(btrim(p_idempotency_key), '') is null then
    raise exception using errcode = 'P0001', message = 'Ungültige Supportantwort.';
  end if;
  perform 1 from public.conversations where id = p_conversation_id and kind = 'support' for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'Supportunterhaltung nicht gefunden.';
  end if;

  insert into public.support_message_sends (idempotency_key, conversation_id, actor_user_id)
  values (p_idempotency_key, p_conversation_id, p_admin_user_id)
  on conflict (idempotency_key) do nothing returning idempotency_key into v_inserted_key;
  if v_inserted_key is null then
    select s.message_id into v_message_id from public.support_message_sends s
    where s.idempotency_key = p_idempotency_key and s.conversation_id = p_conversation_id;
    if v_message_id is null then
      raise exception using errcode = 'P0001', message = 'Idempotenzschlüssel wurde bereits anderweitig verwendet.';
    end if;
    return query select v_message_id, false;
    return;
  end if;

  insert into public.messages (conversation_id, sender_id, content)
  values (p_conversation_id, 'cinegenius-support', btrim(p_content))
  returning id into v_message_id;
  update public.support_message_sends set message_id = v_message_id where idempotency_key = p_idempotency_key;
  update public.conversations set updated_at = now() where id = p_conversation_id;
  return query select v_message_id, true;
end;
$$;

revoke all on function public.create_support_conversation(text, text, text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.send_support_message(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.create_support_conversation(text, text, text, text, text, text, text, text) to service_role;
grant execute on function public.send_support_message(uuid, text, text, text) to service_role;

