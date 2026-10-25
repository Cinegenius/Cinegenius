import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { COMMUNITY_ALLOWED_SOURCE_TYPES, communityMediaLabel, communityPhotoFromRow, isOwnPublicStorageUrl } from './community-media.ts';
let pg;
const company='10000000-0000-4000-8000-000000000001';
const company2='10000000-0000-4000-8000-000000000002';
const origin='https://test.supabase.co';
const image=(name)=>`${origin}/storage/v1/object/public/images/${name}.jpg`;
before(async()=>{
 pg=new PGlite();
 await pg.exec(`
 create role anon; create role authenticated; create role service_role;
 create schema storage;
 create table storage.buckets(id text primary key,public boolean);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,created_at timestamptz default now(),metadata jsonb default '{"mimetype":"image/jpeg"}');
 create table profiles(user_id text primary key,slug text,display_name text,avatar_url text,cover_image_url text,profile_images jsonb default '[]',portfolio_images text[] default '{}',role text,positions text[],location text);
 create table user_settings(user_id text primary key,profile_visibility text default 'public');
 create table companies(id uuid primary key,owner_user_id text,slug text,name text,published boolean default true,logo_url text,cover_url text,portfolio_images text[] default '{}');
 create table listings(id uuid primary key,type text,title text,user_id text,company_id uuid,published boolean,image_url text,extra_images text[] default '{}',images text[] default '{}',metadata jsonb default '{}',floor_plan_url text);
 create table company_equipment(id uuid primary key,company_id uuid,name text,images text[],published boolean);
 create table projects(id uuid primary key,title text,poster_url text,images text[] default '{}',created_by text,metadata jsonb default '{}');
 create table project_drafts(id uuid primary key default gen_random_uuid(),draft_data jsonb);
 create table community_posts(id uuid primary key,author_id text,title text,expires_at timestamptz,images jsonb default '[]');
 create table company_members(id uuid primary key default gen_random_uuid(),company_id uuid references companies(id),user_id text,role text default 'member',title text,public_titles text[] default '{}',status text,unique(company_id,user_id));
 create table notifications(id uuid primary key default gen_random_uuid(),user_id text,type text,title text,body text,href text);
 create table profile_image_likes(id uuid primary key default gen_random_uuid(),profile_id text,image_url text,liker_id text,unique(profile_id,image_url,liker_id));
 create table company_invitations(id uuid primary key default gen_random_uuid(),company_id uuid references companies(id),token_hash text not null unique,permission_role text default 'member',public_titles text[] default '{}',status text default 'pending' check(status in ('pending','claimed','revoked')),created_by text,claimed_by text,created_at timestamptz default now(),expires_at timestamptz);
 insert into profiles(user_id,slug,display_name) values('owner','owner','Firma Owner'),('admin','admin','Team Admin'),('editor','editor','Team Editor'),('member','member','Test Member'),('other','other','Other Member'),('private','private','Private Member');
 insert into user_settings values('private','private');
 insert into companies(id,owner_user_id,slug,name) values('${company}','owner','test-firma','Testfirma'),('${company2}','other','zweite','Zweite Firma');
 insert into company_members(company_id,user_id,role,status,public_titles) values('${company}','admin','admin','accepted','{Projektleitung}'),('${company}','editor','editor','accepted','{Produktion}');
 insert into storage.buckets values('images',true),('private',false);
 `);
 for(const migration of ['20261024190000_public_community_media.sql','20261024191000_direct_company_invitations.sql','20261025150000_profile_company_discovery_only.sql','20261025151000_bound_discovery_query.sql']) await pg.exec(readFileSync(new URL(`../supabase/migrations/${migration}`,import.meta.url),'utf8'));
});
after(async()=>{await pg?.close();});
async function tx(fn){await pg.exec('begin');try{await fn();}finally{await pg.exec('rollback');}}
async function invite(actor='owner',recipient='member',co=company){return (await pg.query('select public.invite_company_member($1,$2,$3,$4) id',[actor,co,recipient,['Geschäftsführer/in','Technische Leitung']])).rows[0].id;}
async function respond(id,actor='member',decision='accept'){return (await pg.query('select public.respond_company_invitation($1,$2,$3) status',[actor,id,decision])).rows[0].status;}
async function attempt(sql,params=[]){await pg.exec('savepoint expected_failure');try{await pg.query(sql,params);}catch(error){await pg.exec('rollback to savepoint expected_failure');return error;}throw new Error('Expected denial');}

