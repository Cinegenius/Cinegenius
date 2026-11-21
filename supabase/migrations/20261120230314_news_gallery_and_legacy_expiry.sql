-- Optional protected article galleries. Never backfill or reassign existing media.
alter table public.organization_entries add column image_gallery jsonb not null default '[]'::jsonb;

create function public.news_gallery_guard() returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
declare image jsonb; asset public.media_assets; urls text[];
begin
 if jsonb_typeof(new.image_gallery) is distinct from 'array' or jsonb_array_length(new.image_gallery)>8 then raise sqlstate 'PT400' using message='media'; end if;
 urls:=array(select value->>'url' from jsonb_array_elements(new.image_gallery));
 if cardinality(urls)<>(select count(distinct u) from unnest(urls) u) or
    (select count(distinct u) from unnest(urls||array[new.image_url]) u where nullif(u,'') is not null)>8 then raise sqlstate 'PT400' using message='media'; end if;
 for image in select value from jsonb_array_elements(new.image_gallery) loop
  if jsonb_typeof(image) is distinct from 'object' then raise sqlstate 'PT400' using message='media'; end if;
  if exists(select 1 from jsonb_each(image) f where f.key in ('url','altText','creator','sourceUrl','licenseName','licenseUrl','changes','caption','imageTitle','attribution','credit') and jsonb_typeof(f.value)<>'string') or
     char_length(coalesce(image->>'caption',''))>800 or char_length(coalesce(image->>'imageTitle',''))>300 or
     char_length(coalesce(image->>'attribution',''))>1000 or char_length(coalesce(image->>'credit',''))>500 then raise sqlstate 'PT400' using message='media'; end if;
  if jsonb_typeof(image) is distinct from 'object' or image->>'url' is null or
     image->>'url' !~ '^/api/media/([A-Za-z0-9_-]+/){1,3}[a-fA-F0-9]{32}[.](jpg|png|webp)$' or
     coalesce(char_length(btrim(image->>'altText')),0) not between 1 and 300 or
     coalesce(char_length(btrim(image->>'creator')),0) not between 1 and 200 or
     coalesce(char_length(btrim(image->>'licenseName')),0) not between 1 and 160 or
     coalesce(char_length(btrim(image->>'changes')),0) not between 1 and 500 or
     coalesce(image->>'sourceUrl','') !~ '^https://' or char_length(image->>'sourceUrl')>2048 or
     (coalesce(image->>'licenseUrl','')<>'' and (image->>'licenseUrl' !~ '^https://' or char_length(image->>'licenseUrl')>2048)) then raise sqlstate 'PT400' using message='media'; end if;
 end loop;
 -- Lock in stable order. Permission checks precede canonical binding in the AFTER trigger.
 for asset in select * from media_assets where reference_url=any(urls) order by storage_path for update loop
  if ((asset.source_type='organization_entry' and asset.source_id=new.id::text) or
    (asset.source_type is null and asset.owner_user_id=new.last_actor_user_id and
      (new.last_actor_user_id=new.author_user_id or public.media_organization_editor(new.organization_id::text,new.last_actor_user_id)))) is distinct from true then
   raise sqlstate 'PT403' using message='media_origin';
  end if;
 end loop;
 if cardinality(urls)<>(select count(*) from media_assets where reference_url=any(urls)) then raise sqlstate 'PT400' using message='media'; end if;
 if tg_op='UPDATE' and (new.image_gallery is distinct from old.image_gallery or new.image_url is distinct from old.image_url)
    and old.moderation_status in ('approved','ended') and new.moderation_status in ('approved','ended') then
  new.moderation_status:='submitted';new.submitted_at:=clock_timestamp();new.reviewed_by:=null;new.reviewed_at:=null;
 end if;
 return new;
end $$;
create trigger news_gallery_guard before insert or update on public.organization_entries for each row execute function public.news_gallery_guard();
revoke all on function public.news_gallery_guard() from public,anon,authenticated;
grant execute on function public.news_gallery_guard() to service_role;

-- Extend the installed source projector, preserving unrelated protected media types and ACLs.
do $patch$
declare definition text; original text := $old$when 'organization_entry' then jsonb_build_array(item->'image_url')$old$;
begin
 definition:=pg_get_functiondef('public.source_image_urls(text,jsonb)'::regprocedure);
 if position(original in definition)=0 then raise exception 'Unknown media projector; review required'; end if;
 execute replace(definition,original,original||$new$||coalesce(item->'image_gallery','[]'::jsonb)$new$);
