import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {placeWriteFields} from './places/catalog.ts';
import {organizationTestBootstrap} from './test-fixtures/organization-database.mjs';
const migration=await readFile(new URL('../supabase/migrations/20261109170000_canonical_places.sql',import.meta.url),'utf8');
const run='b626cd0e-041a-44e7-a737-3ba67c45278b';
async function fixture(){
 const db=new PGlite();await db.exec(`create role anon; create role authenticated; create role service_role;
 create table profiles(user_id text primary key,location text,location_city text,location_region text,location_country text);
 create table companies(id text primary key,city text);
 create table listings(id text primary key,user_id text,city text,type text,published boolean);
 create table projects(id text primary key,country text,shoot_locations jsonb,metadata jsonb);
 create table organizations(id text primary key,city text,region text);
 create table organization_entries(id text primary key,city text);
 insert into profiles(user_id,location) values ('member-1','Cologne, Germany'),('member-2','Bayern, Deutschland'),('member-3','Frankfurt, DE');
 insert into listings values ('listing-1','member-1','Köln, DE','prop',true),('private-listing','member-2','Tokyo, JP','prop',false);`);
 await db.exec(migration);return db;
}
async function read(db,table,id){const key=table==='profiles'?'user_id':'id';const current=(await db.query(`select to_jsonb(t) as row,place_snapshot(to_jsonb(t)) as snapshot from ${table} t where ${key}=$1`,[id])).rows[0];if(table==='profiles'&&current)current.snapshot.profile_legacy=Object.fromEntries(['location_city','location_region','location_country'].map(key=>[key,current.row[key]??null]));if(table==='organizations'&&current)current.snapshot.organization_sources={region:current.row.region??null};if(table==='projects'&&current){const row=current.row;current.snapshot.project_sources={country:row.country??null,shoot_locations:row.shoot_locations??null,metadata_location:row.metadata?.location??null,metadata_country:row.metadata?.project_details?.country??null,metadata_shoot_locations:row.metadata?.project_details?.shoot_locations??null};}return current;}
async function apply(db,table,id,raw,fields){const current=await read(db,table,id);return (await db.query('select apply_place_mapping($1,$2,$3,$4,$5,$6) as status',[table,id,raw,current.snapshot,fields,run])).rows[0].status;}
test('migration is repeatable; backfill is additive, idempotent and reversible',async()=>{
 const db=await fixture();try{
 await db.exec(migration);
 const fields=placeWriteFields('Cologne, Germany');assert.equal(await apply(db,'profiles','member-1','Cologne, Germany',fields),'applied');
 assert.equal(await apply(db,'profiles','member-1','Cologne, Germany',fields),'unchanged');
 assert.equal((await read(db,'profiles','member-1')).row.location,'Cologne, Germany');
 const before=(await db.query('select count(*)::int as count from profiles')).rows[0].count;
 const rollback=(await db.query('select rollback_place_run($1) as result',[run])).rows[0].result;
 assert.equal(rollback.restored,1);assert.equal((await read(db,'profiles','member-1')).row.place_city_id,null);
 assert.equal((await db.query('select count(*)::int as count from profiles')).rows[0].count,before);
 }finally{await db.close();}
});
test('concurrent edits conflict and later raw edits invalidate IDs instead of being overwritten by rollback',async()=>{
 const db=await fixture();try{
 const expected=(await read(db,'profiles','member-1')).snapshot;await db.query("update profiles set location='Wien, AT' where user_id='member-1'");
 const result=await db.query('select apply_place_mapping($1,$2,$3,$4,$5,$6) as status',['profiles','member-1','Cologne, Germany',expected,placeWriteFields('Cologne, Germany'),run]);assert.equal(result.rows[0].status,'conflict');
 await apply(db,'profiles','member-1','Wien, AT',placeWriteFields('Wien, AT'));await db.query("update profiles set location='Unclear place' where user_id='member-1'");
 assert.equal((await read(db,'profiles','member-1')).row.place_city_id,null);
 const rollback=(await db.query('select rollback_place_run($1) as result',[run])).rows[0].result;assert.equal(rollback.conflicts,1);
 assert.equal((await read(db,'profiles','member-1')).row.location,'Unclear place');
 }finally{await db.close();}
});
test('journal uses listing identity, public options exclude private rows and clients cannot execute backfills',async()=>{
 const db=await fixture();try{
 await apply(db,'listings','listing-1','Köln, DE',placeWriteFields('Köln, DE'));await apply(db,'listings','private-listing','Tokyo, JP',placeWriteFields('Tokyo, JP'));
 const keys=(await db.query('select row_id from place_change_journal order by id')).rows.map(r=>r.row_id);assert.deepEqual(keys,['listing-1','private-listing']);
 const rows=(await db.query("select public_place_options('marketplace') as rows")).rows[0].rows;assert.equal(rows.length,1);assert.equal(rows[0].place_city_id,'geonames:2886242');
 await db.exec('set role authenticated');await assert.rejects(()=>db.query('select rollback_place_run($1)',[run]),/permission denied/);
 await assert.rejects(()=>db.query('select * from place_change_journal'),/permission denied/);
 }finally{await db.close();}
});

