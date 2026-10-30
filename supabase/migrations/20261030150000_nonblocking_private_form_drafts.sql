-- A busy recovery snapshot must not occupy every Data API connection while it
-- waits for another tab. Preserve data, revisions, account scope and grants.
create or replace function public.save_private_form_draft(p_user text, p_key text, p_expected bigint, p_data jsonb)
returns table (revision bigint, draft_data jsonb)
language plpgsql security definer
set search_path = public, pg_temp
set lock_timeout = '2s'
as $$
declare current_row public.private_form_drafts%rowtype;
begin
  -- Keep first writes and updates serial, but fail promptly instead of queuing
  -- connections behind a snapshot already being saved by another transaction.
  if not pg_try_advisory_xact_lock(hashtextextended(p_user || ':' || p_key, 0)) then
    raise exception 'draft_busy' using errcode = '55P03';
  end if;
  select * into current_row from public.private_form_drafts f where f.user_id = p_user and f.form_key = p_key for update;
  if found then
    if current_row.draft_data is not distinct from p_data then
      return query select current_row.revision, current_row.draft_data; return;
    end if;
    -- PT409 is an application conflict. 40001 means a serialization failure and
    -- PostgREST may retry the transaction indefinitely while the input is stale.
    if current_row.revision <> p_expected then raise exception 'draft_conflict' using errcode = 'PT409'; end if;
    update public.private_form_drafts f set draft_data = p_data, revision = f.revision + 1, updated_at = now()
      where f.user_id = p_user and f.form_key = p_key returning * into current_row;
  else
    if p_expected <> 0 then raise exception 'draft_conflict' using errcode = 'PT409'; end if;
    insert into public.private_form_drafts(user_id, form_key, draft_data) values (p_user, p_key, p_data) returning * into current_row;
  end if;
  return query select current_row.revision, current_row.draft_data;
end $$;
revoke all on function public.save_private_form_draft(text,text,bigint,jsonb) from public, anon, authenticated;
grant execute on function public.save_private_form_draft(text,text,bigint,jsonb) to service_role;
