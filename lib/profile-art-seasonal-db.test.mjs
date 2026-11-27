import {test,before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {renderSeasonalImportSql} from '../scripts/profile-art/seasonal-import-sql.mjs';
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
for(const f of ['20261118012642_profile_art_reservations_foundation','20261118022112_profile_art_refill_pipeline','20261118131126_profile_art_atomic_profile_save','20261118133702_profile_art_canonical_image_refs','20261118135945_profile_art_balanced_stock','20261118140047_profile_art_permanent_deletion','20261118143209_profile_art_stock_budget','20261123134457_profile_art_batch_generation','20261127135242_profile_art_seasonal_mix'])await pg.exec(readFileSync(new URL('../supabase/migrations/'+f+'.sql',import.meta.url),'utf8'));
});
after(async()=>pg?.close());
beforeEach(async()=>{
 await pg.exec("update profile_art_private.seasonal_editions set refill_enabled=false,available_from=now()+interval '1 day',available_until=now()+interval '2 days';");
 await pg.exec("truncate profiles;truncate profile_art_private.profile_saves,profile_art_private.operations,profile_art_private.leases,profile_art_private.slots,profile_art_private.claims,profile_art_private.artworks,profile_art_private.refill_jobs,profile_art_private.catalog_fingerprints cascade;update profile_art_private.settings set enabled=true;update profile_art_private.pipeline_settings set enabled=true,reader_enabled=true,automatic_review_enabled=false;");
 for(const row of (await pg.query('select source_sha256 from profile_art_private.legacy_shared')).rows)await pg.query('insert into profile_art_private.catalog_fingerprints values($1,$2,$3)',['legacy_'+row.source_sha256,row.source_sha256,fp(row.source_sha256)]);
});

const activate=async(id='winter-2026')=>pg.query("update profile_art_private.seasonal_editions set refill_enabled=true,available_from=now()-interval '1 day',available_until=now()+interval '1 day' where id=$1",[id]);
const end=async(id='winter-2026')=>pg.query("update profile_art_private.seasonal_editions set available_from=now()-interval '2 days',available_until=now()-interval '1 day' where id=$1",[id]);
async function seasonal(edition='winter-2026',slot=null){const a=await art();await pg.query('update profile_art_private.artworks set seasonal_edition=$1,seasonal_slot=$2 where id=$3',[edition,slot,a.id]);return a;}
async function regular(){for(const p of ['feminine','masculine','neutral'])for(let i=0;i<6;i++)await art('avatar',p);}
const isSeasonal=async a=>!!await scalar('select seasonal_edition from profile_art_private.artworks where id=$1',[a.artworkId]);

