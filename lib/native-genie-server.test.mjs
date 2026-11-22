import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as crypto from 'node:crypto';
import ts from 'typescript';
import {trustedMutationOrigin} from './request-origin.ts';

const owner='user_PersonalFixture',other='user_OtherFixture';
function fixture(options={}){
 const diagnostics=[];
 const events=[],calls=[],env={NODE_ENV:'production',GENIE_UNLIMITED_USER_ID:owner,GENIE_NATIVE_TEST_ENABLED:'true',...options.env};
 let verifies=0;
 const mocks={
  'server-only':{},'node:crypto':crypto,'@clerk/nextjs/server':{auth:async()=>({userId:options.actor===null?null:options.actor??owner,sessionId:'fixture-session'})},
  '@/lib/auth':{getCurrentUser:async()=>{events.push('auth');if(options.authError)throw Error('PRIVATE_AUTH_ERROR');return options.actor===null?null:{userId:options.actor??owner};}},
  '@/lib/request-origin':{trustedMutationOrigin},
  '@/lib/genie-server':{
   genieConfiguration(actor){events.push('config');if(options.configError)throw options.configError;return{apiKey:'fixture-only',personalQuality:actor===env.GENIE_UNLIMITED_USER_ID};},
   async reserveGenieUsage(_request,actor,config){events.push('common-quota');assert.equal(actor,owner);assert.equal(config.personalQuality,true);if(options.commonDeny)throw{code:'rate_limited',status:429};},
  },
  '@/lib/native-push-server':{async verifyNativePushSession(){events.push('verify');verifies++;return options.revokeAt&&verifies>=options.revokeAt?'revoked':options.session??'active';}},
  '@/lib/rateLimit':{async rateLimit(key,limit,window){events.push('native-quota');calls.push({key,limit,window});return{allowed:!options.rateDeny};}},
  '@/lib/native-genie-engine.mjs':{
   validateNativeGenieInput(kind,input){events.push('validate');if(options.invalid||!input?.fixture)throw{engine:true,code:'invalid_request',status:400};if(kind==='analyze')throw{engine:true,code:'unavailable',status:503};},
   nativeGenieEngineError(error){return error?.engine?error:null;},
   createNativeGenieEngine(key){assert.equal(key,'fixture-only');return async(kind,input,{signal,beforeProvider})=>{
    events.push('engine');await beforeProvider();signal.throwIfAborted();events.push('provider');
    if(options.run)return options.run({signal,kind,input});return{schemaVersion:1,days:[]};
   };},
  },
 };
 const context=vm.createContext({console:{error:value=>{if(options.logThrows)throw Error("log failure");diagnostics.push(JSON.parse(value));}},Request,Response,URL,AbortSignal,Uint8Array,TextDecoder,Buffer,Set,Number,process:{env}}),module={exports:{}};
 const code=ts.transpileModule(readFileSync(new URL('./native-genie-server.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new vm.Script('(function(require,module,exports){'+code+'\n})').runInContext(context)(id=>{assert.ok(id in mocks,id);return mocks[id];},module,module.exports);
 function request({kind='personal-dispo',body='{"fixture":true}',headers={},signal}={}){
  return new Request('https://www.cinegenius.co/api/native/v1/genie/'+kind,{method:'POST',body,signal,duplex:'half',headers:{Origin:'https://www.cinegenius.co','Content-Type':'application/json','X-CineGenius-Genie-Contract':'personal-test.v1','X-CineGenius-Genie-Account':owner,...headers}});
 }
 return{events,calls,diagnostics,request,route:module.exports.nativeGenieRoute};
}
async function errorCode(response,status,code){
 assert.equal(response.status,status);
 assert.deepEqual(Object.fromEntries(response.headers),{
  'cache-control':'private, no-store, max-age=0','cdn-cache-control':'no-store',
  'content-type':'application/json','referrer-policy':'no-referrer',
  ...(status===429?{'retry-after':'60'}:{}),
  'vercel-cdn-cache-control':'no-store','x-content-type-options':'nosniff',
 });
 assert.deepEqual(await response.json(),{error:code});
}
test('Vercel request cancellation is enabled only for the native Genie route files',()=>{
 const config=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
 assert.deepEqual(config.functions,{'app/api/native/v1/genie/**/route.ts':{supportsCancellation:true}});
});
test('signed-out, foreign and spoofed accounts never read input, reserve usage or reach a provider',async()=>{
 for(const options of [{actor:null},{actor:other},{env:{GENIE_UNLIMITED_USER_ID:''}}]){
  const f=fixture(options),response=await f.route(f.request(),'personal-dispo');
  assert.ok([401,403].includes(response.status));assert.equal(f.events.includes('validate'),false);assert.equal(f.events.includes('provider'),false);assert.equal(f.calls.length,0);
 }
 const f=fixture();await errorCode(await f.route(f.request({headers:{'X-CineGenius-Genie-Account':other}}),'personal-dispo'),409,'unauthorized');assert.equal(f.events.includes('verify'),false);
});
test('hostile origin, wrong contract, missing capability and revoked sessions fail closed',async()=>{
 for(const [options,input,status,code]of [
  [{},{headers:{Origin:'https://evil.test'}},403,'invalid_request'],
  [{},{headers:{'X-CineGenius-Genie-Contract':'fake'}},400,'invalid_request'],
  [{env:{GENIE_NATIVE_TEST_ENABLED:'false'}},{},503,'unavailable'],
  [{session:'revoked'},{},401,'unauthorized'],[{session:'unavailable'},{},503,'unavailable'],
 ]){const f=fixture(options);await errorCode(await f.route(f.request(input),'personal-dispo'),status,code);assert.equal(f.events.includes('validate'),false);assert.equal(f.events.includes('provider'),false);}
});
test('body validation and streamed byte/UTF8 bounds precede any provider reservation',async()=>{
 const cases=[['not-json',400,'invalid_request'],['{"fixture":false}',400,'invalid_request'],['x'.repeat(4194305),413,'too_large'],[new Uint8Array([255]),400,'invalid_request']];
 for(const[body,status,code]of cases){const f=fixture();await errorCode(await f.route(f.request({body}),'personal-dispo'),status,code);assert.equal(f.calls.length,0);assert.equal(f.events.includes('provider'),false);}
});
test('successful analyses bind the returned account and share the existing personal Genie minute guards',async()=>{
 const f=fixture();for(let i=0;i<12;i++){
  const response=await f.route(f.request(),'personal-dispo');assert.equal(response.status,200);assert.equal(response.headers.get('X-CineGenius-Genie-Account'),owner);
 }
 assert.equal(f.events.filter(e=>e==='provider').length,12,'No ten-analyses total ceiling or test-date expiry');
 assert.equal(f.events.filter(e=>e==='common-quota').length,12);assert.equal(f.calls.length,12);
 for(const call of f.calls){assert.equal(call.limit,2);assert.equal(call.window,60);assert.match(call.key,/^native-genie:minute:[a-f0-9]{64}$/);assert.equal(call.key.includes(owner),false);}
});
test('quota failures never call the provider, and reservations are not refunded',async()=>{
 for(const options of [{rateDeny:true},{commonDeny:true}]){
  const f=fixture(options);await errorCode(await f.route(f.request(),'personal-dispo'),429,'rate_limited');assert.equal(f.events.includes('provider'),false);assert.equal(f.calls.length,1);
 }
});
test('same-instance concurrent work is rejected, then the slot is available after completion',async()=>{
 let release,entered,runs=0;const started=new Promise(r=>entered=r);
 const f=fixture({run:async()=>{if(++runs===1){entered();await new Promise(r=>release=r);}return{schemaVersion:1};}});
 const first=f.route(f.request({kind:'work-task'}),'work-task');await started;
 await errorCode(await f.route(f.request(),'personal-dispo'),409,'analysis_busy');release();assert.equal((await first).status,200);
 assert.equal((await f.route(f.request({kind:'work-task'}),'work-task')).status,200);
});
test('revocation after provider completion discards the analysis and source diagnostics never escape',async()=>{
 const before=fixture({revokeAt:2});await errorCode(await before.route(before.request(),'personal-dispo'),401,'unauthorized');assert.equal(before.events.includes('provider'),false);
 const f=fixture({revokeAt:3});await errorCode(await f.route(f.request(),'personal-dispo'),401,'unauthorized');assert.ok(f.events.includes('provider'));
 const g=fixture({run:async()=>{throw Error('PRIVATE_SOURCE_KEY_PROVIDER_DETAIL');}});
 await errorCode(await g.route(g.request(),'personal-dispo'),503,'unavailable');
});
test('unknown paths and the unsupported older screenplay route cannot select a provider',async()=>{
 const f=fixture();await errorCode(await f.route(f.request({kind:'evil'}),'evil'),404,'not_found');assert.equal(f.events.length,0);
 const g=fixture();await errorCode(await g.route(g.request({kind:'analyze'}),'analyze'),503,'unavailable');assert.equal(g.events.includes('provider'),false);
});
test('request cancellation propagates and releases the active slot',async()=>{
 const controller=new AbortController();let entered;const started=new Promise(r=>entered=r);
 const f=fixture({run:async({signal})=>{entered();await new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('cancelled'))));}});
 const result=f.route(f.request({signal:controller.signal}),'personal-dispo');await started;controller.abort();await errorCode(await result,499,'cancelled');
});
test('abort releases its claim before the cancelled engine settles, without releasing a successor',async()=>{
 const controller=new AbortController();let firstEntered,secondEntered,finishFirst,finishSecond,runs=0;
 const firstStarted=new Promise(resolve=>firstEntered=resolve),secondStarted=new Promise(resolve=>secondEntered=resolve);
 const f=fixture({run:async()=>{
  const run=++runs;
  if(run===1){firstEntered();await new Promise(resolve=>finishFirst=resolve);}
  if(run===2){secondEntered();await new Promise(resolve=>finishSecond=resolve);}
  return{schemaVersion:1};
 }});
 const first=f.route(f.request({signal:controller.signal}),'personal-dispo');await firstStarted;
 controller.abort();
 const second=f.route(f.request(),'personal-dispo');await secondStarted;
 assert.equal(runs,2,'The cancelled engine is still pending while its successor acquires the slot');
 finishFirst();await errorCode(await first,499,'cancelled');
 await errorCode(await f.route(f.request(),'personal-dispo'),409,'analysis_busy');
 finishSecond();assert.equal((await second).status,200);
 assert.equal((await f.route(f.request(),'personal-dispo')).status,200);
 assert.equal(runs,3);
});
test('a completed request abort cannot release newer active work, and validation failure releases its slot',async()=>{
 const controller=new AbortController();let entered,finish,runs=0;
 const started=new Promise(resolve=>entered=resolve);
 const f=fixture({run:async()=>{if(++runs===2){entered();await new Promise(resolve=>finish=resolve);}return{schemaVersion:1};}});
 assert.equal((await f.route(f.request({signal:controller.signal}),'personal-dispo')).status,200);
 const second=f.route(f.request(),'personal-dispo');await started;controller.abort();
 await errorCode(await f.route(f.request(),'personal-dispo'),409,'analysis_busy');
 finish();assert.equal((await second).status,200);
 await errorCode(await f.route(f.request({body:'not-json'}),'personal-dispo'),400,'invalid_request');
 assert.equal((await f.route(f.request(),'personal-dispo')).status,200);
});

