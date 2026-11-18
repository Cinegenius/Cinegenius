import {test,before,after,beforeEach} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash,randomUUID} from "node:crypto";
import {PGlite} from "@electric-sql/pglite";
import {PROFILE_AVATARS,PROFILE_COVERS} from "./profile-art.ts";
import {PROFILE_ART_LEASE_SECONDS} from "./profile-art-reservations.ts";

let pg;
const hash=s=>createHash("sha256").update(s).digest("hex");
const conflict=(code="PT409",message)=>error=>error.code===code&&(!message||error.message===message);
const query=async(sql,params=[]) => (await pg.query(sql,params)).rows;
const scalar=async(sql,params=[]) => Object.values((await query(sql,params))[0])[0];
async function service(sql,params=[]) {
  await pg.exec("set role service_role");
  try{return await scalar(sql,params);}finally{await pg.exec("reset role");}
}
const choices=(user,kind="avatar")=>service("select public.profile_art_choices($1,$2)",[user,kind]);
const lease=(user,art,expected=0,key=randomUUID(),kind="avatar")=>service("select public.profile_art_lease($1,$2,$3,$4,$5)",[user,kind,art,expected,key]);
const cancel=(user,expected,key=randomUUID(),kind="avatar")=>service("select public.profile_art_cancel($1,$2,$3,$4)",[user,kind,expected,key]);
const confirm=(user,l,mediaKey,key=randomUUID(),kind="avatar")=>scalar("select profile_art_private.confirm_in_profile_save($1,$2,$3,$4,$5,$6)",[user,kind,l.token,l.revision,key,mediaKey]);
async function artwork(kind="avatar",extra={}) {
  const id=randomUUID(),mediaKey=randomUUID();
  await pg.query("insert into profile_art_private.artworks(id,kind,illustration_key,source_sha256,media_key,state,identity_review,identity_reviewed_at) values($1,$2,$3,$4,$5,$6,$7,now())",[id,kind,extra.illustration??hash(id),extra.bytes??hash(mediaKey),mediaKey,extra.state??"ready",extra.review??"test-reviewed family, no duplicate variant"]);
  return {id,mediaKey};
}
async function counts(){return query("select (select count(*) from profile_art_private.slots) slots,(select count(*) from profile_art_private.leases) leases,(select count(*) from profile_art_private.claims) claims,(select count(*) from profile_art_private.operations) operations");}
before(async()=>{
  pg=new PGlite();
  await pg.exec("create role anon;create role authenticated;create role service_role bypassrls;alter default privileges grant all on tables to service_role,anon,authenticated;alter default privileges grant all on functions to service_role,anon,authenticated;create table public.existing_profiles(user_id text primary key,avatar text,cover text);insert into existing_profiles values('legacy','/profile-art/v1/avatar-01.webp','own-cover');");
  await pg.exec(readFileSync(new URL("../supabase/migrations/20261118012642_profile_art_reservations_foundation.sql",import.meta.url),"utf8"));
  // Contract harness ONLY, not a migration or production save route. The future
  // validated writer must consume both leases and update the profile in ONE tx.
  await pg.exec(`create table public.art_profile_save_fixture(user_id text primary key, revision bigint default 0, avatar_key uuid, cover_key uuid, bio text default 'keep');
    create function public.art_profile_test_save(p_user text,p_expected bigint,p_choices jsonb,p_fail text default null) returns void
    language plpgsql security definer set search_path=pg_catalog,public as $$
    declare item jsonb; receipt jsonb; rev bigint;
    begin
      perform profile_art_private.lock_account(p_user);
      select revision into rev from public.art_profile_save_fixture where user_id=p_user for update nowait;
      if not found or rev<>p_expected then raise exception using errcode='PT409',message='PROFILE_REVISION';end if;
      for item in select value from jsonb_array_elements(p_choices) loop
        receipt:=profile_art_private.confirm_in_profile_save(p_user,item->>'kind',(item->>'token')::uuid,(item->>'revision')::bigint,(item->>'requestKey')::uuid,(item->>'mediaKey')::uuid);
        if item->>'kind'='avatar' then update public.art_profile_save_fixture set avatar_key=(receipt->>'mediaKey')::uuid where user_id=p_user;
        else update public.art_profile_save_fixture set cover_key=(receipt->>'mediaKey')::uuid where user_id=p_user;end if;
      end loop;
      update public.art_profile_save_fixture set revision=revision+1 where user_id=p_user;
      if p_fail='cancel' then raise exception using errcode='57014',message='test simulated statement cancellation';end if;
      if p_fail is not null then raise exception using errcode='PT400',message='test remaining profile validation failed';end if;
    end $$;
    revoke all on function public.art_profile_test_save(text,bigint,jsonb,text) from public,anon,authenticated;
    grant execute on function public.art_profile_test_save(text,bigint,jsonb,text) to service_role;`);
});
after(async()=>{await pg?.close();});
beforeEach(async()=>{
  await pg.exec("truncate profile_art_private.operations,profile_art_private.leases,profile_art_private.slots,profile_art_private.claims,profile_art_private.artworks cascade;truncate art_profile_save_fixture;update profile_art_private.settings set enabled=true;");
});