end $patch$;

create or replace function public.save_editorial_entry(p_id uuid,p_organization uuid,p_expected timestamptz,p_submit boolean,p_document jsonb)
returns public.organization_entries language plpgsql security invoker set search_path=public,pg_temp as $$
declare item public.organization_entries; result public.organization_entries; parent public.organizations; authority public.organization_editorial_grants;
begin
 if p_id is null or p_organization is null or p_submit is null or jsonb_typeof(p_document)<>'object' then raise sqlstate 'PT400' using message='required'; end if;
 select * into parent from organizations where id=p_organization for share;
 select * into authority from organization_editorial_grants where organization_id=p_organization for share;
 if authority.enabled is distinct from true or parent.moderation_status is distinct from 'approved' then raise sqlstate 'PT403' using message='forbidden'; end if;
 perform pg_advisory_xact_lock(hashtextextended('cinegenius-editorial-save',0));
 select * into item from organization_entries where id=p_id for update;
 if exists(select 1 from organization_entries where id<>p_id and (external_url=p_document->>'external_url' or lower(title)=lower(p_document->>'title'))) then raise sqlstate 'PT409' using message='duplicate'; end if;
 if not found then
  if p_expected is not null or p_submit then raise sqlstate 'PT409' using message='save_private_first'; end if;
  insert into organization_entries(id,organization_id,author_user_id,last_actor_user_id,slug,entry_type,title,summary,description,topic,format,city,venue,starts_at,ends_at,registration_url,external_url,image_url,image_gallery,moderation_status)
  values(p_id,p_organization,'cinegenius-editorial','cinegenius-editorial',p_id::text,p_document->>'entry_type',p_document->>'title',p_document->>'summary',p_document->>'description',p_document->>'topic',p_document->>'format',p_document->>'city',p_document->>'venue',(p_document->>'starts_at')::timestamptz,(p_document->>'ends_at')::timestamptz,p_document->>'registration_url',p_document->>'external_url',p_document->>'image_url',coalesce(p_document->'image_gallery','[]'::jsonb),'draft') returning * into result;
 else
  if item.organization_id<>p_organization or item.author_user_id<>'cinegenius-editorial' or item.last_actor_user_id<>'cinegenius-editorial' then raise sqlstate 'PT403' using message='forbidden'; end if;
  if item.updated_at is distinct from p_expected then raise sqlstate 'PT409' using message='conflict'; end if;
  -- Public records and any human restrictions are never overwritten by import.
  if item.moderation_status not in ('draft','submitted') or item.reviewed_by is not null or item.moderation_reason<>'' then raise sqlstate 'PT409' using message='review_required'; end if;
  update organization_entries set entry_type=p_document->>'entry_type',title=p_document->>'title',summary=p_document->>'summary',description=p_document->>'description',topic=p_document->>'topic',format=p_document->>'format',city=p_document->>'city',venue=p_document->>'venue',starts_at=(p_document->>'starts_at')::timestamptz,ends_at=(p_document->>'ends_at')::timestamptz,registration_url=p_document->>'registration_url',external_url=p_document->>'external_url',image_url=p_document->>'image_url',image_gallery=case when p_document ? 'image_gallery' then p_document->'image_gallery' else image_gallery end,moderation_status=case when p_submit then 'submitted' else 'draft' end,submitted_at=case when p_submit then clock_timestamp() else submitted_at end,last_actor_user_id='cinegenius-editorial' where id=p_id returning * into result;
 end if;
 -- Canonical place fields are applied from the server's cityWriteFields output.
 -- Optional place columns are checked against the installed schema.
 -- Only this explicit field allowlist can reach the dynamic column update.
 declare place_column text; assignments text := ''; begin
  foreach place_column in array array['place_country_code','place_region_id','place_city_id','place_city_name','place_region_name','place_status'] loop
   if p_document ? place_column and exists(select 1 from information_schema.columns c where c.table_schema='public' and c.table_name='organization_entries' and c.column_name=place_column) then
    assignments:=assignments || case when assignments='' then '' else ',' end || format('%1$I=(jsonb_populate_record(null::public.organization_entries,$1)).%1$I',place_column);
   end if;
  end loop;
  if assignments<>'' then execute 'update public.organization_entries set ' || assignments || ' where id=$2 returning *' using p_document,p_id into result; end if;
 end;
 return result;