test('only direct public profile and company sources supply avatar, cover, portfolio and galleries',()=>tx(async()=>{
 const names=['avatar','cover','headshot','portfolio','legacy','logo','firm-cover','firm-gallery','location','market','project','poster','equipment','board','private','draft','missing','individual-private'];
 for(const [index,name] of names.entries()) if(name!=='missing') await pg.query("insert into storage.objects(bucket_id,name,created_at) values('images',$1,$2)",[`${name}.jpg`,new Date(1700000000000+index*1000).toISOString()]);
 await pg.query('update profiles set avatar_url=$1,cover_image_url=$2,profile_images=$3,portfolio_images=$4 where user_id=\'owner\'',[image('avatar'),image('cover'),JSON.stringify([{url:image('headshot'),media_type:'headshot'},{url:image('portfolio'),caption:'Set',media_type:'bts'},{url:image('individual-private'),visibility:'private'},{url:image('missing')}]),[image('legacy')]]);
 await pg.query('update profiles set avatar_url=$1 where user_id=\'private\'',[image('private')]);
 await pg.query('update companies set logo_url=$1,cover_url=$2,portfolio_images=$3 where id=$4',[image('logo'),image('firm-cover'),[image('firm-gallery')],company]);
 await pg.query("insert into listings(id,type,title,user_id,company_id,published,image_url,extra_images) values(gen_random_uuid(),'location','Testlocation','owner',null,true,$1,'{}'),(gen_random_uuid(),'prop','Equipment','owner',null,true,$2,'{}'),(gen_random_uuid(),'location','Private draft','owner',null,false,$3,'{}')",[image('location'),image('market'),image('draft')]);
 await pg.query('insert into projects(id,title,poster_url,images,created_by) values(gen_random_uuid(),\'Testfilm\',$1,$2,\'owner\')',[image('poster'),[image('project')]]);
 await pg.query('insert into company_equipment values(gen_random_uuid(),$1,\'Firmenkamera\',$2,true)',[company,[image('equipment')]]);
 await pg.query("insert into community_posts values(gen_random_uuid(),'owner','Testaushang',now()+interval '1 day',$1)",[JSON.stringify([image('board')])]);
 const {rows}=await pg.query('select * from public_community_media order by uploaded_at desc,storage_id');
 assert.equal(rows.length,8); for(const name of names.slice(0,8))assert.ok(rows.some(r=>r.image_url===image(name)),name);
 for(const name of names.slice(8))assert.ok(!rows.some(r=>r.image_url===image(name)),name);
 assert.equal(communityMediaLabel(rows.find(r=>r.image_url===image('logo'))),'Firmenlogo');
 assert.equal(communityPhotoFromRow(rows.find(r=>r.image_url===image('logo'))).fit,'contain');
 assert.deepEqual([...new Set(rows.map(r=>r.source_type))].sort(),[...COMMUNITY_ALLOWED_SOURCE_TYPES].sort());
 assert.equal(rows.find(r=>r.image_url===image('portfolio')).author_href,'/profile/owner');
 assert.equal(rows.find(r=>r.image_url===image('logo')).author_href,'/companies/test-firma');
}));