test('project location metadata and country-only values are retained through mapping and rollback',async()=>{
 const db=await fixture();try{
 await db.query(`insert into projects(id,metadata) values ('p1',$1)`,[{location:'Cologne, DE',project_details:{country:'Germany',shoot_locations:['Frankfurt','Japan']},unrelated:'preserved'}]);
 const before=(await read(db,'projects','p1')).row.metadata;
 assert.equal(await apply(db,'projects','p1','Cologne, DE',placeWriteFields('Cologne, DE')),'applied');
 assert.deepEqual((await read(db,'projects','p1')).row.metadata,before);
 await db.query('select rollback_place_run($1)',[run]);assert.deepEqual((await read(db,'projects','p1')).row.metadata,before);
 await db.query(`insert into projects(id,metadata) values ('p2',$1)`,[{project_details:{country:'Germany'}}]);
 assert.equal(await apply(db,'projects','p2','Germany',placeWriteFields('Germany')),'applied');
 assert.equal((await read(db,'projects','p2')).row.place_city_id,null);
 await apply(db,'profiles','member-1','Cologne, Germany',placeWriteFields('Cologne, Germany'));
 await db.query(`update profiles set location_city='Conflicting legacy value' where user_id='member-1'`);
 assert.equal((await read(db,'profiles','member-1')).row.place_status,'pending');
 }finally{await db.close();}
});

