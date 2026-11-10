import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve,join} from 'node:path';
// Local controlled fixture only. No .env loading, networking or production clients.
const root=resolve(process.env.CINEGENIUS_TEST_SOURCE??process.cwd());
const require=createRequire(join(root,'package.json'));
const {PGlite}=require('@electric-sql/pglite');
const sql=readFileSync(new URL('../supabase/migrations/20261110130000_notification_localization.sql',import.meta.url),'utf8');
const inventory=JSON.parse(readFileSync(new URL('./fixtures/notification-localization-source.json',import.meta.url),'utf8'));
const index=JSON.parse(readFileSync(join(root,'lib/i18n/notification-index.json'),'utf8'));
const company='10000000-0000-4000-8000-000000000001',company2='10000000-0000-4000-8000-000000000002';
let db,beforeState,afterState;
const readMigration=name=>readFileSync(join(root,'supabase/migrations',name),'utf8');
async function functions(pg){return(await pg.query(`select p.oid::text,p.proname,p.prosrc,p.proowner::text,p.proacl::text,p.prosecdef,p.proconfig,p.proargdefaults::text,p.proisstrict,p.provolatile,p.proparallel,p.procost,p.prorows,pg_get_functiondef(p.oid) as definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f' order by p.oid`)).rows;}
async function privileges(pg){return(await pg.query(`select c.oid::text,c.relname,c.relowner::text,c.relacl::text,c.relrowsecurity,c.relforcerowsecurity,(select coalesce(jsonb_agg(jsonb_build_object('name',p.polname,'roles',p.polroles,'cmd',p.polcmd,'using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid)) order by p.polname),'[]'::jsonb) from pg_policy p where p.polrelid=c.oid) policies from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' order by c.oid`)).rows;}
async function notices(pg){return(await pg.query('select to_jsonb(n) row from notifications n order by id')).rows.map(x=>x.row);}
async function snapshot(pg){return{functions:await functions(pg),privileges:await privileges(pg),notices:await notices(pg)};}
async function fixture(){
 const pg=new PGlite();
 const source=readFileSync(join(root,'lib/community-media-team-db.test.mjs'),'utf8');
 const schema=source.split('await pg.exec(`')[1].split('`);')[0].replaceAll('${company}',company).replaceAll('${company2}',company2);
 await pg.exec(schema);
 await pg.exec(`alter table storage.buckets add name text,add file_size_limit bigint,add allowed_mime_types text[];
 alter table project_drafts add user_id text,add published_project_id uuid;
 create table friendships(sender_id text,receiver_id text,status text);create table blocks(blocker_id text,blocked_id text);
 create table admin_audit_log(id uuid primary key default gen_random_uuid(),actor_user_id text,action text,entity_type text,entity_id text,reason text,outcome text,metadata jsonb);
 alter table notifications add is_read boolean default false,add created_at timestamptz default now();
 alter table notifications enable row level security;
 create policy own_notification on notifications for select to authenticated using(user_id=current_setting('fixture.user_id',true));
 grant select on notifications to authenticated;grant select,insert,update,delete on notifications to service_role;
 insert into notifications(id,user_id,type,title,body,href,is_read,created_at) values('90000000-0000-4000-8000-000000000001','member','legacy','Eigener Titel · {opaque}','Unauthored legacy text <keep> & Namen','/messages',true,'2026-01-02T03:04:05Z');`);
 for(const name of ['20261024190000_public_community_media.sql','20261024191000_direct_company_invitations.sql','20261025150000_profile_company_discovery_only.sql','20261025151000_bound_discovery_query.sql','20261027180000_protected_media.sql','20261028200000_offer_moderation.sql','20261028210000_marketplace_profile_publication.sql','20261029020000_admin_review_discretion.sql'])await pg.exec(readMigration(name));
 return pg;
}
async function tx(fn){await db.exec('begin');try{await fn();}finally{await db.exec('rollback');}}
async function failure(statement,args=[],code){await db.exec('savepoint expected_failure');let e;try{await db.query(statement,args);}catch(error){e=error;}await db.exec('rollback to savepoint expected_failure');assert.ok(e,'expected failure');if(code)assert.equal(e.code,code);return e;}
async function count(where='true'){return(await db.query('select count(*)::int n from notifications where '+where)).rows[0].n;}
async function invite(actor='owner',recipient='member',titles=['Geschäftsführer/in','Technische Leitung']){return(await db.query('select invite_company_member($1,$2,$3,$4) id',[actor,company,recipient,titles])).rows[0].id;}
async function respond(id,actor='member',decision='accept'){return(await db.query('select respond_company_invitation($1,$2,$3) status',[actor,id,decision])).rows[0].status;}
async function offerRow(id){return(await db.query('select to_jsonb(l) r from listings l where id=$1',[id])).rows[0].r;}
async function createOffer(media=false){const id=(await db.query('select gen_random_uuid() id')).rows[0].id;let key=null,url=null;if(media){key='owner/'+'e'.repeat(32)+'.webp';url='/api/media/'+key;await db.query("insert into media_assets(storage_path,reference_url,owner_user_id,mime_type) values($1,$2,'owner','image/webp')",[key,url]);}await db.query("insert into listings(id,user_id,type,title,image_url,last_editor_id) values($1,'owner','location','Original member title',$2,'owner')",[id,url]);return{id,key,url};}
async function provider(){return(await db.query("select to_jsonb(p) r from profiles p where user_id='owner'")).rows[0].r;}
async function transition(id,action='approve',notification={title:'Raw review title',body:'Raw member name',href:'/dashboard'},expected,profile){return(await db.query('select offer_review_transition($1,$2,$3,$4,$5,$6,$7,$8,$9) status',['listing',id,expected??await offerRow(id),null,profile??await provider(),action,action==='submit'?'owner':'controlled-admin','Own controlled review reason',notification])).rows[0].status;}
async function mediaAllowed(key){return(await db.query('select * from readable_media_asset($1,null)',[key])).rows.length>0;}
before(async()=>{db=await fixture();beforeState=await snapshot(db);await db.exec(sql);afterState=await snapshot(db);});
after(async()=>db?.close());