test('deletion, replacement, visibility, unpublished parent and expiration update discovery immediately; duplicates share one file',()=>tx(async()=>{
 await pg.query("insert into storage.objects(bucket_id,name) values('images','old.jpg'),('images','new.jpg')");
 await pg.query('update profiles set avatar_url=$1,portfolio_images=$2 where user_id=\'owner\'',[image('old'),[image('old')+'?v=1']]);
 assert.equal((await pg.query('select * from public_community_media')).rows.length,1);
 await pg.query('update profiles set avatar_url=$1,portfolio_images=\'{}\' where user_id=\'owner\'',[image('new')]);
 assert.equal((await pg.query('select image_url from public_community_media')).rows[0].image_url,image('new'));
 await pg.query("insert into user_settings values('owner','private')");assert.equal((await pg.query('select * from public_community_media')).rows.length,0);
 await pg.query("delete from user_settings where user_id='owner'");await pg.query("delete from storage.objects where name='new.jpg'");assert.equal((await pg.query('select * from public_community_media')).rows.length,0);
 await pg.query('update companies set logo_url=$1 where id=$2',[image('old'),company]);
 assert.equal((await pg.query('select * from public_community_media')).rows.length,1);
 await pg.query('update companies set published=false where id=$1',[company]);assert.equal((await pg.query('select * from public_community_media')).rows.length,0);
 await pg.query("insert into community_posts values(gen_random_uuid(),'owner','Öffentlicher Aushang',now()+interval '1 day',$1)",[JSON.stringify([image('old')])]);
 assert.equal((await pg.query('select * from public_community_media')).rows.length,0);
 await pg.query("update community_posts set expires_at=now()-interval '1 minute'");assert.equal((await pg.query('select * from public_community_media')).rows.length,0);
}));

test('registry handles encoded storage filenames and rejects nonpublic or temporary URLs',()=>tx(async()=>{
 await pg.query("insert into storage.objects(bucket_id,name) values('images','ä Raum.jpg'),('private','secret.jpg')");
 await pg.query('update profiles set portfolio_images=$1 where user_id=\'owner\'',[['https://test.supabase.co/storage/v1/object/public/images/%C3%A4%20Raum.jpg','https://test.supabase.co/storage/v1/object/sign/images/secret.jpg?token=abc','https://test.supabase.co/storage/v1/object/public/private/secret.jpg','blob:local-preview']]);
 assert.equal((await pg.query('select * from public_community_media')).rows.length,1);
 assert.equal(isOwnPublicStorageUrl(image('avatar'),origin),true);
 assert.equal(isOwnPublicStorageUrl(image('avatar'),'https://foreign.supabase.co'),false);
}));

test('legacy vehicles and independent projects remain excluded regardless of visibility or author',()=>tx(async()=>{
 await pg.query("insert into storage.objects(bucket_id,name) values('images','legacy-car.jpg'),('images','private-author-project.jpg')");
 await pg.query("insert into listings(id,type,title,user_id,published,images) values(gen_random_uuid(),'vehicle','Testfahrzeug','owner',true,$1)",[[image('legacy-car')]]);
 assert.equal((await pg.query('select * from public_community_media')).rows.length,0);
 await pg.query("insert into projects(id,title,created_by,poster_url) values(gen_random_uuid(),'Öffentlicher Film','private',$1)",[image('private-author-project')]);
 assert.equal((await pg.query('select * from public_community_media')).rows.length,0);
 await pg.query("update projects set metadata='{\"visibility\":\"private\"}'");
 assert.equal((await pg.query('select * from public_community_media')).rows.length,0);
 assert.equal((await pg.query('select * from projects')).rows.length,1);
 assert.equal((await pg.query('select * from listings')).rows.length,1);
}));

test('existing photo likes stay attached and are not deleted when media becomes private or is removed',()=>tx(async()=>{
 await pg.query("insert into storage.objects(bucket_id,name) values('images','liked.jpg')");
 await pg.query("update profiles set profile_images=$1 where user_id='owner'",[JSON.stringify([{url:image('liked'),media_type:'portfolio'}])]);
 await pg.query("insert into profile_image_likes(profile_id,image_url,liker_id) values('owner',$1,'member')",[image('liked')]);
 const visible=await pg.query('select count(*)::int as count from profile_image_likes l join public_community_media m on m.owner_id=l.profile_id and m.image_url=l.image_url');
 assert.equal(visible.rows[0].count,1);
 await pg.query("update profiles set profile_images='[]' where user_id='owner'");
 assert.equal((await pg.query('select * from public_community_media')).rows.length,0);
 assert.equal((await pg.query('select * from profile_image_likes')).rows.length,1);
}));

