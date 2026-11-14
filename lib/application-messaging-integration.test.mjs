import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url),{NextRequest,NextResponse}=require('next/server');
const jobId='11111111-1111-4111-8111-111111111111',applicationId='22222222-2222-4222-8222-222222222222',conversationId='33333333-3333-4333-8333-333333333333';
const source=readFileSync(new URL('../app/api/applications/route.ts',import.meta.url),'utf8');
function fixture(options={}){
 const state={queries:[],rpcs:[],signals:[],messages:new Map(),mails:[],logs:[],applications:0};
 const db={from(table){const ops=[];state.queries.push({table,ops});const q={};for(const name of ['select','eq','upsert','insert'])q[name]=(...args)=>{ops.push([name,...args]);return q;};q.abortSignal=signal=>{state.signals.push(signal);return q;};
 const result=()=>{
  if(table==='privacy_visible_listings')return{data:{id:jobId,title:'Authoritative job title',user_id:'job-owner',published:true,type:'job'},error:null};
  if(table==='applications'){
   if(ops.some(([name])=>name==='upsert')){state.applications++;return{data:null,error:options.saveError??null};}
   if(options.lookupThrows)throw Error('Controlled unavailable lookup');
   return{data:options.lookupMissing?null:{id:options.applicationId??applicationId},error:options.lookupError??null};
  }
  return{data:table==='profiles'?{display_name:'Original applicant'}:null,error:null};
 };
 q.maybeSingle=async()=>result();q.then=(yes,no)=>Promise.resolve().then(result).then(yes,no);return q;
 },rpc(name,args){state.rpcs.push({name,args});return{abortSignal(signal){state.signals.push(signal);return this;},then(yes,no){return Promise.resolve().then(()=>{
  if(options.rpcThrows)throw Error('Controlled transport failure');
  if(options.rpcError)return{data:null,error:options.rpcError};
  const previous=state.messages.get(args.p_idempotency_key);
  if(!previous)state.messages.set(args.p_idempotency_key,args);
  return{data:{conversationId,message:{id:'44444444-4444-4444-8444-444444444444'},created:!previous,replayed:!!previous},error:null};
 }).then(yes,no);}};}};
 const mocks={'next/server':{NextRequest,NextResponse},'next-intl/server':{getTranslations:async()=>key=>key},'@/lib/db':{db},'@/lib/auth':{requireAuth:async()=>options.denied?NextResponse.json({error:'denied'},{status:401}):{userId:'applicant'},getCurrentUser:async()=>({userId:'applicant'})},'@/lib/rateLimit':{rateLimit:async()=>({allowed:options.allowed!==false})},'@/lib/i18n/notification-copy':{localizedNotification:fields=>({title:'Generated title',body:'Generated body',localization:{version:1,...fields}})},'@clerk/nextjs/server':{clerkClient:async()=>({users:{getUser:async()=>({emailAddresses:[]})}})},'@/lib/email':{sendNewApplicationEmail:async(...args)=>state.mails.push(args)}};
 const mod={exports:{}};const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','module','exports','console',compiled)(name=>mocks[name]??require(name),mod,mod.exports,{error:(...values)=>state.logs.push(values)});
 return{state,post:body=>mod.exports.POST(new NextRequest('https://example.invalid/api/applications',{method:'POST',body:JSON.stringify(body)}))};
}
const body={jobId,message:' Own application text ',portfolioUrl:'https://example.invalid/own-portfolio',dayRate:'450 EUR',ownerId:'forged-owner',jobTitle:'Forged title'};
test('a saved application starts its optional chat atomically with authoritative parties and original content',async()=>{
 const f=fixture();const response=await f.post(body);assert.equal(response.status,200);assert.deepEqual(await response.json(),{success:true});assert.equal(f.state.applications,1);assert.equal(f.state.rpcs.length,1);
 const call=f.state.rpcs[0];assert.equal(call.name,'start_direct_conversation');assert.equal(call.args.p_sender_id,'applicant');assert.equal(call.args.p_receiver_id,'job-owner');assert.equal(call.args.p_listing_id,jobId);assert.equal(call.args.p_listing_title,'Authoritative job title');assert.equal(call.args.p_listing_type,'job');
 assert.equal(call.args.p_content,'Own application text\n\nPortfolio: https://example.invalid/own-portfolio\n\nTagesgage: 450 EUR');assert.match(call.args.p_idempotency_key,/^[A-Za-z0-9_-]{8,128}$/);
 assert.equal(f.state.queries.some(query=>['conversations','conversation_members','messages'].includes(query.table)),false);
 assert.equal(f.state.signals.length,2);assert.equal(f.state.signals[0],f.state.signals[1]);assert.ok(f.state.signals[0] instanceof AbortSignal);
 const lookup=f.state.queries.find(query=>query.table==='applications'&&query.ops.some(([name])=>name==='select'));assert.ok(lookup.ops.some(op=>op[0]==='eq'&&op[1]==='applicant_id'&&op[2]==='applicant'));
});
test('application retries keep one stable send key; changed original content or application identity gets a new key',async()=>{
 const f=fixture();await f.post(body);await f.post({...body,ownerId:'another-forged-owner'});assert.equal(f.state.rpcs[0].args.p_idempotency_key,f.state.rpcs[1].args.p_idempotency_key);assert.equal(f.state.messages.size,1);
 await f.post({...body,message:'Own changed application'});assert.notEqual(f.state.rpcs[1].args.p_idempotency_key,f.state.rpcs[2].args.p_idempotency_key);assert.equal(f.state.messages.size,2);
 const other=fixture({applicationId:'55555555-5555-4555-8555-555555555555'});await other.post(body);assert.notEqual(other.state.rpcs[0].args.p_idempotency_key,f.state.rpcs[0].args.p_idempotency_key);
});
test('current messaging consent, a failed optional lookup or transport cannot turn a saved application into a false failure',async()=>{
 for(const options of [{rpcError:{code:'42501',message:'messaging_contact_unavailable'}},{rpcError:{code:'PT409',message:'messaging_busy'}},{rpcThrows:true},{lookupError:{code:'offline'}},{lookupThrows:true},{lookupMissing:true}]){
  const f=fixture(options);const response=await f.post(body);assert.equal(response.status,200);assert.deepEqual(await response.json(),{success:true});assert.equal(f.state.applications,1);assert.equal(f.state.messages.size,0);assert.equal(f.state.logs.length,0);assert.equal(f.state.queries.some(query=>['conversations','conversation_members','messages'].includes(query.table)),false);
 }
});
test('unconfirmed application writes and denied accounts never start a chat',async()=>{
 for(const [options,status] of [[{saveError:{code:'database_failure'}},500],[{denied:true},401],[{allowed:false},429]]){const f=fixture(options);assert.equal((await f.post(body)).status,status);assert.equal(f.state.rpcs.length,0);}
});
