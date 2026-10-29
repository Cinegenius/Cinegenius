import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const migration=name=>readFileSync(new URL('../supabase/migrations/'+name,import.meta.url),'utf8');

test('manual admin approval works across offer statuses without completeness gates, preserving exact versions and client denial',async()=>{
 const pg=new PGlite();try{
 await pg.exec(`create role anon;create role authenticated;create role service_role;
 create table profiles(user_id text primary key,display_name text,location text,profile_type text);
 create table companies(id uuid primary key,owner_user_id text,name text,published boolean,slug text);
 create table listings(id uuid primary key default gen_random_uuid(),user_id text,company_id uuid,type text,category text,title text,description text,city text,image_url text,published boolean default false);
 create table company_equipment(id uuid primary key default gen_random_uuid(),company_id uuid,name text,category text,image_url text,published boolean default false);
 create table admin_audit_log(actor_user_id text,action text,entity_type text,entity_id text,reason text,outcome text,metadata jsonb);
 create table notifications(user_id text,type text,title text,body text,href text);
 insert into profiles values('own-member','Own Member','Test City','crew');
 insert into companies values('20000000-0000-4000-8000-000000000001','own-member','Own Test Company',true,'own-test-company');`);
 await pg.exec(migration('20261028200000_offer_moderation.sql'));
 await pg.exec(migration('20261028210000_marketplace_profile_publication.sql'));
 const preserved=(await pg.query("insert into listings(type,user_id,title,city,category) values('location','own-member','','','') returning to_jsonb(listings) r")).rows[0].r;
 await pg.exec(migration('20261029020000_admin_review_discretion.sql'));
 await pg.exec(migration('20261029020000_admin_review_discretion.sql'));
 const row=async(kind,id)=>(await pg.query(`select to_jsonb(l) r from ${kind==='listing'?'listings':'company_equipment'} l where id=$1`,[id])).rows[0].r;
 assert.deepEqual(await row('listing',preserved.id),preserved,'migration never publishes or rewrites an existing draft');
 const profile=(await pg.query('select to_jsonb(p) p from profiles p')).rows[0].p;
 const company=(await pg.query('select to_jsonb(c) c from companies c')).rows[0].c;
 const decide=async(kind,id,action='approve',expected)=>{
  const r=expected??await row(kind,id);
  return (await pg.query('select offer_review_transition($1,$2,$3,$4,$5,$6,$7,$8,$9) result',[kind,id,r,kind==='company_equipment'?company:null,profile,action,'own-admin','Explicit own administrator decision',{title:'Own decision',body:'Test only',href:'/dashboard'}])).rows[0].result;
 };
 for(const type of ['location','prop','vehicle','animal','job']){
  const id=(await pg.query("insert into listings(type,user_id,title,city,category) values($1,'own-member','','','') returning id",[type])).rows[0].id;
  assert.equal((await row('listing',id)).published,false);
  for(const action of ['approve','hide','approve','reject','approve','changes_requested','approve']){
   assert.equal(await decide('listing',id,action),'saved');
   const r=await row('listing',id);assert.equal(r.published,action==='approve');
   if(action==='approve'){assert.equal(r.reviewed_revision,r.content_revision);assert.equal(r.reviewed_by,'own-admin');}
  }
  const r=await row('listing',id);const count=(await pg.query('select count(*) n from notifications')).rows[0].n;
  assert.equal(await decide('listing',id),'unchanged');assert.equal((await pg.query('select count(*) n from notifications')).rows[0].n,count,'retry creates no duplicate notification');
  await pg.query("update listings set description='Own new version' where id=$1",[id]);
  assert.equal((await row('listing',id)).published,false);assert.equal(await decide('listing',id,'approve',r),'stale');
  assert.equal(await decide('listing',id),'saved');
 }
 const equipment=(await pg.query("insert into company_equipment(company_id,name,category) values($1,'','') returning id",[company.id])).rows[0].id;
 assert.equal(await decide('company_equipment',equipment),'saved');
 assert.equal((await row('company_equipment',equipment)).published,true);
 const logs=(await pg.query("select * from admin_audit_log where action='offer_approve'")).rows;
 assert.ok(logs.length>5);assert.ok(logs.every(e=>e.actor_user_id==='own-admin'&&e.reason==='Explicit own administrator decision'));
 for(const role of ['anon','authenticated']){
  assert.equal((await pg.query("select has_function_privilege($1,'public.offer_review_transition(text,uuid,jsonb,jsonb,jsonb,text,text,text,jsonb)','execute') allowed",[role])).rows[0].allowed,false);
  await pg.exec(`set role ${role}`);
  await assert.rejects(()=>pg.query("select offer_review_transition('listing',$1,$2,null,$3,'approve','own-admin','Forged reason',null)",[preserved.id,preserved,profile]),/permission denied/);
  await assert.rejects(()=>pg.query('update listings set published=true where id=$1',[preserved.id]),/permission denied/);
  await pg.exec('reset role');
 }
 assert.equal((await pg.query("select has_function_privilege('service_role','public.offer_review_transition(text,uuid,jsonb,jsonb,jsonb,text,text,text,jsonb)','execute') allowed")).rows[0].allowed,true);
 }finally{await pg.close()}
});