test('additive migration preserves old rows, IDs/read state, RLS/ACLs, function OIDs/attributes and all unrelated definitions; reruns do nothing',()=>tx(async()=>{
 assert.deepEqual(afterState.privileges,beforeState.privileges);
 assert.deepEqual(afterState.notices.map(({localization,...row})=>{assert.equal(localization,null);return row;}),beforeState.notices);
 assert.deepEqual((await db.query("select data_type,is_nullable,column_default from information_schema.columns where table_schema='public' and table_name='notifications' and column_name='localization'")).rows,[{data_type:'jsonb',is_nullable:'YES',column_default:null}]);
 assert.equal(afterState.functions.length,beforeState.functions.length);
 for(const[i,b]of beforeState.functions.entries()){const a=afterState.functions[i],patch=inventory.find(p=>p.name===b.proname);if(!patch){assert.deepEqual(a,b);continue;}const{prosrc:bs,definition:bd,...ba}=b,{prosrc:as,definition:ad,...aa}=a;assert.deepEqual(aa,ba);assert.equal((await db.query('select md5($1) hash',[bs])).rows[0].hash,patch.before_md5);assert.equal((await db.query('select md5($1) hash',[as])).rows[0].hash,patch.after_md5);assert.equal(ad.replace(as,bs),bd);}
 await db.query("insert into notifications(user_id,type,title,body,localization) values('member','custom','Human authored','Keep raw',$1)",[{version:1,title:{key:'companyInvitationTitle'}}]);
 const state=await snapshot(db);await db.exec(sql);await db.exec(sql);assert.deepEqual(await snapshot(db),state);
}));

test('invitations store canonical metadata and opaque names/roles, keep old text and private membership, and notify once',()=>tx(async()=>{
 const name='ACME · "Crew" <Name> {x}',titles=['Producent · μέλος','Titel: "A/B"'];await db.query('update companies set name=$1 where id=$2',[name,company]);
 const id=await invite('owner','member',titles);assert.equal(await invite('owner','member',titles),id);
 const rows=(await db.query("select * from notifications where type='company_invitation'")).rows;assert.equal(rows.length,1);const n=rows[0];
 assert.equal(n.title,'Einladung ins Firmenteam');assert.equal(n.body,name+' lädt dich ein: '+titles.join(' · ')+'. Die Zuordnung wird erst nach deiner Annahme öffentlich.');
 assert.deepEqual(n.localization,{version:1,title:{key:'companyInvitationTitle'},body:{key:'companyInvitationBody',values:{company:name,roles:titles.join(' · ')}}});
 assert.equal((await db.query("select count(*)::int n from company_members where user_id='member'")).rows[0].n,0);
 await db.exec("set local role authenticated;select set_config('fixture.user_id','other',true)");assert.equal(await count("type='company_invitation'"),0);
 await db.exec("select set_config('fixture.user_id','member',true)");assert.equal(await count("type='company_invitation'"),1);await db.exec('reset role');
}));

