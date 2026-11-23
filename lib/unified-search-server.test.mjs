import * as crypto from 'node:crypto';
import * as discoverySeed from './discovery-seed.ts';
import * as nativeDiscovery from './native-smart-discovery.ts';
import * as occupationFocus from './crew-occupations.ts';
import * as profilePrivacy from './profile-privacy.ts';
import * as requirements from "./unified-search-requirements.ts";
import * as areas from "./unified-search-areas.ts";
import * as production from "./unified-search-production.ts";
import * as catering from "./unified-search-catering.ts";
import * as nearby from "./unified-search-nearby.ts";
import * as intent from "./unified-search-intent.ts";
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as matching from './unified-search-matching.ts';
import * as browse from './browse-filters.ts';
import * as unified from './unified-search.ts';
import * as privacy from './profile-privacy.ts';
import * as departments from './departments.ts';
import * as occupationForm from './occupation-form.ts';
import * as places from './places/catalog.ts';
import * as mapPoints from './places/public-map-point.ts';
import * as locationPrivacy from './location-privacy.ts';
import * as core from './places/core.ts';
import * as media from './project-media-rights.ts';
import * as prices from './listing-price.ts';
import * as categories from './companyCategories.ts';
import * as marketplaceCategories from './marketplaceCategories.ts';
import * as access from './unified-search-access.ts';
import {GenieError} from './genie-error.ts';
import {NextRequest,NextResponse} from 'next/server.js';
const source=file=>ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function load(file,mocks){const m={exports:{}};new Function('require','module','exports',source(file))(id=>{assert.ok(id in mocks,id);return mocks[id]},m,m.exports);return m.exports;}
const translations={getLocale:async()=>'de',getTranslations:async({locale='de',namespace})=>{let root=JSON.parse(readFileSync(new URL(`../messages/${locale}.json`,import.meta.url),'utf8'));if(namespace)root=namespace.split('.').reduce((v,k)=>v[k],root);return(key,vars={})=>key.split('.').reduce((v,k)=>v[k],root)?.replace(/\{(\w+)\}/g,(_,k)=>vars[k])??key;}};
const place=(city)=>({city,country:'',continent:'',radiusKm:0});
const wish=(query,city)=>({area:'crew',query,department:'',places:city?[place(city)]:[]});
const plan=(...searches)=>({version:1,searches});
const person=(id,city,extra={})=>({user_id:id,display_name:id,role:'Fahrer',positions:['Produktionsfahrer*in'],location:`${city}, DE`,...places.placeWriteFields(`${city}, DE`),...extra});
const publicAccess={profile:true,location:true,map:true,activity:true,phone:false,email:false};
function fixture(options={}){
 const usage={quota:0,body:0};const queries=[],rows=options.rows??[person('berlin','Berlin'),person('hamburg','Hamburg')];
 const db={from(table){let from=0,to=Infinity;const constraints=[];const q={select(value){constraints.push(['select',value]);return q},eq(...v){constraints.push(['eq',...v]);return q},in(...v){constraints.push(['in',...v]);return q},or(...v){constraints.push(['or',...v]);return q},not(){return q},neq(){return q},order(key){if(options.realPrivacy)constraints.push(['order',key]);return q},gt(...v){constraints.push(['gt',...v]);return q},abortSignal(signal){if(options.realPrivacy)constraints.push(['signal',signal]);return q},range(a,b){from=a;to=b;return q},then(resolve,reject){queries.push({table,from,to,constraints});options.beforeQuery?.({table,from,to,constraints},options.tables);let data=table==='profiles'?rows:(options.tables?.[table]??[]);for(const [method,key,value]of constraints){if(method==='eq')data=data.filter(r=>r[key]===value);if(method==='in')data=data.filter(r=>value.includes(r[key]));if(method==='gt')data=data.filter(r=>r[key]>value);if(method==='order')data=[...data].sort((a,b)=>String(a[key]).localeCompare(String(b[key])));if(method==='signal')key.throwIfAborted();}return Promise.resolve({data:data.slice(from,to+1),error:options.databaseError?{code:'TEST'}:null}).then(resolve,reject)}};return q;}};
 const privacyServer=options.realPrivacy?load('./profile-privacy-server.ts',{'server-only':{},'@/lib/db':{db},'@/lib/profile-privacy':privacy}):{profileAccessFor:async ids=>{if(options.privacyError)throw new Error('private');return new Map(ids.map(id=>[id,options.permissions?.[id]??publicAccess]))}};
 const discoveryPrivacy=options.realPrivacy&&!options.legacyDiscoveryPrivacy?load('./native-discovery-profile-access.ts',{'server-only':{},'@/lib/db':{db},'@/lib/profile-privacy':privacy}):{createNativeDiscoveryProfileAccess:(viewerId,signal)=>ids=>privacyServer.profileAccessFor(ids,viewerId,{signal,throwOnError:true})};
 const server=load('./unified-search-server.ts',{'node:crypto':crypto,'./discovery-seed':discoverySeed,'./native-smart-discovery':nativeDiscovery,'./native-discovery-profile-access':discoveryPrivacy,'@/lib/browse-filters':browse,'@/lib/crew-occupations':occupationFocus,'server-only':{},'@/lib/db':{db},'next-intl/server':translations,'@/lib/profile-privacy-server':privacyServer,'@/lib/profile-privacy':privacy,'@/lib/departments':departments,'@/lib/occupation-form':occupationForm,'@/lib/places/public-map-point':mapPoints,'@/lib/location-privacy':locationPrivacy,'@/lib/places/catalog':places,'@/lib/places/core':core,'@/lib/project-media-rights':media,'@/lib/listing-price':prices,'@/lib/companyCategories':categories,'@/lib/marketplaceCategories':marketplaceCategories,'@/lib/unified-search-matching':matching,'@/lib/unified-search':unified,'@/lib/unified-search-nearby':nearby,'@/lib/unified-search-areas':areas,'@/lib/unified-search-production':production,'@/lib/unified-search-catering':catering,'@/lib/unified-search-requirements':requirements});
 const planServer=load('./unified-search-plan-server.ts',{'server-only':{},'next-intl/server':translations,'./departments':departments,'./places/catalog':places,'./unified-search-matching':matching,'./unified-search':unified,'./genie-error':{GenieError},'./unified-search-intent':intent});
 const route=load('../app/api/search/unified/route.ts',{'@/lib/browse-filters':browse,'@/lib/discovery-seed':discoverySeed,'@/lib/native-smart-discovery':nativeDiscovery,'next/server':{NextRequest,NextResponse},'next-intl/server':translations,'@/lib/auth':{getCurrentUser:async()=>{if(options.authError)throw new Error('auth unavailable');return options.userId?{userId:options.userId}:null}},'@/lib/request-origin':{trustedMutationOrigin:({origin})=>origin==='https://www.cinegenius.co'},'@/lib/genie-server':{GenieError,readGenieBody:req=>{usage.body++;return req.json()}},'@/lib/unified-search-plan-server':planServer,'@/lib/unified-search-server':server,'@/lib/unified-search-access':{unifiedSearchAccess:id=>access.unifiedSearchAccess(id,options.adminIds??'member')},'@/lib/unified-search':unified,'@/lib/unified-search-nearby':nearby,'@/lib/rateLimit':{rateLimit:async()=>{usage.quota++;return{allowed:!options.denied}}}});
 return{...server,queries,usage,route,privacyServer};
}
const run=(f,p,cursor)=>f.executeUnifiedSearch(p,'de',null,new AbortController().signal,cursor);
const request=body=>new NextRequest('https://www.cinegenius.co/api/search/unified',{method:'POST',headers:{origin:'https://www.cinegenius.co','content-type':'application/json'},body:JSON.stringify(body)});

