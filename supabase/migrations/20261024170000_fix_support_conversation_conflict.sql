-- RETURNS TABLE exposes conversation_id as a PL/pgSQL output variable.
-- Name the existing primary-key constraint to avoid ambiguous column resolution.
do $$
declare
  definition text;
begin
  select pg_get_functiondef('public.create_support_conversation(text,text,text,text,text,text,text,text)'::regprocedure)
    into definition;
  if position('on conflict (conversation_id, user_id) do nothing;' in definition) > 0 then
    execute replace(definition,
      'on conflict (conversation_id, user_id) do nothing;',
      'on conflict on constraint conversation_members_pkey do nothing;');
  elsif position('on conflict on constraint conversation_members_pkey do nothing;' in definition) = 0 then
    raise exception 'Unexpected support function definition; correction not applied.';
  end if;
end;
$$;
