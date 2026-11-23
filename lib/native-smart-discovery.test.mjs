import * as seed from './discovery-seed.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as contract from './native-smart-discovery.ts';
import * as unified from './unified-search.ts';
import * as matching from './unified-search-matching.ts';
import * as access from './unified-search-access.ts';
import * as occupations from './crew-occupations.ts';
import * as mapPoints from './places/public-map-point.ts';
import * as core from './places/core.ts';
import {placeWriteFields} from './places/catalog.ts';
import * as browseFilters from './browse-filters.ts';
import * as discoveryRequest from './native-smart-discovery-request.ts';

function load(file,mocks,globals={}){const mod={exports:{}};const context=vm.createContext({Request,Response,URL,AbortController,AbortSignal,Date,process:{env:{ADMIN_USER_IDS:'admin'}},...globals});const text=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new vm.Script('(function(require,module,exports){'+text+'\n})').runInContext(context)(id=>{assert.ok(id in mocks,'unexpected dependency '+id);return mocks[id]},mod,mod.exports);return mod.exports}
const groups=()=>contract.nativeDiscoveryPlan().searches.map((wish,wishIndex)=>({area:wish.area,wishIndex,label:wish.query,results:[],nextOffset:null}));
const result=(id,extra={})=>({id,title:id,subtitle:'',type:'profile',price:0,image:null,available:null,...extra});
function fixture(options={}){
 const calls=[];const db={from(table){calls.push(['table',table]);const q={select(columns){calls.push(['select',columns]);return q},eq(key,value){calls.push(['eq',key,value]);return q},abortSignal(signal){calls.push(['profile-signal',signal]);return q},maybeSingle:async()=>{if(options.profileWait)await options.profileWait;return{data:options.profile??null,error:options.profileError?{}:null}}};return q}};
 const server=load('lib/native-smart-discovery-server.ts',{'./discovery-seed':seed,'server-only':{},'@/lib/db':{db},'@/lib/crew-occupations':occupations,'@/lib/places/public-map-point':mapPoints,'@/lib/places/core':core,'@/lib/unified-search-server':{executeUnifiedSearch:async(...args)=>{calls.push(['execute',...args]);if(options.searchWait)await options.searchWait;if(options.searchError)throw Error('no');return{groups:options.groups??groups()}}},'./native-smart-discovery':contract});
 const route=load('app/api/native/v1/discovery/route.ts',{'@/lib/browse-filters':browseFilters,'@/lib/native-smart-discovery-request':discoveryRequest,'@/lib/discovery-seed':seed,'next-intl/server':{getLocale:async()=>'de'},'@/lib/auth':{getCurrentUser:async()=>options.actor?{userId:options.actor}:null},'@/lib/unified-search-access':access,'@/lib/rateLimit':{rateLimit:async()=>{calls.push(['rate']);return{allowed:!options.limited}}},'@/lib/native-smart-discovery-server':server,'@/lib/native-smart-discovery':contract});return{server,route,calls};
}
const request=(actor='admin',query='',headers={})=>new Request('https://cinegenius.co/api/native/v1/discovery'+query,{headers:{'X-CineGenius-Native-Discovery':contract.NATIVE_DISCOVERY_CONTRACT,'X-Native-Account':actor,...headers}});

test('valid discovery seed is preserved end-to-end and stale/forged seeds fail before reads',async()=>{
 const value='0123456789abcdef0123456789abcdef',f=fixture({actor:'admin'});
 const response=await f.route.GET(request('admin',`?focus=neutral&seed=${value}`));assert.equal(response.status,200);
 const data=await response.json();assert.equal(data.seed,value);assert.ok(contract.readNativeDiscovery(data,'admin',value));
 assert.equal(contract.readNativeDiscovery(data,'admin','a'.repeat(32)),null);assert.equal(f.calls.find(call=>call[0]==='execute')[7],value);
 assert.equal(JSON.stringify(f.calls.find(call=>call[0]==='execute')[8]),JSON.stringify({version:1}),'initial public facets use the same reader without a second search or a changed plan/seed');
 for(const query of ['?seed=bad',`?seed=${value}&seed=${value}`]){const invalid=fixture({actor:'admin'});assert.equal((await invalid.route.GET(request('admin',query))).status,400);assert.equal(invalid.calls.length,0)}
});

