import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
let pg;
const company='10000000-0000-4000-8000-000000000001',company2='10000000-0000-4000-8000-000000000002';
const migration=name=>readFileSync(new URL('../supabase/migrations/'+name,import.meta.url),'utf8');
before(async()=>{
 pg=new PGlite();
 const schema=readFileSync(new URL('./community-media-team-db.test.mjs',import.meta.url),'utf8').split('await pg.exec(`')[1].split('`);')[0].replaceAll('${company}',company).replaceAll('${company2}',company2);
 await pg.exec(schema);
 await pg.exec(`set timezone='UTC';alter table storage.buckets add name text,add file_size_limit bigint,add allowed_mime_types text[];
 alter table project_drafts add user_id text,add published_project_id uuid;alter table profiles add last_seen_at timestamptz;
 create table friendships(sender_id text,receiver_id text,status text);create table blocks(blocker_id text,blocked_id text);
 alter table notifications add column localization jsonb;`);
 for(const name of ['20261024090100_contact_visibility_controls.sql','20261024190000_public_community_media.sql','20261025150000_profile_company_discovery_only.sql','20261025151000_bound_discovery_query.sql','20261027180000_protected_media.sql','20261030170000_project_media_rights.sql','20261114005134_selective_community_image_lookup.sql','20261114180242_profile_privacy_controls.sql','20261116151505_account_inactivity.sql']) await pg.exec(migration(name));
});
after(async()=>pg?.close());
const rows=async(sql,args=[])=>(await pg.query(sql,args)).rows;
const one=async(sql,args=[])=>(await rows(sql,args))[0]?.value;
async function tx(fn){await pg.exec('begin');try{await fn();}finally{await pg.exec('rollback');}}
const state=()=>one("select to_jsonb(a) value from account_activity a where user_id='owner'");
const record=(at=null,exempt=false)=>one("select record_account_activity('owner',$1,$2) value",[at,exempt]);
const advance=(cycle=1)=>one("select advance_account_activity('owner',$1) value",[cycle]);
const mail=stage=>one("select to_jsonb(o) value from account_activity_outbox o where user_id='owner' and stage=$1 order by cycle desc limit 1",[stage]);
async function age(months){await pg.query("update account_activity set last_activity_at=now()-make_interval(months=>$1)-interval '1 minute',next_check_at=now() where user_id='owner'",[months]);}
const payload={from:'CineGenius <noreply@cinegenius.co>',to:'own@example.invalid',replyTo:'cinegenius.co@gmail.com',subject:'Own',html:'<p>Own</p>',text:'Own',locale:'de'};
async function bind(stage,cycle=1){const o=await mail(stage);return one('select bind_account_activity_mail($1,$2,$3,$4) value',[o.id,cycle,payload,{title:'Own notice',body:'Own body',localization:{version:1}}]);}
async function delivered(stage){const o=await bind(stage);await one('select finish_account_activity_mail($1,$2,$3) value',[o.id,o.cycle,'own-provider-id']);await one('select confirm_account_activity_delivery($1,$2,$3,$4) value',[o.id,o.cycle,'delivered',payload.to]);return o;}
async function throughWarning(){await record();await age(15);await advance();await delivered('reminder');await pg.exec("update account_activity set reminder_delivered_at=now()-interval '31 days'");await advance();await delivered('warning');}

