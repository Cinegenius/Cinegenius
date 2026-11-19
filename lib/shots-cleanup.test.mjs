import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {shotsFixture} from './shots-test-fixture.mjs';
let f;before(async()=>{f=await shotsFixture()});after(async()=>f?.close());
function dependencies(jobs=[]){const events=[];return{events,privateBucket:async()=>true,rpc:async(action,input)=>{events.push({action,input});return action==='cleanup_claim'?{status:'ok',jobs}:action==='cleanup_complete'?{status:'healthy'}:{status:'done'}},remove:async keys=>{events.push({action:'remove',keys})},absent:async()=>true}}
function job(){const id=randomUUID();return{id,token:randomUUID(),paths:['full','thumbnail'].map(variant=>({variant,key:`${id}/${variant}.webp`}))}}
test('cleanup validates the entire manifest before any destructive call',async()=>{
 const valid=job(),invalid=job();invalid.paths[1].key='../profile-photo.webp';const d=dependencies([valid,invalid]);await assert.rejects(()=>f.cleanup.runShotsCleanup(d),/unavailable/);assert.equal(d.events.some(e=>e.action==='remove'),false);assert.equal(d.events.some(e=>e.action==='cleanup_finish'),false);
});
test('cleanup rejects duplicate variants, foreign parent paths and oversized claim batches',async()=>{
 for(const mutate of [j=>j.paths[1]=j.paths[0],j=>j.paths[0].key=randomUUID()+'/full.webp']){const j=job();mutate(j);const d=dependencies([j]);await assert.rejects(()=>f.cleanup.runShotsCleanup(d));assert.equal(d.events.some(e=>e.action==='remove'),false)}await assert.rejects(()=>f.cleanup.runShotsCleanup(dependencies(Array.from({length:11},job))));
});
test('unknown deletion ACK is settled only by checking both canonical paths',async()=>{
 const d=dependencies([job()]);let checks=0;d.remove=async()=>{throw Error('lost ACK')};d.absent=async()=>{checks++;return true};const r=await f.cleanup.runShotsCleanup(d);assert.equal(r.purged,1);assert.equal(r.healthy,true);assert.equal(checks,2);assert.equal(d.events.some(e=>e.action==='cleanup_finish'),true);
});
test('missing absence ACK and a failed retry write retain the durable claim rather than fake purge',async()=>{
 const d=dependencies([job()]);d.absent=async()=>false;const original=d.rpc;d.rpc=async(a,p)=>{if(a==='cleanup_retry')throw Error('SQL ACK lost');return original(a,p)};const r=await f.cleanup.runShotsCleanup(d);assert.equal(r.purged,0);assert.equal(r.retry,1);assert.equal(r.healthy,false);assert.equal(d.events.some(e=>e.action==='cleanup_finish'),false);assert.equal(d.events.some(e=>e.action==='cleanup_failed'),true);
});
test('public bucket stops deletion and revokes healthy-worker readiness',async()=>{
 const d=dependencies([job()]);d.privateBucket=async()=>false;await assert.rejects(()=>f.cleanup.runShotsCleanup(d),/unavailable/);assert.equal(d.events.some(e=>e.action==='remove'||e.action==='cleanup_claim'),false);assert.equal(d.events.some(e=>e.action==='cleanup_failed'),true);
});
test('an empty successful worker run updates health, but outstanding backlog never does',async()=>{
 const d=dependencies();assert.equal((await f.cleanup.runShotsCleanup(d)).healthy,true);const original=d.rpc;d.rpc=async(a,p)=>a==='cleanup_complete'?{status:'backlog'}:original(a,p);assert.equal((await f.cleanup.runShotsCleanup(d)).healthy,false);
});
test('worker GET/HEAD cannot perform cleanup and requires authenticated POST',async()=>{
 for(const handler of[f.worker.GET,f.worker.HEAD]){const r=handler();assert.equal(r.status,405);assert.equal(r.headers.get('allow'),'POST')}
 assert.equal((await f.worker.POST(new Request('https://cinegenius.co/api/internal/shots-cleanup',{method:'POST',headers:{Authorization:'Bearer fixture-secret'}}))).status,200);
});