test('native Crew discovery mixes the entire eligible pool and retains the same order across list, map and pagination',async()=>{
 const rows=Array.from({length:241},(_,i)=>person(`member-${String(i).padStart(3,'0')}`,'Berlin'));
 const permissions=Object.fromEntries(rows.filter((_,i)=>i%17===0).map(row=>[row.user_id,privacy.HIDDEN_PROFILE_ACCESS]));
 const f=fixture({rows,permissions}), p=nativeDiscovery.nativeDiscoveryPlan(), seed='0123456789abcdef0123456789abcdef';
 const read=(cursor,view='list')=>f.executeUnifiedSearch(p,'de','member-001',new AbortController().signal,cursor,view,seed).then(data=>data.groups.find(g=>g.area==='crew'));
 const first=await read(), repeated=await read();
 assert.deepEqual(first,repeated);assert.equal(first.results.length,12);
 assert.ok(first.results.some(row=>Number(row.id.slice(-3))>=180),'selection is not a shuffle of an early bounded page');
 const map=await read(undefined,'map');assert.deepEqual(map.results.slice(0,12).map(row=>row.id),first.results.map(row=>row.id));
 const all=[...first.results];let group=first, passes=0;
 while(group.nextOffset!==null){assert.ok(++passes<30);assert.ok(discoverySeed.validDiscoveryCursor(group.discoveryCursor));
  group=await read({wishIndex:0,area:'crew',offset:group.nextOffset,discovery:group.discoveryCursor});all.push(...group.results);
 }
 const ids=all.map(row=>row.id),eligible=rows.filter(row=>!permissions[row.user_id]).map(row=>row.user_id);
 assert.equal(new Set(ids).size,ids.length);assert.deepEqual([...ids].sort(),eligible);
 assert.deepEqual(map.results.map(row=>row.id),ids.slice(0,map.results.length));
 assert.equal(map.results.length,180);assert.ok(map.results.every(row=>row.mapPoint));
 const changed=(await f.executeUnifiedSearch(p,'de','member-001',new AbortController().signal,undefined,'list','abcdef0123456789abcdef0123456789')).groups[0];
 assert.notDeepEqual(changed.results.map(row=>row.id),first.results.map(row=>row.id));
 const otherViewer=(await f.executeUnifiedSearch(p,'de','member-005',new AbortController().signal,undefined,'list',seed)).groups[0];
 assert.deepEqual(otherViewer.results.map(row=>row.id),first.results.map(row=>row.id),'no account-owned promotion');
 const ordinary=(await run(f,p)).groups[0];assert.deepEqual(ordinary.results.map(row=>row.id),eligible.slice(0,12),'ordinary/older clients retain their existing ordering');
 // Current permissions are re-read even for the same seed and cursor.
 permissions[first.results[0].id]=privacy.HIDDEN_PROFILE_ACCESS;
 assert.ok(!(await read()).results.some(row=>row.id===first.results[0].id));
});

test('native discovery seed/cursor is narrowly validated; explicit list paging works and failures stay errors',async()=>{
 const p=nativeDiscovery.nativeDiscoveryPlan(),seed='0123456789abcdef0123456789abcdef';
 const f=fixture({userId:'member'});
 assert.equal((await f.route.POST(request({plan:p,view:'list',discoverySeed:seed}))).status,200);
 for(const body of [
  {plan:p,discoverySeed:'bad'}, {plan:plan(wish('Model')),discoverySeed:seed},
  {plan:p,discoverySeed:seed,cursor:{area:'crew',wishIndex:0,offset:12}},
  {plan:p,cursor:{area:'crew',wishIndex:0,offset:12,discovery:{key:'a'.repeat(64),id:'member'}}},
  {plan:p,discoverySeed:seed,cursor:{area:'crew',wishIndex:0,offset:12,discovery:{key:'bad',id:'member'}}},
 ])assert.equal((await f.route.POST(request(body))).status,400);
 for(const failure of [{databaseError:true},{privacyError:true}])assert.equal((await fixture({userId:'member',...failure}).route.POST(request({plan:p,discoverySeed:seed}))).status,503);
 const denied=fixture({userId:'normal'});assert.equal((await denied.route.POST(request({plan:p,discoverySeed:seed}))).status,403);assert.equal(denied.queries.length,0);
 const aborted=new AbortController();aborted.abort();await assert.rejects(()=>f.executeUnifiedSearch(p,'de','member',aborted.signal,undefined,'list',seed));
});

test('seeded Crew batching preserves complete projected outputs and cursors with fewer permission queries',async()=>{
 const rows=Array.from({length:1000},(_,i)=>person(`member-${String(i).padStart(4,'0')}`,'Berlin'));
 const viewer='member-0001',p=nativeDiscovery.nativeDiscoveryPlan(),seed='0123456789abcdef0123456789abcdef';
 const tables={user_settings:rows.filter((_,i)=>i%7===0).map((row,i)=>({user_id:row.user_id,...(i%3===0?{ghost_mode:true}:{profile_visibility:'private',location_visibility:'friends'})})),
  blocks:[{id:'block-1',blocker_id:'member-0051',blocked_id:viewer},{id:'block-2',blocker_id:viewer,blocked_id:'member-0081'}],
  friendships:[{id:'friend-1',sender_id:viewer,receiver_id:'member-0007',status:'accepted'},{id:'friend-2',sender_id:'member-0014',receiver_id:viewer,status:'accepted'}]};
 const fresh=()=>fixture({rows,realPrivacy:true,tables:structuredClone(tables)});
 for(const [view,expectedQueries]of [['list',47],['map',62]]){
  const current=fresh(),legacy=fixture({rows,realPrivacy:true,legacyDiscoveryPrivacy:true,tables:structuredClone(tables)});
  const cursor={wishIndex:0,area:'crew',offset:0};
  const actual=await current.executeUnifiedSearch(p,'de',viewer,new AbortController().signal,cursor,view,seed);
  const expected=await legacy.executeUnifiedSearch(p,'de',viewer,new AbortController().signal,cursor,view,seed);
  assert.deepEqual(actual,expected,`${view}: IDs, facts, projections, seed order and cursor stay identical`);
  assert.equal(current.queries.filter(q=>q.table==='profiles').length,17,'all 1,000 candidates are scanned');
  assert.equal(current.queries.length,expectedQueries,`${view}: exact database query count, including final authorization`);
  assert.equal(current.queries.filter(q=>['blocks','friendships'].includes(q.table)&&!q.constraints.some(c=>c[0]==='in')).length,8,'four nonempty relationship directions plus their terminating pages');
  assert.ok(current.queries.every(q=>q.constraints.filter(c=>c[0]==='in').every(c=>c[2].length<=60)));
  const finalChecks=view==='list'?5:20;
  assert.equal(legacy.queries.length-finalChecks,102,'reference full scan used 102 calls before the added final authorization');
  const group=actual.groups[0];
  assert.ok(group.results.every(r=>r.crewPreview&&r.sourceId===r.id));
  assert.ok(!group.results.some(r=>['member-0051','member-0081'].includes(r.id)));
  if(view==='list'){
   const more={wishIndex:0,area:'crew',offset:group.nextOffset,discovery:group.discoveryCursor};
   assert.deepEqual(await current.executeUnifiedSearch(p,'de',viewer,new AbortController().signal,more,view,seed),await legacy.executeUnifiedSearch(p,'de',viewer,new AbortController().signal,more,view,seed));
  }
 }
 const ordinary=fresh(),ordinaryReference=fixture({rows,realPrivacy:true,legacyDiscoveryPrivacy:true,tables:structuredClone(tables)});
 assert.deepEqual(await run(ordinary,p),await run(ordinaryReference,p));
 const queryPlan=f=>f.queries.map(q=>({...q,constraints:q.constraints.filter(c=>c[0]!=='signal')}));
 assert.deepEqual(queryPlan(ordinary),queryPlan(ordinaryReference),'without a discovery seed, the existing query plan is unchanged');
});