test('no enrollment or hiding on migration; new enrollment gives all legacy accounts 12 months and one policy notice',()=>tx(async()=>{
 assert.equal(await one('select count(*)::int value from account_activity'),0);
 const old='2000-01-01T00:00:00Z';const first=await record(old);assert.ok(Date.parse(first.state.last_activity_at)>Date.now()-10000);
 await record(old);assert.equal(await one('select count(*)::int value from account_activity_outbox'),1);
 assert.equal((await advance()).stage,'active');assert.equal(await one("select coalesce(bool_or(account_inactive),false) value from user_settings"),false);
}));
test('12/15/18 calendar-month boundaries require confirmed delivery and full warning grace',()=>tx(async()=>{
 await record();await age(11);assert.equal((await advance()).stage,'active');await age(12);assert.equal((await advance()).stage,'reminder');
 await age(18);assert.equal((await advance()).stage,'reminder');await delivered('reminder');assert.equal((await advance()).stage,'reminder');
 await pg.exec("update account_activity set reminder_delivered_at=now()-interval '31 days'");assert.equal((await advance()).stage,'warning');
 assert.equal((await advance()).stage,'warning');await delivered('warning');assert.equal((await advance()).stage,'warning');
 await pg.exec("update account_activity set warning_delivered_at=now()-interval '31 days'");assert.equal((await advance()).stage,'paused');
 assert.equal(await one("select account_inactive value from user_settings where user_id='owner'"),true);
}));
test('24-month notice starts 30-day review grace on delivery, never on send or elapsed account age; no data deletion',()=>tx(async()=>{
 await throughWarning();await age(25);await pg.exec("update account_activity set warning_delivered_at=now()-interval '31 days'");await advance();await advance();
 assert.equal((await state()).stage,'deletion_pending');assert.equal((await state()).review_after,null);assert.equal((await advance()).stage,'deletion_pending');
 await delivered('deletion_pending');const s=await state();assert.ok(Date.parse(s.review_after)>=Date.now()+29*86400000);assert.equal((await advance()).stage,'deletion_pending');
 await pg.exec("update account_activity set review_after=now()-interval '1 second'");assert.equal((await advance()).stage,'review');assert.equal((await state()).issue,'retention_review');
 assert.equal(await one("select count(*)::int value from profiles where user_id='owner'"),1);
}));
test('reactivation cancels old cycle and deadline, rejects late callbacks and preserves saved privacy/publication',()=>tx(async()=>{
 await throughWarning();await age(25);await pg.exec("update account_activity set warning_delivered_at=now()-interval '31 days'");await advance();await advance();const old=await delivered('deletion_pending');
 await pg.exec("update user_settings set ghost_mode=true,profile_visibility='private' where user_id='owner'");const before=await one("select to_jsonb(p) value from profiles p where user_id='owner'");
 const result=await record();assert.equal(result.reactivated,true);assert.equal(result.state.cycle,2);assert.equal(result.state.review_after,null);
 assert.equal((await advance(1)).stale,true);assert.equal(await one('select confirm_account_activity_delivery($1,1,\'delivered\',$2) value',[old.id,payload.to]),false);
 assert.deepEqual(await one("select jsonb_build_array(ghost_mode,profile_visibility,account_inactive) value from user_settings where user_id='owner'"),[true,'private',false]);
 assert.deepEqual(await one("select to_jsonb(p) value from profiles p where user_id='owner'"),before);await record();assert.equal(await one("select count(*)::int value from account_activity_outbox where stage='reactivated'"),1);
 assert.equal(await one("select count(*)::int value from account_activity_outbox where cycle=1 and payload is not null"),0);
}));
test('frozen outbox and notification are deduplicated; expired uncertain send cannot be retried with a new key',()=>tx(async()=>{
 await record();await age(12);await advance();const a=await bind('reminder');const b=await bind('reminder');assert.deepEqual(a,b);
 assert.equal(await one('select count(*)::int value from notifications'),1);
 await pg.exec("update account_activity_outbox set first_attempt_at=now()-interval '24 hours' where stage='reminder'");assert.equal(await bind('reminder'),null);
 assert.equal((await mail('reminder')).status,'unknown');assert.equal((await state()).issue,'delivery_unknown');
}));
test('bounced or changed-recipient final mail removes the deadline; API acceptance is not delivery',()=>tx(async()=>{
 await record();await pg.exec("update account_activity set stage='deletion_pending';insert into account_activity_outbox(user_id,cycle,stage) values('owner',1,'deletion_pending')");
 const o=await bind('deletion_pending');await one('select finish_account_activity_mail($1,1,\'accepted\') value',[o.id]);assert.equal((await state()).review_after,null);
 assert.equal(await one('select confirm_account_activity_delivery($1,1,\'delivered\',\'different@example.invalid\') value',[o.id]),false);
 await one('select confirm_account_activity_delivery($1,1,\'delivered\',$2) value',[o.id,payload.to]);assert.ok((await state()).review_after);
 await one('select confirm_account_activity_delivery($1,1,\'recipient_changed\',$2) value',[o.id,payload.to]);assert.equal((await state()).review_after,null);
}));
test('worker lock prevents overlapping runs, only the lease owner can release; operators are exempt',()=>tx(async()=>{
 const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
 assert.equal(await one('select claim_account_activity_worker($1) value',[a]),0);assert.equal(await one('select claim_account_activity_worker($1) value',[b]),null);
 await one('select finish_account_activity_worker($1,99) value',[b]);assert.equal(await one('select claim_account_activity_worker($1) value',[b]),null);
 await one('select finish_account_activity_worker($1,100) value',[a]);assert.equal(await one('select claim_account_activity_worker($1) value',[b]),100);
 await record(null,true);await age(30);assert.equal((await advance()).stale,true);assert.equal(await one('select count(*)::int value from account_activity_outbox'),0);
}));
test('inactivity removes personal offers from counts and protects canonical media, independent company remains visible',()=>tx(async()=>{
 await record();await pg.exec("insert into user_settings(user_id,account_inactive) values('owner',true)");
 const key='owner/'+ 'f'.repeat(32)+'.webp';await pg.query("insert into media_assets(storage_path,reference_url,owner_user_id,mime_type) values($1,$2,'owner','image/webp')",[key,'/api/media/'+key]);
 await pg.query("update profiles set avatar_url=$1 where user_id='owner'",['/api/media/'+key]);
 await pg.exec("insert into friendships values('owner','other','accepted');insert into listings(id,user_id,type,published) values(gen_random_uuid(),'owner','prop',true)");
 await pg.query("insert into listings(id,user_id,type,published,company_id) values(gen_random_uuid(),'owner','prop',true,$1)",[company]);
 assert.equal(await one('select count(*)::int value from privacy_visible_listings'),1);
 for(const viewer of [null,'other'])assert.equal((await rows('select * from readable_media_asset($1,$2)',[key,viewer])).length,0);
 assert.equal((await rows('select * from readable_media_asset($1,\'owner\')',[key])).length,1);
 await record();assert.equal(await one('select count(*)::int value from privacy_visible_listings'),2);
}));
test('all state/outbox/worker tables and RPCs deny anon and authenticated execution',()=>tx(async()=>{
 for(const role of ['anon','authenticated']) {
  for(const table of ['account_activity','account_activity_outbox','account_activity_worker'])for(const permission of ['SELECT','INSERT','UPDATE','DELETE'])assert.equal(await one('select has_table_privilege($1,$2,$3) value',[role,table,permission]),false);
  const functions=await rows("select oid::regprocedure::text signature from pg_proc where proname like '%account_activity%'");
  for(const fn of functions)assert.equal(await one('select has_function_privilege($1,$2,\'EXECUTE\') value',[role,fn.signature]),false,fn.signature);
 }
}));

