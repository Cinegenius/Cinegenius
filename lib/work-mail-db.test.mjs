import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
let pg;const owner='user_One',other='user_Two',connection='10000000-0000-4000-8000-000000000001',claim='10000000-0000-4000-8000-000000000002';
const hash='a'.repeat(64),alias='cg-'+'a'.repeat(48);
before(async()=>{pg=new PGlite();await pg.exec('create role anon;create role authenticated;create role service_role bypassrls;create schema storage;grant usage on schema storage to anon,authenticated,service_role;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit integer);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text not null,name text not null);alter table storage.objects enable row level security;grant select,insert,update,delete on storage.objects to anon,authenticated,service_role;create policy fixture_legacy_permissive on storage.objects for all to anon,authenticated using(true) with check(true)');await pg.exec(readFileSync(new URL('../supabase/candidates/work_mail.sql',import.meta.url),'utf8'));});
after(async()=>pg?.close());
const rows=async(sql,args=[])=>(await pg.query(sql,args)).rows;
const rpc=async(actor,action,p={})=>(await rows('select work_mail_v1($1,$2,$3::jsonb) result',[actor,action,JSON.stringify(p)]))[0].result;
async function tx(fn){await pg.exec('begin');try{await fn();}finally{await pg.exec('rollback');}}
async function denied(fn,code){await pg.exec('savepoint denied');try{await assert.rejects(fn,e=>e.code===code);}finally{await pg.exec('rollback to savepoint denied');}}
const source=(p={})=>({source:'inbound',providerId:'10000000-0000-4000-8000-000000000003',externalKey:hash,subject:'Private fixture',from:'external@fixture.invalid',receivedAt:'2026-11-22T12:00:00Z',text:'plain text',attachments:[],size:4,sha256:hash,...p});
const connect=(who=owner)=>rpc(who,'connection_save',{connectionId:connection,provider:'gmail',encryptedTokens:'opaque-fixture-token-'.repeat(4),expiresAt:'2026-11-22T12:00:00Z'});