test('seeded Crew rechecks the bounded output pool for a mid-scan block or field withdrawal',async()=>{
 const rows=Array.from({length:80},(_,i)=>person(`member-${String(i).padStart(3,'0')}`,'Berlin'));
 const viewer='viewer',p=nativeDiscovery.nativeDiscoveryPlan(),seed='0123456789abcdef0123456789abcdef',cursor={wishIndex:0,area:'crew',offset:0};
 const initial=fixture({rows,realPrivacy:true});
 const target=(await initial.executeUnifiedSearch(p,'de',viewer,new AbortController().signal,cursor,'map',seed)).groups[0].results[0].id;
 const tables={blocks:[],friendships:[],user_settings:[]};let changed=false;
 const revoked=fixture({rows,realPrivacy:true,tables,beforeQuery:q=>{
  if(!changed&&q.table==='profiles'&&q.from===60){tables.blocks.push({id:'new-block',blocker_id:viewer,blocked_id:target});changed=true}
 }});
 await assert.rejects(()=>revoked.executeUnifiedSearch(p,'de',viewer,new AbortController().signal,cursor,'map',seed),/search_unavailable/);
 const retried=await revoked.executeUnifiedSearch(p,'de',viewer,new AbortController().signal,cursor,'map',seed);
 assert.ok(!retried.groups[0].results.some(row=>row.id===target),'the next request reads the new block before ranking');
 const fields={blocks:[],friendships:[],user_settings:[]};let withdrawn=false;
 const hidden=fixture({rows,realPrivacy:true,tables:fields,beforeQuery:q=>{
  if(!withdrawn&&q.table==='profiles'&&q.from===60){fields.user_settings.push({user_id:target,location_visibility:'hidden'});withdrawn=true}
 }});
 const result=(await hidden.executeUnifiedSearch(p,'de',viewer,new AbortController().signal,cursor,'map',seed)).groups[0].results.find(row=>row.id===target);
 assert.ok(result);assert.equal(result.crewPreview.place,'');assert.equal(result.mapPoint,null);
 assert.ok(!JSON.stringify(result).includes('Berlin'));
});

test('vegan catering remains mandatory before nearby selection, pagination and map placement',async()=>{
 const caterer=(id,city,diets=['Vegan'],extra={})=>({id,slug:id,name:id,published:true,city,...places.placeWriteFields(`${city}, DE`),categories:['catering-setverpflegung'],catering_details:{dietaryOptions:diets},...extra});
 const nonmatches=Array.from({length:190},(_,i)=>caterer('vegetarian-'+i,'Berlin',['Vegetarisch']));
 const matches=Array.from({length:15},(_,i)=>caterer('vegan-'+i,'Hamburg'));
 const f=fixture({tables:{companies:[...nonmatches,caterer('private','Berlin',['Vegan'],{published:false}),caterer('contradictory','Berlin',['Vegan'],{description:'Kein veganes Catering'}),...matches]}});
 const p=intent.keywordSearchPlan('ich suche ein veganes catering in berlin');
 const first=(await run(f,p)).groups[0];assert.ok(first.nearby);assert.equal(first.results.length,12);assert.ok(first.results.every(r=>r.id.startsWith('vegan-')&&r.nearby.distanceKm>0));
 const more=(await run(f,p,{wishIndex:0,area:'companies',offset:first.nextOffset,nearby:first.nearbyCursor})).groups[0];assert.equal(more.results.length,3);
 const map=(await f.executeUnifiedSearch(p,'de',null,new AbortController().signal,undefined,'map')).groups[0];
 assert.deepEqual([...first.results,...more.results].map(r=>r.id).sort(),map.results.map(r=>r.id).sort());assert.ok(map.results.every(r=>r.mapPoint));
 assert.ok(f.queries.every(q=>q.constraints.some(c=>c[0]==='eq'&&c[1]==='published'&&c[2]===true)));
 assert.ok(f.queries[0].constraints.find(c=>c[0]==='or')[1].includes('catering-setverpflegung'));
 const local=fixture({tables:{companies:[...matches,caterer('local','Berlin')]}});const group=(await run(local,p)).groups[0];assert.deepEqual(group.results.map(r=>r.id),['local']);assert.equal(group.nearby,undefined);
});

test('head recommendations retain profile privacy and show the matching declared role instead of an unrelated primary role',async()=>{
 const f=fixture({rows:[person('assistant','Berlin',{role:'Make-up Assistant',positions:[]}),person('hidden','Berlin',{role:'Gaffer',positions:[]}),person('head','Berlin',{role:'Camera Operator',positions:['Gaffer']})],permissions:{hidden:privacy.HIDDEN_PROFILE_ACCESS}});
 const p=plan(wish('Heads of Department','Berlin'));const group=(await run(f,p)).groups[0];assert.deepEqual(group.results.map(r=>r.id),['head']);assert.match(group.results[0].subtitle,/Gaffer|Oberbeleuchter/);assert.doesNotMatch(group.results[0].subtitle,/Camera Operator/);
 const expression=f.queries.find(q=>q.table==='profiles').constraints.find(c=>c[0]==='or')[1];assert.ok(expression.includes('role.ilike.'));assert.ok(!expression.includes('bio.ilike.'));assert.ok(!expression.includes('Polizei'));
});

test('different wishes retain their cities and one wish can use two cities',async()=>{
 const f=fixture();const response=await run(f,plan(wish('Model','Berlin'),wish('Beleuchter','Hamburg')));
 assert.deepEqual(response.groups.map(g=>g.results.map(r=>r.id)),[['berlin'],['hamburg']]);
 assert.match(response.groups[0].label,/Model.*Berlin/);assert.match(response.groups[1].label,/Beleuchter.*Hamburg/);
 const both=wish('Fahrer');both.places=[place('Berlin'),place('Hamburg')];
 assert.equal((await run(f,plan(both))).groups[0].results.length,2);
});
test('privacy is checked before geographic filtering and public projection',async()=>{
 const f=fixture({rows:[person('ghost','Berlin'),person('hidden-location','Berlin'),person('visible','Berlin')],permissions:{ghost:privacy.HIDDEN_PROFILE_ACCESS,'hidden-location':{...publicAccess,location:false,map:false}}});
 assert.deepEqual((await run(f,plan(wish('Fahrer','Berlin')))).groups[0].results.map(r=>r.id),['visible']);
 const broad=await run(f,plan(wish('Fahrer')));
 assert.deepEqual(broad.groups[0].results.map(r=>r.id),['hidden-location','visible']);
 assert.ok(!broad.groups[0].results[0].subtitle.includes('Berlin'));
  assert.equal(broad.groups[0].results[0].crewPreview.place,'');
 assert.ok(!JSON.stringify(broad).includes('ghost'));
 await assert.rejects(run(fixture({privacyError:true}),plan(wish('Fahrer'))));
});

