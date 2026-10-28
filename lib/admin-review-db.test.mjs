import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
let pg;
const id='10000000-0000-4000-8000-000000000001',company='20000000-0000-4000-8000-000000000001';
before(async()=>{
 pg=new PGlite();await pg.exec(`create role anon;create role authenticated;create role service_role;
 create table profiles(user_id text primary key,display_name text,email text);
 create table companies(id uuid primary key,owner_user_id text,name text,published boolean);
 create table listings(id uuid primary key,user_id text,company_id uuid,title text,description text,published boolean default false,updated_at timestamptz default now());
 create table admin_audit_log(id uuid primary key default gen_random_uuid(),actor_user_id text,action text,entity_type text,entity_id text,reason text,outcome text,metadata jsonb);
 insert into profiles values('own-member','Own test member','own@example.invalid'),('own-admin','Own test admin','admin@example.invalid');
 insert into companies values('${company}','own-member','Own company',true);
 insert into listings(id,user_id,title,description) values('${id}','own-member','Own test listing','Original description');`);
 await pg.exec(readFileSync(new URL('../supabase/migrations/20261028160000_admin_review_release.sql',import.meta.url),'utf8'));
});
after(async()=>await pg?.close());
async function tx(fn){await pg.exec('begin');try{await fn();}finally{await pg.exec('rollback');}}
async function snapshot(){const r=(await pg.query('select to_jsonb(l) r from listings l where id=$1',[id])).rows[0].r;const co=r.company_id?(await pg.query('select to_jsonb(c) r from companies c where id=$1',[r.company_id])).rows[0]?.r:null;const profile=(await pg.query('select to_jsonb(p) r from profiles p where user_id=$1',[co?.owner_user_id||r.user_id])).rows[0]?.r;return{r,co:co||null,profile:profile||null};}
async function transition(s,published=true){return(await pg.query('select admin_review_listing_transition($1,$2,$3,$4,$5,$6,$7) status',[id,s.r,s.co,s.profile,published,'own-admin','Own test review reason'])).rows[0].status;}
test('only the service role can call the exact-review transition; ordinary users cannot spoof the actor',()=>tx(async()=>{
 for(const role of ['anon','authenticated'])assert.equal((await pg.query("select has_function_privilege($1,'admin_review_listing_transition(uuid,jsonb,jsonb,jsonb,boolean,text,text)','execute') ok",[role])).rows[0].ok,false);
 assert.equal((await pg.query("select has_function_privilege('service_role','admin_review_listing_transition(uuid,jsonb,jsonb,jsonb,boolean,text,text)','execute') ok")).rows[0].ok,true);
}));
test('unchanged reviewed content is published with its audit, then hidden and re-published without data loss',()=>tx(async()=>{
 const initial=await snapshot();assert.equal(await transition(initial),'saved');assert.equal((await snapshot()).r.published,true);
 assert.equal((await pg.query('select count(*)::int n from admin_audit_log')).rows[0].n,1);
 assert.equal(await transition(initial),'stale','repeated stale request must not create another audit');
 const published=await snapshot();assert.equal(await transition(published),'unchanged');assert.equal(await transition(published,false),'saved');
 assert.equal(await transition(await snapshot()),'saved');const final=await snapshot();assert.equal(final.r.description,initial.r.description);assert.equal(final.r.title,initial.r.title);
 assert.equal((await pg.query('select count(*)::int n from admin_audit_log')).rows[0].n,3);
}));
test('changing text without updating updated_at rejects publication of a stale preview',()=>tx(async()=>{
 const s=await snapshot();await pg.query("update listings set description='Changed own test text' where id=$1",[id]);assert.equal((await snapshot()).r.updated_at,s.r.updated_at);assert.equal(await transition(s),'stale');assert.equal((await snapshot()).r.published,false);assert.equal((await pg.query('select count(*)::int n from admin_audit_log')).rows[0].n,0);
}));
test('provider profile, company ownership and company details are part of the reviewed snapshot',()=>tx(async()=>{
 let s=await snapshot();await pg.query("update profiles set display_name='Changed name' where user_id='own-member'");assert.equal(await transition(s),'stale');
 await pg.query('update listings set company_id=$1 where id=$2',[company,id]);s=await snapshot();await pg.query("update companies set owner_user_id='own-admin' where id=$1",[company]);assert.equal(await transition(s),'stale');
}));
test('audit storage failure rolls back publication in the same database transaction',()=>tx(async()=>{
 const s=await snapshot();await pg.exec('alter table admin_audit_log add constraint own_failure check(false) not valid; savepoint before_attempt');
 await assert.rejects(()=>transition(s));await pg.exec('rollback to savepoint before_attempt');assert.equal((await snapshot()).r.published,false);
}));
