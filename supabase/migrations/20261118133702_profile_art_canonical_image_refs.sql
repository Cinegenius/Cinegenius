begin;
-- Encoded/absolute/dot-segment aliases must not bypass the existing ownership
-- trigger. Ordinary uploaded URLs and unchanged legacy values remain untouched.
create function profile_art_private.reject_profile_art_aliases() returns trigger
language plpgsql security definer set search_path=pg_catalog,profile_art_private as $$
declare k text; value text; previous text; normalized text; match text[]; pass integer; octet integer;
begin
  foreach k in array array['avatar','cover'] loop
    value:=case when k='avatar' then new.avatar_url else new.cover_image_url end;
    previous:=case when tg_op='UPDATE' then case when k='avatar' then old.avatar_url else old.cover_image_url end end;
    if value is null or (tg_op='UPDATE' and value is not distinct from previous) then continue; end if;
    normalized:=value;
    for pass in 1..4 loop
      for match in select regexp_matches(normalized,'%([a-fA-F0-9]{2})','g') loop
        octet:=get_byte(decode(match[1],'hex'),0);
        if octet between 32 and 126 then normalized:=replace(normalized,'%'||match[1],chr(octet)); end if;
      end loop;
    end loop;
    normalized:=replace(normalized,chr(92),'/');
    if lower(normalized) like '%profile-art%' and lower(normalized) like '%/v2/%'
      and value !~ ('^/profile-art/v2/'||k||'-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$') then
      raise exception using errcode='PT400',message='ART_INVALID';
    end if;
  end loop;
  return new;
end $$;
revoke all on function profile_art_private.reject_profile_art_aliases() from public,anon,authenticated,service_role;
create trigger a_guard_profile_art_aliases before insert or update of avatar_url,cover_image_url on public.profiles
for each row execute function profile_art_private.reject_profile_art_aliases();
commit;
