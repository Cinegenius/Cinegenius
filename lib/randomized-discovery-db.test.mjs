import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

let pg;
const company='10000000-0000-4000-8000-000000000001',company2='10000000-0000-4000-8000-000000000002';
const seed='0123456789abcdef0123456789abcdef';
const migration=name=>readFileSync(new URL('../supabase/migrations/'+name,import.meta.url),'utf8');
before(async()=>{
  pg=new PGlite();
  const schema=readFileSync(new URL('./community-media-team-db.test.mjs',import.meta.url),'utf8').split('await pg.exec(`')[1].split('`);')[0].replaceAll('${company}',company).replaceAll('${company2}',company2);
  await pg.exec(schema);
  await pg.exec(`alter table storage.buckets add name text,add file_size_limit bigint,add allowed_mime_types text[];
    alter table project_drafts add user_id text,add published_project_id uuid;
    alter table profiles add last_seen_at timestamptz,add verified boolean default false;
    create table friendships(sender_id text,receiver_id text,status text);
    create table blocks(blocker_id text,blocked_id text);`);
  for(const name of ['20261024090100_contact_visibility_controls.sql','20261024190000_public_community_media.sql','20261025150000_profile_company_discovery_only.sql','20261025151000_bound_discovery_query.sql','20261027180000_protected_media.sql','20261030170000_project_media_rights.sql','20261114005134_selective_community_image_lookup.sql','20261114180242_profile_privacy_controls.sql','20261117153538_randomized_discovery.sql']) await pg.exec(migration(name));
});
after(async()=>pg?.close());
async function tx(fn){await pg.exec('begin');try{await fn();}finally{await pg.exec('rollback');}}
async function photos(s=seed,offset=0,limit=48,blocked=[]){return (await pg.query('select random_community_media($1,$2,$3,$4,true,$5) result',[s,offset,limit,blocked,'https://test.supabase.co'])).rows[0].result;}
async function addPhotos(){
  for(let owner=0;owner<6;owner++){
    const id=`person-${owner}`,images=[];
    for(let i=0;i<30;i++){
      const name=`${id}-${i}.jpg`;images.push(`https://test.supabase.co/storage/v1/object/public/images/${name}`);
      await pg.query("insert into storage.objects(bucket_id,name,created_at) values('images',$1,$2)",[name,new Date(Date.UTC(2020+owner,0,1,i)).toISOString()]);
    }
    await pg.query('insert into profiles(user_id,display_name,portfolio_images) values($1,$1,$2)',[id,images]);
  }
}
test('random photo pages span the whole eligible collection without duplicates and remain stable for a visit',()=>tx(async()=>{
  await addPhotos();
  const pages=await Promise.all([0,48,96,144].map(offset=>photos(seed,offset)));
  assert.ok(pages.every(page=>page.total===180));
  const ids=pages.flatMap(page=>page.rows.map(row=>row.storage_id));
  assert.equal(ids.length,180);assert.equal(new Set(ids).size,180);
  assert.deepEqual(await photos(),pages[0]);
  assert.notDeepEqual((await photos('f'.repeat(32))).rows.map(row=>row.storage_id),pages[0].rows.map(row=>row.storage_id));
  assert.equal((await photos(seed,0,1000)).rows.length,100);
}));
test('each contributor gets one turn before another image, independently of upload age, volume or likes',()=>tx(async()=>{
  await addPhotos();
  await pg.query("update profiles set portfolio_images=portfolio_images[1:1] where user_id='person-0'");
  const firstOwners=new Set();
  for(let i=0;i<16;i++){
    const page=await photos(i.toString(16).padStart(32,'0'),0,6);
    assert.equal(new Set(page.rows.map(row=>row.owner_id)).size,6);
    assert.ok(page.rows.some(row=>row.owner_id==='person-0'),'oldest one-photo contributor has the same first-pass eligibility');
    firstOwners.add(page.rows[0].owner_id);
  }
  assert.ok(firstOwners.size>=4,'new visits must rotate contributors at the front');
}));
test('Ghost, withdrawal and blocks apply before photo totals and random pagination on every request',()=>tx(async()=>{
  await addPhotos();
  await pg.exec("insert into user_settings(user_id,ghost_mode) values('person-0',true)");
  let result=await photos(seed,0,100,['person-1']);
  assert.equal(result.total,120);assert.ok(result.rows.every(row=>!['person-0','person-1'].includes(row.owner_id)));
  await pg.exec("insert into user_settings(user_id,profile_visibility) values('person-2','private')");
  result=await photos(seed,0,100,['person-1']);assert.equal(result.total,90);
  assert.ok(result.rows.every(row=>row.owner_id!=='person-2'));
}));
test('Crew fetches and subsequent pages share a random whole-directory order, not the first alphabetical pool',()=>tx(async()=>{
  for(let i=0;i<350;i++)await pg.query('insert into profiles(user_id,display_name) values($1,$2)',[`person-${i}`,`Name ${String(i).padStart(3,'0')}`]);
  const read=async(offset,limit)=>(await pg.query('select user_id from random_crew_profiles($1,$2,$3)',[seed,offset,limit])).rows.map(row=>row.user_id);
  const first=await read(0,96),next=await read(96,48);
  const all=(await pg.query("select user_id from profiles where nullif(trim(display_name),'') is not null")).rows.map(row=>row.user_id);
  const rank=id=>createHash('md5').update(`${seed}:${id}`).digest('hex');
  all.sort((a,b)=>rank(a).localeCompare(rank(b))||a.localeCompare(b));
  assert.deepEqual([...first,...next],all.slice(0,144));assert.equal(new Set([...first,...next]).size,144);
  assert.ok(first.some(id=>Number(id.split('-')[1])>300));
  await pg.exec("update profiles set display_name='AAA',verified=true where user_id='person-349'");
  assert.deepEqual(await read(0,96),first,'name and verification never boost a person');
  assert.equal((await read(0,10000)).length,300);
}));
test('random discovery RPCs remain server-only and invoker-scoped',()=>tx(async()=>{
  for(const name of ['random_community_media(text,integer,integer,text[],boolean,text)','random_crew_profiles(text,integer,integer)','random_crew_listings(text)']){
    for(const role of ['anon','authenticated'])assert.equal((await pg.query('select has_function_privilege($1,$2,\'execute\') allowed',[role,name])).rows[0].allowed,false);
    assert.equal((await pg.query('select has_function_privilege(\'service_role\',$1,\'execute\') allowed',[name])).rows[0].allowed,true);
  }
  assert.ok((await pg.query("select prosecdef from pg_proc where proname in ('random_community_media','random_crew_profiles','random_crew_listings')")).rows.every(row=>row.prosecdef===false));
}));
test('invalid random state is rejected without running an unbounded selection',()=>tx(async()=>{
  await assert.rejects(()=>photos('invalid'),error=>error.code==='22023');
}));