test('analysis failures record only closed diagnostic fields and preserve the error response',async()=>{
 const f=fixture({run:async()=>{throw{engine:true,code:'invalid_evidence',status:502,message:'PRIVATE_MODEL_TEXT',stack:'PRIVATE_SOURCE'};}});
 await errorCode(await f.route(f.request(),'personal-dispo'),502,'invalid_evidence');
 assert.equal(f.diagnostics.length,1);
 const d=f.diagnostics[0];assert.deepEqual(Object.keys(d).sort(),['event','kind','phase','code','status','elapsedMs','rejectionStage','rejectionReason','rejectionArea','rejectionRule'].sort());
 assert.equal(d.event,'native_genie_failure');assert.equal(d.phase,'analysis');assert.equal(d.code,'invalid_evidence');assert.equal(d.status,502);
 assert.ok(Number.isFinite(d.elapsedMs)&&d.elapsedMs>=0);
 assert.doesNotMatch(JSON.stringify(d),/PRIVATE|user_|fixture-only/);
});
test('diagnostics cannot leak unknown engine codes or break error handling',async()=>{
 const run=async()=>{throw{engine:true,code:'private_source',status:502};};
 const f=fixture({run});await f.route(f.request(),'personal-dispo');assert.equal(f.diagnostics[0].code,'unclassified');
 const broken=fixture({run,logThrows:true});await errorCode(await broken.route(broken.request(),'personal-dispo'),502,'private_source');
 const denied=fixture({actor:null});await denied.route(denied.request(),'personal-dispo');assert.equal(denied.diagnostics.length,0);
 const ok=fixture();await ok.route(ok.request(),'personal-dispo');assert.equal(ok.diagnostics.length,0);
});

