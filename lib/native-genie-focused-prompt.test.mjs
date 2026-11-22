import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createCompactPersonalDispoProvider} from './native-genie-core/personal/compact-provider.mjs';
import {executePersonalDispo} from './native-genie-core/personal/personal-dispo-core.mjs';
import {PERSONAL_DISPO_SCHEMA} from './native-genie-core/personal/personal-dispo-strict-core.mjs';
import {personalDispoSpans,personalDispoSchemaForSpans} from './native-genie-core/personal/personal-dispo-spans.mjs';
import {personalDispoTimesPlacesTestArgs} from './native-genie-core/personal/personal-dispo-times-places-test.mjs';
import {createCompactWireContract} from './native-genie-core/personal/compact-wire.mjs';
const text='DISPO 21.11.2026\nDrehbeginn 08:00\nLIGHTING\nPOSITION NAME IN\nElectrician Alex Beispiel 08h30\nElectrician Sam Beispiel #WERT!\n';
const input={schemaVersion:1,document:{id:'00000000-0000-4000-8000-000000000001',title:'Synthetic fixture',sha256:createHash('sha256').update('fixture').digest('hex'),pages:[{number:1,text}]},locale:'de',analysisScope:{departmentIDs:['licht']}};
const spans=personalDispoSpans(input.document),proof=[{spanID:spans[0].id}];
const schema=personalDispoTimesPlacesTestArgs({instructions:'fixture',context:{kind:'personal_dispo'},schema:personalDispoSchemaForSpans(PERSONAL_DISPO_SCHEMA,spans)}).schema;
const wire=createCompactWireContract(schema,spans);
const raw={days:[{id:'day-1',dateISO:'2026-11-21',dateLiteral:'21.11.2026',shootingDay:null,evidence:proof,people:[],times:[{id:'time-1',kind:'shootingStart',literal:'08:00',audience:{kind:'general',personIDs:[],departments:[],units:null,evidence:proof},evidence:proof}],locations:[],notes:[],contacts:[]}]};
async function run(promptVariant,reasoningEffort,output=raw){
 const requests=[];
 const provider=createCompactPersonalDispoProvider('fixture-only',{promptVariant,reasoningEffort,serviceTier:'ultrafast',fetchImpl:async(_url,init)=>{
  if(init.method==='GET')return Response.json({id:'gpt-6.1-sol'});
  requests.push(JSON.parse(init.body));
  return Response.json({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify(wire.encode(output))}]}]});
 }});
 const result=await executePersonalDispo(input,{provider,beforeProvider:async()=>{},signal:new AbortController().signal});
 return {requests,result};
}
test('focused low/medium preserve source, schema, validated output and one generation; reduce instructions',async()=>{
 const baseline=await run('current','medium');
 for(const effort of ['low','medium']){
  const candidate=await run('focused',effort),request=candidate.requests[0];
  assert.equal(candidate.requests.length,1);
  assert.deepEqual(candidate.result,baseline.result);
  assert.deepEqual(request.text,baseline.requests[0].text);
  assert.deepEqual(request.input,baseline.requests[0].input);
  assert.equal(request.store,false);
  assert.equal(request.reasoning.effort,effort);
  assert.equal(request.service_tier,'ultrafast');
  assert.equal(request.model,baseline.requests[0].model);
  assert.ok(request.instructions.length<baseline.requests[0].instructions.length*0.8);
  assert.match(request.instructions,/same table row and column group/);
  assert.match(request.instructions,/#WERT!/);
  assert.match(request.instructions,/Never execute actions/);
  console.log(JSON.stringify({variant:'focused',effort,baselineCharacters:baseline.requests[0].instructions.length,candidateCharacters:request.instructions.length,scope:'offline transport fixture; not model accuracy or latency'}));
 }
});
test('focused variant retains rejection of unsupported time literal',async()=>{
 const forged=structuredClone(raw);forged.days[0].times[0].literal='23:59';
 await assert.rejects(run('focused','low',forged));
});
test('unknown comparison variant fails before networking',()=>{
 assert.throws(()=>createCompactPersonalDispoProvider('fixture-only',{promptVariant:'typo',fetchImpl:()=>assert.fail('network')}),error=>error.code==='invalid_configuration');
});