test('native crew preview uses the first existing localized title and projected place without truncating public profile facts',async()=>{
 const {SUPPORTED_LOCALES}=await import('./i18n/locales.ts');
 const rows=[person('public-first','Berlin',{positions:['Gaffer (Oberbeleuchter)','Best Boy Electric','Beleuchter'],crew:{occupationForm:'feminine'}}),
  person('literal','Berlin',{positions:['Camera · authored title','Other authored title'],location:'München, , DE',place_status:'pending',place_country_code:null,place_city_id:null,place_city_name:null})];
 const before=JSON.stringify(rows);
 for(const locale of SUPPORTED_LOCALES){
  const f=fixture({rows});
  const group=(await f.executeUnifiedSearch(plan(wish('')),locale,null,new AbortController().signal)).groups[0];
  const ui=await translations.getTranslations({locale});
  const first=group.results.find(row=>row.id==='public-first');
  assert.equal(first.crewPreview.occupation,departments.taxonomyLabel(occupationFocus.profileOccupationPreview(rows[0])[0],ui,'feminine'));
  assert.ok(first.subtitle.startsWith(first.crewPreview.occupation+' · '));
  assert.ok(first.subtitle.length>first.crewPreview.occupation.length+first.crewPreview.place.length);
  const literal=group.results.find(row=>row.id==='literal');
  assert.equal(literal.crewPreview.occupation,'Camera · authored title');
  assert.equal(literal.crewPreview.place,'München, DE');
  assert.equal(JSON.stringify(rows),before);
 }
});
test('pagination continues beyond hidden rows and preserves requested constraints',async()=>{
 const rows=[...Array.from({length:180},(_,i)=>person('outside-'+i,'Hamburg')),...Array.from({length:15},(_,i)=>person('match-'+i,'Berlin'))];
 const f=fixture({rows});const p=plan(wish('Fahrer','Berlin'));
 const second=(await run(f,p)).groups[0];assert.equal(second.results.length,12);assert.equal(second.nextOffset,192);assert.equal(second.nearby,undefined);
 const third=(await run(f,p,{area:'crew',wishIndex:0,offset:second.nextOffset})).groups[0];assert.equal(third.results.length,3);assert.equal(third.nextOffset,null);
 assert.equal(new Set([...second.results,...third.results].map(r=>r.id)).size,15);
});
test('all-area searches use published views, public projects and approved organizations',async()=>{
 const f=fixture();await run(f,plan({...wish('Film'),area:'all'}));
 assert.deepEqual(new Set(f.queries.map(q=>q.table)),new Set(['profiles','privacy_visible_listings','companies','projects','organizations','organization_entries']));
 for(const q of f.queries.filter(q=>['privacy_visible_listings','companies'].includes(q.table)))assert.ok(q.constraints.some(c=>c[0]==='eq'&&c[1]==='published'&&c[2]===true));
 const news=f.queries.find(q=>q.table==='organization_entries');assert.ok(news.constraints.some(c=>c[1]==='organization.moderation_status'&&c[2]==='approved'));
 assert.ok(!f.queries.some(q=>q.table==='project_drafts'));
});
test('route rejects invalid cursors and forged fields, returns private no-store data and fails closed',async()=>{
 const f=fixture({userId:'member'});const p=plan(wish('Fahrer','Berlin'));
 for(const cursor of [false,null,[],{area:'companies',wishIndex:0,offset:0},{area:'crew',wishIndex:6,offset:0},{area:'crew',wishIndex:0,offset:-1}])assert.equal((await f.route.POST(request({plan:p,cursor}))).status,400);
 assert.equal((await f.route.POST(request({plan:p,viewerId:'someone-else'}))).status,400);
 const result=await f.route.POST(request({plan:p}));assert.equal(result.status,200);assert.match(result.headers.get('cache-control'),/private.*no-store/);
 assert.equal((await fixture({userId:'member',denied:true}).route.POST(request({plan:p}))).status,429);
 assert.equal((await fixture({userId:'member',databaseError:true}).route.POST(request({plan:p}))).status,503);
});

test('project geography uses canonical places and nested production country without inventing a shooting city',async()=>{
 const f=fixture({tables:{projects:[
  {id:'nested-country',title:'Film',metadata:{project_details:{country:'Schweiz',shoot_locations:['Berlin']}}},
  {id:'canonical',title:'Film',metadata:{project_details:{country:'Deutschland'}},...places.placeWriteFields('Zürich, CH')},
 ]}});
 const search={area:'projects',query:'Film',department:'',places:[{...place(''),country:'CH'}]};
 const country=(await run(f,plan(search))).groups[0].results;
 assert.deepEqual(country.map(r=>r.id),['nested-country','canonical']);
 assert.deepEqual((await run(f,plan({...search,places:[place('Zürich')]}))).groups[0].results.map(r=>r.id),['canonical']);
 assert.deepEqual((await run(f,plan({...search,places:[{...place('Berlin'),country:'CH'}]}))).groups[0].results,[]);
});


test('Smart requires membership before quota, body parsing and data access, including forged client claims',async()=>{
 assert.equal(access.unifiedSearchAccess(null).canReadResults,false);
 assert.equal(access.unifiedSearchAccess('member').canReadResults,false);
 assert.equal(access.unifiedSearchAccess('member','member').canReadResults,true);
 for(const body of [{plan:plan(wish('Model','Berlin'))},{plan:plan(wish('Model')),userId:'member'},null]){
  const f=fixture();const result=await f.route.POST(request(body));
  assert.equal(result.status,401);assert.deepEqual(await result.json(),{error:'unauthorized'});
  assert.match(result.headers.get('cache-control'),/private.*no-store/);
  assert.deepEqual(f.usage,{quota:0,body:0});assert.equal(f.queries.length,0);
 }
 const failed=fixture({authError:true});assert.equal((await failed.route.POST(request({}))).status,503);
 assert.deepEqual(failed.usage,{quota:0,body:0});assert.equal(failed.queries.length,0);
});

test('costume search resolves saved positions and company/marketplace categories without profile exceptions',async()=>{
 const f=fixture();await run(f,plan({...wish('kostuem'),area:'all'}));
 const filters=table=>f.queries.find(q=>q.table===table).constraints.find(c=>c[0]==='or')[1];
 assert.match(filters('profiles'),/positions\.ov/);assert.match(filters('profiles'),/Kostüm/);
 assert.match(filters('companies'),/categories\.ov/);assert.match(filters('companies'),/kostumfundus/);
 assert.match(filters('privacy_visible_listings'),/kostuem-kleidung/);
});

test('Smart map honours Ghost, hidden location and map opt-out before deriving any point',async()=>{
 const f=fixture({rows:[person('ghost','Berlin'),person('hidden-place','Berlin'),person('no-map','Berlin'),person('visible','Berlin')],permissions:{ghost:privacy.HIDDEN_PROFILE_ACCESS,'hidden-place':{...publicAccess,location:false,map:false},'no-map':{...publicAccess,map:false}}});
 const result=await f.executeUnifiedSearch(plan(wish('Fahrer')),'de','viewer',new AbortController().signal,undefined,'map');
 assert.deepEqual(result.groups[0].results.map(r=>r.id),['hidden-place','no-map','visible']);
 assert.equal(result.groups[0].results[0].mapPoint,null);assert.equal(result.groups[0].results[1].mapPoint,null);
 assert.ok(result.groups[0].results[2].mapPoint?.lat);assert.ok(!JSON.stringify(result).includes('ghost'));
 const normal=await run(f,plan(wish('Fahrer')));assert.ok(normal.groups[0].results.every(r=>!Object.hasOwn(r,'mapPoint')));
});

test('map pagination is independent of the twelve-card list and continues without silently hiding results',async()=>{
 const rows=Array.from({length:195},(_,i)=>person('person-'+i,'Berlin')),f=fixture({rows});
 const p=plan(wish('Fahrer','Berlin'));
 const first=(await f.executeUnifiedSearch(p,'de','viewer',new AbortController().signal,undefined,'map')).groups[0];
 assert.equal(first.results.length,180);assert.equal(first.nextOffset,180);
 const last=(await f.executeUnifiedSearch(p,'de','viewer',new AbortController().signal,{area:'crew',wishIndex:0,offset:180},'map')).groups[0];
 assert.equal(last.results.length,15);assert.equal(last.nextOffset,null);
 assert.equal(new Set([...first.results,...last.results].map(r=>r.id)).size,195);
 assert.equal((await run(f,p)).groups[0].results.length,12);
});

test('location map pins use only the public approximate area, never exact offer coordinates or addresses',async()=>{
 const row={id:'location-public',type:'location',published:true,title:'Studio',city:'Berlin',...places.placeWriteFields('Berlin, DE'),lat:52.123456,lng:13.123456,address:'PRIVATE EXACT ADDRESS',location_area:{lat:52.51,lng:13.39,radius_meters:500}};
 const f=fixture({tables:{privacy_visible_listings:[row]}}),p=plan({area:'locations',query:'Studio',department:'',places:[]});
 const result=await f.executeUnifiedSearch(p,'de','viewer',new AbortController().signal,undefined,'map');
 assert.deepEqual(result.groups[0].results[0].mapPoint,{lat:52.51,lng:13.39,radiusMeters:500});
 assert.doesNotMatch(JSON.stringify(result),/PRIVATE EXACT|52\.123456|13\.123456/);
 const select=f.queries[0].constraints.find(c=>c[0]==='select')[1];assert.match(select,/location_area:metadata->location_area/);assert.doesNotMatch(select,/(?:^|,)(lat|lng|address)(?:,|$)/);
});