test('route independently allowlists all closed diagnostics without changing the public response',async()=>{
 for(const [stage,reason,area,wantedStage,wantedReason,wantedArea]of [
  ['compact_wire','duplicate_key','unknown','compact_wire','duplicate_key','unknown'],
  ['canonical_validation','canonical_schema','times','canonical_validation','canonical_schema','times'],
  ['recovery','recovery_schema','locations','recovery','recovery_schema','locations'],
  ['PRIVATE_SOURCE','PRIVATE_FIELD','PRIVATE_AREA','unknown','other','unknown'],
  [{secret:'PRIVATE'},['PRIVATE'],{secret:'PRIVATE'},'unknown','other','unknown'],
 ]){
  const f=fixture({run:async()=>{throw{engine:true,code:'invalid_schema',status:502,rejectionStage:stage,rejectionReason:reason,rejectionArea:area,validationPath:'PRIVATE_PATH',message:'PRIVATE_TEXT',stack:'PRIVATE_STACK'};}});
  await errorCode(await f.route(f.request(),'personal-dispo'),502,'invalid_schema');
  assert.equal(f.diagnostics[0].rejectionStage,wantedStage);assert.equal(f.diagnostics[0].rejectionReason,wantedReason);assert.equal(f.diagnostics[0].rejectionArea,wantedArea);
  assert.doesNotMatch(JSON.stringify(f.diagnostics),/PRIVATE|validationPath|days\[/);
 }
});

test('route area allowlist is independent and never logs a raw or partially matching path',async()=>{
 for(const area of ['root','day','people','times','locations','notes','contacts','unknown']){
  const f=fixture({run:async()=>{throw{engine:true,code:'invalid_schema',status:502,rejectionStage:'canonical_validation',rejectionReason:'canonical_schema',rejectionArea:area};}});
  await errorCode(await f.route(f.request(),'personal-dispo'),502,'invalid_schema');
  assert.equal(f.diagnostics[0].rejectionArea,area);
 }
 for(const area of [undefined,null,42,[],{},'days[0].times[0]','times\n','PRIVATE_PATH']){
  const f=fixture({run:async()=>{throw{engine:true,code:'invalid_schema',status:502,rejectionArea:area};}});
  await errorCode(await f.route(f.request(),'personal-dispo'),502,'invalid_schema');
  assert.equal(f.diagnostics[0].rejectionArea,'unknown');
  assert.doesNotMatch(JSON.stringify(f.diagnostics),/PRIVATE|days\[/);
 }
});

test('throwing diagnostic accessors cannot change the public response or escape to logs',async()=>{
 for(const property of ['rejectionStage','rejectionReason','rejectionArea','rejectionRule']){
  const error={engine:true,code:'invalid_schema',status:502};
  Object.defineProperty(error,property,{get(){throw new Error('PRIVATE_DIAGNOSTIC_GETTER');}});
  const f=fixture({run:async()=>{throw error;}});
  await errorCode(await f.route(f.request(),'personal-dispo'),502,'invalid_schema');
  assert.equal(f.diagnostics[0].rejectionStage,'unknown');assert.equal(f.diagnostics[0].rejectionReason,'other');assert.equal(f.diagnostics[0].rejectionArea,'unknown');
  assert.doesNotMatch(JSON.stringify(f.diagnostics),/PRIVATE/);
 }
});

test('route independently allowlists rule values and preserves every public response field',async()=>{
 for(const rule of ['record_id_invalid','record_id_duplicate','audience_form','audience_duplicate_reference','unknown',undefined,null,42,{},[],Symbol('PRIVATE'),()=> 'PRIVATE','record_id_invalid\n','PRIVATE_PATH']){
  const f=fixture({run:async()=>{throw{engine:true,code:'invalid_schema',status:502,rejectionStage:'canonical_validation',rejectionReason:'canonical_schema',rejectionArea:'times',rejectionRule:rule};}});
  await errorCode(await f.route(f.request(),'personal-dispo'),502,'invalid_schema');
  assert.equal(f.diagnostics[0].rejectionRule,['record_id_invalid','record_id_duplicate','audience_form','audience_duplicate_reference','unknown'].includes(rule)?rule:'unknown');
  assert.doesNotMatch(JSON.stringify(f.diagnostics),/PRIVATE|days\[/);
 }
 for(const [stage,code]of [['provider','invalid_schema'],['recovery','invalid_schema'],['canonical_validation','invalid_evidence']]){
  const f=fixture({run:async()=>{throw{engine:true,code,status:502,rejectionStage:stage,rejectionRule:'record_id_duplicate'};}});
  await errorCode(await f.route(f.request(),'personal-dispo'),502,code);assert.equal(f.diagnostics[0].rejectionRule,'unknown');
 }
});

test('route reads a stateful rule getter only once before logging',async()=>{
 let reads=0;
 const error={engine:true,code:'invalid_schema',status:502,rejectionStage:'canonical_validation',rejectionReason:'canonical_schema',rejectionArea:'times'};
 Object.defineProperty(error,'rejectionRule',{get(){reads++;return reads===1?'record_id_duplicate':'PRIVATE_RULE';}});
 const f=fixture({run:async()=>{throw error;}});
 await errorCode(await f.route(f.request(),'personal-dispo'),502,'invalid_schema');
 assert.equal(reads,1);assert.equal(f.diagnostics[0].rejectionRule,'record_id_duplicate');assert.doesNotMatch(JSON.stringify(f.diagnostics),/PRIVATE/);
});