test('response metadata changes only generated title: accept/decline/revoke, raw body, recipient routing and retry semantics survive',()=>tx(async()=>{
 for(const[decision,actor,status,key]of[['decline','member','declined','companyInvitationDeclined'],['revoke','admin','revoked','companyInvitationRevoked'],['accept','member','claimed','companyInvitationAccepted']]){const id=await invite(),n=await count();assert.equal(await respond(id,actor,decision),status);assert.equal(await respond(id,actor,decision),status);assert.equal(await count(),n+1);const row=(await db.query("select * from notifications where type='company_invitation_response'")).rows.find(n=>n.localization.title.key===key);assert.deepEqual(row.localization,{version:1,title:{key}});assert.equal(row.body,'Testfirma: Geschäftsführer/in · Technische Leitung');assert.equal(row.user_id,decision==='revoke'?'member':'owner');assert.ok(!Object.hasOwn(row.localization,'body'));}
 const members=(await db.query("select * from company_members where user_id='member'")).rows;assert.equal(members.length,1);assert.equal(members[0].status,'accepted');assert.deepEqual(members[0].public_titles,['Geschäftsführer/in','Technische Leitung']);
}));

test('company permissions, recipient/title validation, expiry, pair protection and service-only RPC privileges remain enforced',()=>tx(async()=>{
 const n=await count();for(const[actor,recipient,titles,code]of[['editor','member',['Titel'],'42501'],['owner','owner',['Titel'],'22023'],['owner','member',[],'22023'],['owner','member',['x'.repeat(81)],'22023']])await failure('select invite_company_member($1,$2,$3,$4)',[actor,company,recipient,titles],code);assert.equal(await count(),n);
 const id=await invite();await failure('select respond_company_invitation($1,$2,$3)',['other',id,'accept'],'42501');await db.query("update company_invitations set expires_at=now()-interval '1 minute' where id=$1",[id]);const expired=await count();await failure('select respond_company_invitation($1,$2,$3)',['member',id,'accept'],'22023');assert.equal(await count(),expired);
 await db.query("insert into company_members(company_id,user_id,status) values($1,'member','pending')",[company]);await failure('select invite_company_member($1,$2,$3,$4)',['owner',company,'member',['Titel']],'23505');
 for(const role of ['anon','authenticated','service_role'])for(const p of inventory)assert.equal((await db.query("select has_function_privilege($1,$2,'execute') allowed",[role,p.signature])).rows[0].allowed,role==='service_role');
}));

test('latest offer review keeps provider/revision locks, approval/audit history and actual media privacy; metadata passes through exactly',()=>tx(async()=>{
 const{id,key}=await createOffer(true),before=await offerRow(id),pr=await provider();assert.equal(await mediaAllowed(key),false);
 await db.query("update profiles set display_name='Changed provider snapshot' where user_id='owner'");assert.equal(await transition(id,'approve',null,before,pr),'stale');assert.equal(await count("type='offer_review'"),0);
 const localization={version:1,title:{key:'offerTitle'},body:{key:'offerBody_approved',values:{title:'Opaque "Mitglied" <A/B>'}}},notice={title:'Old-compatible title',body:'Member name + title remain raw',href:'/dashboard?tab=listings',localization};
 assert.equal(await transition(id,'approve',notice),'saved');const reviewed=await offerRow(id);assert.equal(reviewed.published,true);assert.equal(reviewed.moderation_status,'approved');assert.equal(reviewed.content_revision,before.content_revision);assert.equal(reviewed.reviewed_revision,before.content_revision);assert.equal(reviewed.reviewed_by,'controlled-admin');assert.equal(await mediaAllowed(key),true);
 assert.equal(await transition(id,'approve',notice),'unchanged');assert.equal(await transition(id,'approve',notice,before),'stale');
 const rows=(await db.query("select * from notifications where type='offer_review'")).rows;assert.equal(rows.length,1);assert.equal(rows[0].title,notice.title);assert.equal(rows[0].body,notice.body);assert.deepEqual(rows[0].localization,localization);
 assert.equal((await db.query('select count(*)::int n from admin_audit_log where entity_id=$1',[id])).rows[0].n,1);assert.equal((await db.query("select count(*)::int n from offer_moderation_events where offer_id=$1 and event='approve'",[id])).rows[0].n,1);
 assert.equal(await transition(id,'hide',{title:'Legacy writer',body:'No localization field',href:'/dashboard'}),'saved');assert.equal(await mediaAllowed(key),false);assert.equal((await db.query("select localization from notifications where title='Legacy writer'")).rows[0].localization,null);
 assert.equal((await db.query("insert into notifications(user_id,type,title,body,href) values('member','custom','Old app','Unchanged insert','/messages') returning localization")).rows[0].localization,null);
}));

