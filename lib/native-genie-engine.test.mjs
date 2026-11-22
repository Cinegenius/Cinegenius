import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createNativeGenieEngine,validateNativeGenieInput} from './native-genie-engine.mjs';
import {WORK_KINDS} from './native-genie-core/work/work-task-core.mjs';
import {executePersonalDispo} from './native-genie-core/personal/personal-dispo-core.mjs';
import {PERSONAL_DISPO_SCHEMA} from './native-genie-core/personal/personal-dispo-strict-core.mjs';
import {personalDispoSpans,personalDispoSchemaForSpans} from './native-genie-core/personal/personal-dispo-spans.mjs';
import {personalDispoTimesPlacesTestArgs} from './native-genie-core/personal/personal-dispo-times-places-test.mjs';
import {createCompactWireContract} from './native-genie-core/personal/compact-wire.mjs';

const uuid='00000000-0000-4000-8000-000000000001';
const text='DISPO 21.11.2026\nDrehbeginn 08:00\nNur synthetische Quelle.\n';
const hash=createHash('sha256').update('synthetic-pdf-bytes').digest('hex');
const document=()=>({id:uuid,title:'Synthetic fixture',sha256:hash,pages:[{number:1,text}]});
const input=()=>({schemaVersion:1,document:document(),locale:'de',analysisScope:{departmentIDs:['licht']}});
const work=()=>({schemaVersion:1,requestID:uuid,kind:WORK_KINDS[0],locale:'de',documents:[],facts:[],parameters:{prompt:'',selectedFactIDs:[],selectedSceneIDs:[],selectedPersonOccurrenceIDs:[],departmentIDs:[],sourcePins:[],constraints:[],includeUnreviewed:false}});
test('real validators preserve source and scope limits and reject unexpected request fields',()=>{
 validateNativeGenieInput('personal-dispo',input());validateNativeGenieInput('work-task',work());
 for(const value of [{...input(),accountID:'user_Spoof'}, {...input(),analysisScope:{departmentIDs:['made-up']}}, {...input(),document:{...document(),sha256:'forged'}}, {...input(),document:{...document(),pages:Array.from({length:101},(_,i)=>({number:i+1,text:'x'}))}}]){
  assert.throws(()=>validateNativeGenieInput('personal-dispo',value));
 }
});
test('work with no eligible facts returns the existing insufficient-information result without a provider call',async()=>{
 let calls=0,reservations=0;
 const engine=createNativeGenieEngine('fixture-only',{fetchImpl:async()=>{calls++;assert.fail('No facts must not trigger paid work');}});
 const result=await engine('work-task',work(),{signal:new AbortController().signal,beforeProvider:async()=>reservations++});
 assert.equal(result.status,'insufficientInformation');assert.equal(calls,0);assert.equal(reservations,0);
});
test('actual compact pipeline keeps model/tier/source and refuses an empty generated analysis',async()=>{
 const calls=[];let reservations=0;
 const engine=createNativeGenieEngine('fixture-only',{fetchImpl:async(url,init)=>{
  calls.push({url,init});
  if(init.method==='GET')return Response.json({id:'gpt-6.1-sol'});
  const request=JSON.parse(init.body),key=request.text.format.schema.required[0];
  return Response.json({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify({[key]:[]})}]}]});
 }});
 await assert.rejects(engine('personal-dispo',input(),{signal:new AbortController().signal,beforeProvider:async()=>reservations++}),error=>error.code==='no_source_structure');
 assert.equal(reservations,1);assert.equal(calls.length,2,'One model-capability GET, one generation, no retries');
 const request=JSON.parse(calls[1].init.body);
 assert.equal(request.model,'gpt-6.1-sol');assert.equal(request.reasoning.effort,'medium');assert.equal(request.service_tier,'ultrafast');assert.equal(request.store,false);
 const context=JSON.parse(request.input[0].content[0].text);
 assert.equal(context.sourceSpans.map(s=>s.text).join(''),text,'Complete original source, no summarization or trimming');
 assert.equal(context.analysisScope.departmentIDs[0],'licht');
 assert.match(request.instructions,/notes=\[\] and contacts=\[\]/);
 assert.match(request.instructions,/same table row and column group/);
 assert.doesNotMatch(request.instructions,/EXPLICIT PRE-ANALYSIS DEPARTMENT SELECTION/);
});
test('core source restoration rejects forged references even when provider structure is otherwise plausible',async()=>{
 await assert.rejects(executePersonalDispo(input(),{signal:new AbortController().signal,beforeProvider:async()=>{},provider:async()=>({days:[{id:'fixture-day',dateISO:null,dateLiteral:null,shootingDay:null,evidence:[{spanID:'p999-0-4'}],people:[],times:[],locations:[],notes:[],contacts:[]}]})}),error=>error.code==='invalid_evidence');
});
test('real compact decoder and source validators return the original document/hash/scope for a grounded success',async()=>{
 const spans=personalDispoSpans(document()),proof=[{spanID:spans[0].id}];
 const args=personalDispoTimesPlacesTestArgs({instructions:'fixture',context:{kind:'personal_dispo',analysisScope:{departmentIDs:['licht']}},schema:personalDispoSchemaForSpans(PERSONAL_DISPO_SCHEMA,spans)});
 const wire=createCompactWireContract(args.schema,spans);
 const raw={days:[{id:'day-1',dateISO:'2026-11-21',dateLiteral:'21.11.2026',shootingDay:null,evidence:proof,people:[],times:[{id:'time-1',kind:'shootingStart',literal:'08:00',audience:{kind:'general',personIDs:[],departments:[],units:null,evidence:proof},evidence:proof}],locations:[],notes:[],contacts:[]}]};
 const encoded=wire.encode(raw);let calls=0;
 const engine=createNativeGenieEngine('fixture-only',{fetchImpl:async(_url,init)=>{
  calls++;if(init.method==='GET')return Response.json({id:'gpt-6.1-sol'});
  return Response.json({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify(encoded)}]}]});
 }});
 const result=await engine('personal-dispo',input(),{signal:new AbortController().signal,beforeProvider:async()=>{}});
 assert.equal(calls,2);assert.equal(result.documentID,uuid);assert.equal(result.sourceSHA256,hash);
 assert.deepEqual(result.analysisScope,{departmentIDs:['licht']});assert.equal(result.days[0].times[0].literal,'08:00');
 assert.ok(text.includes(result.days[0].times[0].evidence[0].quote));
});
test('aborted analysis is refused before the first provider reservation',async()=>{
 const controller=new AbortController();controller.abort();let calls=0,reservations=0;
 const engine=createNativeGenieEngine('fixture-only',{fetchImpl:async()=>{calls++;assert.fail('aborted');}});
 await assert.rejects(engine('personal-dispo',input(),{signal:controller.signal,beforeProvider:async()=>reservations++}));
 assert.equal(calls,0);assert.equal(reservations,0);
});
