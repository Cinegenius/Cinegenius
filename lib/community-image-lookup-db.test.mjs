import test, {before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
let pg;const company='10000000-0000-4000-8000-000000000001',company2='10000000-0000-4000-8000-000000000002';
const legacy=name=>'https://test.supabase.co/storage/v1/object/public/images/'+name;
before(async()=>{
 pg=new PGlite();
 const fixture=readFileSync(new URL('./community-media-team-db.test.mjs',import.meta.url),'utf8');
 await pg.exec(fixture.split('await pg.exec(`')[1].split('`);')[0].replaceAll('${company}',company).replaceAll('${company2}',company2));
 await pg.exec(`alter table storage.buckets add name text,add file_size_limit bigint,add allowed_mime_types text[];
 alter table project_drafts add user_id text,add published_project_id uuid;
 create table friendships(sender_id text,receiver_id text,status text);create table blocks(blocker_id text,blocked_id text);`);
 for(const f of ['20261024190000_public_community_media.sql','20261025150000_profile_company_discovery_only.sql','20261025151000_bound_discovery_query.sql','20261027180000_protected_media.sql','20261030170000_project_media_rights.sql','20261114005134_selective_community_image_lookup.sql'])await pg.exec(readFileSync(new URL('../supabase/migrations/'+f,import.meta.url),'utf8'));
});
after(async()=>await pg?.close());
async function tx(fn){await pg.exec('begin');try{await fn()}finally{await pg.exec('rollback')}}
async function lookup(image){return(await pg.query('select * from public_community_image($1)',[image])).rows}
async function same(image){const expected=(await pg.query('select storage_id,uploaded_at,owner_id from public_community_media where image_url=$1 limit 1',[image])).rows;assert.deepEqual(await lookup(image),expected);return expected;}
async function stored(path,bucket='images'){await pg.query("insert into storage.objects(bucket_id,name,metadata) values($1,$2,'{\"mimetype\":\"image/webp\"}')",[bucket,path])}
test('a single image has exactly the gallery eligibility, including current publication and file existence',()=>tx(async()=>{
 const image=legacy('public.jpg');await stored('public.jpg');await pg.query("update profiles set avatar_url=$1 where user_id='owner'",[image]);assert.equal((await same(image)).length,1);
 await pg.query("insert into user_settings values('owner','private')");assert.equal((await same(image)).length,0);
 await pg.query("delete from user_settings where user_id='owner'");await pg.query('update profiles set avatar_url=null');assert.equal((await same(image)).length,0);
 await pg.query('update companies set logo_url=$1 where id=$2',[image,company]);assert.equal((await same(image)).length,1);await pg.query('update companies set published=false where id=$1',[company]);assert.equal((await same(image)).length,0);
}));
test('encoded aliases preserve global deduplication instead of inventing a different owner',()=>tx(async()=>{
 const encoded=legacy('%C3%A4%20Raum.jpg'),plain=legacy('ä Raum.jpg');await stored('ä Raum.jpg');await pg.query("update profiles set avatar_url=$1 where user_id='owner'",[encoded]);await pg.query('update companies set portfolio_images=$1 where id=$2',[[plain],company2]);
 assert.equal((await same(encoded)).length,1);assert.equal((await same(plain)).length,0);
 await pg.query("insert into listings(id,user_id,published,image_url) values(gen_random_uuid(),'other',false,$1)",[plain]);assert.equal((await same(encoded)).length,0);
}));
test('private or foreign canonical uploads remain excluded through public mirrors',()=>tx(async()=>{
 const key='owner/0123456789abcdef0123456789abcdef.webp',url='/api/media/'+key;await stored(key,'protected-media');await pg.query("insert into media_assets(storage_path,reference_url,owner_user_id,mime_type) values($1,$2,'owner','image/webp')",[key,url]);await pg.query("update profiles set avatar_url=$1 where user_id='owner'",[url]);assert.equal((await same(url)).length,1);
 await pg.query("insert into user_settings values('owner','private')");await pg.query("update profiles set avatar_url=$1 where user_id='other'",[url]);assert.equal((await same(url)).length,0);
}));
test('individually private images, deleted originals and non-image files are denied',()=>tx(async()=>{
 const image=legacy('hidden.jpg');await stored('hidden.jpg');await pg.query("update profiles set profile_images=$1 where user_id='owner'",[JSON.stringify([{url:image,visibility:'private'}])]);assert.equal((await same(image)).length,0);
 await pg.query("update profiles set profile_images=$1 where user_id='owner'",[JSON.stringify([{url:image}])]);assert.equal((await same(image)).length,1);await pg.query("update storage.objects set metadata='{\"mimetype\":\"application/pdf\"}'");assert.equal((await same(image)).length,0);
 await pg.query('delete from storage.objects');assert.equal((await same(image)).length,0);
 for(const invalid of ['','blob:local','x'.repeat(2049)])assert.deepEqual(await lookup(invalid),[]);
}));
test('only the service role may execute the selective lookup',async()=>{
 for(const role of ['anon','authenticated'])assert.equal((await pg.query("select has_function_privilege($1,'public_community_image(text)','execute') ok",[role])).rows[0].ok,false);
 assert.equal((await pg.query("select has_function_privilege('service_role','public_community_image(text)','execute') ok")).rows[0].ok,true);
});
