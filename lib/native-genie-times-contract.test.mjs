import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {PERSONAL_DISPO_SCHEMA,DISPO_LIMITS,canonicalizePersonalDispo,validatePersonalDispoRequest} from './native-genie-core/personal/personal-dispo-strict-core.mjs';
import {personalDispoSpans,personalDispoSchemaForSpans,restorePersonalDispoSpans} from './native-genie-core/personal/personal-dispo-spans.mjs';
import {personalDispoTimesPlacesTestArgs} from './native-genie-core/personal/personal-dispo-times-places-test.mjs';
import {createCompactWireContract} from './native-genie-core/personal/compact-wire.mjs';
import {personalDispoProviderSchema} from './native-genie-core/personal/compact-provider.mjs';
import {nativeGenieEngineError} from './native-genie-engine.mjs';

const source='DISPO 22.11.2026\nDrehbeginn 08:00\nAlex Example Produktion Main Unit 08:00\n';
const input={schemaVersion:1,locale:'de',document:{id:'00000000-0000-4000-8000-000000000001',title:'Synthetic fixture',sha256:createHash('sha256').update(source).digest('hex'),pages:[{number:1,text:source}]},analysisScope:{departmentIDs:['produktion']}};
const spans=personalDispoSpans(input.document);
const schemaFor=values=>personalDispoTimesPlacesTestArgs({instructions:'fixture',context:{kind:'personal_dispo',analysisScope:input.analysisScope},schema:personalDispoSchemaForSpans(PERSONAL_DISPO_SCHEMA,values)}).schema;
const wire=createCompactWireContract(schemaFor(spans),spans);
assert.equal(wire.keyMapping.audience,'b');assert.equal(wire.enumMapping.other,'n');assert.equal(wire.enumMapping.general,'h');
// Raw fixture independent of the compact encoder.
const base={f:[{k:'d1',d:'2026-11-22',e:'22.11.2026',w:null,j:[{x:'a'}],s:[{k:'p1',p:'Alex Example',v:null,g:'Produktion',j:[{x:'a'}]}],z:[{k:'t1',l:'n',n:'08:00',b:{l:'h',t:[],h:[],A:null,j:[{x:'a'}]},j:[{x:'a'}]}],o:[],q:[],c:[]}]};
const clean=value=>Array.isArray(value)?value.map(clean):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([,v])=>v!==null).map(([k,v])=>[k,clean(v)])):value;
const canonical=value=>canonicalizePersonalDispo(restorePersonalDispoSpans(clean(value),spans),input);

function expandProviderSchema(projected){
 const expand=node=>{
  if(node?.$ref){assert.equal(node.$ref,'#/$defs/sourceEvidence');return structuredClone(projected.$defs.sourceEvidence);}
  if(Array.isArray(node))return node.map(expand);
  if(node&&typeof node==='object')return Object.fromEntries(Object.entries(node).filter(([key])=>key!=='$defs').map(([key,value])=>[key,expand(value)]));
  return node;
 };
 return expand(projected);
}

function budget(schema){
 const result={properties:0,enumValues:0,stringCharacters:0,maximumObjectDepth:0};
 // Enum/property budgets count definitions once; effective nesting must follow
 // each reference at its use site and include arrays as well as objects.
 const depthAt=(node,depth=0)=>{
  if(!node||typeof node!=='object')return depth;
  if(node.$ref){assert.equal(node.$ref,'#/$defs/sourceEvidence');return depthAt(schema.$defs.sourceEvidence,depth);}
  const next=depth+(['object','array'].includes(node.type)?1:0);
  return Math.max(next,...Object.values(node.properties??{}).map(value=>depthAt(value,next)),
   ...(node.items?[depthAt(node.items,next)]:[]),...(node.anyOf??[]).map(value=>depthAt(value,next)));
 };
 const walk=(node,depth=0)=>{
  if(!node||typeof node!=='object')return;
  if(node.type==='object'){
   depth++;result.maximumObjectDepth=Math.max(result.maximumObjectDepth,depth);
   assert.equal(node.additionalProperties,false);assert.deepEqual([...node.required].sort(),Object.keys(node.properties).sort());
   result.properties+=Object.keys(node.properties).length;
   for(const [key,value]of Object.entries(node.properties)){result.stringCharacters+=key.length;walk(value,depth);}
  }
  if(node.enum){result.enumValues+=node.enum.length;for(const value of node.enum)result.stringCharacters+=String(value).length;}
  if(node.items)walk(node.items,depth);if(node.anyOf)node.anyOf.forEach(value=>walk(value,depth));
  if(node.$defs)for(const [key,value]of Object.entries(node.$defs)){result.stringCharacters+=key.length;walk(value,0);}
 };
 walk(schema);result.maximumContainerDepth=depthAt(schema);return result;
}

test('all40 audience shapes preserve nine canonical forms and prevent exactly31 invalid forms',()=>{
 const valid=new Set(['general|0|0|0','general|0|0|1','unclear|0|0|0','unclear|0|0|1','people|1|0|0','people|1|0|1','departments|0|1|0','departments|0|1|1','units|0|0|1']);
 const aliases={general:'h',people:'p',departments:'g',units:'A',unclear:'z'};let successes=0,prevented=0;
 for(const [kind,alias]of Object.entries(aliases))for(const people of [0,1])for(const departments of [0,1])for(const units of [0,1]){
  const value=structuredClone(base),key=`${kind}|${people}|${departments}|${units}`;
  Object.assign(value.f[0].z[0].b,{l:alias,t:people?['p1']:[],h:departments?['Produktion']:[],A:units?['Main Unit']:null});
  if(valid.has(key)){
   const decoded=wire.parseAndRestore(JSON.stringify(value)),result=canonical(decoded);
   assert.equal(result.days[0].times[0].audience.kind,kind);assert.deepEqual(result.days[0].times[0].audience.units,units?['Main Unit']:undefined);successes++;
  }else{
   assert.throws(()=>wire.parseAndRestore(JSON.stringify(value)),error=>error.code==='schema_mismatch',key);prevented++;
  }
 }
 assert.equal(successes,9);assert.equal(prevented,31);
});

