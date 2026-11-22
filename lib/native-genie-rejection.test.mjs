import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {nativeGenieEngineError} from './native-genie-engine.mjs';
import {AnalysisError} from './native-genie-core/personal/core.mjs';
import {createCompactPersonalDispoProvider} from './native-genie-core/personal/compact-provider.mjs';
import {createCompactWireContract} from './native-genie-core/personal/compact-wire.mjs';
import {PERSONAL_DISPO_SCHEMA} from './native-genie-core/personal/personal-dispo-strict-core.mjs';
import {executePersonalDispo} from './native-genie-core/personal/personal-dispo-core.mjs';
import {personalDispoSpans,personalDispoSchemaForSpans} from './native-genie-core/personal/personal-dispo-spans.mjs';
import {personalDispoTimesPlacesTestArgs} from './native-genie-core/personal/personal-dispo-times-places-test.mjs';

const text='DISPO 22.11.2026\nDrehbeginn 08:00\nProduktion\nMotive Studio Nord\n';
const input={schemaVersion:1,locale:'de',document:{id:'00000000-0000-4000-8000-000000000001',title:'Synthetic fixture only',sha256:createHash('sha256').update(text).digest('hex'),pages:[{number:1,text}]},analysisScope:{departmentIDs:['licht']}};
const spans=personalDispoSpans(input.document);
const schema=personalDispoTimesPlacesTestArgs({instructions:'fixture',context:{kind:'personal_dispo',analysisScope:{departmentIDs:['licht']}},schema:personalDispoSchemaForSpans(PERSONAL_DISPO_SCHEMA,spans)}).schema;
const wire=createCompactWireContract(schema,spans);
// Independently hand-authored raw wire: do not use the decoder's own encoder
// to generate its success fixture. Pin only the aliases used by this input.
assert.equal(wire.keyMapping.days,'f');assert.equal(wire.keyMapping.id,'k');
assert.equal(wire.enumMapping.shootingStart,'w');assert.equal(wire.enumMapping.general,'h');
assert.deepEqual(wire.spanMapping,{'p1-0-64':'a'});
const base={f:[{k:'d1',d:'2026-11-22',e:'22.11.2026',w:null,j:[{x:'a'}],s:[],z:[{k:'t1',l:'w',n:'08:00',b:{l:'h',t:[],h:[],A:null,j:[{x:'a'}]},j:[{x:'a'}]}],o:[],q:[],c:[]}]};
const changed=mutate=>{const value=structuredClone(base);mutate(value);return JSON.stringify(value);};
const cases=[
 {name:'valid_baseline',body:()=>JSON.stringify(base),code:'success'},
 {name:'duplicate_local_id',body:()=>changed(v=>{v.f[0].z[0].k='d1';}),code:'invalid_schema',stage:'canonical_validation',reason:'canonical_schema',area:'times'},
 {name:'day_id_over_canonical_limit',body:()=>changed(v=>{v.f[0].k='x'.repeat(101);}),code:'invalid_schema',stage:'canonical_validation',reason:'canonical_schema',area:'day'},
 {name:'motive_order_over_canonical_limit',body:()=>changed(v=>{v.f[0].o=[{k:'l1',l:'l',m:'Studio Nord',a:null,r:1001,b:{l:'h',t:[],h:[],A:null,j:[{x:'a'}]},j:[{x:'a'}]}];}),code:'invalid_schema',stage:'canonical_validation',reason:'canonical_schema',area:'locations'},
 {name:'audience_general_with_department',body:()=>changed(v=>{v.f[0].z[0].b.h=['Produktion'];}),code:'invalid_schema',stage:'canonical_validation',reason:'canonical_schema',area:'times'},
 {name:'wrong_wire_key',body:()=>changed(v=>{v.unexpected=[];}),code:'invalid_schema',stage:'compact_wire',reason:'wire_schema_mismatch',area:'unknown'},
 {name:'duplicate_wire_key',body:()=>'{"f":[],"f":[]}',code:'invalid_schema',stage:'compact_wire',reason:'duplicate_key',area:'unknown'},
 {name:'invalid_json',body:()=>'{',code:'provider_invalid_response',stage:'compact_wire',reason:'other',area:'unknown'},
 {name:'unsupported_clock',body:()=>changed(v=>{v.f[0].z[0].n='23:59';}),code:'invalid_evidence',stage:'recovery',reason:'other',area:'times'},
];

test('handwritten raw wire keeps successful output and identifies rejection boundaries without retries',async()=>{
 for(const fixture of cases){
  let generations=0,modelChecks=0;
  const provider=createCompactPersonalDispoProvider('synthetic-only',{promptVariant:'focused',fetchImpl:async(_url,init)=>{
   if(init.method==='GET'){modelChecks++;return Response.json({id:'gpt-6.1-sol'});}
   generations++;const request=JSON.parse(init.body);assert.deepEqual(request.text.format.schema,wire.schema);
   return Response.json({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:fixture.body()}]}]});
  }});
  if(fixture.code==='success'){
   const value=await executePersonalDispo(input,{provider});
   assert.equal(value.documentID,input.document.id);assert.equal(value.sourceSHA256,input.document.sha256);
   assert.equal(value.days[0].times[0].literal,'08:00');
   assert.deepEqual(value.analysisScope,{departmentIDs:['licht']});
  }else{
   await assert.rejects(executePersonalDispo(input,{provider}),error=>{
    assert.equal(error.code,fixture.code,fixture.name);assert.equal(error.status,502,fixture.name);
    assert.deepEqual(nativeGenieEngineError(error),{code:fixture.code,status:502,rejectionStage:fixture.stage,rejectionReason:fixture.reason,rejectionArea:fixture.area},fixture.name);
    return true;
   });
  }
  assert.equal(generations,1,fixture.name);assert.equal(modelChecks,1,fixture.name);
 }
});

