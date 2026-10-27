import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
let pg;
const company='10000000-0000-4000-8000-000000000001';
const company2='10000000-0000-4000-8000-000000000002';
let counter=0;
const path=()=>`owner/${(++counter).toString(16).padStart(32,'0')}.webp`;
const url=k=>`/api/media/${k}`;
async function asset(owner='owner') { const key=path().replace('owner/',owner+'/'); await pg.query('insert into media_assets(storage_path,reference_url,owner_user_id,mime_type) values($1,$2,$3,\'image/webp\')',[key,url(key),owner]);return key; }
async function allowed(key,viewer=null){return (await pg.query('select * from readable_media_asset($1,$2)',[key,viewer])).rows.length===1;}
async function tx(fn){await pg.exec('begin');try{await fn();}finally{await pg.exec('rollback');}}
before(async()=>{
 pg=new PGlite();
 const existing=readFileSync(new URL('./community-media-team-db.test.mjs',import.meta.url),'utf8');
 const schema=existing.split('await pg.exec(`')[1].split('`);')[0].replaceAll('${company}',company).replaceAll('${company2}',company2);
 await pg.exec(schema);
 await pg.exec(`alter table storage.buckets add name text,add file_size_limit bigint,add allowed_mime_types text[];
 alter table project_drafts add user_id text,add published_project_id uuid;
 create table friendships(sender_id text,receiver_id text,status text);
 create table blocks(blocker_id text,blocked_id text);
 `);
 for(const name of ['20261024190000_public_community_media.sql','20261025150000_profile_company_discovery_only.sql','20261025151000_bound_discovery_query.sql']) await pg.exec(readFileSync(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
 await pg.exec(readFileSync(new URL('../supabase/migrations/20261027180000_protected_media.sql',import.meta.url),'utf8'));
});
after(async()=>{await pg?.close();});
test('new unbound uploads are owner-only and all direct client table/function privileges are denied',()=>tx(async()=>{
 const key=await asset();assert.equal(await allowed(key),false);assert.equal(await allowed(key,'other'),false);assert.equal(await allowed(key,'owner'),true);
 for(const role of ['anon','authenticated']) {
 assert.equal((await pg.query("select has_table_privilege($1,'media_assets','SELECT') ok",[role])).rows[0].ok,false);
 assert.equal((await pg.query("select has_function_privilege($1,'readable_media_asset(text,text)','EXECUTE') ok",[role])).rows[0].ok,false);
 }
 assert.equal((await pg.query("select public from storage.buckets where id='protected-media'")).rows[0].public,false);
}));
test('private listing stays protected through public mirrors; publish, withdraw, replace and delete recheck the original',()=>tx(async()=>{
 const key=await asset(); const id=(await pg.query("insert into listings(id,user_id,published,image_url) values(gen_random_uuid(),'owner',false,$1) returning id",[url(key)])).rows[0].id;
 assert.equal(await allowed(key),false);assert.equal(await allowed(key,'other'),false);assert.equal(await allowed(key,'owner'),true);
 await pg.query("update profiles set avatar_url=$1 where user_id='other'",[url(key)]);assert.equal(await allowed(key),false);
 await pg.query('update listings set published=true where id=$1',[id]);assert.equal(await allowed(key),true);
 await pg.query('update listings set published=false where id=$1',[id]);assert.equal(await allowed(key),false);
 await pg.query('update listings set image_url=null where id=$1',[id]);assert.equal(await allowed(key,'owner'),false);
 await pg.query('delete from listings where id=$1',[id]);assert.equal(await allowed(key,'owner'),false);
}));
test('profile privacy and accepted friends, individual private photo, blocks and replacement apply to every file view',()=>tx(async()=>{
 const key=await asset();await pg.query("update profiles set avatar_url=$1 where user_id='owner'",[url(key)]);assert.equal(await allowed(key),true);
 await pg.query("insert into user_settings values('owner','private')");assert.equal(await allowed(key),false);assert.equal(await allowed(key,'other'),false);
 await pg.query("insert into friendships values('owner','other','accepted')");assert.equal(await allowed(key,'other'),true);
 await pg.query("insert into blocks values('owner','other')");assert.equal(await allowed(key,'other'),false);
 await pg.query("update profiles set avatar_url=null where user_id='owner'");assert.equal(await allowed(key,'owner'),false);
 const privateKey=await asset();await pg.query("update profiles set profile_images=$1 where user_id='owner'",[JSON.stringify([{url:url(privateKey),visibility:'private'}])]);
 await pg.query("update user_settings set profile_visibility='public' where user_id='owner'");assert.equal(await allowed(privateKey),false);assert.equal(await allowed(privateKey,'owner'),true);
}));
test('company membership removal and provider reassignment do not preserve uploader privileges',()=>tx(async()=>{
 const key=await asset('editor');await pg.query('update companies set logo_url=$1,published=false where id=$2',[url(key),company]);
 assert.equal(await allowed(key,'editor'),true);assert.equal(await allowed(key),false);
 await pg.query("delete from company_members where user_id='editor'");assert.equal(await allowed(key,'editor'),false);assert.equal(await allowed(key,'owner'),true);
 await pg.query("update companies set owner_user_id='other' where id=$1",[company]);assert.equal(await allowed(key,'owner'),false);assert.equal(await allowed(key,'other'),true);
}));
test('draft project media is private and follows only its real publication, not another profile mirror',()=>tx(async()=>{
 const key=await asset();await pg.query("insert into project_drafts(user_id,draft_data) values('owner',$1)",[JSON.stringify({poster_url:url(key)})]);
 assert.equal(await allowed(key),false);assert.equal(await allowed(key,'other'),false);assert.equal(await allowed(key,'owner'),true);
 await pg.query("insert into projects(id,created_by,poster_url) values(gen_random_uuid(),'owner',$1)",[url(key)]);assert.equal(await allowed(key),true);
 await pg.query('delete from projects where poster_url=$1',[url(key)]);assert.equal(await allowed(key),false);
}));

test('community allows canonical public personal and company uploads, never draft/private mirrors',()=>tx(async()=>{
 const key=await asset();await pg.query("insert into storage.objects(bucket_id,name,metadata) values('protected-media',$1,'{\"mimetype\":\"image/webp\"}')",[key]);
 await pg.query("update profiles set avatar_url=$1 where user_id='owner'",[url(key)]);
 assert.equal((await pg.query('select image_url from public_community_media')).rows.length,1);
 await pg.query("insert into user_settings values('owner','private')");
 await pg.query("update profiles set avatar_url=$1 where user_id='other'",[url(key)]);
 assert.equal((await pg.query('select image_url from public_community_media')).rows.length,0);
 const key2=await asset();await pg.query("insert into storage.objects(bucket_id,name,metadata) values('protected-media',$1,'{\"mimetype\":\"image/webp\"}')",[key2]);
 await pg.query("insert into listings(id,user_id,published,image_url) values(gen_random_uuid(),'owner',false,$1)",[url(key2)]);
 await pg.query("update profiles set avatar_url=$1 where user_id='other'",[url(key2)]);
 assert.equal((await pg.query('select image_url from public_community_media')).rows.length,0);
}));

test('private production references and null legacy image arrays fail safely without exposing confidential files',()=>tx(async()=>{
 const key=await asset();await pg.query("update profiles set profile_images=null,avatar_url=$1 where user_id='owner'",[url(key)]);assert.equal(await allowed(key),true);
 const reference=await asset();await pg.query("insert into listings(id,user_id,published,metadata) values(gen_random_uuid(),'owner',true,$1)",[JSON.stringify({production_credits:[{visibility:'private',image_urls:[url(reference)]}]})]);
 assert.equal(await allowed(reference),false);assert.equal(await allowed(reference,'owner'),true);
}));

test('captions cannot keep a removed file publicly readable, and legacy private mirrors are excluded from discovery',()=>tx(async()=>{
 const key=await asset();await pg.query("update profiles set profile_images=$1 where user_id='owner'",[JSON.stringify([{url:url(key),caption:'Test'}])]);assert.equal(await allowed(key),true);
 await pg.query("update profiles set profile_images=$1 where user_id='owner'",[JSON.stringify([{url:'unrelated',caption:url(key)}])]);assert.equal(await allowed(key),false);
 const legacy='https://test.supabase.co/storage/v1/object/public/images/private-firm.jpg';
 await pg.query("insert into storage.objects(bucket_id,name) values('images','private-firm.jpg')");await pg.query('update companies set logo_url=$1,published=false where id=$2',[legacy,company]);await pg.query("update profiles set avatar_url=$1 where user_id='other'",[legacy]);assert.equal((await pg.query('select * from public_community_media')).rows.length,0);
}));

test('reviewed legacy cutover atomically changes only private company or draft image references and is safely retryable',()=>tx(async()=>{
 const old='https://test.supabase.co/storage/v1/object/public/listing-images/legacy.png';
 const key=await asset();await pg.query("update media_assets set legacy_bucket='listing-images',legacy_path='legacy.png' where storage_path=$1",[key]);
 await pg.query('update companies set logo_url=$1,cover_url=$1,published=false where id=$2',[old,company]);
 assert.equal((await pg.query('select replace_private_media_reference($1,$2,$3,$4,$5) ok',['company',company,'other',[old],url(key)])).rows[0].ok,false);
 const run=()=>pg.query('select replace_private_media_reference($1,$2,$3,$4,$5) ok',['company',company,'owner',[old],url(key)]);
 assert.equal((await run()).rows[0].ok,true);assert.equal((await run()).rows[0].ok,true);
 assert.equal(await allowed(key),false);assert.equal(await allowed(key,'owner'),true);
 const row=(await pg.query('select name,logo_url,cover_url from companies where id=$1',[company])).rows[0];assert.equal(row.name,'Testfirma');assert.equal(row.logo_url,url(key));assert.equal(row.cover_url,url(key));
 await pg.query('update companies set published=true where id=$1',[company]);assert.equal((await run()).rows[0].ok,false);
 const draftKey=await asset();await pg.query("update media_assets set legacy_bucket='listing-images',legacy_path='draft.png' where storage_path=$1",[draftKey]);
 const id=(await pg.query("insert into project_drafts(user_id,draft_data) values('owner',$1) returning id",[JSON.stringify({poster_url:old,images:[old,{url:old,caption:old}],description:'Unchanged own test description'})])).rows[0].id;
 assert.equal((await pg.query('select replace_private_media_reference($1,$2,$3,$4,$5) ok',['project_draft',id,'owner',[old],url(draftKey)])).rows[0].ok,true);
 const data=(await pg.query('select draft_data from project_drafts where id=$1',[id])).rows[0].draft_data;assert.equal(data.description,'Unchanged own test description');assert.equal(data.images[1].caption,old);assert.equal(data.images[1].url,url(draftKey));
 for(const role of ['anon','authenticated'])assert.equal((await pg.query("select has_function_privilege($1,'replace_private_media_reference(text,text,text,text[],text)','EXECUTE') ok",[role])).rows[0].ok,false);
}));

// Storage is an own-data in-memory adapter; PostgreSQL functions above are real.
function cutoverFixture(bytes,{failRetire=false}={}) {
 const files=new Map([['listing-images/legacy.png',Buffer.from(bytes)]]);let fail=failRetire;
 const db={from(table){assert.equal(table,'media_assets');const filters=[];let mode='select',payload;
  const execute=async()=>{try{let result;if(mode==='insert'){
   const keys=Object.keys(payload),values=Object.values(payload);result=await pg.query(`insert into media_assets(${keys.join(',')}) values(${keys.map((_,i)=>'$'+(i+1)).join(',')}) returning *`,values);
  }else{const values=filters.map(([,value])=>value),where=filters.map(([key],i)=>`${key}=$${i+1}`).join(' and ');if(mode==='update'){const keys=Object.keys(payload);result=await pg.query(`update media_assets set ${keys.map((key,i)=>`${key}=$${values.length+i+1}`).join(',')} where ${where} returning *`,[...values,...Object.values(payload)]);}else result=await pg.query(`select * from media_assets where ${where}`,values);}
   return {data:mode==='insert'?result.rows:result.rows[0]??null,error:null};}catch(error){return {data:null,error};}};
  const q={select:()=>q,eq:(key,value)=>{filters.push([key,value]);return q;},maybeSingle:execute,insert:value=>{mode='insert';payload=value;return execute();},update:value=>{mode='update';payload=value;return q;}};return q;
 },rpc:async(name,args)=>{try{if(name==='readable_media_asset')return {data:(await pg.query('select * from readable_media_asset($1,$2)',[args.p_key,args.p_viewer])).rows,error:null};const data=(await pg.query('select replace_private_media_reference($1,$2,$3,$4,$5) ok',[args.p_source_type,args.p_source_id,args.p_owner,args.p_old_refs,args.p_new_ref])).rows[0].ok;return {data,error:null};}catch(error){return {data:null,error};}},storage:{from:bucket=>({download:async path=>({data:files.has(bucket+'/'+path)?new Blob([files.get(bucket+'/'+path)]):null,error:null}),upload:async(path,value)=>{files.set(bucket+'/'+path,Buffer.from(value));return {error:null};},remove:async paths=>{if(fail){fail=false;return {error:Error('Own simulated network interruption')};}for(const path of paths)files.delete(bucket+'/'+path);return {error:null};}})}};
 return {db,files};
}

test('legacy storage cutover preserves original bytes, retries a failed public-copy retirement and never touches a newly public parent',()=>tx(async()=>{
 const {cutoverPrivateMedia}=await import('../scripts/lib/private-media-cutover.mjs');const sharp=(await import('sharp')).default;
 const bytes=await sharp({create:{width:12,height:20,channels:3,background:'#c4ed2d'}}).png().toBuffer();
 const old='https://test.supabase.co/storage/v1/object/public/listing-images/legacy.png';const asset={bucket:'listing-images',path:'legacy.png',sources:[{kind:'company',id:company,owner:'owner',private:true,reference:old}]};
 await pg.query('update companies set logo_url=$1,published=false where id=$2',[old,company]);const f=cutoverFixture(bytes,{failRetire:true});
 await assert.rejects(cutoverPrivateMedia(f.db,asset),/retry required/);assert.equal(f.files.has('listing-images/legacy.png'),true);
 assert.equal((await cutoverPrivateMedia(f.db,asset)).changed,true);assert.equal(f.files.has('listing-images/legacy.png'),false);
 const newFile=[...f.files.entries()].find(([key])=>key.startsWith('protected-media/'));assert.deepEqual(newFile[1],bytes);assert.equal((await cutoverPrivateMedia(f.db,asset)).changed,false);
 const asset2={...asset,path:'other.png',sources:[{...asset.sources[0],reference:old.replace('legacy','other')}]};const f2=cutoverFixture(bytes);f2.files.set('listing-images/other.png',bytes);
 await pg.query('update companies set logo_url=$1,published=true where id=$2',[asset2.sources[0].reference,company]);
 await assert.rejects(cutoverPrivateMedia(f2.db,asset2),/Parent update not confirmed/);assert.equal(f2.files.has('listing-images/other.png'),true);
}));