test('location floor plans and production reference photos stay excluded without changing originals',()=>tx(async()=>{
 await pg.query("insert into storage.objects(bucket_id,name,metadata) values('images','floor.jpg','{\"mimetype\":\"image/jpeg\"}'),('images','reference.jpg','{\"mimetype\":\"image/jpeg\"}'),('images','hidden.jpg','{\"mimetype\":\"image/jpeg\"}'),('images','plan.pdf','{\"mimetype\":\"application/pdf\"}')");
 const metadata={production_credits:[{title:'Testproduktion',image_urls:[image('reference')]},{title:'Privat',visibility:'private',image_urls:[image('hidden')]}]};
 await pg.query("insert into listings(id,type,title,user_id,published,floor_plan_url,metadata) values(gen_random_uuid(),'location','Testhaus','owner',true,$1,$2)",[image('floor'),JSON.stringify(metadata)]);
 const rows=(await pg.query('select * from public_community_media')).rows;
 assert.equal(rows.length,0);
 assert.equal((await pg.query('select metadata from listings')).rows[0].metadata.production_credits.length,2);
 await pg.query("update listings set metadata='{}',floor_plan_url=$1",[`${origin}/storage/v1/object/public/images/plan.pdf`]);
 assert.equal((await pg.query('select * from public_community_media')).rows.length,0);
}));

test('a targeted invitation stays private, notifies once, persists, and accepts only as the intended member',()=>tx(async()=>{
 const id=await invite(); assert.equal(await invite(),id);
 assert.equal((await pg.query("select * from company_members where user_id='member'")).rows.length,0);
 assert.equal((await pg.query("select * from notifications where user_id='member'")).rows.length,1);
 assert.equal((await attempt('select respond_company_invitation($1,$2,$3)',['other',id,'accept'])).code,'42501');
 assert.equal(await respond(id),'claimed'); assert.equal(await respond(id),'claimed');
 const m=(await pg.query("select * from company_members where user_id='member'")).rows;
 assert.equal(m.length,1); assert.equal(m[0].role,'member'); assert.equal(m[0].status,'accepted'); assert.deepEqual(m[0].public_titles,['Geschäftsführer/in','Technische Leitung']);
 assert.equal((await attempt('select invite_company_member($1,$2,$3,$4)',['member',company,'other',['Mitarbeiter/in']])).code,'42501');
}));

test('decline, withdraw, expiration and safe retries never publish membership',()=>tx(async()=>{
 let id=await invite(); assert.equal(await respond(id,'member','decline'),'declined');assert.equal(await respond(id,'member','decline'),'declined');
 id=await invite('admin'); assert.equal(await respond(id,'admin','revoke'),'revoked');assert.equal((await attempt('select respond_company_invitation($1,$2,$3)',['member',id,'accept'])).code,'22023');
 id=await invite();await pg.query("update company_invitations set expires_at=now()-interval '1 minute' where id=$1",[id]);
 assert.equal((await attempt('select respond_company_invitation($1,$2,$3)',['member',id,'accept'])).code,'22023');
 assert.notEqual(await invite(),id);assert.equal((await pg.query("select * from company_members where user_id='member'")).rows.length,0);
}));

test('join requests and directed invitations cannot coexist in either order',()=>tx(async()=>{
 await pg.query("insert into company_members(company_id,user_id,status) values($1,'member','pending')",[company]);
 assert.equal((await attempt('select invite_company_member($1,$2,$3,$4)',['owner',company,'member',['Mitarbeiter/in']])).code,'23505');
 await pg.query("delete from company_members where user_id='member'");await invite();
 assert.equal((await attempt("insert into company_members(company_id,user_id,status) values($1,'member','pending')",[company])).code,'23505');
}));

