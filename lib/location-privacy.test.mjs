import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {privateLocationInput,publicLocationArea,readPublicLocationArea,publicLocationBrowseMetadata,publicLocationFocalPoint} from './location-privacy.ts';
let pg;
const id='10000000-0000-4000-8000-000000000001',company='20000000-0000-4000-8000-000000000001';
const privatePoint={address:'Synthetic private address 17',lat:52.5214321,lng:13.4123456};
const migration=readFileSync(new URL('../supabase/migrations/20261112180000_private_location_areas.sql',import.meta.url),'utf8');
before(async()=>{
 pg=new PGlite();await pg.exec(`create role anon;create role authenticated;create role service_role;
 create table profiles(user_id text primary key,display_name text);
 create table companies(id uuid primary key,owner_user_id text,name text,published boolean);
 create table company_members(company_id uuid,user_id text,role text,status text);
 create table listings(id uuid primary key default gen_random_uuid(),user_id text,company_id uuid,type text,title text,description text,city text,metadata jsonb,published boolean default true);
 create table company_equipment(id uuid primary key default gen_random_uuid(),company_id uuid,name text,published boolean default true);
 create table admin_audit_log(id uuid primary key default gen_random_uuid(),actor_user_id text,action text,entity_type text,entity_id text,reason text,outcome text,metadata jsonb);
 create table notifications(id uuid primary key default gen_random_uuid(),user_id text,type text,title text,body text,href text);
 insert into listings(id,user_id,type,title,published) values('${id}','owner','location','Synthetic offer',true);
 insert into companies values('${company}','company-owner','Synthetic company',true);
 `);
 await pg.exec(readFileSync(new URL('../supabase/migrations/20261028200000_offer_moderation.sql',import.meta.url),'utf8'));
 await pg.exec(migration);await pg.exec(migration);
});
after(async()=>pg?.close());
const call=async(actor,write=false,value=null,revision=0,area=value?publicLocationArea(value):null)=>(await pg.query('select listing_private_location($1,$2,$3,$4,$5,$6) result',[id,actor,write,value,area,revision])).rows[0].result;
const listing=async()=>(await pg.query('select to_jsonb(l) value from listings l where id=$1',[id])).rows[0].value;
test('private input rejects malformed coordinates and public projection exposes only a stable 500m cell',()=>{
 assert.equal(privateLocationInput({address:'a',lat:'52',lng:13}),false);
 assert.equal(privateLocationInput({address:'a',lat:Infinity,lng:13}),false);
 assert.equal(privateLocationInput({address:'a',lat:52,lng:null}),false);
 assert.deepEqual(privateLocationInput(privatePoint),privatePoint);
 const first=publicLocationArea(privatePoint);assert.deepEqual(publicLocationArea(privatePoint),first);
 assert.deepEqual(Object.keys(first).sort(),['lat','lng','radius_meters']);assert.notEqual(first.lat,privatePoint.lat);assert.notEqual(first.lng,privatePoint.lng);
 const distance=(p,q)=>{const rad=Math.PI/180,a=Math.sin((p.lat-q.lat)*rad/2)**2+Math.cos(p.lat*rad)*Math.cos(q.lat*rad)*Math.sin((p.lng-q.lng)*rad/2)**2;return 6371000*2*Math.atan2(Math.sqrt(a),Math.sqrt(Math.max(0,1-a)));};
 for(let i=0;i<10000;i++){const point={address:'',lat:-90+180*i/9999,lng:-180+360*((i*7919)%10000)/9999};const area=publicLocationArea(point);assert.ok(distance(point,area)<=500,`point ${JSON.stringify(point)}`);}
 assert.equal(readPublicLocationArea({location_area:{...first,radius_meters:0}}),null);
 assert.deepEqual(readPublicLocationArea({location_area:{...first,address:'must never project',exact_lat:52}}),first);
});
test('database protects exact data, checks current rights and invalidates existing release atomically',async()=>{
 for(const role of ['anon','authenticated']){
  assert.equal((await pg.query("select has_table_privilege($1,'listing_private_locations','select') ok",[role])).rows[0].ok,false);
  assert.equal((await pg.query("select has_function_privilege($1,'listing_private_location(uuid,text,boolean,jsonb,jsonb,bigint)','execute') ok",[role])).rows[0].ok,false);
 }
 assert.equal((await call('stranger')).status,'missing');assert.equal((await call('stranger',true,privatePoint)).status,'missing');
 assert.equal((await call('owner')).value,null);
 assert.deepEqual(await call('owner',true,privatePoint),{status:'saved',revision:1});
 const read=await call('owner');assert.deepEqual(read.value,privatePoint);assert.equal(read.revision,1);
 const row=await listing();assert.equal(row.published,false);assert.equal(row.moderation_status,'pending');
 assert.equal(JSON.stringify(row).includes(privatePoint.address),false);assert.equal(JSON.stringify(row).includes(String(privatePoint.lat)),false);
 assert.deepEqual(row.metadata.location_area,publicLocationArea(privatePoint));
 assert.equal((await call('owner',true,{...privatePoint,address:'Stale edit'},0)).status,'conflict');
 const before=await listing();await call('owner',true,privatePoint,1);assert.equal((await listing()).content_revision,before.content_revision);
 assert.deepEqual(await call('owner',true,null,1),{status:'saved',revision:2});
 assert.equal((await call('owner')).value,null);assert.equal((await call('owner')).revision,2);
 assert.equal((await call('owner',true,privatePoint,0)).status,'conflict');
 assert.deepEqual(await call('owner',true,privatePoint,2),{status:'saved',revision:3});
 assert.deepEqual((await listing()).metadata.location_area,publicLocationArea(privatePoint));
});
test('company offers require current accepted editing membership; former creators and ordinary members lose exact access',async()=>{
 await pg.query('update listings set company_id=$1 where id=$2',[company,id]);
 assert.equal((await call('owner')).status,'missing');assert.equal((await call('company-owner')).status,'ok');
 await pg.query("insert into company_members values($1,'editor','manager','accepted')",[company]);assert.equal((await call('editor')).status,'ok');
 await pg.exec("update company_members set role='member'");assert.equal((await call('editor')).status,'missing');
 await pg.exec("update company_members set role='admin',status='invited'");assert.equal((await call('editor')).status,'missing');
});

