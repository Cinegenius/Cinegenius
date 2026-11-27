/** Pure SQL rendering; caller must freshly verify private bytes and catalogue. */
export function renderSeasonalImportSql(entries,revision) {
 if(!Number.isSafeInteger(revision)||revision<0||!Array.isArray(entries)||entries.length!==10)throw new Error('Invalid import');
 const literal=JSON.stringify(entries).replaceAll("'","''");
 return `begin;
set local lock_timeout='500ms';
select profile_art_private.lock_catalog();
do $import$ declare entry jsonb; existing profile_art_private.artworks%rowtype; job uuid;begin
 if (select catalog_revision from profile_art_private.pipeline_settings where singleton) <> ${revision} then raise exception 'ART_CATALOG_CHANGED';end if;
 if not exists(select 1 from information_schema.columns where table_schema='profile_art_private' and table_name='artworks' and column_name='seasonal_edition') then raise exception 'Seasonal migration required';end if;
 for entry in select value from jsonb_array_elements('${literal}'::jsonb) loop
  job:=(entry->>'artworkId')::uuid;
  select * into existing from profile_art_private.artworks where id=job;
  if found then
   if existing.source_sha256<>entry->>'sourceSHA256' or existing.media_key<>(entry->>'mediaKey')::uuid or existing.illustration_key<>entry->>'family' or existing.seasonal_edition is distinct from entry->>'edition' or existing.seasonal_slot is distinct from (entry->>'slot')::smallint then raise exception 'ART_IDENTITY_MISMATCH';end if;
   continue;
  end if;
  insert into profile_art_private.refill_jobs(id,request_key,kind,media_key,state,presentation,candidate,seasonal_edition,completed_at)
   values(job,job,'avatar',(entry->>'mediaKey')::uuid,'review','neutral',entry->'candidate',case when entry->>'edition'='winter-2026' then 'winter-2026' else null end,clock_timestamp());
  insert into profile_art_private.catalog_fingerprints values('job_'||job::text,entry->>'sourceSHA256',entry->'fingerprint');
  perform profile_art_private.approve_candidate(job,(select catalog_revision from profile_art_private.pipeline_settings where singleton),entry->>'family','Operator-requested seasonal vector collection; visually checked composition: '||(entry->>'name'),entry->>'byteSHA256');
  update profile_art_private.artworks set presentation='neutral',seasonal_edition=entry->>'edition',seasonal_slot=(entry->>'slot')::smallint where id=job;
 end loop;
end $import$;
-- Apply only AFTER the deployed worker understands seasonalEdition.
update profile_art_private.seasonal_editions set refill_enabled=true where id='winter-2026';
commit;
`;
}