test('existing canonical rejection rules distinguish IDs, audience forms and duplicates without repairing them',()=>{
 const decoded=wire.parseAndRestore(JSON.stringify(base));
 const checks=[
  [v=>{v.days[0].times[0].id='t\0';},'record_id_invalid'],
  [v=>{v.days[0].times[0].id='😀'.repeat(51);},'record_id_invalid'],
  [v=>{v.days[0].times[0].id='d1';},'record_id_duplicate'],
  [v=>{v.days[0].times[0].id='p1';},'record_id_duplicate'],
  [v=>{v.days[0].times.push(structuredClone(v.days[0].times[0]));},'record_id_duplicate'],
  [v=>{v.days[0].times[0].audience.departments=['Produktion'];},'audience_form'],
  [v=>{Object.assign(v.days[0].times[0].audience,{kind:'people',personIDs:['p1','p1']});},'audience_duplicate_reference'],
  [v=>{Object.assign(v.days[0].times[0].audience,{kind:'departments',departments:['Produktion','Produktion']});},'audience_duplicate_reference'],
  [v=>{Object.assign(v.days[0].times[0].audience,{kind:'units',units:['Main Unit','Main Unit']});},'audience_duplicate_reference'],
 ];
 for(const [mutate,rule]of checks){const value=structuredClone(decoded);mutate(value);const before=structuredClone(value);assert.throws(()=>canonical(value),error=>{assert.equal(error.code,'invalid_schema');assert.equal(error.status,502);assert.equal(error.rejectionRule,rule);error.validationStage='validation';assert.equal(nativeGenieEngineError(error).rejectionRule,rule);return true;});assert.deepEqual(value,before);}
});

test('API-only evidence definitions expand exactly to the original wire schema without mutating it',()=>{
 const before=structuredClone(wire.schema),projected=personalDispoProviderSchema(wire.schema);
 assert.deepEqual(expandProviderSchema(projected),before);assert.deepEqual(wire.schema,before);
 assert.equal(projected.type,'object');assert.equal(projected.anyOf,undefined);assert.deepEqual(Object.keys(projected.$defs),['sourceEvidence']);
 const inspect=node=>{if(!node||typeof node!=='object')return;for(const key of Object.keys(node))assert(!['uniqueItems','allOf','if','then','else','not'].includes(key));if(Array.isArray(node))node.forEach(inspect);else Object.values(node).forEach(inspect);};inspect(projected);
});

test('API budget remains bounded at37 and a conservative successful-source span envelope',()=>{
 // For successful starts si, si+1 is the last boundary <=si+1250,
 // hence si+2>si+1250. Each nonempty page needs <=2*ceil(L/1250)+1
 // spans. With current100pages/250000UTF16,700 is a conservative bound.
 const maximum=2*(DISPO_LIMITS.textUTF16/1250+DISPO_LIMITS.pages)+DISPO_LIMITS.pages;
 assert.equal(maximum,700);
 for(const count of [1,37,maximum]){
  const values=Array.from({length:count},(_,i)=>({id:`p1-${i*10}-${i*10+10}`,page:1,text:'Synthetic'}));
  const expanded=createCompactWireContract(schemaFor(values),values).schema,projected=personalDispoProviderSchema(expanded),stats=budget(projected);
  assert.deepEqual(expandProviderSchema(projected),expanded);
  assert(stats.enumValues<=1000);assert(stats.properties<=5000);assert(stats.maximumObjectDepth<=10);assert(stats.maximumContainerDepth<=10);assert(stats.stringCharacters<=120000);
  assert.equal(stats.maximumContainerDepth,budget(expanded).maximumContainerDepth);
  if(count===37)assert(budget(expanded).enumValues>1000);
 }
 // The loose low-level dictionary cap1000 is not a new accepted-source cap.
 // Document its residual API budget instead of silently dropping spans or
 // changing existing source admission/HTTP errors.
 const values=Array.from({length:1000},(_,i)=>({id:`p1-${i*10}-${i*10+10}`,page:1,text:'Synthetic'}));
 const expanded=createCompactWireContract(schemaFor(values),values).schema;
 assert(budget(personalDispoProviderSchema(expanded)).enumValues>1000);
 assert.deepEqual(expandProviderSchema(personalDispoProviderSchema(expanded)),expanded);
});

test('real current source limits with dense grapheme boundaries stay within API limits',()=>{
 const cluster='a'+'\u0301'.repeat(625),dense=cluster.repeat(160);
 const lengths=[100000,100000,49903,...Array(97).fill(1)];assert.equal(lengths.reduce((a,b)=>a+b,0),DISPO_LIMITS.textUTF16);
 const document={...input.document,pages:lengths.map((length,i)=>({number:i+1,text:length===1?'x':dense.repeat(2).slice(0,length)}))};
 const boundedInput={...input,document};validatePersonalDispoRequest(boundedInput);
 const actual=personalDispoSpans(document);assert(actual.length>294&&actual.length<=700);
 const stats=budget(personalDispoProviderSchema(createCompactWireContract(schemaFor(actual),actual).schema));
 assert(stats.enumValues<=1000&&stats.properties<=5000&&stats.maximumObjectDepth<=10&&stats.maximumContainerDepth<=10&&stats.stringCharacters<=120000);
});