test('mail tables and procedures deny direct anon/authenticated access; bucket stays private',()=>tx(async()=>{
 for(const role of ['anon','authenticated'])for(const table of ['work_mail_aliases','work_mail_connections','work_mail_oauth_states','work_mail_items','work_mail_attachments']){
  for(const action of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE'])assert.equal((await rows('select has_table_privilege($1,$2,$3) allowed',[role,table,action]))[0].allowed,false);
 }
 for(const role of ['anon','authenticated'])assert.equal((await rows("select has_function_privilege($1,'work_mail_v1(text,text,jsonb)','EXECUTE') allowed",[role]))[0].allowed,false);
 assert.equal((await rows("select public from storage.buckets where id='work-mail-private'"))[0].public,false);
 assert.equal((await rows("select count(*)::int n from pg_class where relname like 'work_mail_%' and relkind='r' and relrowsecurity"))[0].n,5);
 await pg.exec('set local role service_role');assert.equal((await rpc(owner,'status')).accountId,owner);
}));
test('aliases belong to one caller; pause/rotation stop resolving the old address',()=>tx(async()=>{
 await rpc(owner,'alias_create',{localPart:alias});await rpc(owner,'alias_create',{localPart:'cg-'+'b'.repeat(48)});
 assert.equal((await rpc(owner,'status')).alias.localPart,alias);assert.equal((await rpc(other,'status')).alias,null);
 assert.equal((await rows('select work_mail_resolve_alias($1) owner',[alias]))[0].owner,owner);
 await rpc(owner,'alias_toggle',{enabled:false});assert.equal((await rows('select work_mail_resolve_alias($1) owner',[alias]))[0].owner,null);
 await rpc(owner,'alias_rotate',{localPart:'cg-'+'c'.repeat(48)});assert.equal((await rows('select work_mail_resolve_alias($1) owner',[alias]))[0].owner,null);
 await denied(()=>rpc(owner,'alias_create',{localPart:'user@example.com'}),'22023');await denied(()=>rpc(null,'status'),'42501');
}));
test('OAuth state consumes once and is bound to account/session/provider/connection',()=>tx(async()=>{
 const p={stateHash:hash,sessionHash:'b'.repeat(64),provider:'gmail',connectionId:connection};await rpc(owner,'oauth_start',p);
 await denied(()=>rpc(other,'oauth_consume',p),'42501');await denied(()=>rpc(owner,'oauth_consume',{...p,sessionHash:'c'.repeat(64)}),'42501');await denied(()=>rpc(owner,'oauth_consume',{...p,provider:'microsoft'}),'42501');
 await rpc(owner,'oauth_consume',p);await denied(()=>rpc(owner,'oauth_consume',p),'42501');
 await rpc(owner,'oauth_start',p);await pg.exec("update work_mail_oauth_states set expires_at=clock_timestamp()-interval '1 second'");await denied(()=>rpc(owner,'oauth_consume',p),'42501');
}));
test('credential rows never appear in status; refresh lease rejects races and stale commits',()=>tx(async()=>{
 await connect();const status=await rpc(owner,'status');assert.deepEqual(Object.keys(status.connections[0]).sort(),['createdAt','id','provider']);
 await denied(()=>rpc(other,'connection_get',{connectionId:connection}),'PT404');
 await rpc(owner,'refresh_claim',{connectionId:connection,revision:1,claim});
 await denied(()=>rpc(owner,'refresh_claim',{connectionId:connection,revision:1,claim:'10000000-0000-4000-8000-000000000004'}),'PT409');
 await denied(()=>rpc(owner,'refresh_commit',{connectionId:connection,claim:'10000000-0000-4000-8000-000000000004',encryptedTokens:'x'.repeat(40),expiresAt:'2026-11-23'}),'PT409');
 await rpc(owner,'refresh_commit',{connectionId:connection,claim,encryptedTokens:'x'.repeat(40),expiresAt:'2026-11-23'});
 assert.equal((await rpc(owner,'connection_get',{connectionId:connection})).revision,2);
 await denied(()=>rpc(owner,'refresh_claim',{connectionId:connection,revision:1,claim}),'PT409');
 await rpc(owner,'connection_delete',{connectionId:connection});await denied(()=>rpc(owner,'connection_get',{connectionId:connection}),'PT404');
}));
test('import reservations are idempotent, immutable, private, and never mark forwarding imported automatically',()=>tx(async()=>{
 const item=await rpc(owner,'item_reserve',source());assert.equal(item.imported_at,null);
 assert.equal((await rpc(owner,'item_reserve',source())).id,item.id);await denied(()=>rpc(owner,'item_reserve',source({sha256:'b'.repeat(64)})),'PT409');
 assert.equal((await rpc(owner,'list')).items.length,0);await rpc(owner,'item_commit',{itemId:item.id,sha256:hash});
 await denied(()=>rpc(other,'item_get',{itemId:item.id}),'PT404');assert.equal((await rpc(other,'list')).items.length,0);
 await rpc(owner,'item_import',{itemId:item.id});assert.ok((await rpc(owner,'item_get',{itemId:item.id})).imported_at);
 await rpc(owner,'item_import',{itemId:item.id});assert.equal((await rpc(owner,'list')).items.length,1);
}));
test('source size, item count, aggregate bytes and attachment ownership are bounded',()=>tx(async()=>{
 await denied(()=>rpc(owner,'item_reserve',source({size:12582913})),'23514');
 const item=await rpc(owner,'item_reserve',source({attachments:[{id:'provider-att',name:'Own.pdf',type:'application/pdf',size:3}]}));await rpc(owner,'item_commit',{itemId:item.id,sha256:hash});
 const key=(await rows("select encode(sha256(convert_to('provider-att','UTF8')),'hex') h"))[0].h;
 await denied(()=>rpc(owner,'attachment_commit',{itemId:item.id,attachmentKey:'b'.repeat(64),size:3,sha256:hash}),'PT404');
 await rpc(owner,'attachment_commit',{itemId:item.id,attachmentKey:key,size:3,sha256:hash});assert.equal((await rpc(owner,'attachment_get',{itemId:item.id,attachmentKey:key})).size,3);
 await denied(()=>rpc(other,'attachment_get',{itemId:item.id,attachmentKey:key}),'PT404');
 await rpc(owner,'attachment_commit',{itemId:item.id,attachmentKey:key,size:3,sha256:hash});assert.equal((await rows('select count(*)::int n from work_mail_attachments'))[0].n,1);
 await pg.exec(`insert into work_mail_items(owner_id,source,external_key,provider_id,subject,sender,received_at,original_size,original_hash) select '${owner}','inbound',lpad(to_hex(n),64,'0'),n::text,'','',now(),1,'${hash}' from generate_series(1,199)n`);
 await denied(()=>rpc(owner,'item_reserve',source({externalKey:'c'.repeat(64)})),'PT429');
 await pg.exec(`delete from work_mail_items where id<>'${item.id}'`);
 await pg.exec(`insert into work_mail_items(owner_id,source,external_key,provider_id,subject,sender,received_at,original_size,original_hash) select '${owner}','inbound',lpad(to_hex(n),64,'0'),n::text,'','',now(),12582912,'${hash}' from generate_series(1,8)n`);
 await denied(()=>rpc(owner,'item_reserve',source({externalKey:'c'.repeat(64),size:12582912})),'PT429');
}));
test('disconnect retains originals and saved metadata without exposing them to another owner',()=>tx(async()=>{
 await connect();const item=await rpc(owner,'item_reserve',source({source:'gmail',connectionId:connection}));await rpc(owner,'item_commit',{itemId:item.id,sha256:hash});await rpc(owner,'connection_delete',{connectionId:connection});
 const saved=await rpc(owner,'item_get',{itemId:item.id});assert.equal(saved.original_hash,hash);assert.ok(saved.imported_at);assert.equal(saved.connection_id,connection);
 await denied(()=>rpc(other,'item_import',{itemId:item.id}),'PT404');
}));

test('disconnect prevents a previously pending provider source from becoming a visible import',()=>tx(async()=>{
 await denied(()=>rpc(owner,'item_reserve',source({source:'gmail',connectionId:connection})),'PT404');
 await connect();const item=await rpc(owner,'item_reserve',source({source:'gmail',connectionId:connection}));
 await rpc(owner,'connection_delete',{connectionId:connection});await denied(()=>rpc(owner,'item_commit',{itemId:item.id,sha256:hash}),'PT404');
 assert.equal((await rpc(owner,'list')).items.length,0);
}));

test('restrictive Storage policy defeats legacy permissive read/list/write policies for all private mail objects',()=>tx(async()=>{
 await pg.exec("insert into storage.objects(bucket_id,name) values('work-mail-private','user_One/private.eml'),('legacy-other','preserved.jpg')");
 for(const role of ['anon','authenticated']){
  await pg.exec('set local role '+role);
  assert.deepEqual((await rows('select bucket_id,name from storage.objects')).map(r=>r.bucket_id),['legacy-other']);
  assert.equal((await rows("select * from storage.objects where bucket_id='work-mail-private' and name='user_One/private.eml'")).length,0);
  await denied(()=>pg.exec("insert into storage.objects(bucket_id,name) values('work-mail-private','forged.eml')"),'42501');
  assert.equal((await rows("update storage.objects set name='overwritten' where bucket_id='work-mail-private' returning id")).length,0);
  assert.equal((await rows("delete from storage.objects where bucket_id='work-mail-private' returning id")).length,0);
 }
 await pg.exec('set local role service_role');assert.equal((await rows("select * from storage.objects where bucket_id='work-mail-private'")).length,1);
 // Causal negative control: dropping only our restrictive policy exposes the legacy broad-policy hole.
 await pg.exec('reset role;drop policy work_mail_private_server_only on storage.objects;set local role anon');
 assert.equal((await rows("select * from storage.objects where bucket_id='work-mail-private'")).length,1);
}));