test('company permission roles, multiple memberships and ending one membership preserve accounts',()=>tx(async()=>{
 assert.equal((await attempt('select invite_company_member($1,$2,$3,$4)',['editor',company,'member',['Mitarbeiter/in']])).code,'42501');
 await respond(await invite('admin'));
 await respond(await invite('other','member',company2));
 assert.equal((await pg.query("select * from company_members where user_id='member'")).rows.length,2);
 await pg.query("delete from company_members where company_id=$1 and user_id='member'",[company]);
 assert.equal((await pg.query("select * from profiles where user_id='member'")).rows.length,1);
 assert.equal((await pg.query("select * from company_members where user_id='member'")).rows.length,1);
 assert.equal((await pg.query("select * from company_members where user_id='admin'")).rows[0].role,'admin');
}));

test('public clients cannot query the registry or execute trusted company writes',()=>tx(async()=>{
 for(const role of ['anon','authenticated']) {
  await pg.exec(`set local role ${role}`);
  assert.equal((await attempt('select * from public_community_media')).code,'42501');
  assert.equal((await attempt('select invite_company_member($1,$2,$3,$4)',['owner',company,'member',['Mitarbeiter/in']])).code,'42501');
  assert.equal((await attempt('select * from search_company_candidates($1,$2,$3)',['owner',company,'Test'])).code,'42501');
  await pg.exec('reset role');
 }
}));

test('member search filters private, existing and invited accounts before limiting; returns no contact fields',()=>tx(async()=>{
 await pg.query("update profiles set display_name='Test '||user_id");
 const search=async(actor='owner')=>(await pg.query('select * from search_company_candidates($1,$2,$3)',[actor,company,'Test'])).rows;
 assert.deepEqual((await search()).map(p=>p.user_id).sort(),['member','other']);
 assert.deepEqual(Object.keys((await search())[0]).sort(),['avatar_url','display_name','location','positions','role','slug','user_id']);
 assert.equal((await search('editor')).length,0);
 await invite();assert.deepEqual((await search()).map(p=>p.user_id),['other']);
}));

test('foreign-parent images cannot enter through profile or company mirrors, including private and draft parents',()=>tx(async()=>{
 const names=['prop','vehicle','location','job','service','animal','project','project-photo','project-draft','company-equipment','board','production-reference'];
 for(const name of names) await pg.query("insert into storage.objects(bucket_id,name) values('images',$1)",[`${name}.jpg`]);
 for(const type of ['prop','vehicle','location','job','service','animal']) await pg.query("insert into listings(id,type,title,user_id,published,image_url) values(gen_random_uuid(),$1,'Test','owner',false,$2)",[type,image(type)]);
 await pg.query("insert into projects(id,title,poster_url,images,created_by,metadata) values(gen_random_uuid(),'Film',$1,$2,'owner','{\"visibility\":\"private\"}')",[image('project'),[image('project-photo')]]);
 await pg.query("insert into project_drafts(draft_data) values($1)",[JSON.stringify({poster_url:image('project-draft')})]);
 await pg.query("insert into company_equipment values(gen_random_uuid(),$1,'Kamera',$2,false)",[company,[image('company-equipment')]]);
 await pg.query("insert into community_posts values(gen_random_uuid(),'owner','Alt',now()-interval '1 day',$1)",[JSON.stringify([image('board')])]);
 await pg.query("update listings set metadata=$1 where type='location'",[JSON.stringify({production_credits:[{title:'Dreh',visibility:'private',image_urls:[image('production-reference')]}]})]);
 await pg.query("update profiles set avatar_url=$1,cover_image_url=$2,portfolio_images=$3,profile_images=$4 where user_id='owner'",[image('project'),image('location'),names.map(name=>image(name)+'?v=2'),JSON.stringify(names.map(name=>({url:image(name),media_type:'portfolio'})))]);
 await pg.query("update companies set logo_url=$1,cover_url=$2,portfolio_images=$3 where id=$4",[image('prop'),image('vehicle'),names.map(image),company]);
 assert.equal((await pg.query('select * from public_community_media')).rows.length,0);
 assert.equal((await pg.query('select * from storage.objects')).rows.length,names.length);
 assert.equal((await pg.query('select * from listings')).rows.length,6);
}));

