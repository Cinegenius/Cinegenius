import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),base=process.env.CG_PLACE_BASE??(existsSync(resolve(root,'../baseline-readonly'))?resolve(root,'../baseline-readonly'):root),require=createRequire(import.meta.url),ts=require('typescript');
const{NextRequest,NextResponse}=require('next/server.js');
const pins=new Map();
// Resolve relative sources independently of the caller's cwd.
function actualLoad(relative,mocks={},cache=new Map()){
 if(cache.has(relative))return cache.get(relative);const file=resolve(existsSync(resolve(root,relative))?root:base,relative),text=readFileSync(file,'utf8');pins.set(file,createHash('sha256').update(text).digest('hex'));
 if(relative.endsWith('.json')){const v=JSON.parse(text);cache.set(relative,v);return v;}
 const mod={exports:{}};cache.set(relative,mod.exports);const code=ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
 new Function('require','module','exports',code)(id=>{if(Object.hasOwn(mocks,id))return mocks[id];if(id==='server-only')return{};let next;if(id.startsWith('@/'))next=id.slice(2);else if(id.startsWith('.'))next=resolve('/'+dirname(relative),id).slice(1);else throw Error('Unexpected external '+id);return actualLoad(next+(extname(next)?'':'.ts'),mocks,cache);},mod,mod.exports);cache.set(relative,mod.exports);return mod.exports;
}
const pureCache=new Map(),protocol=actualLoad('lib/discovery-place-options.ts',{},pureCache),catalog=actualLoad('lib/places/catalog.ts',{},pureCache),privacy=actualLoad('lib/profile-privacy.ts',{},pureCache),core=actualLoad('lib/places/core.ts',{},pureCache),providers=actualLoad('lib/profile-provider-filters.ts',{},pureCache);
const place=(code,city='')=>({place_country_code:code,place_city_id:city||null,place_region_id:null,place_city_name:'Visible city',place_region_name:'Visible region',place_status:'verified'});
function fixture({actor='viewer',cap=2,failTable=null,failAfter=0,authFailure=false,repeatPage=false,dbCompare=(a,b)=>a<b?-1:a>b?1:0,scriptedPages={}}={}){
 let viewer=actor;const calls=[],loaded=[],pageReads=new Map(),tables={profiles:[],listings:[],companies:[],user_settings:[],blocks:[],friendships:[]};
 const db={from(table){
  assert.ok(['profiles','listings','privacy_visible_listings','companies','user_settings','blocks','friendships'].includes(table),'unexpected table '+table);
  const state={table,columns:'',filters:[],orders:[],size:200,after:null};calls.push(state);let signal;
  const q={select(columns){state.columns=columns;return q;},eq(k,v){state.filters.push(['eq',k,v]);return q;},neq(k,v){state.filters.push(['neq',k,v]);return q;},not(k,op,v){assert.equal(op,'is');state.filters.push(['not',k,v]);return q;},in(k,v){state.filters.push(['in',k,v]);return q;},gt(k,v){state.filters.push(['gt',k,v]);state.after=v;return q;},order(k,options={}){state.orders.push([k,options.ascending!==false]);return q;},range(from,to){assert.equal(from,0);state.size=to-from+1;return q;},limit(size){state.size=size;return q;},abortSignal(v){signal=v;return q;},then(done,reject){return (async()=>{
   signal?.throwIfAborted();if(table===failTable&&calls.filter(c=>c.table===table).length>failAfter)return{data:null,error:{code:'controlled-failure'}};
   let rows=(table==='privacy_visible_listings'?tables.listings.filter(row=>row.published&&(row.company_id||!tables.user_settings.some(s=>s.user_id===row.user_id&&s.ghost_mode))):tables[table]).slice();
   if(table==='user_settings')rows=rows.map(row=>({...privacy.DEFAULT_PRIVACY,...row}));
   for(const[op,k,v]of state.filters){if(op==='eq')rows=rows.filter(r=>r[k]===v);if(op==='neq')rows=rows.filter(r=>r[k]!==v);if(op==='not')rows=rows.filter(r=>r[k]!=null);if(op==='in')rows=rows.filter(r=>v.includes(r[k]));if(op==='gt'&&!repeatPage)rows=rows.filter(r=>dbCompare(String(r[k]),String(v),k)>0);}
   for(const[key,ascending]of state.orders.toReversed())rows.sort((a,b)=>dbCompare(String(a[key]),String(b[key]),key)*(ascending?1:-1));
   if(Object.hasOwn(scriptedPages,table)&&state.columns.includes('place_country_code')){const page=pageReads.get(table)??0;pageReads.set(table,page+1);rows=typeof scriptedPages[table]==='function'?scriptedPages[table](page):scriptedPages[table][page]??[];}else rows=rows.slice(0,Math.min(state.size,cap));
   const keys=state.columns.split(',');return{data:rows.map(row=>Object.fromEntries(keys.map(k=>[k,row[k]??null]))),error:null};
  })().then(done,reject);}};return q;
 }};
 const mocks={'@/lib/db':{db},'@/lib/discovery-place-options':protocol,'@/lib/places/catalog':catalog,'@/lib/places/core':core,'@/lib/profile-privacy':privacy,'@/lib/profile-provider-filters':providers,'@clerk/nextjs/server':{auth:async()=>{loaded.push('auth');if(authFailure)throw Error('controlled auth failure');return{userId:viewer};}},'next/server':{NextRequest,NextResponse}};
 const modules=new Map([['lib/discovery-place-options.ts',protocol]]);
 // Lazy server dependency is observable: city mode must never load/query it.
 const service=()=>{loaded.push('inventory');return actualLoad('lib/discovery-place-options-server.ts',mocks,modules);};
 const routeSource=readFileSync(resolve(root,'app/api/places/discovery/route.ts'),'utf8'),mod={exports:{}};
 const code=ts.transpileModule(routeSource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
 new Function('require','module','exports',code)(id=>id==='@/lib/discovery-place-options-server'?service():Object.hasOwn(mocks,id)?mocks[id]:actualLoad(id.slice(2)+'.ts',mocks,modules),mod,mod.exports);
 const request=query=>new NextRequest('https://app.invalid/api/places/discovery?'+query);
 return{tables,calls,loaded,route:mod.exports,request,setViewer:value=>{viewer=value},get:query=>mod.exports.GET(request(query)),service};
}
function profile(id,country,extra={}){return{user_id:id,display_name:'Visible member',profile_types:['lighting'],location:'Visible city',...place(country),...extra};}
function listing(id,type,country,extra={}){return{id,type,user_id:'offer-owner',company_id:null,published:true,created_at:'2026-01-01T00:00:00Z',city:'Visible city',...place(country),...extra};}
const ids=v=>v.countries.map(c=>c.id).sort();

test('global catalogue cities and public centers work without a country, auth or inventory availability',async()=>{
 const f=fixture({authFailure:true,failTable:'profiles'});const r=await f.get('mode=cities&locale=de&q=Marakesch');assert.equal(r.status,200);const b=await r.json();assert.equal(b.mode,'cities');const city=b.cities.find(c=>c.id==='geonames:2542997');assert.ok(city);assert.equal(city.countryCode,'MA');assert.equal(city.countryName,'Marokko');assert.ok(city.label.includes(city.name)&&city.label.includes('Marokko'));assert.ok(city.center===null||Number.isFinite(city.center.lat)&&Number.isFinite(city.center.lng));assert.deepEqual(f.calls,[]);assert.deepEqual(f.loaded,[]);assert.ok(!('countries'in b));assert.match(r.headers.get('cache-control'),/no-store/);
});
test('aliases and exact ID restoration keep global Vienna usable with empty eligible countries',async()=>{
 for(const q of ['Wien','Vienna'])assert.ok((await (await fixture().get('mode=cities&locale=de&q='+q)).json()).cities.some(c=>c.id==='geonames:2761369'));
 const f=fixture();const c=(await(await f.get('mode=cities&locale=en&city=geonames%3A2761369')).json()).cities[0];assert.equal(c.countryCode,'AT');assert.equal(c.name,'Vienna');assert.ok(c.center);assert.deepEqual(ids(await(await f.get('mode=countries&surface=directory&locale=de&areas=')).json()),[]);assert.equal((await(await f.get('mode=cities&locale=de&city=geonames%3A2761369&country=DE')).json()).cities.length,0);
});
test('country limits catalogue cities only when explicitly chosen; broad suggestions are bounded and disambiguated',async()=>{
 const f=fixture();const b=await(await f.get('mode=cities&locale=de&q=Berlin&country=DE')).json();assert.ok(b.cities.some(c=>c.id==='geonames:2950159'));assert.ok(b.cities.every(c=>c.countryCode==='DE'&&typeof c.regionId==='string'&&typeof c.region==='string'&&typeof c.district==='string'));const broad=await(await f.get('mode=cities&locale=de&q=an')).json();assert.equal(broad.cities.length,30);assert.equal(new Set(broad.cities.map(c=>c.id)).size,30);assert.deepEqual(f.loaded,[]);
});
test('typo tolerance is one edit, suggestion-only, min5 and exact/prefix names rank first',()=>{
 assert.equal(protocol.onePlaceEdit('marrakesch','marakesch'),true);assert.equal(protocol.onePlaceEdit('marrakesch','mraksch'),false);assert.ok(protocol.discoveryCityOptions('Marakesch','de').some(c=>c.id==='geonames:2542997'));const exact=protocol.discoveryCityOptions('Marrakesch','de');assert.equal(exact[0].id,'geonames:2542997');assert.deepEqual(protocol.discoveryCityOptions('a','de'),[]);assert.deepEqual(protocol.discoveryCityOptions('unrecognizable-private-city-zzzz','de'),[]);
});
test('country facet exhausts keyset pages past short API caps before returning selected-area union',async()=>{
 const f=fixture({cap:1});f.tables.listings.push(listing('a','prop','DE'),listing('b','vehicle','AT'),listing('c','prop','MA'),listing('d','job','ES'),listing('e','location','IT'),listing('f','prop','FR',{published:false}));
 const r=await f.get('mode=countries&surface=directory&locale=de&areas=jobs,marketplace'),b=await r.json();assert.equal(r.status,200);assert.deepEqual(b.areas,['marketplace','jobs']);assert.deepEqual(ids(b),['AT','DE','ES','MA']);assert.equal(b.accountId,'viewer');assert.ok(f.calls.filter(c=>c.table==='privacy_visible_listings').length>=5);assert.ok(f.calls.every(c=>!['lat','lng','address','place_original','metadata'].some(k=>c.columns.split(',').includes(k))));assert.ok(!JSON.stringify(b).includes('offer-owner'));assert.ok(!('cities'in b));
});
test('profile/field privacy, Ghost, blocks, membership and accepted friends apply BEFORE country facets',async()=>{
 const f=fixture({cap:100});f.tables.profiles.push(profile('public','DE'),profile('location-hidden','MA'),profile('ghost','FR'),profile('blocked','CH'),profile('member','PL'),profile('friend','HU'),profile('viewer','JP',{profile_types:[],bio:'Actual legacy author'}));
 f.tables.user_settings.push({user_id:'location-hidden',location_visibility:'hidden'},{user_id:'ghost',ghost_mode:true},{user_id:'member',profile_visibility:'members'},{user_id:'friend',profile_visibility:'private',location_visibility:'friends'},{user_id:'viewer',ghost_mode:true});f.tables.blocks.push({id:'b1',blocker_id:'blocked',blocked_id:'viewer'});f.tables.friendships.push({id:'f1',sender_id:'friend',receiver_id:'viewer',status:'accepted'});
 let b=await(await f.get('mode=countries&surface=directory&locale=de&areas=crew')).json();assert.deepEqual(ids(b),['DE','HU','JP','PL']);assert.ok(!JSON.stringify(b).includes('location-hidden'));f.setViewer(null);b=await(await f.get('mode=countries&surface=directory&locale=de&areas=crew')).json();assert.deepEqual(ids(b),['CH','DE']);assert.equal(b.accountId,null);
});
test('legacy creator fallback uses current owner location privacy and complete named-profile deduplication',async()=>{
 const f=fixture({cap:300});f.tables.profiles.push(profile('named-owner','DE'));f.tables.listings.push(listing('a','creator','IT',{user_id:'named-owner'}),listing('b','creator','CA',{user_id:'legacy-visible'}),listing('c','creator','MX',{user_id:'legacy-hidden'}));f.tables.user_settings.push({user_id:'legacy-hidden',location_visibility:'hidden'});assert.deepEqual(ids(await(await f.get('mode=countries&surface=directory&locale=de&areas=crew')).json()),['CA','DE']);
});
test('company geography is independently public; personal Ghost offers and unpublished rows never create a country',async()=>{
 const f=fixture();f.tables.user_settings.push({user_id:'ghost-owner',ghost_mode:true});f.tables.listings.push(listing('a','prop','MA',{user_id:'ghost-owner'}),listing('b','prop','DE'),listing('c','job','IT',{published:false}),listing('d','prop','AT',{user_id:'ghost-owner',company_id:'company'}));f.tables.companies.push({id:'company',published:true,city:'Public city',...place('EG')},{id:'private-company',published:false,...place('US')});assert.deepEqual(ids(await(await f.get('mode=countries&surface=directory&locale=de&areas=companies,marketplace,jobs')).json()),['AT','DE','EG']);
});
test('unknown/pending legacy city never invents a country from its name',async()=>{
 const f=fixture();f.tables.listings.push(listing('a','prop',null,{city:'Berlin',place_status:'pending',place_city_name:'Berlin'}),listing('b','prop','AT',{city:'Berlin',place_status:'pending'}));assert.deepEqual(ids(await(await f.get('mode=countries&surface=directory&locale=de&areas=marketplace')).json()),['AT']);
});
for(const options of [{failTable:'profiles'},{failTable:'user_settings'},{failTable:'privacy_visible_listings',failAfter:1},{repeatPage:true}])test('failed/incomplete inventory is503, never partial/empty facet: '+JSON.stringify(options),async()=>{
 const f=fixture(options);f.tables.profiles.push(profile('a','DE'),profile('b','MA'),profile('c','AT'));f.tables.listings.push(listing('a','prop','DE'),listing('b','prop','MA'),listing('c','prop','AT'));const r=await f.get('mode=countries&surface=directory&locale=de&areas=crew,marketplace');assert.equal(r.status,503);assert.deepEqual(await r.json(),{version:1,code:'unavailable'});assert.match(r.headers.get('cache-control'),/no-store/);const city=await f.get('mode=cities&locale=de&q=Berlin');assert.equal(city.status,200);assert.ok((await city.json()).cities.length>0);
});
test('empty selected union returns honest empty facets without data reads; cities stay global',async()=>{const f=fixture();const b=await(await f.get('mode=countries&surface=directory&locale=de&areas=')).json();assert.deepEqual(b.countries,[]);assert.deepEqual(b.areas,[]);assert.equal(f.calls.length,0);});
test('invalid inputs reject before auth or DB; duplicate selectors and injected countries never become filters',async()=>{
 const f=fixture();for(const q of ['mode=wrong','mode=countries&surface=directory&areas=crew,secret','mode=countries&surface=directory&areas=crew,crew','mode=countries','mode=cities&locale=bad&q=Berlin','mode=cities&q=Berlin&country=DE%2Cor(id.eq.secret)','mode=cities&q=a&q=b','mode=cities&q='+('x'.repeat(121)),'mode=cities&city=../../private'])assert.equal((await f.get(q)).status,400,q);assert.equal(f.calls.length,0);assert.equal(f.loaded.length,0);
});
test('all17 locales return canonical city/country IDs with localized labels, no extra identities/counts',async()=>{
 const locales=actualLoad('lib/i18n/locales.ts').SUPPORTED_LOCALES;
 for(const locale of locales){const f=fixture();f.tables.listings.push(listing('a','prop','DE'));const r=await f.get('mode=countries&surface=directory&locale='+locale+'&areas=marketplace'),b=await r.json();assert.equal(r.status,200);assert.deepEqual(ids(b),['DE']);assert.equal(typeof b.countries[0].name,'string');const c=protocol.discoveryCityOptions('',locale,'','geonames:2761369')[0];assert.equal(c.id,'geonames:2761369');assert.ok(c.name&&c.label&&c.countryName);assert.equal(Object.keys(c).sort().join(','),'canonicalName,center,countryCode,countryName,district,id,label,name,region,regionId');}
});
test('surface is closed and required; exact smart/directory country scope is echoed',async()=>{
 const f=fixture();for(const q of ['mode=countries&areas=crew','mode=countries&surface=unknown&areas=crew','mode=countries&surface=smart&surface=directory&areas=crew'])assert.equal((await f.get(q)).status,400);
 assert.deepEqual(f.calls,[]);for(const surface of ['smart','directory']){const b=await(await f.get('mode=countries&surface='+surface+'&areas=')).json();assert.equal(b.surface,surface);assert.deepEqual(b.areas,[]);assert.equal(b.accountId,'viewer');}
});
test('Smart named-profile source and directory people/fallback source remain distinct without broadening results',async()=>{
 const f=fixture({cap:300});f.tables.profiles.push(profile('named-stub','AU',{profile_types:[],role:null,bio:null,portfolio_images:null}));f.tables.listings.push(listing('legacy-only','creator','CA',{user_id:'legacy-person'}));
 assert.deepEqual(ids(await(await f.get('mode=countries&surface=smart&areas=crew')).json()),['AU']);assert.equal(f.calls.some(c=>c.table==='listings'),false);
 const start=f.calls.length;assert.deepEqual(ids(await(await f.get('mode=countries&surface=directory&areas=crew')).json()),['CA']);assert.ok(f.calls.slice(start).some(c=>c.table==='listings'&&c.filters.some(v=>v[0]==='eq'&&v[1]==='type'&&v[2]==='creator')));
});
test('directory creator fallback retains exact newest300 set, current privacy-view filter and per-owner first/newest precedence',async()=>{
 const f=fixture({cap:300});
 f.tables.listings.push(listing('a-older','creator','CA',{user_id:'same-owner',created_at:'2026-01-01T00:00:00Z'}),listing('z-newer','creator','AU',{user_id:'same-owner',created_at:'2026-11-01T00:00:00Z'}),listing('ghost','creator','JP',{user_id:'viewer',created_at:'2026-11-02T00:00:00Z'}));f.tables.user_settings.push({user_id:'viewer',ghost_mode:true});
 assert.deepEqual(ids(await(await f.get('mode=countries&surface=directory&areas=crew')).json()),['AU']);assert.equal(f.calls.find(c=>c.table==='listings').size,300);assert.ok(f.calls.find(c=>c.table==='listings').orders.some(([k,ascending])=>k==='created_at'&&!ascending));
 const g=fixture({cap:300});for(let i=0;i<300;i++)g.tables.listings.push(listing('new-'+String(i).padStart(3,'0'),'creator','DE',{user_id:'owner-'+i,created_at:'2026-11-01T00:00:00Z'}));g.tables.listings.push(listing('old-outside300','creator','MX',{user_id:'old-owner',created_at:'2020-01-01T00:00:00Z'}));assert.deepEqual(ids(await(await g.get('mode=countries&surface=directory&areas=crew')).json()),['DE']);
});
test('directory fallback privacy-ID failure is503 and never opens raw market/location/job reads',async()=>{
 const f=fixture({cap:300,failTable:'privacy_visible_listings'});f.tables.listings.push(listing('creator','creator','CA',{user_id:'legacy'}));assert.equal((await f.get('mode=countries&surface=directory&areas=crew,marketplace,locations,jobs')).status,503);
 const g=fixture({cap:300});g.tables.listings.push(listing('creator','creator','CA',{user_id:'legacy'}),listing('hidden-prop','prop','FR',{user_id:'ghost'}));g.tables.user_settings.push({user_id:'ghost',ghost_mode:true});assert.deepEqual(ids(await(await g.get('mode=countries&surface=directory&areas=crew,marketplace,locations,jobs')).json()),['CA']);const raw=g.calls.filter(c=>c.table==='listings');assert.ok(raw.length===1&&raw[0].filters.some(v=>v[0]==='eq'&&v[1]==='type'&&v[2]==='creator'));assert.ok(g.calls.some(c=>c.table==='privacy_visible_listings'&&c.filters.some(v=>v[0]==='in'&&v[1]==='type'&&!v[2].includes('creator'))));
});
test('published-only job eligibility is identical on both surfaces; no invented expiry/business predicate',async()=>{const f=fixture({cap:300});f.tables.listings.push(listing('a','job','ES',{created_at:'2020-01-01T00:00:00Z'}),listing('b','job','DE',{published:false}));for(const surface of ['smart','directory'])assert.deepEqual(ids(await(await f.get('mode=countries&surface='+surface+'&areas=jobs')).json()),['ES']);});
test('settled directory dedup is initial96 raw names UNION all people-qualified profiles, preserving97th nonpeople fallback',async()=>{
 const f=fixture({cap:300});for(let i=0;i<96;i++)f.tables.profiles.push(profile('person-'+String(i).padStart(3,'0'),'DE',{display_name:'A'+String(i).padStart(3,'0')}));f.tables.profiles.push(profile('older-nonpeople','AU',{display_name:'Zulu',profile_types:['company'],bio:null,role:null,portfolio_images:null}));f.tables.listings.push(listing('fallback-outside96','creator','CA',{user_id:'older-nonpeople'}));
 assert.deepEqual(ids(await(await f.get('mode=countries&surface=directory&areas=crew')).json()),['CA','DE']);assert.deepEqual(ids(await(await f.get('mode=countries&surface=smart&areas=crew')).json()),['AU','DE']);
 const g=fixture({cap:300});g.tables.profiles.push(profile('initial-nonpeople','AU',{display_name:'A first',profile_types:['company'],bio:null,role:null,portfolio_images:null}));g.tables.listings.push(listing('fallback-inside96','creator','CA',{user_id:'initial-nonpeople'}));assert.deepEqual(ids(await(await g.get('mode=countries&surface=directory&areas=crew')).json()),[]);
});
test('database collation controls both order and gt; a valid JS-inverted page keeps the exact final DB cursor on both surfaces',async()=>{
 const ordered=['user_a','user_B','user_c'],rank=new Map(ordered.map((id,index)=>[id,index]));
 assert.ok(ordered[1]<ordered[0],'fixture must disagree with JS codepoint order');
 const dbCompare=(a,b,key)=>key==='user_id'&&rank.has(a)&&rank.has(b)?rank.get(a)-rank.get(b):a<b?-1:a>b?1:0;
 for(const surface of ['smart','directory']){
  const f=fixture({actor:null,cap:2,dbCompare});f.tables.profiles.push(profile('user_a','DE'),profile('user_B','MA'),profile('user_c','AT'));
  const r=await f.get('mode=countries&surface='+surface+'&areas=crew');assert.equal(r.status,200);assert.deepEqual(ids(await r.json()),['AT','DE','MA']);
  const pages=f.calls.filter(call=>call.table==='profiles'&&call.columns.includes('place_country_code'));
  assert.deepEqual(pages.map(call=>call.after),[null,'user_B','user_c']);assert.ok(pages.every(call=>call.orders.some(([key,ascending])=>key==='user_id'&&ascending)));
 }
});
test('database collation disagreement never widens anonymous Ghost or hidden-location access',async()=>{
 const ordered=['user_a','user_B','user_c'],rank=new Map(ordered.map((id,index)=>[id,index]));
 const dbCompare=(a,b,key)=>key==='user_id'&&rank.has(a)&&rank.has(b)?rank.get(a)-rank.get(b):a<b?-1:a>b?1:0;
 for(const surface of ['smart','directory']){
  const f=fixture({actor:null,cap:2,dbCompare});f.tables.profiles.push(profile('user_a','DE'),profile('user_B','MA'),profile('user_c','AT'));f.tables.user_settings.push({user_id:'user_B',ghost_mode:true},{user_id:'user_c',location_visibility:'hidden'});
  const r=await f.get('mode=countries&surface='+surface+'&areas=crew');assert.equal(r.status,200);assert.deepEqual(ids(await r.json()),['DE']);
 }
});
test('missing or explicit-empty selected union is the same fail-closed empty response with no data reads',async()=>{
 for(const surface of ['smart','directory'])for(const suffix of ['', '&areas=']){
  const f=fixture({actor:null,failTable:'profiles'});const r=await f.get('mode=countries&surface='+surface+suffix);assert.equal(r.status,200);assert.deepEqual(await r.json(),{version:1,mode:'countries',surface,accountId:null,areas:[],countries:[]});assert.deepEqual(f.calls,[]);
 }
 for(const q of ['areas=crew,crew','areas=crew&areas=jobs','areas=private','areas='+('x'.repeat(101))]){
  const f=fixture();assert.equal((await f.get('mode=countries&surface=smart&'+q)).status,400);assert.deepEqual(f.calls,[]);assert.deepEqual(f.loaded,[]);
 }
});
for(const [name,pages] of [
 ['within page',[[{id:'a',published:true,...place('DE')},{id:'a',published:true,...place('MA')}]]],
 ['across pages',[[{id:'a',published:true,...place('DE')},{id:'b',published:true,...place('AT')}],[{id:'b',published:true,...place('AT')},{id:'c',published:true,...place('MA')}]]],
 ['cycle',[[{id:'a',published:true,...place('DE')}],[{id:'b',published:true,...place('AT')}],[{id:'a',published:true,...place('DE')}]]],
])test('per-source seen-ID guard rejects duplicate/cycle '+name+' without returning partial facets',async()=>{
 const f=fixture({scriptedPages:{companies:pages}});const r=await f.get('mode=countries&surface=smart&areas=companies');assert.equal(r.status,503);assert.deepEqual(await r.json(),{version:1,code:'unavailable'});assert.match(r.headers.get('cache-control'),/no-store/);
});
for(const id of [null,undefined,4,''])test('per-source seen-ID guard preserves invalid ID rejection: '+String(id),async()=>{
 const f=fixture({scriptedPages:{companies:[[{id,published:true,...place('DE')}]]}});assert.equal((await f.get('mode=countries&surface=smart&areas=companies')).status,503);
});
test('per-source seen-ID guard keeps the500-page bound when the source advances forever',async()=>{
 const f=fixture({scriptedPages:{companies:page=>[{id:'id-'+String(page).padStart(4,'0'),published:true,...place('DE')}]}});const r=await f.get('mode=countries&surface=smart&areas=companies');assert.equal(r.status,503);assert.equal(f.calls.filter(call=>call.table==='companies').length,500);
});
test('per-source seen-ID guard keeps the200-row response bound',async()=>{
 const rows=Array.from({length:201},(_,index)=>({id:'id-'+String(index).padStart(4,'0'),published:true,...place('DE')}));const f=fixture({scriptedPages:{companies:[rows]}});assert.equal((await f.get('mode=countries&surface=smart&areas=companies')).status,503);assert.equal(f.calls.length,1);
});