test('map mode is member-only and cannot accept an arbitrary mode',async()=>{
 const p=plan(wish('Fahrer','Berlin'));
 const guest=fixture();assert.equal((await guest.route.POST(request({plan:p,view:'map'}))).status,401);assert.deepEqual(guest.usage,{quota:0,body:0});
 const member=fixture({userId:'member'});assert.equal((await member.route.POST(request({plan:p,view:'raw'}))).status,400);
 const result=await member.route.POST(request({plan:p,view:'map'}));assert.equal(result.status,200);assert.match(result.headers.get('cache-control'),/no-store/);assert.ok((await result.json()).groups[0].results[0].mapPoint);
});

test('nearest fallback examines late candidates and orders by distance rather than ID or input order',async()=>{
 const rows=[...Array.from({length:181},(_,i)=>person('far-'+i,'München')),person('berlin','Berlin'),person('nearest','Bremen')];
 const f=fixture({rows}),p=plan(wish('Fahrer','Hamburg'));
 const first=(await run(f,p)).groups[0];
 assert.equal(first.nearby,true);assert.equal(first.results[0].id,'nearest');assert.equal(first.results[1].id,'berlin');
 assert.ok(first.results[0].nearby.distanceKm<first.results[1].nearby.distanceKm);
 assert.ok(first.results.every(r=>r.nearby.origin==='Hamburg'&&!r.mapPoint));
 assert.ok(f.queries.some(q=>q.from>=180));assert.ok(first.nearbyCursor);assert.equal(first.nextOffset,12);
 const second=(await run(f,p,{area:'crew',wishIndex:0,offset:first.nextOffset,nearby:first.nearbyCursor})).groups[0];
 assert.equal(second.nearby,true);assert.equal(second.results.length,12);
 assert.equal(new Set([...first.results,...second.results].map(r=>r.id)).size,24);
 const mapped=(await f.executeUnifiedSearch(p,'de',null,new AbortController().signal,undefined,'map')).groups[0];
 assert.deepEqual(mapped.results.slice(0,12).map(r=>r.id),first.results.map(r=>r.id));assert.ok(mapped.results.every(r=>r.mapPoint));
});

test('nearby results respect privacy, map opt-out, known locations and explicit countries',async()=>{
 const rows=[person('ghost','Bremen'),person('hidden','Bremen'),person('map-off','Bremen'),person('unknown','UNKNOWN'),person('berlin','Berlin'),person('vienna','Wien',{location:'Wien, AT',...places.placeWriteFields('Wien, AT')})];
 const f=fixture({rows,permissions:{ghost:privacy.HIDDEN_PROFILE_ACCESS,hidden:{...publicAccess,location:false,map:false},'map-off':{...publicAccess,map:false}}});
 const p=plan({...wish('Fahrer','Hamburg'),places:[{...place('Hamburg'),country:'DE'}]});
 const results=(await run(f,p)).groups[0].results;
 assert.deepEqual(results.map(r=>r.id),['berlin']);assert.ok(results[0].nearby);
 for(const places of [[{...place(''),country:'CH'}],[{...place(''),continent:'002'}],[place('UncataloguedVillage')],[{...place('Berlin'),country:'CH'}]]){
  const group=(await run(f,plan({...wish('Fahrer'),places}))).groups[0];assert.equal(group.results.length,0);assert.equal(group.nearby,undefined);
 }
});

test('fallback is per wish and area; local results suppress alternatives and later pages do not invent fallback',async()=>{
 const rows=[person('berlin','Berlin'),person('bremen','Bremen')],f=fixture({rows});
 const response=await run(f,plan(wish('Fahrer','Hamburg'),wish('Fahrer','Berlin')));
 assert.equal(response.groups[0].nearby,true);assert.deepEqual(response.groups[1].results.map(r=>r.id),['berlin']);assert.equal(response.groups[1].nearby,undefined);
 const later=(await run(f,plan(wish('Fahrer','Berlin')),{area:'crew',wishIndex:0,offset:2})).groups[0];assert.deepEqual(later.results,[]);assert.equal(later.nearby,undefined);
 // A forged/stale nearby cursor cannot force the omission of actual local matches.
 const forced=(await run(f,plan(wish('Fahrer','Berlin')),{area:'crew',wishIndex:0,offset:12,nearby:{distanceKm:0,id:'a'}})).groups[0];
 assert.deepEqual(forced.results.map(r=>r.id),['berlin']);assert.equal(forced.nearby,undefined);
});

test('nearby pagination visits every equal-distance candidate once and fails closed on interrupted scans',async()=>{
 const f=fixture({rows:Array.from({length:29},(_,i)=>person('berlin-'+String(i).padStart(2,'0'),'Berlin')).reverse()}),p=plan(wish('Fahrer','Hamburg'));
 let cursor,ids=[];
 for(let pass=0;pass<4;pass++){
  const group=(await run(f,p,cursor)).groups[0];ids.push(...group.results.map(r=>r.id));
  if(group.nextOffset===null)break;
  cursor={area:'crew',wishIndex:0,offset:group.nextOffset,nearby:group.nearbyCursor};
 }
 assert.equal(ids.length,29);assert.equal(new Set(ids).size,29);assert.deepEqual(ids,[...ids].sort());
 const controller=new AbortController();controller.abort();await assert.rejects(f.executeUnifiedSearch(p,'de',null,controller.signal));
 const member=fixture({userId:'member'});
 for(const value of [null,false,{}, {distanceKm:-1,id:'a'}, {distanceKm:1,id:''}, {distanceKm:21000,id:'a'}, {distanceKm:1,id:'a',userId:'other'}]){
  assert.equal((await member.route.POST(request({plan:p,cursor:{area:'crew',wishIndex:0,offset:12,nearby:value}}))).status,400);
 }
});

test('whole-directory searches skip literal word filters while police remains an independent theme',async()=>{
 const p=intent.keywordSearchPlan('Berlin Location Polizei'),f=fixture();await run(f,p);
 const locationQueries=f.queries.filter(q=>q.constraints.some(c=>c[0]==='in'&&c[1]==='type'&&c[2].includes('location')));
 assert.ok(locationQueries.some(q=>!q.constraints.some(c=>c[0]==='or')));
 assert.ok(locationQueries.some(q=>q.constraints.some(c=>c[0]==='or'&&c[1].includes('Polizei'))));
});

test('v2 department heads fall back separately and combined list/map share the same protected scan',async()=>{
 const f=fixture({rows:[person('camera','Berlin',{role:'Director of Photography (DoP)',positions:[]}),person('sound','Hamburg',{role:'Production Sound Mixer',positions:[]}),person('ghost','Berlin',{role:'Gaffer',positions:[]})],permissions:{ghost:privacy.HIDDEN_PROFILE_ACCESS}});
 const p={version:2,searches:[{...wish('Heads of Department','Berlin'),recommended:true}]};
 const result=await f.executeUnifiedSearch(p,'de','member',new AbortController().signal,undefined,'combined');
 const camera=result.groups.find(g=>g.results.some(r=>r.id==='camera'));const sound=result.groups.find(g=>g.results.some(r=>r.id==='sound'));
 assert.ok(camera.segment);assert.equal(camera.nearby,undefined);assert.ok(sound.segment&&sound.nearby);assert.ok(sound.results[0].nearby.distanceKm>0);
 assert.ok(!result.groups.some(g=>g.results.some(r=>r.id==='ghost')));
 assert.deepEqual(result.groups.flatMap(g=>g.results.map(r=>r.id)).sort(),result.mapGroups.flatMap(g=>g.results.map(r=>r.id)).sort());
 assert.equal(f.queries.length,production.departmentHeadSegments.length);
 assert.ok(!JSON.stringify(result).includes('listPage'));
});