test('the landing plan reuses six generic existing v1 wishes with no hard department/place filter or model',()=>{
 const plan=contract.nativeDiscoveryPlan();assert.deepEqual(unified.readSearchPlan(plan),plan);assert.equal(plan.version,1);assert.equal(plan.searches.length,6);assert.ok(plan.searches.every(w=>!w.department&&!w.places.length&&!matching.wishSearchTerms(w).length));assert.deepEqual(plan.searches.map(w=>w.area),['crew','marketplace','locations','companies','jobs','projects']);
});
test('soft focus never removes IDs, mutates result facts, grants availability or changes pagination',()=>{
 const rows=[result('far',{facets:{departments:['kamera']},mapPoint:{lat:48.1,lng:11.5}}),result('matching',{facets:{departments:['licht']},mapPoint:null}),result('near',{facets:{departments:['kamera']},mapPoint:{lat:52.52,lng:13.4}})];const original=JSON.stringify(rows);const input=[{area:'crew',wishIndex:0,label:'Crew',results:rows,nextOffset:180}];const ranked=contract.rankNativeDiscoveryGroups(input,{mode:'profile',departments:['licht'],city:'Berlin'},{lat:52.52,lng:13.4});assert.deepEqual(ranked[0].results.map(r=>r.id),['matching','near','far']);assert.equal(ranked[0].nextOffset,180);assert.equal(JSON.stringify(rows),original);assert.ok(ranked[0].results.every(r=>r.available===null));assert.equal(contract.rankNativeDiscoveryGroups(input,{mode:'neutral',departments:[],city:null},null),input);
});
test('guests and normal members cannot reach profile/query/map aggregation through the new endpoint',async()=>{
 for(const actor of[null,'member']){const f=fixture({actor});const response=await f.route.GET(request(actor??'guest'));assert.equal(response.status,actor?403:401);assert.equal(f.calls.length,0);assert.match(response.headers.get('cache-control'),/no-store/)}
});
test('admin account/contract/query/rate guards run before any profile or search request',async()=>{
 for(const[query,headers,status]of[['',{'X-Native-Account':'other'},409],['',{'X-CineGenius-Native-Discovery':'wrong'},400],['?focus=secret',{},400],['?focus=profile&focus=neutral',{},400],['?lat=52',{},400]]){const f=fixture({actor:'admin'});assert.equal((await f.route.GET(request('admin',query,headers))).status,status);assert.equal(f.calls.length,0)}const f=fixture({actor:'admin',limited:true});assert.equal((await f.route.GET(request())).status,429);assert.deepEqual(f.calls,[['rate']]);
});
test('neutral is explicit and never loads a private profile; results are accountbound no-store',async()=>{
 const f=fixture({actor:'admin'});const response=await f.route.GET(request('admin','?focus=neutral'));assert.equal(response.status,200);const data=await response.json();assert.ok(contract.readNativeDiscovery(data,'admin'));assert.equal(contract.readNativeDiscovery(data,'other'),null);assert.equal(data.focus.mode,'neutral');assert.equal(f.calls.some(c=>c[0]==='table'),false);const call=f.calls.find(c=>c[0]==='execute');assert.equal(call[3],'admin');assert.equal(call[6],'list');assert.match(response.headers.get('CDN-Cache-Control'),/no-store/);
});
test('profile focus uses only own saved occupations and verified city without LLM, GPS or inferred capabilities',async()=>{
 const profile={positions:['Beleuchter (Electrician)'],role:'Beleuchter (Electrician)',...placeWriteFields('Berlin, DE','geonames:2950159')};const f=fixture({actor:'admin',profile});const response=await f.route.GET(request());const data=await response.json();assert.equal(response.status,200);assert.equal(data.focus.mode,'profile');assert.ok(data.focus.departments.includes('licht'));assert.equal(data.focus.city,'Berlin');assert.deepEqual(f.calls.find(c=>c[0]==='eq'),['eq','user_id','admin']);assert.doesNotMatch(f.calls.find(c=>c[0]==='select')[1],/email|phone|bio|available|location|lat|lng/);
});
test('missing/ambiguous focus stays neutral, and real query/profile errors are not silent empty successes',async()=>{
 for(const profile of[null,{positions:['Unknown made-up occupation'],place_status:'pending',place_city_name:'Berlin'}]){const f=fixture({actor:'admin',profile});const response=await f.route.GET(request());assert.equal(response.status,200);assert.equal((await response.json()).focus.mode,'neutral')}
 for(const flags of[{profileError:true},{searchError:true}]){const f=fixture({actor:'admin',...flags});const response=await f.route.GET(request());assert.equal(response.status,503);assert.equal((await response.json()).error,'unavailable')}
});
test('cancelled requests never return a successful result body',async()=>{
 const f=fixture({actor:'admin'}),controller=new AbortController();controller.abort();await assert.rejects(()=>f.server.nativeDiscoveryForAccount('admin','de','neutral',controller.signal),/unavailable/);
});
test('focus and search both start before either completes, then return one account-bound result',async()=>{
 const profileGate=Promise.withResolvers(),searchGate=Promise.withResolvers();
 const profile={positions:['Beleuchter (Electrician)'],role:'Beleuchter (Electrician)',...placeWriteFields('Berlin, DE','geonames:2950159')};
 const f=fixture({actor:'admin',profile,profileWait:profileGate.promise,searchWait:searchGate.promise});
 let finished=false;
 const pending=f.route.GET(request()).then(response=>{finished=true;return response});
 await new Promise(resolve=>setImmediate(resolve));
 assert.ok(f.calls.some(call=>call[0]==='table'),'Own profile read started');
 assert.ok(f.calls.some(call=>call[0]==='execute'),'Search started while profile remains pending');
 const search=f.calls.find(call=>call[0]==='execute');
 assert.equal(search[3],'admin');assert.equal(search[6],'list');
 assert.equal(search[4],f.calls.find(call=>call[0]==='profile-signal')[1],'Both operations share the same account request cancellation');
 searchGate.resolve();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(finished,false,'No partial response before the account focus settles');
 profileGate.resolve();
 const response=await pending;assert.equal(response.status,200);
 const data=await response.json();assert.equal(data.accountId,'admin');assert.equal(data.focus.mode,'profile');
 assert.ok(data.focus.departments.includes('licht'));
});
test('either parallel failure cancels the sibling request and never emits a partial success',async()=>{
 for(const flags of[{profileError:true},{searchError:true}]){
  const f=fixture({actor:'admin',...flags});
  const response=await f.route.GET(request());
  assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:'unavailable'});
  assert.equal(f.calls.find(call=>call[0]==='execute')[4].aborted,true);
  assert.equal(f.calls.find(call=>call[0]==='profile-signal')[1].aborted,true);
 }
});
test('first-display list groups retain exact shared cursors and do not invent map points',async()=>{
 const initial=groups().map((group,index)=>({...group,results:Array.from({length:12},(_,row)=>result(`${index}-${row}`)),nextOffset:12}));
 const f=fixture({actor:'admin',groups:initial});
 const response=await f.route.GET(request('admin','?focus=neutral'));
 const data=await response.json();
 assert.equal(response.status,200);assert.ok(contract.readNativeDiscovery(data,'admin'));
 assert.deepEqual(data.groups,initial);
 assert.ok(data.groups.every(group=>group.results.length===12&&group.nextOffset===12&&group.results.every(row=>!('mapPoint' in row))));
 assert.equal(f.calls.find(call=>call[0]==='execute')[6],'list');
});
test('outer response validation rejects stale accounts, altered plans and mismatched groups',()=>{
 const valid={contract:contract.NATIVE_DISCOVERY_CONTRACT,accountId:'admin',serverNow:new Date().toISOString(),plan:contract.nativeDiscoveryPlan(),focus:{mode:'neutral',departments:[],city:null},groups:groups()};assert.ok(contract.readNativeDiscovery(valid,'admin'));assert.equal(contract.readNativeDiscovery({...valid,contract:'wrong'},'admin'),null);assert.equal(contract.readNativeDiscovery({...valid,groups:[]},'admin'),null);assert.equal(contract.readNativeDiscovery({...valid,plan:{version:1,searches:[{area:'all',query:'secret',department:'',places:[]}]}},'admin'),null);assert.equal(contract.readNativeDiscovery({...valid,groups:valid.groups.map((g,i)=>i?g:{...g,area:'news'})},'admin'),null);
});
