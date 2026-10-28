-- Independent, private recovery snapshots. Never writes to public content tables.
create table if not exists public.private_form_drafts (
  user_id text not null,
  form_key text not null check (length(form_key) <= 100),
  draft_data jsonb,
  revision bigint not null default 1,
  updated_at timestamptz not null default now(),
  primary key (user_id, form_key),
  check (draft_data is null or (jsonb_typeof(draft_data) = 'object' and octet_length(draft_data::text) <= 300000))
);
alter table public.private_form_drafts enable row level security;
revoke all on public.private_form_drafts from public, anon, authenticated;
grant select, insert, update, delete on public.private_form_drafts to service_role;

create or replace function public.save_private_form_draft(p_user text, p_key text, p_expected bigint, p_data jsonb)
returns table (revision bigint, draft_data jsonb)
language plpgsql security definer set search_path = public, pg_temp as $$
declare current_row public.private_form_drafts%rowtype;
begin
  -- Serialise first writes as well as updates from different tabs/devices.
  perform pg_advisory_xact_lock(hashtextextended(p_user || ':' || p_key, 0));
  select * into current_row from public.private_form_drafts f where f.user_id = p_user and f.form_key = p_key for update;
  if found then
    -- Idempotent retry after a lost acknowledgement (including a deleted snapshot).
    if current_row.draft_data is not distinct from p_data then
      return query select current_row.revision, current_row.draft_data; return;
    end if;
    if current_row.revision <> p_expected then raise exception 'draft_conflict' using errcode = '40001'; end if;
    update public.private_form_drafts f set draft_data = p_data, revision = f.revision + 1, updated_at = now()
      where f.user_id = p_user and f.form_key = p_key returning * into current_row;
  else
    if p_expected <> 0 then raise exception 'draft_conflict' using errcode = '40001'; end if;
    insert into public.private_form_drafts(user_id, form_key, draft_data) values (p_user, p_key, p_data) returning * into current_row;
  end if;
  -- Keep a tombstone after completion/discard so delayed saves cannot resurrect it.
  return query select current_row.revision, current_row.draft_data;
end $$;
revoke all on function public.save_private_form_draft(text,text,bigint,jsonb) from public, anon, authenticated;
grant execute on function public.save_private_form_draft(text,text,bigint,jsonb) to service_role;