test('explicit foreign source references are excluded; a directly uploaded set photo needs no likes or featured flag',()=>tx(async()=>{
 for(const name of ['direct-set','linked','unknown','hidden']) await pg.query("insert into storage.objects(bucket_id,name) values('images',$1)",[`${name}.jpg`]);
 await pg.query("update profiles set profile_images=$1 where user_id='owner'",[JSON.stringify([
  {url:image('direct-set'),caption:'Arbeitsprobe eines Filmdrehs',media_type:'set_photo',featured:false},
  {url:image('linked'),project_id:company,media_type:'portfolio'},
  {url:image('unknown'),source_type:'project'},
  {url:image('hidden'),visibility:'private'},
 ])]);
 const rows=(await pg.query('select * from public_community_media')).rows;
 assert.deepEqual(rows.map(row=>row.image_url),[image('direct-set')]);
 assert.equal(rows[0].caption,'Arbeitsprobe eines Filmdrehs');
 assert.equal((await pg.query('select * from profile_image_likes')).rows.length,0);
 assert.equal(communityPhotoFromRow(rows[0]).sourceHref,'/profile/owner');
}));

test('future uploads, company cover replacement, gallery removal and private visibility are evaluated on every read',()=>tx(async()=>{
 for(const name of ['first','next','company-new','company-cover']) await pg.query("insert into storage.objects(bucket_id,name) values('images',$1)",[`${name}.jpg`]);
 await pg.query("update profiles set portfolio_images=$1 where user_id='owner'",[[image('first')]]);
 assert.equal((await pg.query('select * from public_community_media')).rows.length,1);
 await pg.query("update profiles set portfolio_images=$1 where user_id='owner'",[[image('first'),image('next')]]);
 await pg.query("update companies set cover_url=$1,portfolio_images=$2 where id=$3",[image('company-cover'),[image('company-new')],company]);
 assert.equal((await pg.query('select * from public_community_media')).rows.length,4);
 await pg.query("update companies set cover_url=null,portfolio_images='{}' where id=$1",[company]);
 await pg.query("insert into user_settings values('owner','private')");
 assert.equal((await pg.query('select * from public_community_media')).rows.length,0);
 assert.equal((await pg.query('select * from storage.objects')).rows.length,4);
}));

test('storage joins decode candidate paths once, independent of unrelated stored objects',()=>tx(async()=>{
 await pg.exec(`
 create or replace function public.community_decode_path(value text) returns text language plpgsql immutable strict as $$
 begin perform set_config('test.discovery_decodes',(coalesce(nullif(current_setting('test.discovery_decodes',true),''),'0')::int+1)::text,true); return value; end; $$;
 insert into storage.objects(bucket_id,name) select 'images','unrelated-'||n||'.jpg' from generate_series(1,2000) n;
 insert into storage.objects(bucket_id,name) values('images','direct-a.jpg'),('images','direct-b.jpg');
 `);
 await pg.query("update profiles set portfolio_images=$1 where user_id='owner'",[[image('direct-a'),image('direct-b')]]);
 await pg.query("select set_config('test.discovery_decodes','0',true)");
 assert.equal((await pg.query('select * from public_community_media')).rows.length,2);
 const calls=Number((await pg.query("select current_setting('test.discovery_decodes') n")).rows[0].n);
 assert.equal(calls,2,'Decoding must happen per candidate, not for every candidate/storage pair');
}));