end $$;
revoke all on function public.save_editorial_entry(uuid,uuid,timestamptz,boolean,jsonb) from public,anon,authenticated;
grant execute on function public.save_editorial_entry(uuid,uuid,timestamptz,boolean,jsonb) to service_role;

notify pgrst,'reload schema';

-- A reviewed legacy import receives one expiring hide-only capability, not ownership.
create table public.editorial_legacy_expiry_grants (
 entry_id uuid primary key references public.organization_entries(id),
 organization_id uuid not null references public.organizations(id),
 original_author_user_id text not null,
 entry_revision timestamptz not null,
 entry_snapshot jsonb not null,
 source_url text not null,
 evidence_sha256 text not null check(evidence_sha256 ~ '^[a-f0-9]{64}$'),
 evidence_reference text not null check(char_length(evidence_reference) between 5 and 500),
 content_expires_at timestamptz not null,
 valid_until timestamptz not null,
 enabled boolean not null,
 granted_by text not null,
 used_at timestamptz,
 updated_at timestamptz not null default clock_timestamp()
);
create table public.editorial_legacy_expiry_events (
 id uuid primary key default gen_random_uuid(), entry_id uuid not null references public.organization_entries(id),
 actor_user_id text not null, action text not null check(action in ('grant','revoke','hide')),
 revision_at timestamptz not null, evidence_sha256 text not null, source_url text not null,
 reason text not null, created_at timestamptz not null default clock_timestamp()
);
alter table public.editorial_legacy_expiry_grants enable row level security;
alter table public.editorial_legacy_expiry_events enable row level security;
revoke all on public.editorial_legacy_expiry_grants,public.editorial_legacy_expiry_events from public,anon,authenticated;
grant select,insert,update on public.editorial_legacy_expiry_grants to service_role;
grant select,insert on public.editorial_legacy_expiry_events to service_role;

-- Caller is requireAdmin(), never the newsroom actor or a member ownership claim.
create function public.set_editorial_legacy_expiry_grant(p_actor text,p_entry uuid,p_expected timestamptz,p_enabled boolean,p_document jsonb)
returns public.editorial_legacy_expiry_grants language plpgsql security invoker set search_path=public,pg_temp as $$
declare item public.organization_entries; parent public.organizations; result public.editorial_legacy_expiry_grants; org_id uuid;
begin
 if nullif(btrim(p_actor),'') is null or p_actor='cinegenius-editorial' or p_enabled is null or p_expected is null or jsonb_typeof(p_document) is distinct from 'object' then raise sqlstate 'PT400' using message='required'; end if;
 select organization_id into org_id from organization_entries where id=p_entry;
 if not found then raise sqlstate 'PT404' using message='not_found'; end if;
 select * into parent from organizations where id=org_id for share;
 select * into item from organization_entries where id=p_entry for update;
 if item.organization_id is distinct from org_id or item.updated_at is distinct from p_expected then raise sqlstate 'PT409' using message='conflict'; end if;
 if p_enabled then
  if parent.moderation_status is distinct from 'approved' or item.moderation_status not in ('approved','ended') or item.author_user_id='cinegenius-editorial' then raise sqlstate 'PT409' using message='review_required'; end if;
  if p_document->>'originalAuthorUserId' is distinct from item.author_user_id or p_document->>'sourceUrl' is distinct from item.external_url or
     p_document->>'organizationId' is distinct from item.organization_id::text or p_document->>'reviewed' is distinct from 'true' or
     coalesce(p_document->>'evidenceSha256','') !~ '^[a-f0-9]{64}$' or
     coalesce(char_length(btrim(p_document->>'evidenceReference')),0) not between 5 and 500 or
     coalesce(char_length(btrim(p_document->>'reason')),0) not between 5 and 500 or
     p_document->>'contentExpiresAt' is null or coalesce(item.external_url,'') !~ '^https://'  then raise sqlstate 'PT400' using message='review_required'; end if;
  insert into editorial_legacy_expiry_grants(entry_id,organization_id,original_author_user_id,entry_revision,entry_snapshot,source_url,evidence_sha256,evidence_reference,content_expires_at,valid_until,enabled,granted_by)
  values(item.id,item.organization_id,item.author_user_id,item.updated_at,to_jsonb(item),item.external_url,p_document->>'evidenceSha256',btrim(p_document->>'evidenceReference'),(p_document->>'contentExpiresAt')::timestamptz,clock_timestamp()+interval '7 days',true,p_actor)
  on conflict(entry_id) do update set organization_id=excluded.organization_id,original_author_user_id=excluded.original_author_user_id,entry_revision=excluded.entry_revision,entry_snapshot=excluded.entry_snapshot,source_url=excluded.source_url,evidence_sha256=excluded.evidence_sha256,evidence_reference=excluded.evidence_reference,content_expires_at=excluded.content_expires_at,valid_until=excluded.valid_until,enabled=true,granted_by=p_actor,used_at=null,updated_at=clock_timestamp() returning * into result;
 else
  update editorial_legacy_expiry_grants set enabled=false,updated_at=clock_timestamp() where entry_id=item.id returning * into result;
  if not found then raise sqlstate 'PT404' using message='not_found'; end if;
 end if;
 insert into editorial_legacy_expiry_events(entry_id,actor_user_id,action,revision_at,evidence_sha256,source_url,reason)
 values(item.id,p_actor,case when p_enabled then 'grant' else 'revoke' end,item.updated_at,result.evidence_sha256,result.source_url,coalesce(p_document->>'reason','Legacy expiry permission revoked'));
 return result;