test('calendar uses Berlin midnight, inclusive start and exclusive end, with no annual repeat',async()=>{
 await pg.exec("update profile_art_private.seasonal_editions set available_from='2026-12-04 00:00:00 Europe/Berlin',available_until='2026-12-07 00:00:00 Europe/Berlin' where id='nikolaus-2026';update profile_art_private.seasonal_editions set available_from='2026-11-27 00:00:00 Europe/Berlin',available_until='2027-01-01 00:00:00 Europe/Berlin' where id='winter-2026'");
 for(const [id,stamp,yes] of [['nikolaus-2026','2026-12-03T22:59:59.999Z',false],['nikolaus-2026','2026-12-03T23:00:00Z',true],['nikolaus-2026','2026-12-06T22:59:59.999Z',true],['nikolaus-2026','2026-12-06T23:00:00Z',false],['winter-2026','2026-12-31T22:59:59.999Z',true],['winter-2026','2026-12-31T23:00:00Z',false],['nikolaus-2026','2027-12-06T12:00:00Z',false]])assert.equal(await service('select profile_art_private.season_active($1,$2)',[id,stamp]),yes,stamp);
});
test('ordinary assortment stays 4+4+4 outside season and covers are unchanged',async()=>{
 await regular();await seasonal();await seasonal('nikolaus-2026',1);
 for(let i=0;i<18;i++)await art('cover');
 const a=(await choices()).available;assert.equal(a.length,12);for(const p of ['feminine','masculine','neutral'])assert.equal(a.filter(x=>x.presentation===p).length,4);
 assert.ok(!(await Promise.all(a.map(isSeasonal))).some(Boolean));assert.equal((await choices('cover')).available.length,12);
});
test('three winter avatars mix at positions 4/8/12; reads and leases never generate',async()=>{
 await activate();await regular();for(let i=0;i<5;i++)await seasonal();
 const snap=await choices(),flags=await Promise.all(snap.available.map(isSeasonal));
 assert.equal(snap.available.length,12);assert.deepEqual(flags,[false,false,false,true,false,false,false,true,false,false,false,true]);
 assert.deepEqual((await choices()).available,snap.available);
 await service('select public.profile_art_lease($1,$2,$3,0,$4)',['owner','avatar',snap.available[3].artworkId,randomUUID()]);
 assert.equal(await scalar("select count(*) from profile_art_private.refill_jobs where state='queued'"),0);
 assert.equal((await service('select public.profile_art_choices($1,$2)',['other','avatar'])).available.length,12);
});
test('seasonal art never takes over when regular stock is short or absent',async()=>{
 await activate();for(let i=0;i<5;i++)await seasonal();assert.equal((await choices()).available.length,0);
 for(let i=0;i<2;i++)await art();assert.equal((await choices()).available.length,2);
 await art();const a=(await choices()).available;assert.equal(a.length,4);assert.equal((await Promise.all(a.map(isSeasonal))).filter(Boolean).length,1);
});
test('holiday has exactly seven slots, rejects duplicate/extra slots, and always includes available Nikolaus in mixed selection',async()=>{
 await activate();await activate('nikolaus-2026');await regular();for(let i=0;i<3;i++)await seasonal();
 const one=await seasonal('nikolaus-2026',1);for(let i=2;i<=7;i++)await seasonal('nikolaus-2026',i);
 const extra=await art();for(const slot of [0,8,null])await assert.rejects(pg.query("update profile_art_private.artworks set seasonal_edition='nikolaus-2026',seasonal_slot=$1 where id=$2",[slot,extra.id]));
 await assert.rejects(pg.query("update profile_art_private.artworks set seasonal_edition='nikolaus-2026',seasonal_slot=1 where id=$1",[extra.id]));
 const a=(await choices()).available;assert.equal(a.length,12);assert.ok(a.some(x=>x.artworkId===one.id));assert.equal((await Promise.all(a.map(isSeasonal))).filter(Boolean).length,3);
 await own(one);assert.ok(!(await choices('avatar','other')).available.some(x=>x.artworkId===one.id));
 assert.equal(await scalar("select count(*) from profile_art_private.refill_jobs where state='queued'"),0,'no paid replacement for finite holiday');
});
test('unavailable season blocks old/direct lease paths and preserves existing reservation',async()=>{
 const a=await art(),season=await seasonal();const l=await service('select public.profile_art_lease($1,$2,$3,0,$4)',['owner','avatar',a.id,randomUUID()]);
 await assert.rejects(service('select public.profile_art_lease($1,$2,$3,$4,$5)',['owner','avatar',season.id,l.revision,randomUUID()]),rejects('ART_UNAVAILABLE'));
 assert.equal((await choices()).lease.artworkId,a.id);
});
test('lease ends at campaign boundary and a stale save cannot claim; saved owner still keeps/restores art',async()=>{
 await activate();const a=await seasonal();
 await pg.query("update profile_art_private.seasonal_editions set available_until=now()+interval '30 seconds' where id='winter-2026'");
 const l=await service('select public.profile_art_lease($1,$2,$3,0,$4)',['owner','avatar',a.id,randomUUID()]);
 assert.ok(Date.parse(l.expiresAt)<Date.now()+31000);await end();
 await assert.rejects(save('owner',{display_name:'Saved'},[{kind:'avatar',token:l.token,revision:l.revision,requestKey:randomUUID()}],null,randomUUID(),true),rejects('ART_UNAVAILABLE'));
 assert.equal(await scalar('select count(*) from profiles'),0);
 await activate();await own(a);await end();
 assert.equal((await choices()).selected.artworkId,a.id);assert.equal((await choices('avatar','other')).available.length,0);
 assert.ok(await service('select public.profile_art_read_descriptor($1,$2)',['avatar',a.media]));
 const snapshot=await choices();assert.ok(await service('select public.profile_art_lease($1,$2,$3,$4,$5)',['owner','avatar',a.id,snapshot.revision,randomUUID()]));
});
test('winter quota is three separate jobs; ordinary balanced reserve remains eighteen',async()=>{
 await activate();for(let i=0;i<21;i++)await enqueue('avatar');
 assert.equal(await scalar("select count(*) from profile_art_private.refill_jobs where seasonal_edition='winter-2026'"),3);
 assert.equal(await scalar("select count(*) from profile_art_private.refill_jobs where seasonal_edition is null"),18);
 assert.equal((await enqueue('avatar')).state,'sufficient');
 const counts=(await pg.query("select presentation,count(*)::int n from profile_art_private.refill_jobs where seasonal_edition is null group by presentation")).rows;assert.deepEqual(counts.map(x=>x.n),[6,6,6]);
});
test('winter brief persists through submission/collection and expired unsubmitted jobs never reach provider',async()=>{
 await activate();await enqueue('avatar');
 const batch=await service("select public.profile_art_batch_command('begin')");assert.equal(batch.seasonalEdition,'winter-2026');
 await pg.query("update profile_art_private.refill_jobs set batch_state='ready',batch_output_file='file_test',batch_payload_sha=$1 where id=$2",[sha('test'),batch.id]);
 const j=await service('select public.profile_art_claim_refill_v3()');assert.equal(j.seasonalEdition,'winter-2026');
 await enqueue('avatar');await end();assert.equal(await service("select public.profile_art_batch_command('begin')"),null);
 assert.equal(await scalar("select count(*) from profile_art_private.refill_jobs where failure_code='season_ended'"),1);
});
test('generation approval binds winter edition even after season; owner/role permissions remain closed',async()=>{
 await activate();await enqueue('avatar');const j=(await pg.query("select * from profile_art_private.refill_jobs where seasonal_edition='winter-2026'")).rows[0];
 await pg.query("insert into profile_art_private.artworks(id,kind,illustration_key,source_sha256,media_key,state,identity_review,identity_reviewed_at,presentation) values($1,'avatar',$2,$3,$4,'ready','fixture approval only',now(),'neutral')",[j.id,sha(j.id),sha(j.media_key),j.media_key]);
 assert.equal(await scalar('select seasonal_edition from profile_art_private.artworks where id=$1',[j.id]),'winter-2026');
 await assert.rejects(pg.query('update profile_art_private.artworks set seasonal_edition=null where id=$1',[j.id]),rejects('ART_IDENTITY_IMMUTABLE'));
 for(const role of ['anon','authenticated'])assert.equal(await scalar("select has_function_privilege($1,'profile_art_private.season_active(text,timestamptz)','EXECUTE')",[role]),false);
 assert.equal(await scalar("select has_table_privilege('service_role','profile_art_private.seasonal_editions','UPDATE')"),false);
 await end();await regular();assert.ok(!(await choices()).available.some(x=>x.artworkId===j.id));
});