test('notification failure atomically rolls back publication, audit, revision events and media access',()=>tx(async()=>{
 const{id,key}=await createOffer(true),before=await offerRow(id);const media=(await db.query('select to_jsonb(m) r from media_assets m order by storage_path')).rows;
 const queryCounts='select (select count(*) from notifications)::int n,(select count(*) from admin_audit_log)::int a,(select count(*) from offer_moderation_events)::int e',counts=(await db.query(queryCounts)).rows;
 await db.exec('alter table notifications add constraint controlled_notification_failure check(false) not valid');await failure('select offer_review_transition($1,$2,$3,$4,$5,$6,$7,$8,$9)',['listing',id,before,null,await provider(),'approve','controlled-admin','Controlled test reason',{title:'Old title',body:'Old body',localization:{version:1,title:{key:'offerTitle'}}}],'23514');
 assert.deepEqual(await offerRow(id),before);assert.deepEqual((await db.query('select to_jsonb(m) r from media_assets m order by storage_path')).rows,media);assert.deepEqual((await db.query(queryCounts)).rows,counts);assert.equal(await mediaAllowed(key),false);
}));

test('unknown authoritative RPC aborts the entire statement, including earlier patches and new column',async()=>{
 const pg=await fixture();try{const signature=inventory.find(p=>p.name==='offer_review_transition').signature,original=(await pg.query('select pg_get_functiondef($1::regprocedure) definition',[signature])).rows[0].definition;await pg.exec(original.replace("RETURN 'saved';","RETURN 'saved'; -- independently changed body"));const state=await snapshot(pg);await assert.rejects(()=>pg.exec(sql),/Unexpected body for RPC/);assert.equal((await pg.query("select count(*)::int n from information_schema.columns where table_schema='public' and table_name='notifications' and column_name='localization'")).rows[0].n,0);assert.deepEqual(await snapshot(pg),state);}finally{await pg.close();}
});

test('all SQL-generated notification keys belong to the shared index and correct field/type',()=>{
 const keys={companyInvitationTitle:['title','company_invitation'],companyInvitationBody:['body','company_invitation'],companyInvitationAccepted:['title','company_invitation_response'],companyInvitationDeclined:['title','company_invitation_response'],companyInvitationRevoked:['title','company_invitation_response'],offerTitle:['title','offer_review'],offerBody_approved:['body','offer_review']};for(const[key,[field,type]]of Object.entries(keys)){assert.equal(index[key].field,field);assert.ok(index[key].types.includes(type));}
});

test('pre-existing incompatible localization schema is refused without resetting its data or default',()=>tx(async()=>{
 await db.exec("alter table notifications alter column localization set default '{\"unexpected\":true}'::jsonb");
 const state=await snapshot(db),defaultBefore=(await db.query("select column_default from information_schema.columns where table_schema='public' and table_name='notifications' and column_name='localization'")).rows;
 await failure(sql,[], 'P0001');
 assert.deepEqual(await snapshot(db),state);
 assert.deepEqual((await db.query("select column_default from information_schema.columns where table_schema='public' and table_name='notifications' and column_name='localization'")).rows,defaultBefore);
}));

test('verification counts real metadata values but neither a missing field, SQL NULL nor JSON null',async()=>{
 const verification=readFileSync(new URL('../docs/sql/verify-notification-localization.sql',import.meta.url),'utf8');
 const aggregation=verification.match(/SELECT count\(\*\) AS total_notifications,[\s\S]*?FROM public\.notifications n;/)?.[0];
 assert.ok(aggregation,'Execute the actual aggregate verification query');
 const pg=new PGlite();
 try{
  await pg.exec("create table public.notifications(id integer primary key,body text);insert into public.notifications values(1,'Synthetic legacy one'),(2,'Synthetic legacy two')");
  const counts=async()=>{const row=(await pg.query(aggregation)).rows[0];return Object.fromEntries(Object.entries(row).map(([key,value])=>[key,Number(value)]));};
  assert.deepEqual(await counts(),{total_notifications:2,with_metadata_value:0,metadata_version_1:0});
  await pg.exec('alter table public.notifications add column localization jsonb');
  assert.deepEqual(await counts(),{total_notifications:2,with_metadata_value:0,metadata_version_1:0});
  await pg.exec("insert into public.notifications values(3,'Synthetic JSON null','null'::jsonb)");
  assert.deepEqual(await counts(),{total_notifications:3,with_metadata_value:0,metadata_version_1:0});
  await pg.exec("insert into public.notifications values(4,'Synthetic versioned metadata','{\"version\":1}'::jsonb),(5,'Synthetic empty object','{}'::jsonb),(6,'Synthetic non-null scalar','false'::jsonb)");
  assert.deepEqual(await counts(),{total_notifications:6,with_metadata_value:3,metadata_version_1:1});
 }finally{await pg.close();}
});
