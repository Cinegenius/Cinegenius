import {test,before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
let pg;
const sha=s=>createHash('sha256').update(s).digest('hex');
const fp=s=>({version:'cg-art-dct32-gradient-v1',canonicalPixelSHA256:sha(s+'a'),pixelSHA256:sha(s+'b'),pHash:'3'+sha(s+'p').slice(1,16),dHash:sha(s+'d').slice(0,32),edgeHash:sha(s+'e').slice(0,32)});
const scalar=async(sql,args=[])=>Object.values((await pg.query(sql,args)).rows[0]??{})[0];
const rejects=message=>e=>e.message===message;
async function service(sql,args=[]){await pg.exec('set role service_role');try{return await scalar(sql,args);}finally{await pg.exec('reset role');}}
const enqueue=kind=>service('select public.profile_art_enqueue_refill($1,$2)',[kind,randomUUID()]);
const choices=(kind='avatar',user='owner')=>service('select public.profile_art_choices_v2($1,$2)',[user,kind]);
const save=(u,p,c=[],expected=null,key=randomUUID(),create=false,d=[])=>service('select public.profile_art_save_profile_v2($1,$2,$3,$4,$5,$6,$7)',[u,p,c,expected,key,create,d]);
async function art(kind='avatar',presentation='neutral'){
 const id=randomUUID(),media=randomUUID();
 await pg.query("insert into profile_art_private.artworks(id,kind,illustration_key,source_sha256,media_key,state,identity_review,identity_reviewed_at,presentation) values($1,$2,$3,$4,$5,'ready','reviewed fixture only',now(),$6)",[id,kind,sha(id),sha(media),media,kind==='avatar'?presentation:null]);
 await pg.query('insert into profile_art_private.catalog_fingerprints values($1,$2,$3)',['art_'+id,sha(media),fp(id)]);
 await pg.query("insert into profile_art_private.refill_jobs(id,request_key,kind,media_key,state,presentation,candidate,created_at) values($1,$2,$3,$4,'approved',$5,$6,now()-interval '2 days')",[id,randomUUID(),kind,media,kind==='avatar'?presentation:null,{byteSHA256:sha(media),byteLength:1234}]);
 return {id,media,kind,url:`/profile-art/v2/${kind}-${media}.webp`};
}
async function own(a,u='owner'){
 const snap=await choices(a.kind,u),l=await service('select public.profile_art_lease($1,$2,$3,$4,$5)',[u,a.kind,a.id,snap.revision,randomUUID()]);
 return save(u,{display_name:'Test'},[{kind:a.kind,token:l.token,revision:l.revision,requestKey:randomUUID()}],null,randomUUID(),true);
}
before(async()=>{pg=new PGlite();await pg.exec("create role anon;create role authenticated;create role service_role bypassrls;alter default privileges grant all on tables to anon,authenticated,service_role;alter default privileges grant all on functions to anon,authenticated,service_role;create table profiles(user_id text primary key,display_name text not null check(length(display_name)>0),bio text default '',avatar_url text,cover_image_url text,updated_at timestamptz default now(),role text default 'member');");
for(const f of ['20261118012642_profile_art_reservations_foundation','20261118022112_profile_art_refill_pipeline','20261118131126_profile_art_atomic_profile_save','20261118133702_profile_art_canonical_image_refs','20261118135945_profile_art_balanced_stock','20261118140047_profile_art_permanent_deletion','20261118143209_profile_art_stock_budget'])await pg.exec(readFileSync(new URL('../supabase/migrations/'+f+'.sql',import.meta.url),'utf8'));
});
after(async()=>pg?.close());
beforeEach(async()=>{
 await pg.exec("truncate profiles;truncate profile_art_private.profile_saves,profile_art_private.operations,profile_art_private.leases,profile_art_private.slots,profile_art_private.claims,profile_art_private.artworks,profile_art_private.refill_jobs,profile_art_private.catalog_fingerprints cascade;update profile_art_private.settings set enabled=true;update profile_art_private.pipeline_settings set enabled=true,reader_enabled=true,automatic_review_enabled=false;");
 for(const row of (await pg.query('select source_sha256 from profile_art_private.legacy_shared')).rows)await pg.query('insert into profile_art_private.catalog_fingerprints values($1,$2,$3)',['legacy_'+row.source_sha256,row.source_sha256,fp(row.source_sha256)]);
});
test('12 visible avatars are balanced 4+4+4, reserve replaces a lease immediately, all 12 covers are shown',async()=>{
 for(const p of ['feminine','masculine','neutral'])for(let i=0;i<6;i++)await art('avatar',p);
 for(let i=0;i<18;i++)await art('cover');
 const s=await choices();assert.equal(s.available.length,12);
 for(const p of ['feminine','masculine','neutral'])assert.equal(s.available.filter(a=>a.presentation===p).length,4);
 await service('select public.profile_art_lease($1,$2,$3,0,$4)',['other','avatar',s.available[0].artworkId,randomUUID()]);
 const next=await choices();assert.equal(next.available.length,12);assert.ok(!next.available.some(a=>a.artworkId===s.available[0].artworkId));
 assert.equal((await choices('cover')).available.length,12);
 assert.equal((await enqueue('avatar')).state,'sufficient');
});
test('queue balances groups, has a real reserve and old workers cannot use the rejected prompt',async()=>{
 for(let i=0;i<18;i++)await enqueue('avatar');
 const counts=(await pg.query('select presentation,count(*)::int n from profile_art_private.refill_jobs group by presentation order by presentation')).rows;
 assert.deepEqual(counts.map(r=>r.n),[6,6,6]);assert.equal((await enqueue('avatar')).state,'sufficient');
 assert.equal(await service('select public.profile_art_claim_refill()'),null);
 const j=await service('select public.profile_art_claim_refill_v2()');assert.ok(['feminine','masculine','neutral'].includes(j.presentation));
});
test('ownership queues its replacement, read/lease does not; full budget never rolls back the profile',async()=>{
 for(let i=0;i<64;i++)await pg.query("insert into profile_art_private.refill_jobs(request_key,kind,state) values($1,'cover','failed')",[randomUUID()]);
 const a=await art();await choices();const p=await own(a);assert.equal(p.avatar_url,a.url);
 assert.equal(await scalar("select count(*) from profile_art_private.refill_jobs where state='queued'"),0);
 await assert.rejects(enqueue('cover'),rejects('ART_REFILL_LIMIT'));
});
test('a consumed image receives one durable refill even when Save is retried',async()=>{
 const a=await art();await own(a);
 assert.equal(await scalar("select count(*) from profile_art_private.refill_jobs where state='queued'"),1);
 assert.equal((await choices()).available.length,0);
});
test('permanent deletion is atomic, idempotent and cannot be undone, reselected or served',async()=>{
 const a=await art(),p=await own(a),key=randomUUID(),d=[{kind:'avatar',mediaKey:a.media}];
 const r=await save('owner',{avatar_url:null},[],p.updated_at,key,false,d);
 assert.equal(r.avatar_url,null);assert.deepEqual(await save('owner',{avatar_url:null},[],p.updated_at,key,false,d),r);
 assert.equal(await scalar('select count(*) from profile_art_private.claims'),1);
 assert.ok(await scalar('select deleted_at from profile_art_private.artworks where id=$1',[a.id]));
 assert.equal(await service('select public.profile_art_read_descriptor($1,$2)',[a.kind,a.media]),null);
 await assert.rejects(pg.query("update profile_art_private.artworks set state='ready',deleted_at=null where id=$1",[a.id]),rejects('ART_PERMANENTLY_DELETED'));
 await assert.rejects(pg.query("update profiles set avatar_url=$1 where user_id='owner'",[a.url]),rejects('ART_NOT_OWNED'));
 await assert.rejects(service('select public.profile_art_lease($1,$2,$3,$4,$5)',['owner','avatar',a.id,(await choices()).revision,randomUUID()]),rejects('ART_UNAVAILABLE'));
});
test('deleting while still selected, stale saves, foreign owners and invalid fields never destroy art',async()=>{
 const a=await art(),p=await own(a),d=[{kind:'avatar',mediaKey:a.media}];
 await assert.rejects(save('owner',{bio:'unchanged image'},[],p.updated_at,randomUUID(),false,d),rejects('ART_STILL_SELECTED'));
 await assert.rejects(save('owner',{avatar_url:null,display_name:''},[],p.updated_at,randomUUID(),false,d));
 await assert.rejects(save('owner',{avatar_url:null},[],null,randomUUID(),false,d),rejects('ART_PROFILE_CHANGED'));
 await assert.rejects(save('other',{display_name:'Other'},[],null,randomUUID(),true,d),rejects('ART_NOT_OWNED'));
 assert.equal(await scalar('select deleted_at from profile_art_private.artworks where id=$1',[a.id]),null);
 assert.equal(await scalar("select avatar_url from profiles where user_id='owner'"),a.url);
});
test('ordinary replacement keeps ownership and saved image available; guests cannot mutate stock or deletion',async()=>{
 const a=await art();await own(a);await pg.query("update profiles set avatar_url='/api/media/own-photo' where user_id='owner'");
 assert.equal(await scalar('select deleted_at from profile_art_private.artworks where id=$1',[a.id]),null);
 assert.ok(await service('select public.profile_art_read_descriptor($1,$2)',[a.kind,a.media]));
 for(const role of ['anon','authenticated']){
  assert.equal(await scalar("select has_function_privilege($1,'public.profile_art_save_profile_v2(text,jsonb,jsonb,timestamptz,uuid,boolean,jsonb)','EXECUTE')",[role]),false);
  assert.equal(await scalar("select has_function_privilege($1,'public.profile_art_complete_review(uuid,jsonb,text)','EXECUTE')",[role]),false);
 }
 assert.equal(await scalar("select has_function_privilege('service_role','profile_art_private.approve_candidate(uuid,bigint,text,text,text)','EXECUTE')"),false);
});
test('automatic visual release remains separately gated, validates policy and stores honest review provenance',async()=>{
 await enqueue('avatar');const j=await service('select public.profile_art_claim_refill_v2()'),s=await service('select public.profile_art_catalog_snapshot()');
 const c={sourceSHA256:sha(j.id),byteSHA256:sha('bytes'),verifiedSHA256:sha('bytes'),byteLength:1234,fingerprint:fp(j.id)};
 await service('select public.profile_art_stage_candidate($1,$2,$3,$4)',[j.id,j.token,s.revision,c]);
 const review={policy:'cg-silhouette-nature-v1',model:'gpt-5.4-mini',accepted:true,description:'Test-only independent description of unique composition.',styleVersion:'cg-selected-avatars-20261123',styleId:'riso'};
 const complete=r=>service('select public.profile_art_complete_review($1,$2,$3)',[j.id,r,c.byteSHA256]);
 await assert.rejects(complete({...review,policy:'bypass'}),rejects('ART_REVIEW_REQUIRED'));
 assert.equal((await complete(review)).status,'review');assert.equal(await scalar('select count(*) from profile_art_private.artworks'),0);
 await pg.exec('update profile_art_private.pipeline_settings set automatic_review_enabled=true');
 assert.equal((await complete(review)).status,'ready');
 assert.equal(await scalar('select presentation from profile_art_private.artworks where id=$1',[j.id]),j.presentation);
 assert.deepEqual(await scalar('select vision_review from profile_art_private.refill_jobs where id=$1',[j.id]),review);
});
