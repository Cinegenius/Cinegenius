import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { organizationTestBootstrap } from './test-fixtures/organization-database.mjs';
let pg;
before(async()=>{
 pg=new PGlite(); await pg.exec(organizationTestBootstrap);
 for(const name of ['20261103170000_organizations_and_news.sql','20261120152314_delegated_editorial_publication.sql']) await pg.exec(readFileSync(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
});
after(async()=>pg?.close());
async function tx(fn){await pg.exec('begin');try{await fn();}finally{await pg.exec('rollback');}}
async function rejected(fn,message){await pg.exec('savepoint attempt');await assert.rejects(fn,message?new RegExp(message):undefined);await pg.exec('rollback to savepoint attempt');}
async function setup(){
 const org=(await pg.query("insert into organizations(owner_user_id,last_actor_user_id,responsible_user_id,slug,name,moderation_status) values('support','admin','support','own-newsroom','Own newsroom','approved') returning *")).rows[0];
 const item=(await pg.query("insert into organization_entries(organization_id,author_user_id,last_actor_user_id,slug,entry_type,title,external_url,moderation_status) values($1,'cinegenius-editorial','cinegenius-editorial','test-news','news','Own checked news','https://example.org/source','submitted') returning *",[org.id])).rows[0];
 return {org,item};
}
async function grant(org,enabled=true,expected=null){return(await pg.query('select * from set_organization_editorial_grant($1,$2,$3,$4,$5)',['admin',org.id,enabled,expected,'Explicit organization-scoped delegation'])).rows[0];}
async function action(item,patch={}){
 const p={actor:'cinegenius-editorial',id:item.id,revision:item.updated_at,action:'publish',source:item.external_url,checked:new Date(),verified:true,reason:'Verified official source, dates, rights and duplicates',...patch};
 return(await pg.query('select * from moderate_own_editorial_entry($1,$2,$3,$4,$5,$6,$7,$8)',Object.values(p))).rows[0];
}
test('no grant is created by migration or ordinary ownership; ungranted publication fails',()=>tx(async()=>{
 const {item}=await setup();assert.equal((await pg.query('select count(*)::int n from organization_editorial_grants')).rows[0].n,0);await rejected(()=>action(item),'forbidden');
}));
test('delegation is specific to the newsroom and organization, with an honest atomic audit',()=>tx(async()=>{
 const {org,item}=await setup();await grant(org);const published=await action(item);
 assert.equal(published.moderation_status,'approved');assert.equal(published.publication_authority,'editorial');assert.equal(published.reviewed_by,null);
 const events=(await pg.query('select action,actor_user_id,source_url from organization_editorial_events order by created_at')).rows;
 assert.deepEqual(events.map(x=>x.action),['grant','publish']);assert.equal(events[1].actor_user_id,'cinegenius-editorial');assert.equal(events[1].source_url,item.external_url);
 assert.match((await pg.query('select reason from organization_moderation_events where entry_id=$1 order by revision_at desc limit 1',[item.id])).rows[0].reason,/delegated editorial/);
}));
test('other user, another author, or a contribution edited by someone else cannot be published',()=>tx(async()=>{
 const {org,item}=await setup();await grant(org);await rejected(()=>action(item,{actor:'stranger'}),'forbidden');
 for(const field of ['author_user_id','last_actor_user_id']){
  const changed=(await pg.query(`update organization_entries set ${field}='human-editor' where id=$1 returning *`,[item.id])).rows[0];
  await rejected(()=>action(changed),'forbidden');await pg.query(`update organization_entries set ${field}='cinegenius-editorial' where id=$1`,[item.id]);
 }
}));
test('a grant never applies to another organization',()=>tx(async()=>{
 const {org,item}=await setup();await grant(org);
 const other=(await pg.query("insert into organizations(owner_user_id,last_actor_user_id,responsible_user_id,slug,name,moderation_status) values('support','support','support','other-room','Other room','approved') returning *")).rows[0];
 const moved=(await pg.query('update organization_entries set organization_id=$1 where id=$2 returning *',[other.id,item.id])).rows[0];
 await rejected(()=>action(moved),'forbidden');
}));
test('revocation is immediate and a stale grant edit cannot re-enable it',()=>tx(async()=>{
 const {org,item}=await setup();const current=await grant(org);await grant(org,false,current.updated_at);
 await rejected(()=>action(item),'forbidden');await rejected(()=>grant(org,true,current.updated_at),'conflict');
}));
test('the newsroom grant belongs to neither Support nor the owner account',()=>tx(async()=>{
 const {org,item}=await setup();await grant(org);await rejected(()=>action(item,{actor:'support'}),'forbidden');
 await pg.query("update organizations set owner_user_id='new-owner' where id=$1",[org.id]);
 assert.equal((await action(item)).moderation_status,'approved');
 assert.equal((await pg.query("select count(*)::int n from organization_members where user_id='cinegenius-editorial'")).rows[0].n,0);
}));
test('admin-restricted, human-reviewed and unsubmitted drafts cannot be self-approved',()=>tx(async()=>{
 const {org,item}=await setup();await grant(org);
 for(const status of ['draft','changes_requested','rejected','hidden']){
  const row=(await pg.query('update organization_entries set moderation_status=$1 where id=$2 returning *',[status,item.id])).rows[0];await rejected(()=>action(row),'review_required');
 }
 const held=(await pg.query("update organization_entries set moderation_status='submitted',reviewed_by='admin' where id=$1 returning *",[item.id])).rows[0];await rejected(()=>action(held),'review_required');
}));
test('stale revisions, a changed source, missing review, and old review time are rejected',()=>tx(async()=>{
 const {org,item}=await setup();await grant(org);
 await rejected(()=>action(item,{revision:new Date(0)}),'conflict');await rejected(()=>action(item,{source:'https://example.org/other'}),'source_changed');
 await rejected(()=>action(item,{verified:false}),'review_required');await rejected(()=>action(item,{checked:new Date(Date.now()-11*60000)}),'review_required');
 await rejected(()=>action(item,{checked:new Date(Date.now()+60000)}),'review_required');
}));
test('an expired event and an unapproved parent cannot be published',()=>tx(async()=>{
 const {org,item}=await setup();await grant(org);
 const expired=(await pg.query("update organization_entries set ends_at=now()-interval '1 day' where id=$1 returning *",[item.id])).rows[0];await rejected(()=>action(expired),'expired');
 await pg.query("update organizations set moderation_status='hidden' where id=$1",[org.id]);await rejected(()=>action(expired),'parent_required');
}));
test('own published entries can be hidden reversibly and never republished from hidden by this role',()=>tx(async()=>{
 const {org,item}=await setup();await grant(org);const published=await action(item);const hidden=await action(published,{action:'hide',reason:'Event ended 2026-11-19; source rechecked 2026-11-20'});
 assert.equal(hidden.moderation_status,'hidden');assert.equal(hidden.title,item.title);assert.equal(hidden.external_url,item.external_url);
 await rejected(()=>action(hidden),'review_required');await rejected(()=>action(hidden,{action:'delete'}),'review_required');
 assert.equal((await pg.query('select count(*)::int n from organization_entries')).rows[0].n,1);
}));
test('audit insertion failure rolls back publication and grant changes',()=>tx(async()=>{
 const {org,item}=await setup();const current=await grant(org);
 await pg.exec('alter table organization_editorial_events add constraint audit_failure check(false) not valid');
 await rejected(()=>action(item));assert.equal((await pg.query('select moderation_status from organization_entries where id=$1',[item.id])).rows[0].moderation_status,'submitted');
 await rejected(()=>grant(org,false,current.updated_at));assert.equal((await pg.query('select enabled from organization_editorial_grants where organization_id=$1',[org.id])).rows[0].enabled,true);
}));
test('browser database roles have no table access or function execution',()=>tx(async()=>{
 for(const role of ['anon','authenticated']){
  for(const table of ['organization_editorial_grants','organization_editorial_events'])for(const permission of ['SELECT','INSERT','UPDATE','DELETE'])assert.equal((await pg.query('select has_table_privilege($1,$2,$3) allowed',[role,table,permission])).rows[0].allowed,false);
  for(const fn of ['set_organization_editorial_grant(text,uuid,boolean,timestamp with time zone,text)','moderate_own_editorial_entry(text,uuid,timestamp with time zone,text,text,timestamp with time zone,boolean,text)','save_editorial_entry(uuid,uuid,timestamp with time zone,boolean,jsonb)'])assert.equal((await pg.query('select has_function_privilege($1,$2,\'EXECUTE\') allowed',[role,fn])).rows[0].allowed,false);
 }
}));
const document={entry_type:'news',title:'New service-created news',summary:'A checked short summary',description:'Own editorial summary with official source link',topic:'industry',format:'online',city:'',venue:'',starts_at:null,ends_at:null,registration_url:null,external_url:'https://example.org/new-source',image_url:null};
async function save(id,org,expected=null,submit=false,doc=document){return(await pg.query('select * from save_editorial_entry($1,$2,$3,$4,$5)',[id,org.id,expected,submit,JSON.stringify(doc)])).rows[0];}
test('machine drafts are private, own-authored and cannot forge member ownership or publication',()=>tx(async()=>{
 const {org}=await setup();await grant(org);const id='11111111-1111-4111-8111-111111111111';
 const draft=await save(id,org,null,false,{...document,author_user_id:'admin',last_actor_user_id:'admin',moderation_status:'approved'});
 assert.equal(draft.author_user_id,'cinegenius-editorial');assert.equal(draft.last_actor_user_id,'cinegenius-editorial');assert.equal(draft.moderation_status,'draft');
 const submitted=await save(id,org,draft.updated_at,true);assert.equal(submitted.moderation_status,'submitted');assert.equal((await action(submitted)).moderation_status,'approved');
}));
test('machine writes require a private first save and respect all-status duplicate checks',()=>tx(async()=>{
 const {org}=await setup();await grant(org);const id='11111111-1111-4111-8111-111111111111';
 await rejected(()=>save(id,org,null,true),'save_private_first');const draft=await save(id,org);
 await rejected(()=>save(id,org),'conflict');await rejected(()=>save('22222222-2222-4222-8222-222222222222',org),'duplicate');
 await pg.query("update organization_entries set moderation_status='hidden' where id=$1",[id]);
 await rejected(()=>save('22222222-2222-4222-8222-222222222222',org),'duplicate');
 await rejected(()=>save(id,org,draft.updated_at),'conflict');
}));
test('revoked and human-modified machine drafts cannot be updated or reassigned',()=>tx(async()=>{
 const {org}=await setup();const authority=await grant(org);const id='11111111-1111-4111-8111-111111111111';const draft=await save(id,org);
 const edited=(await pg.query("update organization_entries set description='Human changes',last_actor_user_id='support' where id=$1 returning *",[id])).rows[0];
 await rejected(()=>save(id,org,edited.updated_at),'forbidden');await grant(org,false,authority.updated_at);
 await rejected(()=>save('22222222-2222-4222-8222-222222222222',org),'forbidden');
 assert.equal((await pg.query('select description from organization_entries where id=$1',[id])).rows[0].description,'Human changes');
}));
