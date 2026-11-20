import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {NextRequest,NextResponse} from 'next/server.js';
import * as readership from './news-readership.ts';
const require=createRequire(import.meta.url),id='11111111-1111-4111-8111-111111111111',org='22222222-2222-4222-8222-222222222222';
const entry={id,topic:'technology',published_at:'2026-10-01T00:00:00Z',created_at:'2026-10-01T00:00:00Z'};
function load(file,mocks){const mod={exports:{}};const code=ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','module','exports',code)(name=>mocks[name]??require(name),mod,mod.exports);return mod.exports;}
function fixture({authenticated=true,allowed=true,rows=[entry],visible=rows,counts=[{id,impressions:30,views:8}],onRead=()=>{},error=null}={}){
 const calls=[];let selects=0,providerCalls=0;const state={allowed};
 class Query{constructor(){this.steps=[];calls.push(this.steps)}select(...args){this.steps.push(['select',...args]);return this}eq(...args){this.steps.push(['eq',...args]);return this}in(...args){this.steps.push(['in',...args]);return this}order(...args){this.steps.push(['order',...args]);return this}limit(...args){this.steps.push(['limit',...args]);return this}gt(...args){this.steps.push(['gt',...args]);return this}then(resolve){return Promise.resolve({data:selects++?visible:rows,error}).then(resolve)}}
 const route=load('../app/api/editorial/readership/route.ts',{'next/server':{NextResponse},'@/lib/db':{db:{from:()=>new Query()}},'@/lib/editorial-agent-server':{requireEditorialAgent:async()=>authenticated?{userId:'cinegenius-editorial'}:NextResponse.json({error:'unauthorized'},{status:401}),editorialOrganizationAllowed:async()=>state.allowed,editorialHeaders:{'Cache-Control':'private, no-store'}},'@/lib/news-readership':readership,'@/lib/news-readership-server':{readNewsReadership:async()=>{providerCalls++;onRead(state);return counts}}});
 return{calls,get providerCalls(){return providerCalls},get:query=>route.GET(new NextRequest(`https://cinegenius.test/api/editorial/readership?organizationId=${org}${query??''}`))};
}
test('readership rejects missing credentials, ungranted organization and invalid cursor before any provider request',async()=>{
 for(const [options,query,status]of [[{authenticated:false},'',401],[{allowed:false},'',403],[{},'&afterId=bad',400]]){const f=fixture(options);assert.equal((await f.get(query)).status,status);assert.equal(f.providerCalls,0);assert.equal(f.calls.length,0)}
});
test('provider outage stays unavailable, absent eligible articles cold-start, no individual identity output',async()=>{
 let f=fixture({counts:null}),response=await f.get();assert.equal(response.status,503);assert.equal((await response.json()).status,'unavailable');
 f=fixture({rows:[]});response=await f.get();assert.equal(response.status,200);assert.equal((await response.json()).status,'cold_start');assert.equal(f.providerCalls,0);
 f=fixture();response=await f.get();const result=await response.json();assert.equal(result.contract,'news-readership-v1');assert.equal(result.metric,'observations_not_people');assert.equal(result.entries[0].learningEligible,true);assert.equal(response.headers.get('Cache-Control'),'private, no-store');assert.doesNotMatch(JSON.stringify(result),/user_id|email|sourceUrl|title|distinct_id/);
 for(const query of f.calls){assert.ok(query.some(row=>row[0]==='eq'&&row[1]==='organization.moderation_status'&&row[2]==='approved'));assert.ok(query.some(row=>row[0]==='in'&&row[1]==='moderation_status'&&row[2].join(',')==='approved,ended'))}
});
test('revocation and removal during a provider/cache read cannot leak stale article aggregates',async()=>{
 let f=fixture({onRead:s=>{s.allowed=false}});assert.equal((await f.get()).status,403);
 f=fixture({visible:[]});const result=await(await f.get()).json();assert.deepEqual(result.entries,[]);assert.equal(result.status,'cold_start');
});
test('legacy status readback is limited to an explicit historic capability and excludes private evidence',async()=>{
 const policy=await import('./editorial-agent-policy.ts');
 for(const [row,status]of [
  [{entry_id:id,used_at:'2026-11-20T12:00:00Z',entry:{organization_id:org,moderation_status:'hidden',updated_at:'2026-11-20T12:00:00Z'},entry_snapshot:'PRIVATE',original_author_user_id:'PRIVATE'},200],
  [null,403],
  [{entry_id:id,entry:{organization_id:'different',moderation_status:'hidden'}},403]
 ]){
  const calls=[];const query={select(...x){calls.push(['select',...x]);return this},eq(...x){calls.push(['eq',...x]);return this},maybeSingle:async()=>({data:row,error:null})};
  const route=load('../app/api/editorial/legacy-expiry/route.ts',{'next/server':{NextResponse},'@/lib/db':{db:{from:table=>{assert.equal(table,'editorial_legacy_expiry_grants');return query}}},'@/lib/editorial-agent-policy':policy,'@/lib/editorial-agent-server':{requireEditorialAgent:async()=>({userId:'cinegenius-editorial'}),editorialHeaders:{'Cache-Control':'private, no-store'}}});
  const response=await route.GET(new NextRequest(`https://cinegenius.test/api/editorial/legacy-expiry?organizationId=${org}&id=${id}`));assert.equal(response.status,status);const result=await response.json();assert.doesNotMatch(JSON.stringify(result),/PRIVATE|author_user|entry_snapshot/);
  assert.ok(calls.some(x=>x[0]==='eq'&&x[1]==='entry_id'&&x[2]===id));assert.ok(calls.some(x=>x[0]==='eq'&&x[1]==='organization_id'&&x[2]===org));
  if(status===200)assert.deepEqual(Object.keys(result.entry),['id','currentStatus','currentUpdatedAt','usedAt']);
 }
});
