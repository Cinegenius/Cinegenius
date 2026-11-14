import test,{before,after} from 'node:test';
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
 await pg.exec(`alter table storage.buckets add name text,add file_size_limit bigint,add allowed_mime_types text[];
 alter table project_drafts add user_id text,add published_project_id uuid;
 alter table profiles add last_seen_at timestamptz;
 create table friendships(sender_id text,receiver_id text,status text);
 create table blocks(blocker_id text,blocked_id text);`);
 for(const name of ['20261024090100_contact_visibility_controls.sql','20261024190000_public_community_media.sql','20261025150000_profile_company_discovery_only.sql','20261025151000_bound_discovery_query.sql','20261027180000_protected_media.sql','20261030170000_project_media_rights.sql','20261114005134_selective_community_image_lookup.sql','20261114180242_profile_privacy_controls.sql']) await pg.exec(migration(name));
});
after(async()=>pg?.close());
async function tx(fn){await pg.exec('begin');try{await fn();}finally{await pg.exec('rollback');}}
const rows=async(sql,args=[])=>(await pg.query(sql,args)).rows;
const setting=async(ghost)=>pg.query("insert into user_settings(user_id,ghost_mode) values('owner',$1) on conflict(user_id) do update set ghost_mode=excluded.ghost_mode",[ghost]);
let serial=0;
async function asset(){const key='owner/'+(++serial).toString(16).padStart(32,'0')+'.webp';await pg.query("insert into media_assets(storage_path,reference_url,owner_user_id,mime_type) values($1,$2,'owner','image/webp')",[key,'/api/media/'+key]);return key;}
const allowed=async(key,viewer=null)=>(await rows('select * from readable_media_asset($1,$2)',[key,viewer])).length===1;

test('ghost removes all personal offer types before counts and pagination, retains states and independent company offers',()=>tx(async()=>{
 for(const type of ['prop','vehicle','location','job','animal','creator'])await pg.query("insert into listings(id,user_id,type,published) values(gen_random_uuid(),'owner',$1,true)",[type]);
 await pg.query("insert into listings(id,user_id,type,published,company_id) values(gen_random_uuid(),'owner','prop',true,$1)",[company]);
 await pg.exec("insert into listings(id,user_id,type,published) values(gen_random_uuid(),'owner','prop',false)");
 assert.equal((await rows('select count(*)::int n from privacy_visible_listings'))[0].n,7);
 await setting(true);
 assert.equal((await rows('select count(*)::int n from privacy_visible_listings'))[0].n,1);
 assert.equal((await rows('select company_id from privacy_visible_listings limit 1'))[0].company_id,company);
 assert.equal((await rows('select count(*)::int n from listings where published'))[0].n,7);
 await setting(false);assert.equal((await rows('select count(*)::int n from privacy_visible_listings'))[0].n,7);
}));
test('ghost revokes profile and personal offer originals for accepted friends and public mirrors; owners retain access',()=>tx(async()=>{
 const portrait=await asset(),offer=await asset();
 await pg.query("update profiles set avatar_url=$1 where user_id='owner'",['/api/media/'+portrait]);
 await pg.query("insert into listings(id,user_id,type,published,image_url) values(gen_random_uuid(),'owner','vehicle',true,$1)",['/api/media/'+offer]);
 await pg.query("update profiles set portfolio_images=$1 where user_id='other'",[['/api/media/'+offer]]);
 await pg.exec("insert into friendships values('owner','other','accepted')");
 assert.equal(await allowed(portrait),true);assert.equal(await allowed(offer),true);
 await setting(true);
 for(const key of [portrait,offer]){assert.equal(await allowed(key),false);assert.equal(await allowed(key,'other'),false);assert.equal(await allowed(key,'owner'),true);}
 await setting(false);assert.equal(await allowed(portrait),true);assert.equal(await allowed(offer),true);
}));
test('company-owned image access remains independent, but mirroring a ghost profile image cannot grant rights',()=>tx(async()=>{
 const logo=await asset(),portrait=await asset();
 await pg.query('update companies set logo_url=$1 where id=$2',['/api/media/'+logo,company]);
 await pg.query("update profiles set avatar_url=$1 where user_id='owner'",['/api/media/'+portrait]);
 await pg.query('update companies set cover_url=$1 where id=$2',['/api/media/'+portrait,company]);
 await setting(true);assert.equal(await allowed(logo),true);assert.equal(await allowed(portrait),false);
}));
test('public photo discovery and direct eligibility expire immediately for legacy profile uploads and their mirrors',()=>tx(async()=>{
 const image='https://fixture.supabase.co/storage/v1/object/public/images/own-fixture.jpg';
 await pg.exec("insert into storage.objects(bucket_id,name) values('images','own-fixture.jpg')");
 await pg.query("update profiles set avatar_url=$1 where user_id='owner'",[image]);
 assert.equal((await rows('select * from public_community_media')).length,1);
 await setting(true);await pg.query("update profiles set avatar_url=$1 where user_id='other'",[image]);
 assert.equal((await rows('select * from public_community_media')).length,0);
 assert.equal((await rows('select * from public_community_image($1)',[image])).length,0);
}));
test('private settings and visibility view cannot be read by anon/authenticated roles and audiences are constrained',()=>tx(async()=>{
 for(const role of ['anon','authenticated'])for(const table of ['user_settings','privacy_visible_listings'])assert.equal((await rows('select has_table_privilege($1,$2,\'SELECT\') ok',[role,table]))[0].ok,false);
 await pg.exec("insert into user_settings(user_id,location_visibility,map_visibility,activity_visibility,phone_visibility,contact_email_visibility) values('owner','friends','hidden','members','friends','friends')");
 await pg.exec('savepoint bad');await assert.rejects(()=>pg.exec("update user_settings set map_visibility='admin'"),e=>e.code==='23514');await pg.exec('rollback to savepoint bad');
}));
test('hidden or ghost activity stops retaining fresh presence without changing other profile fields',()=>tx(async()=>{
 await setting(true);await pg.exec("update profiles set last_seen_at=now(),location='Own fixture city' where user_id='owner'");
 let row=(await rows("select last_seen_at,location from profiles where user_id='owner'"))[0];assert.equal(row.last_seen_at,null);assert.equal(row.location,'Own fixture city');
 await setting(false);await pg.exec("update profiles set last_seen_at=now() where user_id='owner'");assert.ok((await rows("select last_seen_at from profiles where user_id='owner'"))[0].last_seen_at);
 await pg.exec("update user_settings set activity_visibility='hidden' where user_id='owner';update profiles set last_seen_at=now() where user_id='owner'");assert.equal((await rows("select last_seen_at from profiles where user_id='owner'"))[0].last_seen_at,null);
}));
