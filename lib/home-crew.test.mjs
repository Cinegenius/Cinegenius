import test from 'node:test';
import assert from 'node:assert/strict';
import {homeCrewFixture} from './home-crew-fixture.mjs';
import {profileAccess} from './profile-privacy.ts';
const now=Date.parse('2026-11-20T12:00:00Z');
const person=(id,created_at='2025-01-01T00:00:00Z')=>({user_id:id,created_at,display_name:`Person ${id}`,slug:id,avatar_url:`/api/media/profile-media/${id}`,profile_type:'lighting',profile_types:['lighting'],positions:['Best Boy Electric'],location:'private location sentinel',crew:null});
function fixture(rows,{settings=new Map(),failure,privacyFailure=false}={}){
 const reads=[],accessReads=[];
 const db={from(table){assert.ok(['profiles','user_settings'].includes(table));let fields,ids,from=0,to=Infinity,signal;const predicates=[];
 const q={select(value){fields=value;return q},not(key,_op,value){predicates.push(p=>p[key]!==value);return q},neq(key,value){predicates.push(p=>p[key]!==value);return q},order(){return q},range(a,b){from=a;to=b;return q},in(_key,value){ids=value;return q},abortSignal(value){signal=value;return q},then(resolve,reject){
  if(table==='user_settings')return Promise.resolve({data:[],error:null}).then(resolve,reject);
  reads.push({fields,ids,from,to,signal});
  const error=failure?.({fields,ids,from});
  let data=rows.filter(p=>predicates.every(predicate=>predicate(p))&&(!ids||ids.includes(p.user_id))).sort((a,b)=>a.user_id.localeCompare(b.user_id)).slice(from,to+1);
  data=data.map(p=>Object.fromEntries(fields.split(',').map(key=>[key,p[key]??null])));
  return Promise.resolve({data:error?null:data,error:error??null}).then(resolve,reject);
 }};return q}};
 const service=homeCrewFixture(db,async(ids,viewer,options)=>{assert.equal(viewer,null);assert.equal(options.throwOnError,true);accessReads.push(ids);if(privacyFailure)throw new Error('permission failure');return new Map(ids.map(id=>[id,profileAccess(settings.get(id)??null,id,null)]));});
 return {read:(preferred=null)=>service.homeCrewProfiles(now,preferred),reads,accessReads,settings};
}
test('the whole thin pool is paged, including profiles older than the former 300 limit; only small card batches are loaded',async()=>{
 const rows=Array.from({length:620},(_,i)=>person(`id-${String(i).padStart(4,'0')}`));
 const f=fixture(rows);const result=await f.read();
 assert.equal(result.data.length,10);assert.equal(new Set(result.data.map(p=>p.user_id)).size,10);
 assert.deepEqual(f.reads.filter(r=>!r.ids).map(r=>[r.fields,r.from,r.to]),[['user_id',0,499],['user_id',500,999]]);
 assert.ok(result.data.some(p=>Number(p.user_id.slice(3))>300));
 assert.equal(f.reads.filter(r=>r.ids).length,1);assert.equal(f.reads.find(r=>r.ids).ids.length,32);
 assert.ok(f.reads.every(r=>r.signal instanceof AbortSignal));
});
test('hidden, Ghost, members-only and non-person candidates never fill cards; later batches replace them',async()=>{
 const rows=Array.from({length:44},(_,i)=>person(`id-${i}`,new Date(now-i*1000).toISOString()));
 const settings=new Map();for(let i=0;i<33;i++)settings.set(`id-${i}`,i%3===0?{ghost_mode:true}:i%3===1?{profile_visibility:'private'}:{profile_visibility:'members'});
 rows[33].profile_type='company';rows[33].profile_types=['company'];rows[33].positions=[];
 settings.set('id-34',{location_visibility:'hidden'});
 const f=fixture(rows,{settings});const result=await f.read();
 assert.equal(result.data.length,10);
 assert.ok(result.data.every(p=>Number(p.user_id.slice(3))>=34));
 const hiddenLocation=result.data.find(p=>p.user_id==='id-34');assert.ok(hiddenLocation);assert.equal(hiddenLocation.location,null);
 assert.ok(f.accessReads.length>=2);
});
test('a new request rechecks withdrawal without cached visibility or reusing a selected old snapshot',async()=>{
 const rows=Array.from({length:12},(_,i)=>person(`id-${i}`,new Date(now-i*1000).toISOString()));
 const f=fixture(rows);const first=await f.read();const withdrawn=first.data[0].user_id;
 f.settings.set(withdrawn,{ghost_mode:true});const second=await f.read();
 assert.equal(second.data.length,10);assert.ok(!second.data.some(p=>p.user_id===withdrawn));assert.equal(f.accessReads.length,2);
});
test('pool, card or permission errors fail rather than claim a successful incomplete result',async()=>{
 const rows=Array.from({length:510},(_,i)=>person(`id-${i}`));
 for(const options of [{failure:r=>r.from===500?new Error('pool failed'):null},{failure:r=>r.ids?new Error('cards failed'):null},{privacyFailure:true}])await assert.rejects(()=>fixture(rows,options).read());
 const empty=fixture([]);assert.deepEqual((await empty.read()).data,[]);assert.equal(empty.accessReads.length,0);
});

test('country priority reaches older distant pool rows and never ranks by a hidden location',async()=>{
 const rows=Array.from({length:520},(_,i)=>({...person(`id-${String(i).padStart(4,'0')}`,new Date(now-1000).toISOString()),place_country_code:'DE'}));
 rows.push({...person('mexico'),place_country_code:'MX'},{...person('hidden-place'),place_country_code:'MX'},{...person('ghost'),place_country_code:'MX'});
 const settings=new Map([['hidden-place',{location_visibility:'hidden'}],['ghost',{ghost_mode:true}]]);
 const f=fixture(rows,{settings});const preferred={country:'MX',region:'',city:''};
 const first=await f.read(preferred);
 assert.equal(first.data[0].user_id,'mexico');assert.equal(first.data.length,10);
 assert.ok(!first.data.some(row=>row.user_id==='ghost'||row.user_id==='hidden-place'));
 assert.ok(f.reads.filter(read=>!read.ids).every(read=>read.fields.includes('place_country_code')));
 assert.ok(f.accessReads.every(ids=>ids.length<=200));
 settings.set('mexico',{ghost_mode:true});
 assert.ok(!(await f.read(preferred)).data.some(row=>row.user_id==='mexico'));
});