async function moderationFixture(){
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role;
 create table profiles(user_id text primary key,display_name text);
 create table companies(id uuid primary key,owner_user_id text,name text,published boolean);
 create table listings(id uuid primary key,user_id text,company_id uuid,type text,category text,title text,description text,price numeric,city text,image_url text,extra_images jsonb,metadata jsonb,published boolean default true,view_count int default 0);
 create table company_equipment(id uuid primary key,company_id uuid,name text,category text,description text,images jsonb,published boolean default true);
 create table admin_audit_log(id uuid primary key default gen_random_uuid(),actor_user_id text,action text,entity_type text,entity_id text,reason text,outcome text,metadata jsonb);
 create table notifications(id uuid primary key default gen_random_uuid(),user_id text,type text,title text,body text,href text);
 insert into listings(id,user_id,type,title,description,city,published) values
 ('10000000-0000-4000-8000-000000000001','own-member','location','Own legacy location','Original','Cologne, Germany',true),
 ('10000000-0000-4000-8000-000000000002','own-member','location','Own approved location','Original','Cologne, Germany',true),
 ('10000000-0000-4000-8000-000000000003','own-member','prop','Own published prop','Original','Cologne, Germany',true);`);
 for(const name of ['20261028200000_offer_moderation.sql','20261028210000_marketplace_profile_publication.sql','20261029020000_admin_review_discretion.sql']){
  await db.exec(await readFile(new URL(`../supabase/migrations/${name}`,import.meta.url),'utf8'));
 }
 await db.exec(`begin;
 select set_config('cinegenius.offer_actor','own-admin',true),set_config('cinegenius.offer_action','approve',true);
 update listings set published=true where id='10000000-0000-4000-8000-000000000002';
 select set_config('cinegenius.offer_actor','own-member',true),set_config('cinegenius.offer_action','owner_publish',true);
 update listings set published=true where id='10000000-0000-4000-8000-000000000003';
 commit;`);
 await db.exec(migration);return db;
}
function reviewState(row){return Object.fromEntries(['published','moderation_status','content_revision','reviewed_revision','reviewed_at','reviewed_by','submitted_at','submitted_by','moderation_reason'].map(key=>[key,row[key]]));}
test('integrated mapping and rollback preserve publication and reviews under installed moderation guards',async()=>{
 const db=await moderationFixture();try{
 await db.exec(migration); // The coordinated guard patch must also be repeatable.
 const ids=['10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003'];
 const states=[];
 for(const id of ids){
  const before=(await read(db,'listings',id)).row;states.push(reviewState(before));
  assert.equal(before.published,true);
  assert.equal(await apply(db,'listings',id,'Cologne, Germany',placeWriteFields('Cologne, Germany')),'applied');
  const after=(await read(db,'listings',id)).row;assert.deepEqual(reviewState(after),reviewState(before));assert.equal(after.place_city_id,'geonames:2886242');
 }
 assert.deepEqual(states.map(state=>state.moderation_status),['legacy_review_required','approved','owner_published']);
 const rollback=(await db.query('select rollback_place_run($1) as result',[run])).rows[0].result;
 assert.equal(rollback.restored,3);assert.equal(rollback.conflicts,0);
 for(const [index,id] of ids.entries()){
  const row=(await read(db,'listings',id)).row;assert.deepEqual(reviewState(row),states[index]);assert.equal(row.place_city_id,null);
 }
 // Ordinary editor writes still invalidate approval, even if only a stored
 // country/city path changed while the compatibility city text stayed equal.
 await db.query("update listings set place_country_code='US',place_city_id='geonames:123',place_city_name='Other city',place_status='verified',place_original='Other city, US' where id=$1",[ids[1]]);
 const edited=(await read(db,'listings',ids[1])).row;assert.equal(edited.published,false);assert.equal(edited.moderation_status,'pending');assert.equal(edited.content_revision,states[1].content_revision+1);
 // Non-place material is never exempted by a mapping context.
 await db.exec('begin');await db.query("select set_config('cinegenius.place_run',$1,true)",[run]);
 await db.query('update listings set description=$1 where id=$2',['Edited description',ids[0]]);await db.exec('commit');
 assert.equal((await read(db,'listings',ids[0])).row.published,false);
 }finally{await db.close();}
});
test('ordinary saves create no location history; parent deletion atomically erases its mapping journal',async()=>{
 const db=await fixture();try{
 await db.query("insert into profiles(user_id,location) values ('ordinary-new','Private village, CH')");
 await db.query("update profiles set location='Other private village, CH' where user_id='ordinary-new'");
 assert.equal((await db.query('select count(*)::int n from place_change_journal')).rows[0].n,0);
 await apply(db,'profiles','member-1','Cologne, Germany',placeWriteFields('Cologne, Germany'));
 await apply(db,'listings','listing-1','Köln, DE',placeWriteFields('Köln, DE'));
 await db.query("update profiles set location='Private move, CH' where user_id='member-1'");
 assert.equal((await db.query('select count(*)::int n from place_change_journal')).rows[0].n,2);
 await db.exec("begin;delete from profiles where user_id='member-1'");
 assert.equal((await db.query("select count(*)::int n from place_change_journal where source_table='profiles'")).rows[0].n,0);
 await db.exec('rollback');
 assert.equal((await db.query("select count(*)::int n from place_change_journal where source_table='profiles'")).rows[0].n,1);
 await db.query("delete from profiles where user_id='member-1'");
 const remaining=(await db.query('select source_table,row_id from place_change_journal')).rows;assert.deepEqual(remaining,[{source_table:'listings',row_id:'listing-1'}]);
 }finally{await db.close();}
});
test('journal cleanup is service-only and retains the operational thirty-day rollback window',async()=>{
 const db=await fixture();try{
 await apply(db,'profiles','member-1','Cologne, Germany',placeWriteFields('Cologne, Germany'));
 await apply(db,'listings','listing-1','Köln, DE',placeWriteFields('Köln, DE'));
 await db.query("update place_change_journal set changed_at=now()-interval '31 days' where source_table='profiles'");
 for(const role of ['anon','authenticated']){
  await db.exec(`set role ${role}`);await assert.rejects(()=>db.query('select purge_place_change_journal()'),/permission denied/);await db.exec('reset role');
 }
 await db.exec('set role service_role');assert.equal((await db.query('select purge_place_change_journal() removed')).rows[0].removed,1);await db.exec('reset role');
 assert.deepEqual((await db.query('select source_table from place_change_journal')).rows,[{source_table:'listings'}]);
 const current=await read(db,'profiles','member-1');await assert.rejects(()=>db.query('select apply_place_mapping($1,$2,$3,$4,$5,$6)',['profiles','member-1','Cologne, Germany',current.snapshot,placeWriteFields('Cologne, Germany'),null]),/explicit place mapping run/);
 }finally{await db.close();}
});
test('profile mappings detect parallel-source edits even when raw and pending canonical snapshots are unchanged',async()=>{
 const db=await fixture();try{
 for(const column of ['location_city','location_region','location_country']){
  await db.query("update profiles set location='Uncertain, DE',location_city=null,location_region=null,location_country=null where user_id='member-3'");
  const before=await read(db,'profiles','member-3');
  await db.query(`update profiles set ${column}=$1 where user_id='member-3'`,['Member correction']);
  const after=await read(db,'profiles','member-3');
  assert.equal(after.row.location,before.row.location);
  assert.deepEqual(Object.fromEntries(Object.entries(after.snapshot).filter(([key])=>key!=='profile_legacy')),Object.fromEntries(Object.entries(before.snapshot).filter(([key])=>key!=='profile_legacy')));
  const stale=await db.query('select apply_place_mapping($1,$2,$3,$4,$5,$6) status',['profiles','member-3','Uncertain, DE',before.snapshot,placeWriteFields('Cologne, DE'),run]);
  assert.equal(stale.rows[0].status,'conflict');assert.equal((await read(db,'profiles','member-3')).row[column],'Member correction');
  // Requests from older clients fail closed for profiles; other table contracts
  // are unchanged and remain covered by the listing tests above.
  const withoutLegacy={...after.snapshot};delete withoutLegacy.profile_legacy;
  const oldClient=await db.query('select apply_place_mapping($1,$2,$3,$4,$5,$6) status',['profiles','member-3','Uncertain, DE',withoutLegacy,placeWriteFields('Cologne, DE'),run]);assert.equal(oldClient.rows[0].status,'conflict');
 }
 // A later parallel edit must also block rollback, not merely the first apply.
 await apply(db,'profiles','member-1','Cologne, Germany',placeWriteFields('Cologne, Germany'));
 await db.query("update profiles set location_country='CH',place_country_code=null,place_region_id=null,place_city_id=null,place_city_name=null,place_region_name=null,place_status='pending' where user_id='member-1'");
 const result=(await db.query('select rollback_place_run($1) result',[run])).rows[0].result;assert.equal(result.restored,0);assert.equal(result.conflicts,1);assert.equal((await read(db,'profiles','member-1')).row.location_country,'CH');
 }finally{await db.close();}
});
test('production profile schema without optional legacy columns supports mapping and rollback',async()=>{
 const db=await fixture();try{
 await db.exec('alter table profiles drop column location_city,drop column location_region,drop column location_country');
 await db.exec(migration);
 assert.equal(await apply(db,'profiles','member-1','Cologne, Germany',placeWriteFields('Cologne, Germany')),'applied');
 const result=(await db.query('select rollback_place_run($1) result',[run])).rows[0].result;assert.equal(result.restored,1);assert.equal(result.conflicts,0);assert.equal((await read(db,'profiles','member-1')).row.location,'Cologne, Germany');
 }finally{await db.close();}
});
test('project top-level production countries and shoot sources remain independent and are concurrency checked',async()=>{
 const db=await fixture();try{
 const country='Germany',shoots=['Tokyo, JP'],metadata={location:'Cologne, DE',project_details:{country:'Germany',shoot_locations:['Tokyo, JP']},unrelated:{keep:true}};
 await db.query('insert into projects(id,country,shoot_locations,metadata) values ($1,$2,$3,$4)',['separate',country,shoots,metadata]);
 assert.equal(await apply(db,'projects','separate','Cologne, DE',placeWriteFields('Cologne, DE')),'applied');
 const mapped=(await read(db,'projects','separate')).row;assert.equal(mapped.place_country_code,'DE');assert.deepEqual(mapped.shoot_locations,shoots);assert.equal(mapped.country,country);assert.deepEqual(mapped.metadata,metadata);
 const rollback=(await db.query('select rollback_place_run($1) result',[run])).rows[0].result;assert.equal(rollback.restored,1);assert.deepEqual((await read(db,'projects','separate')).row.metadata,metadata);
 await db.query('insert into projects(id,country,shoot_locations,metadata,place_original) values ($1,$2,$3,$4,$5)',['country-only','Germany',['Tokyo, JP'],{project_details:{country:'Deutschland'}},'Germany']);
 const before=await read(db,'projects','country-only');
 await db.query("update projects set shoot_locations=$1 where id='country-only'",[['Wien, AT']]);
 const after=await read(db,'projects','country-only');assert.equal(after.row.place_original,before.row.place_original);
 const canonical=snapshot=>Object.fromEntries(Object.entries(snapshot).filter(([key])=>key!=='project_sources'));assert.deepEqual(canonical(after.snapshot),canonical(before.snapshot));
 assert.equal((await db.query('select apply_place_mapping($1,$2,$3,$4,$5,$6) status',['projects','country-only','Germany',before.snapshot,placeWriteFields('Germany'),run])).rows[0].status,'conflict');
 assert.equal(await apply(db,'projects','country-only','Germany',placeWriteFields('Germany')),'applied');assert.equal((await read(db,'projects','country-only')).row.place_city_id,null);
 // Metadata objects are preserved as sources and never stringified into a city.
 const row={country:'Japan',metadata:{location:{unexpected:'preserved'},project_details:{country:'Germany'}}};
 assert.equal((await db.query("select place_legacy_value('projects',$1) raw",[row])).rows[0].raw,'Japan');
 }finally{await db.close();}
});
test('organization coverage text is preserved separately and never supplies an inferred country',async()=>{
 const db=await fixture();try{
 await db.query("insert into organizations(id,city,region,place_original) values ('own-org','Cologne','Deutschland · bundesweit','Cologne')");
 const before=await read(db,'organizations','own-org');assert.equal((await db.query("select place_legacy_value('organizations',$1) raw",[before.row])).rows[0].raw,'Cologne');
 await db.query("update organizations set region='Schweiz' where id='own-org'");
 const after=await read(db,'organizations','own-org');assert.deepEqual(Object.fromEntries(Object.entries(after.snapshot).filter(([key])=>key!=='organization_sources')),Object.fromEntries(Object.entries(before.snapshot).filter(([key])=>key!=='organization_sources')));
 const fields={...placeWriteFields('Cologne, DE'),place_original:'Cologne'};
 assert.equal((await db.query('select apply_place_mapping($1,$2,$3,$4,$5,$6) status',['organizations','own-org','Cologne',before.snapshot,fields,run])).rows[0].status,'conflict');
 assert.equal(await apply(db,'organizations','own-org','Cologne',fields),'applied');
 await db.query("update organizations set region='Europa' where id='own-org'");
 const edited=(await read(db,'organizations','own-org')).row;assert.equal(edited.region,'Europa');assert.equal(edited.city,'Cologne');assert.equal(edited.place_city_id,'geonames:2886242');assert.equal(edited.place_status,'verified');
 const rollback=(await db.query('select rollback_place_run($1) result',[run])).rows[0].result;assert.equal(rollback.conflicts,1);assert.equal(rollback.restored,0);
 }finally{await db.close();}
});

async function sideEffectFixture(){
 const db=new PGlite();await db.exec(organizationTestBootstrap);
 await db.exec(`alter table profiles add column location text,add column avatar_url text;
 alter table companies add column city text,add column owner_user_id text,add column name text,add column logo_url text;
 alter table listings add column user_id text,add column company_id uuid,add column type text,add column category text,add column title text,add column description text,add column price numeric,add column city text,add column image_url text,add column extra_images jsonb,add column metadata jsonb,add column published boolean default true,add column view_count int default 0;
 alter table projects add column country text,add column shoot_locations jsonb,add column metadata jsonb,add column created_by text,add column poster_url text;
 alter table community_posts add column city text,add column author_id text,add column image_url text;
 alter table company_equipment add column company_id uuid,add column name text,add column category text,add column description text,add column images jsonb,add column published boolean default true;`);
 await db.exec(await readFile(new URL('../supabase/migrations/20261103170000_organizations_and_news.sql',import.meta.url),'utf8'));
 const ids={companies:'21000000-0000-4000-8000-000000000001',listings:'21000000-0000-4000-8000-000000000002',projects:'21000000-0000-4000-8000-000000000003',community_posts:'21000000-0000-4000-8000-000000000004',organizations:'21000000-0000-4000-8000-000000000005',organization_entries:'21000000-0000-4000-8000-000000000006',profiles:'own-profile'};
 await db.query("insert into profiles(user_id,display_name,location,avatar_url) values ('own-profile','Own profile','Cologne, DE','/api/media/own-profile/profile.webp')");
 await db.query("insert into companies(id,published,city,owner_user_id,name,logo_url) values ($1,true,'Cologne, DE','own-profile','Own company','/api/media/own-profile/company.webp')",[ids.companies]);
 await db.query("insert into listings(id,user_id,type,title,description,city,image_url,published) values ($1,'own-profile','prop','Own offer','Original','Cologne, DE','/api/media/own-profile/listing.webp',true)",[ids.listings]);
 await db.query("insert into projects(id,created_by,metadata,poster_url) values ($1,'own-profile',$2,'/api/media/own-profile/project.webp')",[ids.projects,{location:'Cologne, DE'}]);
 await db.query("insert into community_posts(id,city,author_id,image_url) values ($1,'Cologne, DE','own-profile','/api/media/own-profile/post.webp')",[ids.community_posts]);
 await db.query("insert into organizations(id,owner_user_id,last_actor_user_id,responsible_user_id,slug,name,city,region,logo_url,moderation_status) values ($1,'own-profile','own-admin','own-profile','own-organization','Own organization','Cologne, DE','Deutschland · bundesweit','/api/media/own-profile/org.webp','approved')",[ids.organizations]);
 await db.query("insert into organization_entries(id,organization_id,author_user_id,last_actor_user_id,slug,entry_type,title,city,image_url,moderation_status) values ($1,$2,'own-profile','own-admin','own-entry','news','Own entry','Cologne, DE','/api/media/own-profile/entry.webp','approved')",[ids.organization_entries,ids.organizations]);
 for(const name of ['20261028200000_offer_moderation.sql','20261028210000_marketplace_profile_publication.sql','20261029020000_admin_review_discretion.sql'])await db.exec(await readFile(new URL(`../supabase/migrations/${name}`,import.meta.url),'utf8'));
 // These uploads were already referenced by legacy rows but remain unbound;
 // a location backfill must not establish new origin or public-read rights.
 for(const name of ['profile','company','listing','project','post','org','entry'])await db.query('insert into media_assets(storage_path,reference_url,owner_user_id,mime_type) values ($1,$2,$3,$4)',[`own-profile/${name}.webp`,`/api/media/own-profile/${name}.webp`,'own-profile','image/webp']);
 return {db,ids};
}
const withoutPlaces=row=>Object.fromEntries(Object.entries(row).filter(([key])=>!['place_country_code','place_region_id','place_city_id','place_city_name','place_region_name','place_status','place_original'].includes(key)));
test('real revision, moderation and media triggers have no side effects during service mapping or rollback',async()=>{
 const {db,ids}=await sideEffectFixture();try{
 const functions=()=>db.query("select proname,prosecdef,proconfig,proacl::text as acl from pg_proc where pronamespace='public'::regnamespace and proname in ('guard_offer_moderation','bind_media_source','organization_revision_guard','organization_revision_history') order by proname");
 const permissions=(await functions()).rows;await db.exec(migration);await db.exec(migration);
 assert.deepEqual((await functions()).rows,permissions);
 const before={};for(const [table,id] of Object.entries(ids))before[table]=(await read(db,table,id)).row;
 const eventsBefore=(await db.query('select * from organization_moderation_events order by id')).rows;
 const offerEventsBefore=(await db.query('select * from offer_moderation_events order by id')).rows;
 const mediaBefore=(await db.query('select * from media_assets order by storage_path')).rows;
 for(const [table,id] of Object.entries(ids)){
  const current=await read(db,table,id);await db.exec('set role service_role');
  const result=await db.query('select apply_place_mapping($1,$2,$3,$4,$5,$6) status',[table,id,'Cologne, DE',current.snapshot,placeWriteFields('Cologne, DE'),run]);
  assert.equal(result.rows[0].status,'applied');await db.exec('reset role');
  assert.deepEqual(withoutPlaces((await read(db,table,id)).row),withoutPlaces(before[table]),table);
 }
 assert.deepEqual((await db.query('select * from organization_moderation_events order by id')).rows,eventsBefore);
 assert.deepEqual((await db.query('select * from offer_moderation_events order by id')).rows,offerEventsBefore);
 assert.deepEqual((await db.query('select * from media_assets order by storage_path')).rows,mediaBefore);
 await db.exec('set role service_role');const rollback=(await db.query('select rollback_place_run($1) result',[run])).rows[0].result;await db.exec('reset role');assert.equal(rollback.restored,7);assert.equal(rollback.conflicts,0);
 for(const [table,id] of Object.entries(ids))assert.deepEqual((await read(db,table,id)).row,before[table],table);
 assert.deepEqual((await db.query('select * from organization_moderation_events order by id')).rows,eventsBefore);
 assert.deepEqual((await db.query('select * from offer_moderation_events order by id')).rows,offerEventsBefore);
 assert.deepEqual((await db.query('select * from media_assets order by storage_path')).rows,mediaBefore);
 // A context-shaped setting cannot hide a genuine content edit, actor change,
 // revision timestamp, moderation event or the resulting media association.
 await db.exec('begin');await db.query("select set_config('cinegenius.place_run',$1,true),set_config('cinegenius.place_table','organizations',true),set_config('cinegenius.place_row',$2,true)",[run,ids.organizations]);
 await db.query("update organizations set description='Owner content edit',last_actor_user_id='own-editor',place_city_name='Changed derived name' where id=$1",[ids.organizations]);await db.exec('commit');
 const edited=(await read(db,'organizations',ids.organizations)).row;assert.notEqual(edited.updated_at,before.organizations.updated_at);
 assert.equal((await db.query('select count(*)::int n from organization_moderation_events')).rows[0].n,eventsBefore.length+1);
 assert.equal((await db.query("select source_type from media_assets where storage_path='own-profile/org.webp'")).rows[0].source_type,'organization');
 // Ordinary city and image edits retain the real binder and revision guards.
 await db.query("update organization_entries set city='Wien, AT',last_actor_user_id='own-editor' where id=$1",[ids.organization_entries]);
 assert.notEqual((await read(db,'organization_entries',ids.organization_entries)).row.updated_at,before.organization_entries.updated_at);
 assert.equal((await db.query("select source_type from media_assets where storage_path='own-profile/entry.webp'")).rows[0].source_type,'organization_entry');
 await db.query("update profiles set location='Wien, AT' where user_id='own-profile'");
 assert.equal((await db.query("select source_type from media_assets where storage_path='own-profile/profile.webp'")).rows[0].source_type,'profile');
 await db.query("insert into media_assets(storage_path,reference_url,owner_user_id,mime_type) values ('own-profile/new.webp','/api/media/own-profile/new.webp','own-profile','image/webp')");
 await db.query("update profiles set avatar_url='/api/media/own-profile/new.webp' where user_id='own-profile'");
 assert.equal((await db.query("select source_type from media_assets where storage_path='own-profile/new.webp'")).rows[0].source_type,'profile');
 for(const role of ['anon','authenticated'])assert.equal((await db.query("select has_function_privilege($1,'place_is_mapping_only(text,jsonb,jsonb)','execute') allowed",[role])).rows[0].allowed,false);
 }finally{await db.close();}
});
test('unknown side-effect trigger definitions abort the additive rollout atomically',async()=>{
 const {db}=await sideEffectFixture();try{
 await db.exec("create or replace function bind_media_source() returns trigger language plpgsql security definer as $$begin return new;end$$");
 const original=(await db.query("select prosrc from pg_proc where oid='bind_media_source()'::regprocedure")).rows[0].prosrc;
 await assert.rejects(()=>db.exec(migration),/Unknown trigger definition for bind_media_source/);await db.exec('rollback');
 assert.equal((await db.query("select count(*)::int n from information_schema.columns where table_schema='public' and column_name='place_city_id'")).rows[0].n,0);
 assert.equal((await db.query("select prosrc from pg_proc where oid='bind_media_source()'::regprocedure")).rows[0].prosrc,original);
 assert.equal((await db.query("select to_regprocedure('public.apply_place_mapping(text,text,text,jsonb,jsonb,uuid)') as mapping")).rows[0].mapping,null);
 }finally{await db.close();}
});