test('v2 relevance pages keep exact roles first, stable cursors, and the same map records',async()=>{
 const rows=Array.from({length:26},(_,i)=>person(String(i).padStart(2,'0'),'Berlin',{role:i<10?'Runner':'Fahrer',positions:['Fahrer']}));
 const f=fixture({rows});const p={version:2,searches:[wish('Fahrer','Berlin')]};
 const initial=await f.executeUnifiedSearch(p,'de',null,new AbortController().signal,undefined,'combined');
 const first=initial.groups[0];assert.equal(first.results.length,12);assert.equal(initial.mapGroups[0].results.length,26);assert.ok(first.rankCursor);
 assert.deepEqual(first.results.map(r=>r.id),rows.slice(10,22).map(r=>r.user_id));
 const cursor={wishIndex:0,area:'crew',offset:first.nextOffset,rank:first.rankCursor};assert.ok(f.validSearchCursor(p,cursor));
 const next=(await run(f,p,cursor)).groups[0];assert.equal(next.results.length,12);assert.equal(new Set([...first.results,...next.results].map(r=>r.id)).size,24);
 const last=(await run(f,p,{...cursor,offset:next.nextOffset,rank:next.rankCursor})).groups[0];assert.equal(last.results.length,2);assert.equal(last.nextOffset,null);
 assert.equal(f.validSearchCursor(p,{...cursor,rank:{...cursor.rank,score:99}}),false);
 assert.equal(f.validSearchCursor(p,{...cursor,segment:'admin'}),false);
});

test('v2 declared requirements, exclusions and explicit radius survive nearest expansion',async()=>{
 const p={version:2,searches:[{...wish('Fahrer','Berlin'),requirements:[['Führerschein CE']],exclude:['Anfänger']}]};
 const f=fixture({rows:[person('missing','Berlin'),person('excluded','Berlin',{bio:'Führerschein CE, Anfänger'}),person('qualified','Hamburg',{bio:'Führerschein CE vorhanden.'})]});
 const group=(await run(f,p)).groups[0];assert.deepEqual(group.results.map(r=>r.id),['qualified']);assert.ok(group.nearby);
 p.searches[0].places[0].radiusKm=50;
 assert.deepEqual((await run(f,p)).groups[0].results,[]);
 p.searches[0].places[0]={city:'Berlin',country:'CH',continent:'',radiusKm:0};
 assert.deepEqual((await run(f,p)).groups[0].results,[]);
});


test('a production selection covers the full shared department catalogue with one protected profile scan',async()=>{
 const rows=[person('costume','München',{role:'Assistant Costume Designer',positions:[]}),person('makeup','München',{role:'Make-up Assistant',positions:[]}),person('sound','Berlin',{role:'Tonmeister / Sound Mixer',positions:[]}),person('transport','München'),person('provider','München',{role:'Locationanbieter',positions:[]}),person('ghost','München',{role:'Gaffer',positions:[]}),person('private-place','München',{role:'Key Grip',positions:[]})];
 const permissions={ghost:privacy.HIDDEN_PROFILE_ACCESS,'private-place':{...publicAccess,location:false,map:false},makeup:{...publicAccess,map:false}};
 const f=fixture({rows,permissions});const p=intent.keywordSearchPlan('ich drehe in münchen');
 const response=await f.executeUnifiedSearch(p,'de','member',new AbortController().signal,undefined,'combined');
 const crew=response.groups.filter(g=>g.area==='crew');assert.deepEqual(crew.map(g=>g.segment),departments.departments.map(d=>d.id));
 assert.equal(crew.find(g=>g.segment==='kostuem').results[0].id,'costume');assert.equal(crew.find(g=>g.segment==='maske').results[0].id,'makeup');
 assert.ok(crew.find(g=>g.segment==='ton').nearby);assert.ok(crew.find(g=>g.segment==='produktion').results.some(r=>r.id==='transport'));
 assert.ok(crew.every(g=>g.results.every(r=>!['provider','ghost','private-place'].includes(r.id))));
 assert.equal(response.mapGroups.find(g=>g.segment==='maske').results[0].mapPoint,null);
 assert.deepEqual(response.groups.map(g=>g.results.map(r=>r.id)),response.mapGroups.map(g=>g.results.map(r=>r.id)));
 const reads=f.queries.filter(q=>q.table==='profiles');assert.equal(reads.length,1);assert.ok(reads.every(q=>!q.constraints.some(c=>c[0]==='or')));
 permissions.makeup=privacy.HIDDEN_PROFILE_ACCESS;
 const fresh=await f.executeUnifiedSearch(p,'de','another-member',new AbortController().signal,undefined,'combined');
 assert.equal(fresh.groups.find(g=>g.segment==='maske').results.length,0);assert.equal(f.queries.filter(q=>q.table==='profiles').length,2);
});

test('production department pages preserve segment and rank boundaries, privacy failures never become an empty selection',async()=>{
 const p={version:2,searches:[{...wish(production.PRODUCTION_CREW_QUERY,'München'),recommended:true}]};
 const f=fixture({rows:Array.from({length:14},(_,i)=>person(String(i).padStart(2,'0'),'München',{role:'Assistant Costume Designer',positions:[]}))});
 const initial=await f.executeUnifiedSearch(p,'de','member',new AbortController().signal,undefined,'combined');
 const group=initial.groups.find(g=>g.segment==='kostuem');assert.equal(group.results.length,12);assert.ok(group.rankCursor);
 const cursor={wishIndex:0,area:'crew',segment:'kostuem',offset:group.nextOffset,rank:group.rankCursor};assert.ok(f.validSearchCursor(p,cursor));
 const page=(await run(f,p,cursor)).groups[0];assert.equal(page.results.length,2);assert.equal(new Set([...group.results,...page.results].map(r=>r.id)).size,14);
 assert.equal(f.validSearchCursor(p,{...cursor,segment:'admin'}),false);assert.equal(f.validSearchCursor(p,{...cursor,segment:undefined}),false);
 await assert.rejects(()=>run(fixture({privacyError:true}),p),/private/);
});

test('non-admin accounts cannot read Smart results, map or paging even with forged claims',async()=>{
 for(const view of [undefined,'map','combined'])for(const body of [{plan:plan(wish('Model','Berlin')),view},{plan:{bad:true},view,userId:'admin',isAdmin:true,role:'admin'},null]){
  const f=fixture({userId:'member',adminIds:'admin'});const response=await f.route.POST(request(body));
  assert.equal(response.status,403);assert.deepEqual(await response.json(),{error:'in_development'});
  assert.deepEqual(f.usage,{quota:0,body:0});assert.equal(f.queries.length,0);assert.match(response.headers.get('cache-control'),/private.*no-store/);
 }
 for(const ids of ['',undefined,'other-admin','member-extra'])assert.equal(access.unifiedSearchAccess('member',ids).canReadResults,false);
 assert.equal(access.unifiedSearchAccess('member',' other-admin, member ').canInterpret,true);
});

test('Smart exposes canonical facets and evidence only after current profile privacy projection',async()=>{
 const f=fixture({rows:[person('camera','Berlin',{role:'Camera Operator',positions:['Camera Operator']}),person('hidden','Berlin',{role:'Camera Operator',positions:['Camera Operator']})],permissions:{hidden:privacy.HIDDEN_PROFILE_ACCESS}});
 const p={version:2,searches:[wish('Camera Operator','Berlin')]};
 const response=await f.executeUnifiedSearch(p,'de',null,new AbortController().signal,undefined,'combined');
 const card=response.mapGroups[0].results[0];
 assert.equal(response.mapGroups[0].results.length,1);
 assert.deepEqual(card.facets,{departments:['kamera']});
 assert.equal(card.evidence,'role');
 assert.equal(JSON.stringify(card).includes('private'),false);
 assert.deepEqual(response.groups[0].results[0],card);
});

