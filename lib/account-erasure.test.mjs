import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {PGlite} from '@electric-sql/pglite';
import ts from 'typescript';
const require=createRequire(import.meta.url),{NextResponse}=require('next/server');
const a='user_testA',b='user_testB',admin='user_admin';let pg,server,api,adminApi,actor=a,isAdmin=false,authFails=false,removeFails=false,deleteFails=false,noticeFails=false,removed=[],identities=[],notices=[],mailUsers=new Map(),clock;
const environment={};
const root=new URL('../',import.meta.url);const sql=(s,p)=>pg.query(s,p);
const rpc=async(action,id=null,payload={},who=admin)=>(await sql('select public.account_erasure($1,$2,$3,$4) value',[who,action,id,payload])).rows[0].value;
const resetUser=id=>mailUsers.set(id,{id,primaryEmailAddressId:'primary',emailAddresses:[{id:'primary',emailAddress:id+'@example.test',verification:{status:'verified'}}],unsafeMetadata:{locale:'de'},privateMetadata:{}});
before(async()=>{
 pg=new PGlite();await pg.exec(`create role anon;create role authenticated;create role service_role;
 create schema storage;create table storage.objects(bucket_id text,name text,primary key(bucket_id,name));
 create table user_settings(user_id text primary key,ghost_mode boolean,profile_visibility text,show_in_home_crew boolean);
 create table profiles(user_id text primary key,avatar_url text,cover_image_url text,portfolio_images jsonb,profile_images jsonb);
 create table media_assets(storage_path text primary key,owner_user_id text,source_type text,source_id text,legacy_reference text);
 create table private_form_drafts(user_id text,form_key text,draft_data jsonb);
 create table notifications(id text,user_id text,body text);create table projects(id text,created_by text,title text);
 create table newsletter_subscriptions(id text,email text);create table rate_limit_buckets(key text,count integer,window_end timestamptz);
 create schema content_translation_private;create table content_translation_private.cache(kind text,source_id text,fields jsonb);
 create schema profile_art_private;create table profile_art_private.artworks(id text primary key,state text);
 create table profile_art_private.claims(artwork_id text references profile_art_private.artworks(id),user_id text);
 `);
 await pg.exec(readFileSync(new URL('supabase/migrations/20261125165142_account_erasure_requests.sql',root),'utf8'));
 const db={rpc:async(_,p)=>{try{return{data:await rpc(p.p_action,p.p_id,p.p_payload,p.p_actor),error:null};}catch(e){return{data:null,error:{code:e.code,message:'PRIVATE_SQL'}};}},storage:{from:bucket=>({remove:async paths=>{removed.push({bucket,paths});if(removeFails)return{error:{message:'PRIVATE_STORAGE'}};for(const path of paths)await sql('delete from storage.objects where bucket_id=$1 and name=$2',[bucket,path]);return{error:null};}})},from:table=>{assert.equal(table,'newsletter_subscriptions');let emails;const q={select:()=>q,in:(_,values)=>{emails=values;return q},limit:async()=>({data:(await sql('select id from newsletter_subscriptions where lower(email)=any($1::text[]) limit 1',[emails])).rows,error:null})};return q;}};
 const mocks={'node:crypto':require('node:crypto'),'server-only':{},'@/lib/db':{db},'@/lib/auth':{requireAuth:async()=>{if(authFails)throw Error('PRIVATE_AUTH_DETAIL');return actor?{userId:actor}:NextResponse.json({error:'unauthorized'},{status:401});},requireAdmin:async()=>{if(authFails)throw Error('PRIVATE_AUTH_DETAIL');return actor&&isAdmin?{userId:actor}:NextResponse.json({error:'forbidden'},{status:403});}},'next/server':{NextResponse},'next-intl/server':{getTranslations:async()=>key=>key},'@clerk/nextjs/server':{clerkClient:async()=>({users:{getUser:async id=>{if(!mailUsers.has(id))throw{status:404,errors:[{code:'resource_not_found'}]};return mailUsers.get(id);},deleteUser:async id=>{identities.push(id);if(deleteFails)throw Error('PRIVATE_CLERK');mailUsers.delete(id);return{id};}}})},'./account-erasure-email':{sendErasureAlert:async id=>{notices.push({id,kind:'alert'});},sendErasureNotice:async(id,value)=>{notices.push({id,...value});if(noticeFails)throw Error('PRIVATE_MAIL');}}};
 const cache=new Map();function load(relative){if(cache.has(relative))return cache.get(relative);const mod={exports:{}};cache.set(relative,mod.exports);const source=ts.transpileModule(readFileSync(new URL(relative,root),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;new Function('require','module','exports','process',source)(name=>{if(mocks[name])return mocks[name];if(name.startsWith('@/'))return load(name.slice(2)+'.ts');if(name.startsWith('.'))return load(new URL(name+'.ts',new URL(relative,root)).pathname.slice(root.pathname.length));throw Error('Unexpected import '+name);},mod,mod.exports,{env:environment});return mod.exports;}
 server=load('lib/account-erasure-server.ts');api=load('app/api/account/route.ts');adminApi=load('app/api/admin/privacy-requests/route.ts');clock=new Date();
});
after(async()=>pg?.close());
const policy=()=>rpc('policy_save',null,{revision:1,enabled:true,evidence:'Synthetic verified policy, no real service approval',validUntil:new Date(Date.now()+86400000).toISOString(),backupDays:0,providerDays:0,receiptDays:7});
const seed=async(id,path)=>{resetUser(id);await sql('insert into profiles(user_id,avatar_url) values($1,$2)',[id,path?'/api/media/'+path:null]);if(path){await sql('insert into media_assets values($1,$2,$3,$2,null)',[path,id,'profile']);await sql("insert into storage.objects values('protected-media',$1)",[path]);}};
const request=account=>api.DELETE(new Request('https://www.cinegenius.co/api/account',{method:'DELETE',headers:{'X-Account-Id':account}}));
test('public roles cannot read the private queue or call its service RPC',async()=>{
 for(const role of ['anon','authenticated']){await pg.exec('set role '+role);await assert.rejects(rpc('request',null,{},a),e=>e.code==='42501');await assert.rejects(sql('select * from account_erasure_private.requests'),e=>e.code==='42501');await pg.exec('reset role');}
});
test('guest, stale-account and non-admin requests cannot create or inspect cases',async()=>{
 actor=null;assert.equal((await request(a)).status,401);actor=a;assert.equal((await request(b)).status,409);assert.equal((await adminApi.GET(new Request('https://www.cinegenius.co/api/admin/privacy-requests'))).status,403);assert.equal((await rpc('list')).length,0);
});
test('request is durable, account-scoped, idempotent and distinct from completion; default automation is disabled',async()=>{
 const path=a+'/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.webp';await seed(a,path);await seed(b,b+'/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.webp');
 await sql("insert into rate_limit_buckets values('form-draft:'||$1,1,clock_timestamp()+interval '1 hour'),('form-draft:'||$2,1,clock_timestamp()+interval '1 hour')",[a,b]);
 await sql("insert into private_form_drafts values($1,'test','{\"private\":true}'),($2,'test','{\"other\":true}')",[a,b]);
 actor=a;const first=await request(a);assert.equal(first.status,202);const body=await first.json();assert.equal(body.accepted,true);assert.equal(body.success,undefined);assert.equal(body.request.state,'pending');
 assert.equal((await(await request(a)).json()).request.id,body.request.id);assert.equal((await(await api.GET()).json()).accountId,a);
 actor=b;assert.equal((await(await api.GET()).json()).request,null);
 assert.equal((await server.runAccountErasure()).status,'disabled');assert.deepEqual(removed,[]);assert.deepEqual(identities,[]);
 const row=(await sql('select * from user_settings where user_id=$1',[a])).rows[0];assert.equal(row.ghost_mode,true);assert.equal(row.profile_visibility,'private');
});
test('pending deletion prevents resurrection by late profile, draft, media and translation writes',async()=>{
 for(const [query,params] of [["update profiles set avatar_url='new' where user_id=$1",[a]],["insert into private_form_drafts values($1,'late','{}')",[a]],["insert into storage.objects values('protected-media',$1)",[a+'/cccccccccccccccccccccccccccccccc.webp']],["insert into content_translation_private.cache values('profile',$1,'{}')",[a]]])await assert.rejects(sql(query,params),e=>e.code==='PT409');
 await sql("update user_settings set ghost_mode=false,profile_visibility='public' where user_id=$1",[a]);assert.equal((await sql('select ghost_mode from user_settings where user_id=$1',[a])).rows[0].ghost_mode,true);
});
test('policy needs real explicit fields and expected revision; no assumed retention defaults',async()=>{
 await assert.rejects(rpc('policy_save',null,{revision:1,enabled:true,evidence:'No periods yet, should fail',validUntil:new Date(Date.now()+86400000).toISOString()}));
 assert.equal((await policy()).enabled,true);await assert.rejects(policy(),e=>e.code==='PT409');
});
test('Storage failure keeps the file manifest and identity, then retry deletes only the requesting account',async()=>{
 removeFails=true;await assert.rejects(server.runAccountErasure());removeFails=false;assert.deepEqual(identities,[]);assert.ok((await sql('select * from profiles where user_id=$1',[a])).rows.length);
 await sql('update account_erasure_private.requests set due_at=clock_timestamp() where owner_id=$1',[a]);
 assert.equal((await server.runAccountErasure()).status,'waiting');assert.deepEqual(identities,[a]);
 assert.equal((await sql('select * from profiles where user_id=$1',[a])).rows.length,0);assert.equal((await sql('select * from private_form_drafts where user_id=$1',[a])).rows.length,0);
 assert.equal((await sql('select * from profiles where user_id=$1',[b])).rows.length,1);assert.equal((await sql('select * from private_form_drafts where user_id=$1',[b])).rows.length,1);
 assert.equal((await sql("select * from storage.objects where name like $1",[b+'/%'])).rows.length,1);
});
test('mail delivery errors remain retryable; final completion is distinct from active deletion',async()=>{
 noticeFails=true;await assert.rejects(server.runAccountErasure());noticeFails=false;
 await sql('update account_erasure_private.requests set due_at=clock_timestamp() where owner_id=$1',[a]);
 assert.equal((await server.runAccountErasure()).status,'waiting');assert.equal(notices.at(-1).kind,'active');
 assert.equal((await server.runAccountErasure()).status,'completed');assert.equal(notices.at(-1).kind,'complete');
 const r=(await sql('select * from account_erasure_private.requests where owner_id=$1',[a])).rows[0];assert.equal(r.notification_email,null);assert.equal(r.state,'completed');
});
test('shared projects remain intact and route to review without deleting the identity',async()=>{
 const who='user_shared';await seed(who);await sql("insert into projects values('shared-project',$1,'Other people also work here')",[who]);const r=await rpc('request',null,{},who);
 assert.equal((await server.runAccountErasure(r.id)).status,'needs_review');assert.equal((await sql("select * from projects where id='shared-project'")).rows.length,1);assert.ok(mailUsers.has(who));
});
test('legacy media is held for reviewed cutover before any bytes or profile are removed',async()=>{
 const who='user_legacy';await seed(who);await sql("update profiles set avatar_url='https://legacy.example.test/public/photo.jpg' where user_id=$1",[who]);const r=await rpc('request',null,{},who);const count=removed.length;
 assert.equal((await server.runAccountErasure(r.id)).status,'needs_review');assert.equal(removed.length,count);assert.equal((await sql('select * from profiles where user_id=$1',[who])).rows.length,1);
});
test('ownership claims are retired rather than returning exclusive artwork to the catalogue',async()=>{
 const who='user_art';await seed(who);await sql("insert into profile_art_private.artworks values('owned-art','ready'),('other-art','ready')");await sql("insert into profile_art_private.claims values('owned-art',$1),('other-art',$2)",[who,b]);const r=await rpc('request',null,{},who);
 assert.equal((await server.runAccountErasure(r.id)).status,'waiting');assert.equal((await sql("select state from profile_art_private.artworks where id='owned-art'")).rows[0].state,'retired');assert.equal((await sql("select state from profile_art_private.artworks where id='other-art'")).rows[0].state,'ready');
});
test('provider failure after a durable identity checkpoint can be retried without changing target',async()=>{
 const who='user_provider';await seed(who);const r=await rpc('request',null,{},who);deleteFails=true;await assert.rejects(server.runAccountErasure(r.id));deleteFails=false;
 // Simulate lost acknowledgement plus verified deletion webhook.
 mailUsers.delete(who);await rpc('external_deleted',null,{},who);await sql('update account_erasure_private.requests set due_at=clock_timestamp() where id=$1',[r.id]);
 assert.equal((await server.runAccountErasure(r.id)).status,'waiting');
});
test('provider-side deletion without a verified email mapping remains an exception',async()=>{
 const who='user_external';const r=await rpc('external_deleted',null,{},who);assert.equal((await server.runAccountErasure(r.id)).status,'needs_review');
});
test('newsletter records are not silently ignored or deleted using caller-supplied emails',async()=>{
 const who='user_newsletter';await seed(who);await sql('insert into newsletter_subscriptions values($1,$2)',['sub',who+'@example.test']);const r=await rpc('request',null,{},who);
 assert.equal((await server.runAccountErasure(r.id)).status,'needs_review');assert.ok(mailUsers.has(who));assert.equal((await sql('select * from newsletter_subscriptions')).rows.length,1);
});
test('unknown columns stop deletion before storage calls',async()=>{
 const who='user_schema';await seed(who);const r=await rpc('request',null,{},who);await pg.exec('alter table profiles add column new_personal_data text');const count=removed.length;
 assert.equal((await server.runAccountErasure(r.id)).status,'needs_review');assert.equal(removed.length,count);assert.ok(mailUsers.has(who));await pg.exec('alter table profiles drop column new_personal_data');
});
test('leases bind mutations to one worker and reject forged acknowledgements',async()=>{
 const who='user_lease';await seed(who);const r=await rpc('request',null,{},who),claim=await rpc('claim',r.id);assert.ok(claim.token);
 assert.equal(await rpc('claim',r.id),null);await assert.rejects(rpc('cleanup',r.id,{token:crypto.randomUUID()}),e=>e.code==='PT409');
});
test('security counters belonging to another account survive, while erased-account counters cannot return',async()=>{
 assert.equal((await sql('select * from rate_limit_buckets where key=$1',['form-draft:'+a])).rows.length,0);
 assert.equal((await sql('select * from rate_limit_buckets where key=$1',['form-draft:'+b])).rows.length,1);
 await assert.rejects(sql("insert into rate_limit_buckets values($1,1,clock_timestamp()+interval '1 hour')",['form-draft:'+a]),e=>e.code==='PT409');
});
test('exceptions trigger a minimal operator notice without a member email or message body',async()=>{
 const row=(await sql('select id from account_erasure_private.requests where owner_id=$1',['user_shared'])).rows[0];
 assert.equal((await server.runAccountErasure(row.id)).status,'needs_review');assert.deepEqual(notices.at(-1),{id:row.id,kind:'alert'});
 assert.equal((await server.runAccountErasure(row.id)).status,'idle');
});
test('an unacknowledged physical object prevents a forged successful removal receipt',async()=>{
 const who='user_unremoved',path=who+'/dddddddddddddddddddddddddddddddd.webp';await seed(who,path);const r=await rpc('request',null,{},who),c=await rpc('claim',r.id);await rpc('prepare',r.id,{token:c.token});
 await assert.rejects(rpc('files_removed',r.id,{token:c.token,paths:[path]}),e=>e.code==='PT409');
 assert.equal((await sql('select removed_at from account_erasure_private.files where request_id=$1',[r.id])).rows[0].removed_at,null);
});
test('receipt expiry removes the personal tombstone and internal case only after recorded completion',async()=>{
 await sql("update account_erasure_private.requests set purge_after=clock_timestamp()-interval '1 second' where owner_id=$1",[a]);await rpc('claim');
 assert.equal((await sql('select * from account_erasure_private.requests where owner_id=$1',[a])).rows.length,0);assert.equal((await sql('select * from user_settings where user_id=$1',[a])).rows.length,0);
 assert.equal((await sql('select * from account_erasure_private.requests where owner_id=$1',['user_shared'])).rows.length,1);
});
test('a subsequently longer verified retention policy cannot close an older case early',async()=>{
 const who='user_policy_change';await seed(who);const r=await rpc('request',null,{},who);assert.equal((await server.runAccountErasure(r.id)).status,'waiting');assert.equal((await server.runAccountErasure(r.id)).status,'waiting');
 const cfg=await rpc('policy_read');await rpc('policy_save',null,{revision:cfg.revision,enabled:true,evidence:'Synthetic longer retention setting with actual test proof',validUntil:new Date(Date.now()+86400000).toISOString(),backupDays:10,providerDays:2,receiptDays:7});
 assert.equal((await server.runAccountErasure(r.id)).status,'idle');assert.equal((await rpc('admin_read',r.id)).state,'waiting');
});
test('changed foreign keys and disabled translation guards stop deletion before file or identity removal',async()=>{
 for(const change of ['cascade','translation']){
  const who='user_drift_'+change,path=who+'/dddddddddddddddddddddddddddddddd.webp';await seed(who,path);
  const r=await rpc('request',null,{},who),beforeRemoved=removed.length,beforeIdentities=identities.length;
  if(change==='cascade')await pg.exec('alter table notifications add constraint erasure_drift_fk foreign key(user_id) references profiles(user_id) on delete cascade');
  else await pg.exec('alter table content_translation_private.cache disable trigger account_erasure_translation');
  try{
   assert.equal((await server.runAccountErasure(r.id)).status,'needs_review');
   assert.equal((await rpc('admin_read',r.id)).reason,'schema_changed');
   assert.equal(removed.length,beforeRemoved);assert.equal(identities.length,beforeIdentities);
   assert.equal((await sql('select user_id from profiles where user_id=$1',[who])).rows.length,1);
  }finally{
   if(change==='cascade')await pg.exec('alter table notifications drop constraint erasure_drift_fk');
   else await pg.exec('alter table content_translation_private.cache enable trigger account_erasure_translation');
  }
 }
});
test('status notices use the real identity locale before legacy account preferences',async()=>{
 for(const [suffix,fields,locale] of [
  ['standard',{locale:'fr-FR',privateMetadata:{cinegeniusLocale:'it'},unsafeMetadata:{cinegeniusLocale:'en'}},'fr'],
  ['private',{privateMetadata:{cinegeniusLocale:'pt-PT'},unsafeMetadata:{cinegeniusLocale:'en'}},'pt-PT'],
  ['legacy',{unsafeMetadata:{cinegeniusLocale:'uk-UA'}},'uk'],
 ]){
  const who='user_mail_locale_'+suffix;await seed(who);Object.assign(mailUsers.get(who),fields);
  const r=await rpc('request',null,{},who);assert.equal((await server.runAccountErasure(r.id)).status,'waiting');
  assert.equal((await sql('select notification_locale from account_erasure_private.requests where id=$1',[r.id])).rows[0].notification_locale,locale);
 }
});
test('a longer policy introduced after a claim still blocks an early completion acknowledgement',async()=>{
 const who='user_inflight_policy';await seed(who);const r=await rpc('request',null,{},who);
 assert.equal((await server.runAccountErasure(r.id)).status,'waiting');assert.equal((await server.runAccountErasure(r.id)).status,'waiting');
 await sql("update account_erasure_private.requests set active_removed_at=clock_timestamp()-interval '11 days',due_at=clock_timestamp() where id=$1",[r.id]);
 const claim=await rpc('claim',r.id);assert.equal(claim.state,'waiting');
 const cfg=await rpc('policy_read');await rpc('policy_save',null,{revision:cfg.revision,enabled:true,evidence:'Synthetic policy revision after a worker lease',validUntil:new Date(Date.now()+86400000).toISOString(),backupDays:20,providerDays:2,receiptDays:7});
 assert.equal((await rpc('notice',r.id,{token:claim.token})).ready,false);
 await assert.rejects(rpc('notice_sent',r.id,{token:claim.token,kind:'complete'}),e=>e.code==='PT409');
 assert.equal((await rpc('admin_read',r.id)).state,'waiting');
});

test('identity provider failures on member/admin reads and writes return private generic errors',async()=>{
 authFails=true;
 try{
  const url='https://www.cinegenius.co/api/admin/privacy-requests';
  for(const response of [await api.GET(),await request(a),await adminApi.GET(new Request(url)),await adminApi.POST(new Request(url,{method:'POST'}))]){
   assert.equal(response.status,503);assert.match(response.headers.get('cache-control'),/private, no-store/);
   assert.deepEqual(await response.json(),{error:'requestFailed'});
  }
 }finally{authFails=false;}
});

test('configured administrator access is a review case before deleting any files or identity',async()=>{
 const who='user_configured_admin';await seed(who,who+'/eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee.webp');const r=await rpc('request',null,{},who),beforeRemoved=removed.length,beforeIdentities=identities.length;
 environment.ADMIN_USER_IDS=who;
 try{assert.equal((await server.runAccountErasure(r.id)).status,'needs_review');assert.equal((await rpc('admin_read',r.id)).reason,'provider_review');assert.equal(removed.length,beforeRemoved);assert.equal(identities.length,beforeIdentities);}
 finally{delete environment.ADMIN_USER_IDS;}
});
test('policy audit references prevent falsely completing a former administrator account',async()=>{
 const who='user_policy_editor';await seed(who);const cfg=await rpc('policy_read');
 await rpc('policy_save',null,{revision:cfg.revision,enabled:true,evidence:'Synthetic operator policy change with private audit trail',validUntil:new Date(Date.now()+86400000).toISOString(),backupDays:20,providerDays:2,receiptDays:7},who);
 const r=await rpc('request',null,{},who);assert.equal((await server.runAccountErasure(r.id)).status,'needs_review');
 const detail=await rpc('admin_read',r.id);assert.equal(detail.reason,'account_data_remaining');assert.ok(detail.inventory.some(row=>row.schema==='account_erasure_private'&&row.table==='policy_history'));assert.ok(mailUsers.has(who));
});
