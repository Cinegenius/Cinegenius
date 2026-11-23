import {test,before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {createProfileArtBatch} from './profile-art-batch.ts';
import {profileArtGenerationRequest} from './profile-art-producer.ts';
import {runProfileArtRefill} from './profile-art-refill.ts';
let pg;
const scalar=async(sql,args=[])=>Object.values((await pg.query(sql,args)).rows[0]??{})[0];
async function service(sql,args=[]) {await pg.exec('set role service_role');try{return await scalar(sql,args);}finally{await pg.exec('reset role');}}
const rpc=async(name,args)=>{
 if(name==='profile_art_batch_command')return service('select public.profile_art_batch_command($1,$2,$3,$4)',[args.p_action,args.p_job,args.p_token,args.p_value]);
 throw Error('Unexpected RPC');
};
const command=(action,job=null,value={})=>rpc('profile_art_batch_command',{p_action:action,p_job:job?.id??null,p_token:job?.token??null,p_value:value});
const enqueue=kind=>service('select public.profile_art_enqueue_refill($1,$2)',[kind,randomUUID()]);
const due=()=>pg.exec("update profile_art_private.refill_jobs set batch_next_poll_at=now()-interval '1 minute'");
const hash=s=>createHash('sha256').update(s).digest('hex');
const generationSHA=job=>hash(JSON.stringify({custom_id:job.id,method:'POST',url:'/v1/images/generations',body:profileArtGenerationRequest(job)})+'\n');
before(async()=>{
 pg=new PGlite();await pg.exec("create role anon;create role authenticated;create role service_role bypassrls;alter default privileges grant all on tables to anon,authenticated,service_role;alter default privileges grant all on functions to anon,authenticated,service_role;create table profiles(user_id text primary key,display_name text,avatar_url text,cover_image_url text,updated_at timestamptz default now());");
 for(const f of ['20261118012642_profile_art_reservations_foundation','20261118022112_profile_art_refill_pipeline','20261118131126_profile_art_atomic_profile_save','20261118133702_profile_art_canonical_image_refs','20261118135945_profile_art_balanced_stock','20261118140047_profile_art_permanent_deletion','20261118143209_profile_art_stock_budget','20261123134457_profile_art_batch_generation'])await pg.exec(readFileSync(new URL('../supabase/migrations/'+f+'.sql',import.meta.url),'utf8'));
});
after(()=>pg?.close());
beforeEach(()=>pg.exec("truncate profile_art_private.refill_jobs cascade;update profile_art_private.pipeline_settings set enabled=true;"));
function provider({lostCreate=false,status='in_progress',noOutput=false}={}){
 const calls=[],batches=[];let input,body;
 const fetcher=async(url,init)=>{
  calls.push({url,method:init.method??'GET'});
  assert.equal(init.redirect,'error');assert.equal(init.cache,'no-store');assert.ok(init.signal);
  assert.ok(!url.endsWith('/images/generations'),'Never a synchronous fallback');
  if(url.endsWith('/files')&&init.method==='POST') {
   assert.equal(init.body.get('purpose'),'batch');
   input=JSON.parse(await init.body.get('file').text());body=input.body;
   assert.equal(input.url,'/v1/images/generations');assert.equal(body.n,1);assert.equal(body.quality,'low');
   return Response.json({id:'file-input'});
  }
  if(url.endsWith('/batches')&&init.method==='POST'){
   const value=JSON.parse(init.body);assert.equal(value.completion_window,'24h');assert.equal(value.input_file_id,'file-input');
   assert.equal(await scalar('select batch_input_file from profile_art_private.refill_jobs where id=$1',[input.custom_id]),'file-input','File receipt stored before charging');
   const batch={id:'batch_fixture',input_file_id:'file-input',endpoint:value.endpoint,metadata:value.metadata,status};batches.push(batch);
   if(lostCreate)throw Error('private provider detail');return Response.json(batch);
  }
  if(url.includes('/batches?'))return Response.json({data:batches,has_more:false});
  if(url.endsWith('/batches/batch_fixture'))return Response.json({...batches[0],status,output_file_id:noOutput?null:'file-output',error_file_id:noOutput?'file-errors':null});
  if(init.method==='DELETE')return new Response('',{status:200});
  throw Error('Unexpected '+url);
 };
 return {calls,batches,fetcher,get input(){return input;},get body(){return body;}};
}
test('submission is durable, uses the same model/style and does not release or regenerate stock while waiting',async()=>{
 await enqueue('avatar');const p=provider();const worker=createProfileArtBatch({apiKey:'fixture',fetcher:p.fetcher});
 assert.equal((await worker.advance(rpc)).status,'batch_submitted');
 assert.equal(p.body.model,'gpt-image-2.6-flare');assert.equal(p.body.size,'1024x1024');assert.ok(p.body.prompt.includes('CineGenius'));
 assert.equal(await scalar("select count(*) from profile_art_private.artworks"),0);
 assert.equal((await worker.advance(rpc)).status,'idle');assert.equal(p.calls.length,2);
 await due();assert.equal((await worker.advance(rpc)).status,'waiting');assert.equal(p.calls.filter(c=>c.method==='POST').length,2);
 assert.equal(await service('select public.profile_art_claim_refill_v3()'),null);
});
test('lost create response is recovered by exact input/hash without a second paid POST',async()=>{
 await enqueue('avatar');const p=provider({lostCreate:true});const worker=createProfileArtBatch({apiKey:'fixture',fetcher:p.fetcher});
 const result=await worker.advance(rpc);assert.equal(result.status,'unconfirmed');assert.ok(!JSON.stringify(result).includes('private'));
 await due();assert.equal((await worker.advance(rpc)).status,'recovered');
 assert.equal(p.calls.filter(c=>c.url.endsWith('/batches')&&c.method==='POST').length,1);
 assert.equal(await scalar('select batch_provider_id from profile_art_private.refill_jobs'),'batch_fixture');
});
test('unknown upload outcome stays pending rather than silently creating another billed job',async()=>{
 await enqueue('avatar');const p=provider();const worker=createProfileArtBatch({apiKey:'fixture',fetcher:async()=>{throw Error('unknown');}});
 assert.equal((await worker.advance(rpc)).status,'unconfirmed');await due();
 assert.equal((await createProfileArtBatch({apiKey:'fixture',fetcher:p.fetcher}).advance(rpc)).status,'unconfirmed');assert.equal(p.calls.length,0);
 assert.equal(await scalar('select batch_state from profile_art_private.refill_jobs'),'unknown');
});
test('batch readiness gives one processing lease and old workers cannot charge the same pending job',async()=>{
 await enqueue('avatar');const p=provider({status:'completed'}),worker=createProfileArtBatch({apiKey:'fixture',fetcher:p.fetcher});
 await worker.advance(rpc);await due();assert.equal((await worker.advance(rpc)).status,'batch_ready');
 assert.equal(await service('select public.profile_art_claim_refill_v2()'),null);
 const job=await service('select public.profile_art_claim_refill_v3()');assert.equal(job.outputFileId,'file-output');assert.ok(job.token);
 assert.equal(await service('select public.profile_art_claim_refill_v3()'),null);
 await pg.exec("update profile_art_private.refill_jobs set expires_at=now()-interval '1 minute' where state='running'");
 assert.equal(await service('select public.profile_art_claim_refill_v3()'),null);assert.equal(await scalar('select state from profile_art_private.refill_jobs'),'failed');
 await due();assert.equal((await worker.advance(rpc)).status,'batch_cleaned');
 assert.deepEqual(p.calls.filter(c=>c.method==='DELETE').map(c=>c.url.split('/').at(-1)).sort(),['file-input','file-output']);
});
test('expired/cancelled partial results are collected but failures with no image never become stock',async()=>{
 for(const status of ['expired','cancelled','failed']){
  await pg.exec('truncate profile_art_private.refill_jobs');await enqueue('cover');
  const p=provider({status,noOutput:status==='failed'}),worker=createProfileArtBatch({apiKey:'fixture',fetcher:p.fetcher});await worker.advance(rpc);await due();
  const result=await worker.advance(rpc);assert.equal(result.status,status==='failed'?'batch_failed':'batch_ready');
  assert.equal(p.body.size,'1536x1024');assert.equal(await scalar('select count(*) from profile_art_private.artworks'),0);
 }
});
test('six outstanding jobs preserve existing buffer and daily budgets; no queue is inflated by reads',async()=>{
 for(let i=0;i<18;i++)await enqueue('avatar');
 const claimed=[];for(let i=0;i<6;i++)claimed.push(await command('begin'));
 assert.equal(new Set(claimed.map(j=>j.id)).size,6);assert.equal(await command('begin'),null);
 assert.equal((await enqueue('avatar')).state,'sufficient');assert.equal(await scalar('select count(*) from profile_art_private.refill_jobs'),18);
 for(let i=18;i<64;i++)await pg.query("insert into profile_art_private.refill_jobs(request_key,kind,state) values($1,'cover','failed')",[randomUUID()]);
 await assert.rejects(enqueue('cover'),e=>e.message==='ART_REFILL_LIMIT');
});
test('foreign tokens, invalid file IDs and invalid transitions cannot substitute provider outputs',async()=>{
 await enqueue('avatar');const job=await command('begin');
 await assert.rejects(command('input',{...job,token:randomUUID()},{fileId:'file-input',sha:'a'.repeat(64)}));
 await assert.rejects(command('input',job,{fileId:'https://attacker/image',sha:'a'.repeat(64)}));
 await assert.rejects(command('submitted',job,{batchId:'batch_fixture'}));
 await assert.rejects(command('terminal',job,{status:'completed',outputFileId:'file-output'}));
 await command('input',job,{fileId:'file-input',sha:'a'.repeat(64)});
 await assert.rejects(command('input',job,{fileId:'file-other',sha:'a'.repeat(64)}));
});
test('guest/member cannot access queue or new definer functions, and service has no direct writes',async()=>{
 for(const role of ['anon','authenticated'])for(const fn of ['public.profile_art_batch_command(text,uuid,uuid,jsonb)','profile_art_private.batch_command(text,uuid,uuid,jsonb)','public.profile_art_claim_refill_v3()'])assert.equal(await scalar('select has_function_privilege($1,$2,\'EXECUTE\')',[role,fn]),false);
 assert.equal(await scalar("select has_table_privilege('service_role','profile_art_private.refill_jobs','UPDATE')"),false);
 assert.equal(await scalar("select has_function_privilege('service_role','profile_art_private.batch_descriptor(profile_art_private.refill_jobs)','EXECUTE')"),false);
});
test('output is mapped by custom_id and validates base64; no URLs, extra responses or huge bodies',async()=>{
 const job={id:randomUUID(),kind:'avatar',presentation:'neutral',outputFileId:'file-output'};job.generationSHA=generationSHA(job);const image=Buffer.from('fixture');
 const row={custom_id:job.id,response:{status_code:200,body:{data:[{b64_json:image.toString('base64')}]}},error:null};
 const produce=body=>createProfileArtBatch({apiKey:'fixture',fetcher:async()=>new Response(body)}).produce(job,new AbortController().signal);
 assert.deepEqual(await produce(JSON.stringify(row)),image);
 await assert.rejects(createProfileArtBatch({apiKey:'fixture',fetcher:async()=>{throw Error('must not download');}}).produce({...job,generationSHA:'a'.repeat(64)},new AbortController().signal),/batch_prompt_changed/);
 for(const value of [{...row,custom_id:randomUUID()},{...row,error:{code:'failed'}},{...row,response:{status_code:200,body:{data:[{url:'https://attacker'}]}}}])await assert.rejects(produce(JSON.stringify(value)));
 await assert.rejects(produce(JSON.stringify(row)+'\n'+JSON.stringify(row)));
 await assert.rejects(createProfileArtBatch({apiKey:'fixture',fetcher:async()=>new Response('x',{headers:{'content-length':String(13*1024*1024)}})}).produce(job,new AbortController().signal),/body_too_large/);
});
test('downloaded batch images still go through preparation, review, verified storage and staging before availability',async()=>{
 const image=readFileSync(new URL('../public/profile-art/v1/avatar-01.webp',import.meta.url));
 const job={id:randomUUID(),mediaKey:randomUUID(),token:randomUUID(),kind:'avatar',presentation:'neutral',expiresAt:new Date(Date.now()+150000).toISOString(),outputFileId:'file-result'};
 job.generationSHA=generationSHA(job);
 const calls=[],payload={custom_id:job.id,response:{status_code:200,body:{data:[{b64_json:image.toString('base64')}]}},error:null};
 const adapter=createProfileArtBatch({apiKey:'fixture',fetcher:async()=>new Response(JSON.stringify(payload))});
 const result=await runProfileArtRefill({queue:{claim:async()=>job,snapshot:async()=>({revision:0,comparisons:{scope:'all-catalog-art',complete:true,snapshotID:'r_0',entries:[]}}),stage:async()=>{calls.push('stage');return{jobId:job.id,state:'review',inventoryReady:false};},fail:async()=>calls.push('fail')},
 produce:adapter.produce,review:async()=>{calls.push('review');return{accepted:true};},putVerified:async(kind,key,bytes)=>{calls.push('storage');assert.ok(bytes.length<=64000);return{sha256:hash(bytes),byteLength:bytes.length};},release:async()=>{calls.push('release');return{status:'ready',jobId:job.id,inventoryReady:true};}}, {enabled:true});
 assert.equal(result.status,'ready');assert.deepEqual(calls,['review','storage','stage','release']);
});
