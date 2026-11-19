-- Reversible withdrawal/trash. No content, original media or history is deleted.
alter table public.organization_entries
  drop constraint organization_entries_moderation_status_check,
  add constraint organization_entries_moderation_status_check check
    (moderation_status in ('draft','submitted','approved','changes_requested','rejected','ended','hidden','deleted')),
  add column owner_withdrawn_from text check
    (owner_withdrawn_from in ('draft','submitted','approved','changes_requested','rejected','ended','hidden'));
alter table public.organization_moderation_events
  drop constraint organization_moderation_events_action_check,
  add constraint organization_moderation_events_action_check check
    (action in ('draft','submitted','approved','changes_requested','rejected','hidden','ended','deleted'));

-- The actor comes from server authentication, never a client identity claim.
-- Lock the current entry and management grants in the same transaction as the
-- revision/history write, so concurrent edits and revocations cannot be lost.
create function public.manage_organization_entry_lifecycle(
  p_id uuid, p_actor text, p_expected timestamptz, p_action text, p_reason text
) returns setof public.organization_entries
language plpgsql security invoker set search_path=public,pg_temp as $$
declare item public.organization_entries; owner_id text; target text;
begin
  select * into item from public.organization_entries where id=p_id for update;
  if not found then raise sqlstate 'PT403' using message='forbidden'; end if;
  select owner_user_id into owner_id from public.organizations where id=item.organization_id for share;
  if p_actor is null or btrim(p_actor)='' then raise sqlstate 'PT403' using message='forbidden'; end if;
  if owner_id is distinct from p_actor then
    perform 1 from public.organization_members
      where organization_id=item.organization_id and user_id=p_actor
        and status='active' and role in ('owner','admin') for share;
    if not found then raise sqlstate 'PT403' using message='forbidden'; end if;
  end if;
  if p_expected is null or p_expected is distinct from item.updated_at then
    raise sqlstate 'PT409' using message='conflict';
  end if;
  if p_action not in ('hide','delete','restore') or p_action is null
    or p_reason is null or char_length(btrim(p_reason)) not between 5 and 1000 then
    raise sqlstate 'PT400' using message='required';
  end if;
  if p_action='hide' and item.moderation_status not in ('hidden','deleted') then
    target:='hidden';
  elsif p_action='delete' and item.moderation_status<>'deleted' then
    target:='deleted';
  elsif p_action='restore' and (item.moderation_status='deleted'
    or (item.moderation_status='hidden' and item.owner_withdrawn_from is not null)) then
    -- An administrator's restriction survives withdrawal, trash and restore.
    target:=case when item.owner_withdrawn_from in ('hidden','rejected','changes_requested')
      then item.owner_withdrawn_from else 'draft' end;
  else
    raise sqlstate 'PT409' using message='conflict';
  end if;
  return query update public.organization_entries set
    moderation_status=target,
    owner_withdrawn_from=case when p_action='restore' then null
      else coalesce(item.owner_withdrawn_from,item.moderation_status) end,
    moderation_reason=btrim(p_reason), submitted_at=null, published_at=null,
    reviewed_at=null, reviewed_by=null, last_actor_user_id=p_actor
    where id=p_id returning *;
  -- Existing revision triggers commit actor, reason and exact revision atomically.
end $$;
revoke all on function public.manage_organization_entry_lifecycle(uuid,text,timestamptz,text,text)
  from public,anon,authenticated;
grant execute on function public.manage_organization_entry_lifecycle(uuid,text,timestamptz,text,text) to service_role;
comment on column public.organization_entries.owner_withdrawn_from is
  'Private restoration marker. Does not grant publication or override administrator restrictions.';
notify pgrst,'reload schema';
