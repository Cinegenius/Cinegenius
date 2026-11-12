import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const migration=readFileSync(new URL('../supabase/migrations/20261112191000_verification_review_atomic.sql',import.meta.url),'utf8');
async function fixture(){
 const pg=new PGlite();
 await pg.exec(`create role anon;create role authenticated;create role service_role;
 create table profiles(user_id text primary key,display_name text,verified boolean default false);
 create table verification_requests(id uuid primary key default gen_random_uuid(),user_id text,display_name text,status text default 'pending' check(status in ('pending','approved','rejected')),notes text,submitted_at timestamptz default now(),reviewed_at timestamptz,reviewed_by text);
 create table admin_audit_log(id uuid primary key default gen_random_uuid(),actor_user_id text,action text,entity_type text,entity_id text,reason text,outcome text,metadata jsonb);
 grant all on verification_requests to public,anon,authenticated;
 create table notifications(id uuid primary key default gen_random_uuid(),user_id text,type text,title text,body text,href text,localization jsonb);
 insert into profiles values('member','Own member',false),('admin','Own admin',false);
 insert into verification_requests(user_id,status,notes) values('member','rejected','Legacy evidence, never deleted');`);
 await pg.exec(migration);
 const query=async(sql,args)=>(await pg.query(sql,args)).rows;
 const profile=async()=>(await query("select * from profiles where user_id='member'"))[0];
 const submit=async(notes=null)=>(await query("select verification_submit('member',$1) result",[notes]))[0].result;
 const request=async(id)=>(await query('select * from verification_requests where id=$1',[id]))[0];
 const notification={title:'Result',body:'Own result',localization:{version:1}};
 const review=async(id,action,version=1,revision=1)=>(await query('select verification_review($1,$2,$3,$4,$5,$6,$7) result',[id,version,revision,action,'admin','Reviewed own test evidence',notification]))[0].result;
 const toggle=async(verified,revision)=>(await query("select verification_set_profile('member',$1,$2,'admin','Own explicit administrator decision',$3) result",[revision,verified,notification]))[0].result;
 return{pg,query,profile,submit,request,review,toggle};
}
test('migration reruns safely, preserves legacy requests, and denies forged direct RPCs',async()=>{
 const f=await fixture();try{
  await f.pg.exec(migration);
  assert.equal((await f.query('select notes from verification_requests'))[0].notes,'Legacy evidence, never deleted');
  for(const role of ['anon','authenticated'])for(const privilege of ['SELECT','INSERT','UPDATE','DELETE'])assert.equal((await f.query("select has_table_privilege($1,'verification_requests',$2) allowed",[role,privilege]))[0].allowed,false);
  const signatures=['verification_submit(text,text)','verification_review(uuid,bigint,bigint,text,text,text,jsonb)','verification_set_profile(text,bigint,boolean,text,text,jsonb)'];
  for(const signature of signatures){
   for(const role of ['anon','authenticated'])assert.equal((await f.query('select has_function_privilege($1,$2,\'execute\') allowed',[role,signature]))[0].allowed,false);
   assert.equal((await f.query('select has_function_privilege(\'service_role\',$1,\'execute\') allowed',[signature]))[0].allowed,true);
  }
 }finally{await f.pg.close();}
});
test('submission is idempotent and rejected members can reapply without erasing history',async()=>{
 const f=await fixture();try{
  const first=await f.submit('Own notes');assert.equal(first.status,'saved');
  const second=await f.submit('Retry notes');assert.equal(second.status,'pending');assert.equal(second.id,first.id);
  assert.equal((await f.query('select count(*)::int count from verification_requests'))[0].count,2);
  assert.equal(await f.review(first.id,'reject'),'saved');assert.equal((await f.request(first.id)).status,'rejected');
  const again=await f.submit();assert.equal(again.status,'saved');assert.notEqual(again.id,first.id);
 }finally{await f.pg.close();}
});
test('approval atomically saves badge, reviewed request, audit and one notification; stale/replayed decisions do nothing',async()=>{
 const f=await fixture();try{
  const first=await f.submit();assert.equal(await f.review(first.id,'approve'),'saved');
  assert.equal((await f.profile()).verified,true);assert.equal((await f.profile()).verification_revision,2);
  assert.equal((await f.request(first.id)).status,'approved');assert.equal((await f.request(first.id)).review_version,2);
  assert.equal((await f.request(first.id)).reviewed_by,'admin');
  assert.equal(await f.review(first.id,'reject'),'stale');
  assert.equal((await f.query('select count(*)::int n from notifications'))[0].n,1);
  assert.equal((await f.query('select count(*)::int n from admin_audit_log'))[0].n,1);
  assert.equal((await f.submit()).status,'approved');
 }finally{await f.pg.close();}
});
test('notification failure rolls back the badge, request decision and audit together',async()=>{
 const f=await fixture();try{
  const first=await f.submit();await f.pg.exec("alter table notifications add constraint synthetic_failure check(body <> 'Own result')");
  await assert.rejects(()=>f.review(first.id,'approve'));
  assert.equal((await f.profile()).verified,false);assert.equal((await f.request(first.id)).status,'pending');
  assert.equal((await f.query('select count(*)::int n from admin_audit_log'))[0].n,0);
  assert.equal((await f.query('select count(*)::int n from notifications'))[0].n,0);
 }finally{await f.pg.close();}
});
test('manual verification resolves pending requests; revocation permits reapplication and rejects old browser decisions',async()=>{
 const f=await fixture();try{
  const first=await f.submit();assert.equal(await f.toggle(true,1),'saved');assert.equal((await f.request(first.id)).status,'approved');
  assert.equal(await f.toggle(false,1),'stale');assert.equal(await f.toggle(false,2),'saved');
  assert.equal((await f.request(first.id)).status,'rejected');assert.equal((await f.profile()).verified,false);
  assert.equal((await f.submit()).status,'saved');
  assert.equal(await f.review(first.id,'approve',1,1),'stale');
  assert.equal((await f.query('select count(*)::int n from notifications'))[0].n,2);
 }finally{await f.pg.close();}
});
test('changed profile state and missing members block approval without partial changes',async()=>{
 const f=await fixture();try{
  const first=await f.submit();await f.pg.exec("update profiles set verified=true where user_id='member'");
  assert.equal(await f.review(first.id,'approve'),'stale');assert.equal((await f.request(first.id)).status,'pending');
  await f.pg.exec("delete from profiles where user_id='member'");
  assert.equal(await f.review(first.id,'approve'),'profile_missing');assert.equal((await f.submit()).status,'missing');
 }finally{await f.pg.close();}
});