test("migration has no profile backfill and feature switch is required for read and write",async()=>{
  assert.deepEqual(await query("select * from existing_profiles"),[{user_id:"legacy",avatar:"/profile-art/v1/avatar-01.webp",cover:"own-cover"}]);
  await pg.exec("update profile_art_private.settings set enabled=false");
  const initial=await counts();
  await assert.rejects(choices("user"),conflict("PT503"));
  await assert.rejects(lease("user",randomUUID()),conflict("PT503"));
  assert.deepEqual(await counts(),initial);
  const source=readFileSync(new URL("../supabase/migrations/20261118012642_profile_art_reservations_foundation.sql",import.meta.url),"utf8");
  assert.match(source,/insert into profile_art_private.settings values \(true, false\)/);
});
test("opening choices is side-effect free and gives neither foreign owners nor their lease tokens",async()=>{
  const a=await artwork(),b=await artwork();const held=await lease("other",b.id);
  const initial=await counts(),read=await choices("viewer");
  assert.deepEqual(read.available,[{artworkId:a.id,kind:"avatar",mediaKey:a.mediaKey}]);
  assert.equal(read.revision,0);assert.equal(read.lease,null);assert.equal(read.selected,null);
  assert.ok(!JSON.stringify(read).includes(held.token));assert.ok(!JSON.stringify(read).includes("other"));
  assert.deepEqual(await counts(),initial);
});
test("one account can hold one avatar and one cover; replacement is atomic and independent",async()=>{
  const a=await artwork(),b=await artwork(),c=await artwork("cover");
  const start=new Date(await scalar("select clock_timestamp()")).getTime();
  const first=await lease("own",a.id),cover=await lease("own",c.id,0,randomUUID(),"cover");
  const end=new Date(await scalar("select clock_timestamp()")).getTime();
  assert.ok(Date.parse(first.expiresAt)>=start+PROFILE_ART_LEASE_SECONDS*1000-1);
  assert.ok(Date.parse(first.expiresAt)<=end+PROFILE_ART_LEASE_SECONDS*1000+1);
  const next=await lease("own",b.id,first.revision);
  assert.notEqual(next.token,first.token);assert.equal(next.revision,2);
  assert.equal((await choices("own")).lease.artworkId,b.id);assert.equal((await choices("own","cover")).lease.token,cover.token);
  assert.equal((await choices("other")).available.some(x=>x.artworkId===a.id),true);
  await assert.rejects(confirm("own",first,a.mediaKey),conflict());
  assert.equal(await scalar("select count(*) from profile_art_private.leases where user_id='own'"),2);
});
test("contending accounts cannot claim the same illustration; a failed replacement retains both old leases",async()=>{
  const a=await artwork(),b=await artwork();const one=await lease("one",a.id),two=await lease("two",b.id);
  const before=await counts();
  await assert.rejects(lease("two",a.id,two.revision),conflict("PT409","ART_UNAVAILABLE"));
  await assert.rejects(lease("one",b.id,one.revision),conflict("PT409","ART_UNAVAILABLE"));
  assert.equal((await choices("one")).lease.token,one.token);assert.equal((await choices("two")).lease.token,two.token);assert.deepEqual(await counts(),before);
});
test("idempotent retry does not renew a lease and an old or repurposed key cannot revive it",async()=>{
  const a=await artwork(),b=await artwork(),key=randomUUID();const l=await lease("own",a.id,0,key);
  assert.deepEqual(await lease("own",a.id,0,key),l);
  await assert.rejects(lease("own",b.id,l.revision,key),conflict("PT409","ART_KEY_REUSED"));
  await lease("own",b.id,l.revision);
  await assert.rejects(lease("own",a.id,0,key),conflict("PT409","ART_STALE_RETRY"));
  assert.equal((await choices("own")).lease.artworkId,b.id);
});
test("expired lease can be reused by another account but cannot be confirmed or renewed by retry",async()=>{
  const a=await artwork(),key=randomUUID(),first=await lease("one",a.id,0,key);
  await pg.query("update profile_art_private.leases set expires_at=clock_timestamp()-interval '1 second' where token=$1",[first.token]);
  assert.equal((await choices("one")).lease,null);
  await assert.rejects(confirm("one",first,a.mediaKey),conflict("PT409","ART_EXPIRED"));
  await assert.rejects(lease("one",a.id,0,key),conflict("PT409","ART_STALE_RETRY"));
  const second=await lease("two",a.id);assert.notEqual(second.token,first.token);
  await assert.rejects(confirm("one",first,a.mediaKey),conflict("PT409","ART_EXPIRED"));
});
test("cancel is revision checked, idempotent and preserves the confirmed choice",async()=>{
  const a=await artwork(),b=await artwork();const held=await lease("own",a.id),saved=await confirm("own",held,a.mediaKey);
  const second=await lease("own",b.id,saved.revision),key=randomUUID();
  await assert.rejects(cancel("own",0),conflict("PT409","ART_REVISION"));
  const canceled=await cancel("own",second.revision,key);assert.deepEqual(await cancel("own",second.revision,key),canceled);
  const read=await choices("own");assert.equal(read.lease,null);assert.equal(read.selected.artworkId,a.id);
});
test("confirmed artwork remains separately visible to its owner and never returns to others after a change",async()=>{
  const a=await artwork(),b=await artwork(),l=await lease("own",a.id),key=randomUUID();
  const saved=await confirm("own",l,a.mediaKey,key);assert.deepEqual(await confirm("own",l,a.mediaKey,key),saved);
  assert.equal((await choices("own")).selected.mediaKey,a.mediaKey);
  const l2=await lease("own",b.id,saved.revision);await confirm("own",l2,b.mediaKey);
  await assert.rejects(lease("other",a.id),conflict("PT409","ART_UNAVAILABLE"));
  assert.equal((await choices("other")).available.length,0);
  await assert.rejects(confirm("own",l,a.mediaKey,key),conflict("PT409","ART_STALE_RETRY"));
  assert.equal(await scalar("select count(*) from profile_art_private.claims where user_id='own'"),2);
});
test("wrong kind, foreign token and media binding cannot consume the real owner's lease",async()=>{
  const a=await artwork();const l=await lease("own",a.id),initial=await counts();
  await assert.rejects(lease("other",a.id,0,randomUUID(),"cover"),conflict());
  await assert.rejects(confirm("other",l,a.mediaKey),conflict());
  await assert.rejects(confirm("own",l,randomUUID()),conflict("PT409","ART_UNAVAILABLE"));
  assert.equal((await choices("own")).lease.token,l.token);assert.deepEqual(await counts(),initial);
});
test("identity is immutable and shared by all variants regardless of new UUID, media key or type",async()=>{
  const family=hash("same drawing independent of palette"),bytes=hash("decoded image");const a=await artwork("avatar",{illustration:family,bytes});
  await assert.rejects(artwork("cover",{illustration:family,bytes:hash("recoloured resized rendition")}),conflict("23505"));
  await assert.rejects(artwork("avatar",{bytes}),conflict("23505"));
  await assert.rejects(pg.query("update profile_art_private.artworks set illustration_key=$1 where id=$2",[hash("replacement"),a.id]),conflict("PT409","ART_IDENTITY_IMMUTABLE"));
  const pending=await artwork("avatar",{state:"quarantine"});assert.equal((await choices("own")).available.some(x=>x.artworkId===pending.id),false);
  await assert.rejects(pg.query("update profile_art_private.artworks set state='ready',identity_review=null where id=$1",[pending.id]),conflict("23514"));
});
test("all 24 legacy-shared v1 files are explicitly excluded, with original files intact",async()=>{
  const legacy=await query("select * from profile_art_private.legacy_shared");assert.equal(legacy.length,24);
  for(const entry of [...PROFILE_AVATARS,...PROFILE_COVERS]){
    const bytes=readFileSync(new URL('../public'+entry.src,import.meta.url));const fingerprint=createHash('sha256').update(bytes).digest('hex');
    assert.equal(legacy.find(row=>row.source_path===entry.src)?.source_sha256,fingerprint);
    await assert.rejects(artwork(entry.src.includes('/avatar-')?'avatar':'cover',{bytes:fingerprint}),conflict("PT409","ART_LEGACY_SHARED"));
  }
});
test("untrusted database roles have no table/RPC access; even service role cannot enable or confirm",async()=>{
  const tables=await query("select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='profile_art_private' and c.relkind='r'");
  assert.equal(tables.length,7);assert.ok(tables.every(x=>x.relrowsecurity));
  for(const role of ["anon","authenticated"]){
    await pg.exec('set role '+role);
    try{
      await assert.rejects(pg.query("select * from profile_art_private.leases"),conflict("42501"));
      await assert.rejects(pg.query("select public.profile_art_choices('victim','avatar')"),conflict("42501"));
      await assert.rejects(pg.query("select public.profile_art_lease('victim','avatar',$1,0,$2)",[randomUUID(),randomUUID()]),conflict("42501"));
    }finally{await pg.exec("reset role");}
  }
  await assert.rejects(service("update profile_art_private.settings set enabled=true returning enabled"),conflict("42501"));
  await assert.rejects(service("update profile_art_private.artworks set state='ready' returning state"),conflict("42501"));
  await assert.rejects(service("delete from profile_art_private.claims returning artwork_id"),conflict("42501"));
  await assert.rejects(service("select profile_art_private.confirm_in_profile_save('victim','avatar',$1,1,$2,$3)",[randomUUID(),randomUUID(),randomUUID()]),conflict("42501"));
});
test("invalid direct privileged inputs fail without creating a slot or lease",async()=>{
  const initial=await counts(),id=randomUUID(),key=randomUUID();
  for(const [user,kind] of [[null,"avatar"],["","cover"],["   ","avatar"],["own",null],["own","company"]]){
    await assert.rejects(choices(user,kind),conflict("PT400"));
    await assert.rejects(service("select profile_art_lease($1,$2,$3,0,$4)",[user,kind,id,key]),conflict("PT400"));
  }
  for(const [art,expected,request] of [[null,0,key],[id,null,key],[id,-1,key],[id,0,null]]){
    await assert.rejects(service("select profile_art_lease('own','avatar',$1,$2,$3)",[art,expected,request]),conflict("PT400"));
  }
  assert.deepEqual(await counts(),initial);
});
test("a future atomic profile writer rolls back images AND both claims if validation or cancellation fails",async()=>{
  const a=await artwork(),c=await artwork("cover"),al=await lease("own",a.id),cl=await lease("own",c.id,0,randomUUID(),"cover");
  await pg.exec("insert into art_profile_save_fixture(user_id) values('own')");
  const selections=[{...al,kind:"avatar",mediaKey:a.mediaKey,requestKey:randomUUID()},{...cl,kind:"cover",mediaKey:c.mediaKey,requestKey:randomUUID()}];
  const before=await counts(),profile=await query("select * from art_profile_save_fixture");
  for(const failure of ["validation","cancel"]){
    await assert.rejects(service("select art_profile_test_save($1,0,$2::jsonb,$3)",["own",JSON.stringify(selections),failure]),conflict(failure==="cancel"?"57014":"PT400"));
    assert.deepEqual(await counts(),before);assert.deepEqual(await query("select * from art_profile_save_fixture"),profile);
    assert.equal((await choices("own")).lease.token,al.token);
  }
  await service("select art_profile_test_save($1,0,$2::jsonb,null)",["own",JSON.stringify(selections)]);
  assert.deepEqual(await query("select * from art_profile_save_fixture"),[{user_id:"own",revision:1,avatar_key:a.mediaKey,cover_key:c.mediaKey,bio:"keep"}]);
  assert.equal(await scalar("select count(*) from profile_art_private.leases"),0);assert.equal(await scalar("select count(*) from profile_art_private.claims"),2);
});
test("expired second selection or stale profile revision rolls back the first selected image",async()=>{
  const a=await artwork(),c=await artwork("cover"),al=await lease("own",a.id),cl=await lease("own",c.id,0,randomUUID(),"cover");
  await pg.exec("insert into art_profile_save_fixture(user_id) values('own')");
  const selections=[{...al,kind:"avatar",mediaKey:a.mediaKey,requestKey:randomUUID()},{...cl,kind:"cover",mediaKey:c.mediaKey,requestKey:randomUUID()}];
  await assert.rejects(service("select art_profile_test_save($1,1,$2::jsonb,null)",["own",JSON.stringify(selections)]),conflict("PT409","PROFILE_REVISION"));
  await pg.query("update profile_art_private.leases set expires_at=clock_timestamp()-interval '1 second' where token=$1",[cl.token]);
  await assert.rejects(service("select art_profile_test_save($1,0,$2::jsonb,null)",["own",JSON.stringify(selections)]),conflict("PT409","ART_EXPIRED"));
  assert.equal(await scalar("select count(*) from profile_art_private.claims"),0);assert.equal((await choices("own")).lease.token,al.token);
  assert.equal(await scalar("select avatar_key from art_profile_save_fixture"),null);
});