test('initial policy mail remains due despite active-session updates; non-deadline payloads are discarded after send',()=>tx(async()=>{
 await record();await record();const s=await state();assert.ok(Date.parse(s.next_check_at)<=Date.now()+1000);
 const o=await bind('policy');await one('select finish_account_activity_mail($1,1,\'policy-mail\') value',[o.id]);assert.equal((await mail('policy')).payload,null);
}));

test('review notifies each configured operator once, separate from the affected member',()=>tx(async()=>{
 await record();await pg.exec("update account_activity set stage='review';insert into account_activity_outbox(user_id,cycle,stage) values('owner',1,'review')");
 const o=await mail('review'),alerts=[{userId:'own-admin',title:'Own operator notice',body:'Own review body',localization:{version:1}},{userId:'second-admin',title:'Own operator notice',body:'Own review body',localization:{version:1}}];
 for(let n=0;n<2;n++)await one('select bind_account_activity_mail($1,1,$2,$3,$4) value',[o.id,payload,{title:'Own account notice',body:'Own body',localization:{version:1}},alerts]);
 assert.equal(await one('select count(*)::int value from notifications'),3);
 assert.deepEqual((await rows("select user_id,href from notifications where user_id<>'owner' order by user_id")),[{user_id:'own-admin',href:'/admin?tab=accounts'},{user_id:'second-admin',href:'/admin?tab=accounts'}]);
}));