end $$;

create function public.hide_editorial_legacy_entry(p_actor text,p_entry uuid,p_expected timestamptz,p_source text,p_checked timestamptz,p_verified boolean,p_evidence text,p_reason text)
returns public.organization_entries language plpgsql security invoker set search_path=public,pg_temp as $$
declare item public.organization_entries; result public.organization_entries; capability public.editorial_legacy_expiry_grants; parent public.organizations; org_id uuid;
begin
 if p_actor is distinct from 'cinegenius-editorial' or p_verified is distinct from true or p_checked is null or
    p_checked<clock_timestamp()-interval '10 minutes' or p_checked>clock_timestamp()+interval '30 seconds' or
    coalesce(char_length(btrim(p_reason)),0) not between 5 and 500 then raise sqlstate 'PT400' using message='review_required'; end if;
 select organization_id into org_id from organization_entries where id=p_entry;
 if not found then raise sqlstate 'PT404' using message='not_found'; end if;
 select * into parent from organizations where id=org_id for share;
 select * into item from organization_entries where id=p_entry for update;
 select * into capability from editorial_legacy_expiry_grants where entry_id=p_entry for update;
 if parent.moderation_status is distinct from 'approved' or capability.enabled is distinct from true or capability.used_at is not null or capability.valid_until<=clock_timestamp() then raise sqlstate 'PT403' using message='forbidden'; end if;
 if item.organization_id is distinct from capability.organization_id or item.author_user_id is distinct from capability.original_author_user_id or
    item.updated_at is distinct from p_expected or item.updated_at is distinct from capability.entry_revision or
    to_jsonb(item) is distinct from capability.entry_snapshot or item.external_url is distinct from capability.source_url or
    p_source is distinct from capability.source_url or p_evidence is distinct from capability.evidence_sha256 then raise sqlstate 'PT409' using message='conflict'; end if;
 if item.moderation_status not in ('approved','ended') or capability.content_expires_at>clock_timestamp() then raise sqlstate 'PT409' using message='review_required'; end if;
 update organization_entries set moderation_status='hidden',moderation_reason=btrim(p_reason),last_actor_user_id=p_actor where id=p_entry returning * into result;
 update editorial_legacy_expiry_grants set enabled=false,used_at=clock_timestamp(),updated_at=clock_timestamp() where entry_id=p_entry;
 insert into editorial_legacy_expiry_events(entry_id,actor_user_id,action,revision_at,evidence_sha256,source_url,reason)
 values(item.id,p_actor,'hide',result.updated_at,p_evidence,p_source,btrim(p_reason));
 return result;
end $$;
revoke all on function public.set_editorial_legacy_expiry_grant(text,uuid,timestamptz,boolean,jsonb),public.hide_editorial_legacy_entry(text,uuid,timestamptz,text,timestamptz,boolean,text,text) from public,anon,authenticated;
grant execute on function public.set_editorial_legacy_expiry_grant(text,uuid,timestamptz,boolean,jsonb),public.hide_editorial_legacy_entry(text,uuid,timestamptz,text,timestamptz,boolean,text,text) to service_role;
notify pgrst,'reload schema';