test('Smart marketplace facets use the existing category catalogue, including vehicle-type boundaries',async()=>{
 const item=(id,type,category)=>({id,user_id:'owner',title:id,type,category,published:true,city:'Berlin',...places.placeWriteFields('Berlin, DE')});
 const f=fixture({tables:{privacy_visible_listings:[item('car','vehicle','fahrzeuge-bild'),item('bad-category','prop','fahrzeuge-bild')]}});
 const response=await f.executeUnifiedSearch({version:2,searches:[{...wish('Marktplatz','Berlin'),area:'marketplace'}]},'de',null,new AbortController().signal,undefined,'map');
 const cards=response.groups[0].results;
 assert.equal(cards.find(r=>r.id==='car').facets.marketplace,'fahrzeuge');
 assert.equal(cards.find(r=>r.id==='bad-category').facets,undefined);
});

test('browse filters inspect beyond180candidates and count before list/map/combined pagination',async()=>{
 const listing=(id,category,extra={})=>({id,title:id,type:'location',category,published:true,city:'Berlin, DE',price:100,price_currency:'EUR',sqm:300,ceiling_height_m:4,parking_spots:3,power_available:true,...places.placeWriteFields('Berlin, DE'),...extra});
 const rows=[...Array.from({length:205},(_,i)=>listing('a'+String(i).padStart(3,'0'),'Villa')),...Array.from({length:15},(_,i)=>listing('z'+String(i).padStart(3,'0'),'Studio'))];
 const f=fixture({userId:'member',tables:{privacy_visible_listings:rows}}),p=plan({area:'locations',query:'Locations',department:'',places:[]});
 const filters=browse.readSearchBrowseFilters({version:1,locationTypes:['Studio'],location:{sqm:'200',power:'1',min:'10',max:'200',currency:'EUR'}});
 const execute=(cursor,view='list')=>f.executeUnifiedSearch(p,'de','member',new AbortController().signal,cursor,view,undefined,filters);
 const first=(await execute()).groups[0];assert.equal(first.totalCount,15);assert.equal(first.results.length,12);assert.ok(first.results.every(r=>r.id.startsWith('z')));
 assert.ok(f.queries.some(q=>q.from>=180));assert.ok(first.browseKey);assert.ok(first.rankCursor);
 const cursor={wishIndex:0,area:'locations',offset:first.nextOffset,rank:first.rankCursor,browseKey:first.browseKey};assert.ok(f.validSearchCursor(p,cursor,undefined,filters));
 const last=(await execute(cursor)).groups[0];assert.equal(last.totalCount,15);assert.equal(last.results.length,3);assert.equal(last.nextOffset,null);
 const map=(await execute(undefined,'map')).groups[0],combined=await execute(undefined,'combined');
 assert.deepEqual([...first.results,...last.results].map(r=>r.id),map.results.map(r=>r.id));assert.equal(map.totalCount,15);
 assert.deepEqual(combined.groups[0].results.map(r=>r.id),first.results.map(r=>r.id));assert.deepEqual(combined.mapGroups[0].results.map(r=>r.id),map.results.map(r=>r.id));
 assert.equal(f.validSearchCursor(p,cursor,undefined,{version:1,locationTypes:['Villa']}),false);assert.equal(f.validSearchCursor(p,cursor),false);
 const selected=f.queries.find(q=>q.table==='privacy_visible_listings').constraints.find(c=>c[0]==='select')[1];
 assert.ok(selected.includes('sqm:metadata->sqm'));assert.ok(selected.includes('location_area:metadata->location_area'));assert.ok(!/(?:^|,)\s*metadata\s*(?:,|$)|private_location|address|latitude|longitude/.test(selected));
 const reset=(await f.executeUnifiedSearch(p,'de','member',new AbortController().signal,undefined,'list',undefined,{version:1})).groups[0];
 assert.equal(reset.browseKey,undefined);assert.equal(reset.totalCount,undefined);assert.ok(reset.results[0].id.startsWith('a'));
});

test('browse category facts cover company services, existing job schedules and project aliases',async()=>{
 const f=fixture({tables:{companies:[{id:'c1',slug:'c1',name:'Catering',published:true,categories:[],services:['catering-setverpflegung']},{id:'c2',name:'Camera',published:true,categories:['kameraverleih']}],privacy_visible_listings:[{id:'j1',title:'Intern',type:'job',published:true,job:{employmentType:'praktikum',startDate:'',endDate:''}},{id:'j2',title:'Freelance',type:'job',published:true,job:{employmentType:'freelance',startDate:'',endDate:''}}],projects:[{id:'p1',title:'Commercial',type:'Werbefilm / Commercial',metadata:{}},{id:'p2',title:'Public custom',type:'Custom type',metadata:{}}]}});
 for(const [area,filters,id,fact]of [['companies',{companyCategories:['catering-setverpflegung']},'c1','companyCategories'],['jobs',{jobTypes:['praktikum']},'j1','jobType'],['projects',{projectTypes:['Werbung']},'p1','projectType'],['projects',{projectTypes:['Custom type']},'p2','projectType']]){
  const result=await f.executeUnifiedSearch(plan({area,query:area,department:'',places:[]}),'de','member',new AbortController().signal,undefined,'list',undefined,{version:1,...filters});
  assert.deepEqual(result.groups[0].results.map(v=>v.id),[id]);assert.equal(result.groups[0].totalCount,1);assert.ok(result.groups[0].results[0].facets[fact]);
 }
});

test('browse route closes input and filter cursor reset while preserving auth and provider plan',async()=>{
 const p=nativeDiscovery.nativeDiscoveryPlan(),f=fixture({userId:'member'});
 assert.equal((await f.route.POST(request({plan:p,browseFilters:{version:1,departments:['produktion']}}))).status,200);
 for(const browseFilters of [{version:1,lat:52},{version:1,companyCategories:['forged']},{version:1,radiusKm:20},{version:1,location:{min:'100',max:'5'}},null])assert.equal((await f.route.POST(request({plan:p,browseFilters}))).status,400);
 assert.equal((await f.route.POST(request({plan:p,cursor:{wishIndex:0,area:'crew',offset:12,rank:{score:0,distanceKm:20050,id:'x'},browseKey:'f'.repeat(64)},browseFilters:{version:1,departments:['produktion']}}))).status,400);
 const denied=fixture({userId:'normal'});assert.equal((await denied.route.POST(request({plan:p,browseFilters:{version:1,departments:['produktion']}}))).status,403);assert.equal(denied.queries.length,0);
 const unauthenticated=fixture();assert.equal((await unauthenticated.route.POST(request({plan:p,browseFilters:{version:1}}))).status,401);assert.equal(unauthenticated.queries.length,0);
});

test('browse radius cannot use a hiddenCrewplace and rechecks withdrawal before emitting filtered rows',async()=>{
 const city=places.placeCatalog.cities.find(c=>c.name==='Berlin'&&c.country==='DE');const filters=browse.readSearchBrowseFilters({version:1,city:city.id,radiusKm:20});
 const row={...person('visible','Berlin'),...places.placeWriteFields('Berlin, DE',city.id)};
 const hidden={...person('hidden','Berlin'),...places.placeWriteFields('Berlin, DE',city.id)};
 const f=fixture({rows:[row,hidden],permissions:{hidden:{...publicAccess,location:false,map:false}}}),p=plan(wish('Crew'));
 const result=(await f.executeUnifiedSearch(p,'de','viewer',new AbortController().signal,undefined,'list',undefined,filters)).groups[0];
 assert.deepEqual(result.results.map(v=>v.id),['visible']);assert.equal(result.totalCount,1);
 assert.equal(result.results[0].facets.place.city,city.id);
});