test('only complete canonical path shapes map to a closed area without indices',()=>{
 for(const [validationPath,rejectionArea]of [
  ['root','root'],['days[0]','day'],['days[19]','day'],
  ['days[0].people[399]','people'],['days[0].times[1999]','times'],
  ['days[0].locations[299]','locations'],['days[0].notes[499]','notes'],['days[0].contacts[1999]','contacts'],
 ]){
  const error=new AnalysisError('invalid_schema',502);error.validationStage='validation';error.validationPath=validationPath;
  const result=nativeGenieEngineError(error);
  assert.deepEqual(result,{code:'invalid_schema',status:502,rejectionStage:'canonical_validation',rejectionReason:'canonical_schema',rejectionArea});
  assert.doesNotMatch(JSON.stringify(result),/days\[|validationPath/);
 }
});

test('partial, noncanonical, suffixed and hostile paths never become a known area',()=>{
 for(const path of [undefined,null,42,{},[],['times'],Symbol('PRIVATE'),()=> 'PRIVATE',
  'PRIVATE_PATH',' root','root\n','days[0]\n','days[0]\r\n','days[0].times[0]\n','days[0].times[0]\r\n',
  'days[0].times','days[0].times[0].audience','prefixdays[0]','days[-1]','days[01]','days[0].times[01]',
  'days[0].times[1e1]','days[0].times[Infinity]','days[0].times[0]\0','days['+'1'.repeat(101)+']']){
  const error=new AnalysisError('invalid_schema',502);error.validationStage='validation';error.validationPath=path;error.rejectionArea='people';
  assert.deepEqual(nativeGenieEngineError(error),{code:'invalid_schema',status:502,rejectionStage:'canonical_validation',rejectionReason:'canonical_schema',rejectionArea:'unknown'});
 }
});

test('engine independently allowlists stage/reason and does not trust a supplied area',()=>{
 const error=new AnalysisError('invalid_schema',502);
 error.rejectionStage='PRIVATE_SOURCE';error.rejectionReason={secret:'PRIVATE'};error.validationPath='PRIVATE_PATH';error.validationStage='validation';error.rejectionArea='people';
 assert.deepEqual(nativeGenieEngineError(error),{code:'invalid_schema',status:502,rejectionStage:'canonical_validation',rejectionReason:'canonical_schema',rejectionArea:'unknown'});
 error.validationStage='PRIVATE_STAGE';error.validationPath='days[0].times[0]';
 assert.deepEqual(nativeGenieEngineError(error),{code:'invalid_schema',status:502,rejectionStage:'unknown',rejectionReason:'other',rejectionArea:'unknown'});
 error.rejectionStage='compact_wire';error.rejectionReason='duplicate_key';
 assert.deepEqual(nativeGenieEngineError(error),{code:'invalid_schema',status:502,rejectionStage:'compact_wire',rejectionReason:'duplicate_key',rejectionArea:'unknown'});
 assert.equal(nativeGenieEngineError(new Error('PRIVATE_STACK')),null);
});

test('throwing diagnostic accessors cannot replace the original engine error',()=>{
 for(const property of ['rejectionStage','rejectionReason','validationStage','validationPath']){
  const error=new AnalysisError('invalid_schema',502);error.validationStage='validation';error.validationPath='days[0].times[0]';
  Object.defineProperty(error,property,{get(){throw new Error('PRIVATE_DIAGNOSTIC_GETTER');}});
  assert.deepEqual(nativeGenieEngineError(error),{code:'invalid_schema',status:502,rejectionStage:'unknown',rejectionReason:'other',rejectionArea:'unknown'});
 }
});

test('stateful diagnostic getters are captured once before the independent engine allowlists',()=>{
 const error=new AnalysisError('invalid_schema',502);const reads={stage:0,reason:0,validation:0,path:0};
 Object.defineProperties(error,{
  validationStage:{get(){reads.validation++;return reads.validation===1?'validation':'PRIVATE_VALIDATION';}},
  rejectionStage:{get(){reads.stage++;return reads.stage===1?'canonical_validation':'PRIVATE_STAGE';}},
  rejectionReason:{get(){reads.reason++;return reads.reason===1?'canonical_schema':'PRIVATE_REASON';}},
  validationPath:{get(){reads.path++;return reads.path===1?'days[0].times[0]':'PRIVATE_PATH';}},
 });
 const result=nativeGenieEngineError(error);
 assert.deepEqual(result,{code:'invalid_schema',status:502,rejectionStage:'canonical_validation',rejectionReason:'canonical_schema',rejectionArea:'times'});
 assert.deepEqual(reads,{stage:1,reason:1,validation:1,path:1});
 assert.doesNotMatch(JSON.stringify(result),/PRIVATE|days\[/);
});