test('the exact ten-asset import runs through review/dedup, is idempotent and leaves profiles/ordinary stock intact',async()=>{
 const manifest=JSON.parse(readFileSync(new URL('../design/profile-art-seasonal-20261127/catalog.json',import.meta.url),'utf8'));
 const entries=manifest.entries.map(a=>({...a,candidate:{sourceSHA256:a.sourceSHA256,byteSHA256:a.byteSHA256,verifiedSHA256:a.byteSHA256,byteLength:a.byteLength,fingerprint:a.fingerprint}}));
 const revision=await scalar('select catalog_revision from profile_art_private.pipeline_settings where singleton');
 await pg.exec(renderSeasonalImportSql(entries,revision));
 assert.equal(await scalar('select count(*) from profile_art_private.artworks'),10);
 assert.equal(await scalar("select count(*) from profile_art_private.artworks where seasonal_edition='nikolaus-2026'"),7);
 assert.equal(await scalar("select count(*) from profile_art_private.artworks where seasonal_edition='winter-2026'"),3);
 assert.equal(await scalar("select count(*) from profile_art_private.refill_jobs where state='approved'"),10);
 assert.equal(await scalar('select count(*) from profiles'),0);
 await pg.exec(renderSeasonalImportSql(entries,await scalar('select catalog_revision from profile_art_private.pipeline_settings where singleton')));
 assert.equal(await scalar('select count(*) from profile_art_private.artworks'),10);
 await assert.rejects(pg.exec(renderSeasonalImportSql(entries,revision)),rejects('ART_CATALOG_CHANGED'));await pg.exec('rollback');
});
test('late paid batch result is discarded without a new generation or review, and left for cleanup',async()=>{
 await activate();await enqueue('avatar');const batch=await service("select public.profile_art_batch_command('begin')");
 await pg.query("update profile_art_private.refill_jobs set batch_state='ready',batch_output_file='file_late',batch_payload_sha=$1 where id=$2",[sha('late'),batch.id]);await end();
 assert.equal(await service('select public.profile_art_claim_refill_v3()'),null);
 assert.equal((await service("select public.profile_art_batch_command('cleanup')")).id,batch.id);
});
test('ordinary stock cannot be replaced by an unlimited winter queue and the existing daily limit still applies',async()=>{
 await activate();for(let i=0;i<64;i++)await pg.query("insert into profile_art_private.refill_jobs(request_key,kind,state) values($1,'cover','failed')",[randomUUID()]);
 await assert.rejects(enqueue('avatar'),rejects('ART_REFILL_LIMIT'));
 const a=await seasonal();await own(a);assert.equal(await scalar('select count(*) from profiles'),1);
 assert.equal(await scalar("select count(*) from profile_art_private.refill_jobs where state='queued'"),0);
});