test('browse cursor keys ignore canonical parent/currency insertion order but reject changed filters',async()=>{
 const f=fixture({userId:'member'}),city=places.placeCatalog.cities.find(c=>c.name==='Berlin'&&c.country==='DE');
 const first=browse.readSearchBrowseFilters({version:1,city:city.id,location:{min:'10'}}),again=browse.readSearchBrowseFilters(first);
 assert.equal(f.browseFiltersKey(first),f.browseFiltersKey(again));
 assert.notEqual(f.browseFiltersKey(first),f.browseFiltersKey({...again,location:{...again.location,min:'11'}}));
 const rows=Array.from({length:14},(_,i)=>({...person(String(i).padStart(3,'0'),'Berlin'),...places.placeWriteFields('Berlin, DE',city.id)}));
 const real=fixture({userId:'member',rows}),p=plan(wish('Crew'));
 const response=await real.route.POST(request({plan:p,browseFilters:{version:1,city:city.id}}));assert.equal(response.status,200);const group=(await response.json()).groups[0];
 const next=await real.route.POST(request({plan:p,browseFilters:{version:1,city:city.id},cursor:{wishIndex:0,area:'crew',offset:group.nextOffset,rank:group.rankCursor,browseKey:group.browseKey}}));
 assert.equal(next.status,200);assert.equal((await next.json()).groups[0].results.length,2);
});

test('active browse never returns a partial count when a later page fails or the request is aborted',async()=>{
 const rows=Array.from({length:200},(_,i)=>({id:String(i).padStart(4,'0'),title:'Studio',type:'location',category:'Studio',published:true}));
 let calls=0;const f=fixture({tables:{privacy_visible_listings:rows},beforeQuery:()=>{if(++calls===3)throw Error('late failure')}});
 const p=plan({area:'locations',query:'Locations',department:'',places:[]}),filters={version:1,locationTypes:['Studio']};
 await assert.rejects(()=>f.executeUnifiedSearch(p,'de','member',new AbortController().signal,undefined,'list',undefined,filters),/late failure/);
 const aborted=new AbortController(),g=fixture({tables:{privacy_visible_listings:rows},beforeQuery:()=>aborted.abort()});
 await assert.rejects(()=>g.executeUnifiedSearch(p,'de','member',aborted.signal,undefined,'map',undefined,filters));
});

test('a seeded filtered Crew request rejects a newly hidden matching place during the final privacy check',async()=>{
 const city=places.placeCatalog.cities.find(c=>c.name==='Berlin'&&c.country==='DE'),seed='0123456789abcdef0123456789abcdef',viewer='viewer';
 const rows=Array.from({length:80},(_,i)=>({...person('b'+String(i).padStart(3,'0'),'Berlin'),...places.placeWriteFields('Berlin, DE',city.id)}));
 const p=nativeDiscovery.nativeDiscoveryPlan(),filters=browse.readSearchBrowseFilters({version:1,city:city.id}),cursor={wishIndex:0,area:'crew',offset:0};
 const base=fixture({rows,realPrivacy:true});const target=(await base.executeUnifiedSearch(p,'de',viewer,new AbortController().signal,cursor,'list',seed,filters)).groups[0].results.find(row=>Number(row.id.slice(1))<60)?.id;assert.ok(target,'choose an emitted result from the page read before withdrawal');
 const tables={blocks:[],friendships:[],user_settings:[]};let changed=false;
 const f=fixture({rows,realPrivacy:true,tables,beforeQuery:q=>{if(!changed&&q.table==='profiles'&&q.from===60){tables.user_settings.push({user_id:target,location_visibility:'hidden'});changed=true}}});
 await assert.rejects(()=>f.executeUnifiedSearch(p,'de',viewer,new AbortController().signal,cursor,'list',seed,filters),/search_unavailable/);
});

test('the initial reset opt-in projects six public facets without extra searches, counts or a changed seed',async()=>{
 const f=fixture({rows:[person('crew','Berlin')],tables:{companies:[{id:'company',name:'Company',published:true,categories:['drohnen']}],privacy_visible_listings:[{id:'location',title:'Bar',type:'location',category:'Bar',published:true},{id:'job',title:'Job',type:'job',published:true,job:{employmentType:'freelance',startDate:'',endDate:''}},{id:'prop',title:'Light',type:'prop',category:'licht-quellen',published:true}],projects:[{id:'project',title:'Project',type:'Custom public type',metadata:{}}]}});
 const p=nativeDiscovery.nativeDiscoveryPlan(),seed='0123456789abcdef0123456789abcdef';
 const result=await f.executeUnifiedSearch(p,'de','viewer',new AbortController().signal,undefined,'list',seed,{version:1});
 assert.equal(result.groups.length,6);assert.equal(f.queries.filter(q=>['profiles','privacy_visible_listings','companies','projects'].includes(q.table)).length,6);
 assert.ok(result.groups.every(g=>g.browseKey===undefined&&g.totalCount===undefined));
 const group=area=>result.groups.find(g=>g.area===area);
 assert.equal(group('locations').results[0].facets.locationType,'Bar');assert.equal(group('jobs').results[0].facets.jobType,'freelance');
 assert.equal(group('projects').results[0].facets.projectType,'Custom public type');assert.deepEqual(group('companies').results[0].facets.companyCategories,['drohnen']);
 assert.ok(group('marketplace').results[0].facets.marketplace);assert.ok(group('crew').results[0].facets.departments);
});
test('Crew verification survives permission projection in lists/maps and never comes from historical approval',async()=>{
 const rows=[person('verified','Berlin',{verified:true}),person('revoked','Berlin',{verified:false,status:'approved'}),person('private','Berlin',{verified:true})];
 for(const view of ['list','map']) {
  const f=fixture({rows,permissions:{private:privacy.HIDDEN_PROFILE_ACCESS}});
  const data=await f.executeUnifiedSearch(plan(wish('')),'de',null,new AbortController().signal,undefined,view);
  const results=data.groups.flatMap(group=>group.results);
  assert.equal(results.find(row=>row.id==='verified')?.verified,true);
  assert.equal(results.find(row=>row.id==='revoked')?.verified,false);
  assert.ok(!results.some(row=>row.id==='private'));
  assert.ok(f.queries.filter(query=>query.table==='profiles').every(query=>query.constraints.some(([op,value])=>op==='select'&&value.includes('verified'))));
 }
});


test('filtered and seeded Crew keep current verification without changing privacy, counts or cursors',async()=>{
 const seed='0123456789abcdef0123456789abcdef';
 const rows=[person('verified','Berlin',{role:'Gaffer',positions:['Gaffer'],verified:true}),person('revoked','Berlin',{role:'Gaffer',positions:['Gaffer'],verified:false,status:'approved'}),person('private','Berlin',{role:'Gaffer',positions:['Gaffer'],verified:true})];
 const filters=browse.readSearchBrowseFilters({version:1,departments:['licht']});
 for(const useSeed of [false,true])for(const view of ['list','map','combined']) {
  const f=fixture({rows,permissions:{private:privacy.HIDDEN_PROFILE_ACCESS}}),p=nativeDiscovery.nativeDiscoveryPlan();
  const data=await f.executeUnifiedSearch(p,'de','viewer',new AbortController().signal,undefined,view,useSeed?seed:undefined,filters);
  const crew=data.groups.find(group=>group.area==='crew');
  assert.equal(crew.totalCount,2);assert.equal(crew.nextOffset,null);assert.equal(crew.browseKey,f.browseFiltersKey(filters));
  assert.equal(crew.results.find(row=>row.id==='verified')?.verified,true);assert.equal(crew.results.find(row=>row.id==='revoked')?.verified,false);
  assert.ok(!crew.results.some(row=>row.id==='private'));assert.ok(crew.results.every(row=>row.facets.departments.includes('licht')));
  if(view==='combined')assert.deepEqual(data.mapGroups.find(group=>group.area==='crew').results,crew.results);
 }
});