test('a failed public-area update rolls back the private write in the same transaction',async()=>{
 const before=await call('company-owner');const publicBefore=await listing();
 await pg.exec("create function reject_test_area() returns trigger language plpgsql as $$ begin raise exception 'Synthetic write failure'; end $$; create trigger reject_test_area before update on listings for each row execute function reject_test_area();");
 try{await assert.rejects(()=>call('company-owner',true,{...privatePoint,address:'Must roll back'},before.revision));}finally{await pg.exec('drop trigger reject_test_area on listings;drop function reject_test_area();');}
 assert.deepEqual(await call('company-owner'),before);assert.deepEqual(await listing(),publicBefore);
});

test('browse metadata and focal-point projection cannot carry arbitrary private fields',()=>{
 const metadata={private_address:'DO NOT PROJECT',lat:52.1234567,lng:13.1234567,price_negotiable:true,power_available:true,indoor_outdoor:'innen',rental_type:'PRIVATE RENTAL TEXT',focal_point:{x:25,y:75,address:'DO NOT PROJECT'},location_area:{lat:52,lng:13,radius_meters:500,secret:'DO NOT PROJECT'}};
 assert.deepEqual(publicLocationBrowseMetadata(metadata),{price_negotiable:true,power_available:true,indoor_outdoor:'innen',location_area:{lat:52,lng:13,radius_meters:500}});
 assert.deepEqual(publicLocationFocalPoint(metadata),{x:25,y:75});assert.equal(publicLocationFocalPoint({focal_point:{x:Infinity,y:50}}),null);assert.equal(publicLocationFocalPoint({focal_point:{x:'25',y:50}}),null);
});
