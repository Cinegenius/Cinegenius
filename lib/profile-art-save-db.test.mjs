import {test,before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
let pg;
const scalar=async(sql,args=[])=>Object.values((await pg.query(sql,args)).rows[0]??{})[0];
async function service(sql,args=[]){await pg.exec('set role service_role');try{return await scalar(sql,args);}finally{await pg.exec('reset role');}}
const save=(u,p,c,expected=null,key=randomUUID(),create=true)=>service('select public.profile_art_save_profile($1,$2,$3,$4,$5,$6)',[u,p,c,expected,key,create]);
const count=table=>scalar('select count(*) from profile_art_private.'+table);
const err=message=>e=>e.message===message;
async function lease(user='one',kind='avatar'){
  const id=randomUUID(),media=randomUUID();
  const hash=s=>createHash('sha256').update(s).digest('hex');
  await pg.query("insert into profile_art_private.artworks(id,kind,illustration_key,source_sha256,media_key,state,identity_review,identity_reviewed_at) values($1,$2,$3,$4,$5,'ready','reviewed test fixture only',now())",[id,kind,hash(id),hash(media),media]);
  const l=await service('select public.profile_art_lease($1,$2,$3,0,$4)',[user,kind,id,randomUUID()]);
  return {choice:{kind,token:l.token,revision:l.revision,requestKey:randomUUID()},url:`/profile-art/v2/${kind}-${media}.webp`,id};
}
before(async()=>{
  pg=new PGlite();
  await pg.exec("create role anon;create role authenticated;create role service_role bypassrls;alter default privileges grant all on tables to anon,authenticated,service_role;alter default privileges grant all on functions to anon,authenticated,service_role;create table profiles(user_id text primary key,display_name text not null check(length(display_name)>0),bio text default '',avatar_url text,cover_image_url text,updated_at timestamptz default now(),role text default 'member');");
  for(const name of ['20261118012642_profile_art_reservations_foundation','20261118131126_profile_art_atomic_profile_save'])await pg.exec(readFileSync(new URL('../supabase/migrations/'+name+'.sql',import.meta.url),'utf8'));
});
after(async()=>pg?.close());
beforeEach(async()=>pg.exec('truncate profiles;truncate profile_art_private.profile_saves,profile_art_private.operations,profile_art_private.leases,profile_art_private.slots,profile_art_private.claims,profile_art_private.artworks cascade;update profile_art_private.settings set enabled=true;'));
test('avatar and cover commit with profile; same request retries without a second claim',async()=>{
  const a=await lease(),c=await lease('one','cover'),key=randomUUID(),choices=[a.choice,c.choice];
  const p=await save('one',{display_name:'Name',avatar_url:'forged'},choices,null,key);
  assert.equal(p.avatar_url,a.url);assert.equal(p.cover_image_url,c.url);assert.equal(p.role,'member');
  assert.equal(await count('claims'),2);assert.equal(await count('leases'),0);
  assert.deepEqual(await save('one',{display_name:'Name',avatar_url:'forged'},choices,null,key),p);
  assert.equal(await count('profile_saves'),1);
});
test('profile validation failure rolls back both claims and preserves leases',async()=>{
  const a=await lease(),c=await lease('one','cover');
  await assert.rejects(save('one',{display_name:''},[a.choice,c.choice]));
  assert.equal(await count('claims'),0);assert.equal(await count('leases'),2);assert.equal(await scalar('select count(*) from profiles'),0);
});
test('expired second image rolls back first confirmation',async()=>{
  const a=await lease(),c=await lease('one','cover');
  await pg.query("update profile_art_private.leases set expires_at=now()-interval '1 second' where kind='cover'");
  await assert.rejects(save('one',{display_name:'Name'},[a.choice,c.choice]),err('ART_EXPIRED'));
  assert.equal(await count('claims'),0);assert.equal(await count('leases'),2);
});
test('another account cannot use a token or adopt a v2 URL through an older writer',async()=>{
  const a=await lease();
  await assert.rejects(save('two',{display_name:'Other'},[a.choice]),err('ART_EXPIRED'));
  await assert.rejects(pg.query('insert into profiles(user_id,display_name,avatar_url) values($1,$2,$3)',['two','Other',a.url]),err('ART_NOT_OWNED'));
  await save('one',{display_name:'Name'},[a.choice]);
  await assert.rejects(pg.query('insert into profiles(user_id,display_name,avatar_url) values($1,$2,$3)',['two','Other',a.url]),err('ART_NOT_OWNED'));
});
test('stale profile save rolls back, omitted columns survive, switching to a photo retains ownership',async()=>{
  const a=await lease();
  await pg.exec("insert into profiles(user_id,display_name,bio) values('one','Name','preserve')");
  await assert.rejects(save('one',{display_name:'Changed'},[a.choice]),err('ART_PROFILE_CHANGED'));
  const expected=await scalar("select updated_at::text from profiles where user_id='one'");
  const p=await save('one',{display_name:'Changed'},[a.choice],expected,randomUUID(),false);
  assert.equal(p.bio,'preserve');
  await pg.query("update profiles set avatar_url='/api/media/own-photo' where user_id='one'");
  assert.equal(await count('claims'),1);assert.equal(await scalar("select selected_artwork_id from profile_art_private.slots where user_id='one'"),null);
  await pg.query("update profiles set avatar_url=$1 where user_id='one'",[a.url]);
  assert.equal(await scalar("select selected_artwork_id from profile_art_private.slots where user_id='one'"),a.id);
});
test('role escalation, duplicate kinds, foreign user override and repurposed save keys are rejected',async()=>{
  const a=await lease();
  await assert.rejects(save('one',{display_name:'Name',role:'admin'},[a.choice]),err('ART_INVALID'));
  await assert.rejects(save('one',{display_name:'Name'},[a.choice,a.choice]),err('ART_INVALID'));
  const key=randomUUID();const p=await save('one',{display_name:'Name',user_id:'foreign'},[a.choice],null,key);
  assert.equal(p.user_id,'one');
  await assert.rejects(save('one',{display_name:'Other',user_id:'foreign'},[a.choice],null,key),err('ART_KEY_REUSED'));
  assert.equal(await scalar("select has_function_privilege('anon','public.profile_art_save_profile(text,jsonb,jsonb,timestamptz,uuid,boolean)','EXECUTE')"),false);
  assert.equal(await scalar("select has_function_privilege('service_role','profile_art_private.confirm_in_profile_save(text,text,uuid,bigint,uuid,uuid)','EXECUTE')"),false);
});
