import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
let pg;
const legacy='10000000-0000-4000-8000-000000000001',co='20000000-0000-4000-8000-000000000001';
before(async()=>{
 pg=new PGlite();
 await pg.exec(`create role anon;create role authenticated;create role service_role;
 create table profiles(user_id text primary key,display_name text);
 create table companies(id uuid primary key,owner_user_id text,name text,published boolean);
 create table listings(id uuid primary key default gen_random_uuid(),user_id text,company_id uuid,type text,category text,title text,description text,price numeric,city text,image_url text,extra_images jsonb,metadata jsonb,published boolean default true,view_count int default 0);
 create table company_equipment(id uuid primary key default gen_random_uuid(),company_id uuid,name text,category text,description text,images jsonb,published boolean default true);
 create table admin_audit_log(id uuid primary key default gen_random_uuid(),actor_user_id text,action text,entity_type text,entity_id text,reason text,outcome text,metadata jsonb);
 create table notifications(id uuid primary key default gen_random_uuid(),user_id text,type text,title text,body text,href text);
 insert into profiles values('own-member','Own member');insert into companies values('${co}','own-member','Own company',true);
 insert into listings(id,user_id,type,title,description,published) values('${legacy}','own-member','prop','Existing public offer','Original',true);
 grant select,insert,update,delete on listings,company_equipment to anon,authenticated;
 grant select on listings to public;
 grant select(title) on listings to authenticated;
 grant update(title),insert(title) on listings to authenticated;
 `);
 await pg.exec(readFileSync(new URL('../supabase/migrations/20261028200000_offer_moderation.sql',import.meta.url),'utf8'));
});
after(async()=>pg?.close());
async function tx(f){await pg.exec('begin');try{await f();}finally{await pg.exec('rollback');}}
async function row(id,kind='listing'){return(await pg.query(`select to_jsonb(l) r from ${kind==='listing'?'listings':'company_equipment'} l where id=$1`,[id])).rows[0]?.r;}
async function transition(id,action,kind='listing',expected){const r=expected??await row(id,kind);const company=r.company_id?(await pg.query('select to_jsonb(c) r from companies c where id=$1',[r.company_id])).rows[0].r:null;const profile=(await pg.query('select to_jsonb(p) r from profiles p where user_id=$1',[company?.owner_user_id??r.user_id])).rows[0]?.r??null;return(await pg.query('select offer_review_transition($1,$2,$3,$4,$5,$6,$7,$8,$9) s',[kind,id,r,company,profile,action,action==='submit'?'own-member':'own-admin','Own controlled test decision',action==='submit'?null:{title:'Own review',body:'Own decision',href:'/dashboard?tab=listings'}])).rows[0].s;}
async function create(type='prop'){return(await pg.query("insert into listings(user_id,type,title,description,city,category,last_editor_id) values('own-member',$1,'Own offer','Original','Own city','test','own-member') returning id",[type])).rows[0].id;}
test('migration preserves old public offers and marks missing evidence without inventing an approval',async()=>{
 const r=await row(legacy);assert.equal(r.published,true);assert.equal(r.moderation_status,'legacy_review_required');assert.equal(r.reviewed_by,null);assert.equal(r.reviewed_revision,null);
});
test('new offers and uploads remain private until explicit review, across all existing listing types',()=>tx(async()=>{
 for(const type of ['location','prop','vehicle','job','creator','animal','service']){
  const id=await create(type);assert.equal((await row(id)).published,false);
  await pg.query('update listings set image_url=$1 where id=$2',['/api/media/own-member/own.webp',id]);assert.equal((await row(id)).published,false);
  assert.equal(await transition(id,'submit'),'saved');let r=await row(id);assert.equal(r.moderation_status,'pending');assert.equal(r.published,false);
  assert.equal((await pg.query('select count(*)::int n from listings where id=$1 and published=true',[id])).rows[0].n,0);
  assert.equal(await transition(id,'approve'),'saved');r=await row(id);assert.equal(r.published,true);assert.equal(r.reviewed_revision,r.content_revision);assert.equal(r.reviewed_by,'own-admin');
 }
}));
test('private defaults and denied client table/column writes prevent direct self-approval',()=>tx(async()=>{
 for(const role of ['anon','authenticated'])for(const table of ['listings','company_equipment']){
  for(const privilege of ['SELECT','INSERT','UPDATE','DELETE'])assert.equal((await pg.query('select has_table_privilege($1,$2,$3) ok',[role,table,privilege])).rows[0].ok,false);
  for(const col of ['title','published','moderation_status'])if(table==='listings')for(const privilege of ['SELECT','UPDATE'])assert.equal((await pg.query('select has_column_privilege($1,$2,$3,$4) ok',[role,table,col,privilege])).rows[0].ok,false);
 }
 for(const role of ['anon','authenticated'])assert.equal((await pg.query("select has_function_privilege($1,'offer_review_transition(text,uuid,jsonb,jsonb,jsonb,text,text,text,jsonb)','execute') ok",[role])).rows[0].ok,false);
 for(const role of ['anon','authenticated'])for(const statement of [
  'select id from listings',
  "update listings set published=true",
  "select offer_review_transition('listing','10000000-0000-4000-8000-000000000001','{}',null,null,'approve','forged-admin','Forged approval',null)",
 ]){
  await pg.exec('savepoint client_attempt');await pg.exec('set local role '+role);
  await assert.rejects(()=>pg.exec(statement),{code:'42501'});await pg.exec('rollback to savepoint client_attempt');
 }
 const id=await create();await pg.exec('savepoint attempt');await assert.rejects(()=>pg.query('update listings set published=true where id=$1',[id]));await pg.exec('rollback to savepoint attempt');assert.equal((await row(id)).published,false);
}));
test('material changes invalidate release and exact reviewed snapshots cannot approve later content',()=>tx(async()=>{
 const id=await create();await transition(id,'submit');const pending=await row(id);await transition(id,'approve');
 for(const [field,value] of [['title','Changed own title'],['description','Changed own text'],['image_url','/api/media/own-member/new.webp'],['extra_images',JSON.stringify(['/api/media/own-member/second.webp'])],['price',55]]){
  const approved=await row(id);assert.equal(approved.published,true);await pg.query(`update listings set ${field}=$1,last_editor_id='own-member' where id=$2`,[value,id]);const edited=await row(id);assert.equal(edited.published,false);assert.equal(edited.moderation_status,'pending');assert.equal(edited.content_revision,approved.content_revision+1);assert.equal(edited.reviewed_revision,null);
  assert.equal(await transition(id,'approve','listing',approved),'stale');assert.equal(await transition(id,'approve'),'saved');
 }
 assert.equal(await transition(id,'approve','listing',pending),'stale');
 const n=(await pg.query("select count(*)::int n from offer_moderation_events where offer_id=$1 and event='content_changed'",[id])).rows[0].n;assert.equal(n,5);
}));
test('rejection, correction, resubmission and duplicate attempts retain history and notify once',()=>tx(async()=>{
 const id=await create();await transition(id,'submit');const old=await row(id);assert.equal(await transition(id,'changes_requested'),'saved');assert.equal((await row(id)).published,false);assert.match((await row(id)).moderation_reason,/controlled/);
 await pg.query("update listings set description='Own correction',last_editor_id='own-member' where id=$1",[id]);assert.equal((await row(id)).moderation_status,'draft');await transition(id,'submit');assert.equal(await transition(id,'submit'),'unchanged');await transition(id,'reject');await transition(id,'submit');const reviewed=await row(id);assert.equal(await transition(id,'approve'),'saved');assert.equal(await transition(id,'approve','listing',reviewed),'stale');assert.equal(await transition(id,'approve','listing',old),'stale');
 assert.equal((await pg.query('select count(*)::int n from notifications')).rows[0].n,3);
 assert.equal((await pg.query('select count(*)::int n from admin_audit_log where entity_id=$1',[id])).rows[0].n,3);
}));
test('company equipment has the identical review gate and a company role/title cannot make it public',()=>tx(async()=>{
 const id=(await pg.query("insert into company_equipment(company_id,name,category,images,last_editor_id) values($1,'Own equipment','light','[]','own-member') returning id",[co])).rows[0].id;
 assert.equal((await row(id,'company_equipment')).published,false);await transition(id,'submit','company_equipment');await transition(id,'approve','company_equipment');await pg.query("update company_equipment set images='[\"/api/media/own-member/new.webp\"]',last_editor_id='own-member' where id=$1",[id]);assert.equal((await row(id,'company_equipment')).published,false);assert.equal((await row(id,'company_equipment')).moderation_status,'pending');
}));
test('audit or notification failures roll back the release; review context cannot leak to another write',()=>tx(async()=>{
 const id=await create();await transition(id,'submit');await pg.exec('alter table notifications add constraint own_failure check(false) not valid;savepoint release');await assert.rejects(()=>transition(id,'approve'));await pg.exec('rollback to savepoint release');assert.equal((await row(id)).published,false);
 await pg.exec('alter table notifications drop constraint own_failure');await transition(id,'approve');const other=await create();await pg.exec('savepoint bypass');await assert.rejects(()=>pg.query('update listings set published=true where id=$1',[other]));await pg.exec('rollback to savepoint bypass');assert.equal((await row(other)).published,false);
}));
