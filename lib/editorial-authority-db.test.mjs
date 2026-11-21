import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { organizationTestBootstrap } from './test-fixtures/organization-database.mjs';
let pg;
before(async()=>{
 pg=new PGlite(); await pg.exec(organizationTestBootstrap);
 for(const name of ['20261103170000_organizations_and_news.sql','20261120152314_delegated_editorial_publication.sql','20261120230314_news_gallery_and_legacy_expiry.sql']) await pg.exec(readFileSync(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
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

const photo=(n,owner='cinegenius-editorial')=>({url:`/api/media/${owner}/${String(n).padStart(32,'0')}.jpg`,altText:'Archive portrait',creator:'Original photographer',sourceUrl:'https://commons.wikimedia.org/wiki/File:Portrait.jpg',licenseName:'CC BY-SA 3.0',licenseUrl:'https://creativecommons.org/licenses/by-sa/3.0/',changes:'Unchanged',caption:'Archive portrait, San Diego, 12 July 2012',imageTitle:'Original image title',attribution:'Required attribution',credit:'Original credit'});
async function upload(image,owner='cinegenius-editorial',source=null,sourceId=null){await pg.query('insert into media_assets(storage_path,reference_url,owner_user_id,source_type,source_id,mime_type) values($1,$2,$3,$4,$5,$6)',[image.url.slice('/api/media/'.length),image.url,owner,source,sourceId,'image/jpeg']);}
test('gallery media binds canonically, stays private until approval and withdraws with current parent visibility',()=>tx(async()=>{
 const {org}=await setup();await grant(org);const image=photo(1);await upload(image);
 const draft=await save('11111111-1111-4111-8111-111111111111',org,null,false,{...document,image_gallery:[image]});
 const key=image.url.slice('/api/media/'.length);
 assert.equal((await pg.query('select source_id from media_assets where storage_path=$1',[key])).rows[0].source_id,draft.id);
 assert.equal((await pg.query('select * from readable_media_asset($1,null)',[key])).rows.length,0);
 const submitted=await save(draft.id,org,draft.updated_at,true,document);assert.deepEqual(submitted.image_gallery,[image],'Older clients preserve galleries');
 await action(submitted);assert.equal((await pg.query('select * from readable_media_asset($1,null)',[key])).rows.length,1);
 await pg.query("update organizations set moderation_status='hidden' where id=$1",[org.id]);assert.equal((await pg.query('select * from readable_media_asset($1,null)',[key])).rows.length,0);
 await pg.query("update organizations set moderation_status='approved' where id=$1",[org.id]);
 const edited=(await pg.query("update organization_entries set image_gallery=$1 where id=$2 returning *",[JSON.stringify([{...image,caption:'Corrected archive date'}]),draft.id])).rows[0];
 assert.equal(edited.moderation_status,'submitted');assert.equal((await pg.query('select * from readable_media_asset($1,null)',[key])).rows.length,0);
 await pg.query("update organization_entries set image_gallery='[]' where id=$1",[draft.id]);
 assert.equal((await pg.query('select source_id from media_assets where storage_path=$1',[key])).rows[0].source_id,draft.id,'Removal never destroys or reassigns original');
 assert.equal((await pg.query('select * from readable_media_asset($1,$2)',[key,'cinegenius-editorial'])).rows.length,0);
}));
test('gallery refuses other origins, duplicate photos, unknown assets, oversize metadata and more than eight',()=>tx(async()=>{
 const {org,item}=await setup();await grant(org);const image=photo(2);await upload(image,'cinegenius-editorial','organization_entry',item.id);
 const id='11111111-1111-4111-8111-111111111111';await rejected(()=>save(id,org,null,false,{...document,image_gallery:[image]}),'media_origin');
 for(const images of [[photo(999)],[image,image],Array.from({length:9},(_,i)=>photo(i)),[{...image,caption:'a'.repeat(801)}],[{...image,creator:12}],[{...image,altText:''}],[null]])await rejected(()=>save(id,org,null,false,{...document,image_gallery:images}));
 const foreign=photo(3,'stranger');await upload(foreign,'stranger');await rejected(()=>save(id,org,null,false,{...document,image_gallery:[foreign]}),'media_origin');
 const own=photo(4);await upload(own);const draft=await save(id,org,null,false,{...document,image_gallery:[own]});
 await rejected(()=>save(id,org,new Date(0),false,{...document,image_gallery:[]}),'conflict');
 assert.deepEqual((await pg.query('select image_gallery from organization_entries where id=$1',[id])).rows[0].image_gallery,[own]);
}));
async function legacySetup(){const {org,item}=await setup();const legacy=(await pg.query("update organization_entries set author_user_id='support',last_actor_user_id='support',moderation_status='approved' where id=$1 returning *",[item.id])).rows[0];return{org,legacy};}
async function legacyGrant(item,patch={},enabled=true){const review={organizationId:item.organization_id,originalAuthorUserId:item.author_user_id,sourceUrl:item.external_url,reviewed:true,evidenceSha256:'a'.repeat(64),evidenceReference:'private-import-receipt#entry',contentExpiresAt:new Date(Date.now()-86400000).toISOString(),reason:'Original import and source expiry reviewed',...patch};return(await pg.query('select * from set_editorial_legacy_expiry_grant($1,$2,$3,$4,$5)',['admin',item.id,item.updated_at,enabled,JSON.stringify(review)])).rows[0];}
async function hideLegacy(item,patch={}){const params={actor:'cinegenius-editorial',id:item.id,expected:item.updated_at,source:item.external_url,checked:new Date(),verified:true,evidence:'a'.repeat(64),reason:'Actual source expiry verified again before hide',...patch};return(await pg.query('select * from hide_editorial_legacy_entry($1,$2,$3,$4,$5,$6,$7,$8)',Object.values(params))).rows[0];}
test('legacy hide is one explicit entry grant and never requires or creates a publication grant',()=>tx(async()=>{
 const {org,legacy}=await legacySetup();await rejected(()=>hideLegacy(legacy),'forbidden');await legacyGrant(legacy);
 assert.equal((await pg.query('select count(*)::int n from organization_editorial_grants')).rows[0].n,0);
 const hidden=await hideLegacy(legacy);assert.equal(hidden.moderation_status,'hidden');assert.equal(hidden.author_user_id,'support');assert.equal(hidden.title,legacy.title);assert.equal(hidden.description,legacy.description);assert.equal(hidden.external_url,legacy.external_url);
 assert.equal((await pg.query('select enabled from editorial_legacy_expiry_grants where entry_id=$1',[legacy.id])).rows[0].enabled,false);
 await rejected(()=>hideLegacy(hidden),'forbidden');await rejected(()=>action(hidden),'forbidden');
 await rejected(()=>save('11111111-1111-4111-8111-111111111111',org),'forbidden');
 assert.deepEqual((await pg.query('select action from editorial_legacy_expiry_events order by created_at')).rows.map(x=>x.action),['grant','hide']);
}));
test('legacy capability rejects stale author/source/content/revision, no fresh evidence, future expiry and parent withdrawal',()=>tx(async()=>{
 const {org,legacy}=await legacySetup();await legacyGrant(legacy);
 for(const patch of [{expected:new Date(0)},{source:'https://example.org/other'},{evidence:'b'.repeat(64)},{checked:new Date(Date.now()-11*60000)},{verified:false},{actor:'support'}])await rejected(()=>hideLegacy(legacy,patch));
 await pg.query("update organization_entries set title='Human correction' where id=$1",[legacy.id]);await rejected(()=>hideLegacy(legacy),'conflict');
 let current=(await pg.query('select * from organization_entries where id=$1',[legacy.id])).rows[0];await legacyGrant(current,{contentExpiresAt:new Date(Date.now()+86400000).toISOString()});await rejected(()=>hideLegacy(current),'review_required');
 await legacyGrant(current);await pg.query("update organizations set moderation_status='hidden' where id=$1",[org.id]);await rejected(()=>hideLegacy(current),'forbidden');
}));
test('legacy revocation, expiry and atomic audit prevent accidental hiding',()=>tx(async()=>{
 const {legacy}=await legacySetup();await legacyGrant(legacy);await legacyGrant(legacy,{},false);await rejected(()=>hideLegacy(legacy),'forbidden');
 await legacyGrant(legacy);await pg.exec("update editorial_legacy_expiry_grants set valid_until=now()-interval '1 minute'");await rejected(()=>hideLegacy(legacy),'forbidden');
 await legacyGrant(legacy);await pg.exec('alter table editorial_legacy_expiry_events add constraint test_audit_failure check(false) not valid');await rejected(()=>hideLegacy(legacy));
 assert.equal((await pg.query('select moderation_status from organization_entries where id=$1',[legacy.id])).rows[0].moderation_status,'approved');assert.equal((await pg.query('select enabled from editorial_legacy_expiry_grants where entry_id=$1',[legacy.id])).rows[0].enabled,true);
}));
test('legacy grants cannot be accessed or executed through browser database roles',()=>tx(async()=>{
 for(const role of ['anon','authenticated']){
  for(const table of ['editorial_legacy_expiry_grants','editorial_legacy_expiry_events'])for(const permission of ['SELECT','INSERT','UPDATE','DELETE'])assert.equal((await pg.query('select has_table_privilege($1,$2,$3) allowed',[role,table,permission])).rows[0].allowed,false);
  for(const fn of ['set_editorial_legacy_expiry_grant(text,uuid,timestamptz,boolean,jsonb)','hide_editorial_legacy_entry(text,uuid,timestamptz,text,timestamptz,boolean,text,text)'])assert.equal((await pg.query('select has_function_privilege($1,$2,\'EXECUTE\') allowed',[role,fn])).rows[0].allowed,false);
 }
}));
