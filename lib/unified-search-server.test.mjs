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
import * as unified from './unified-search.ts';
import * as privacy from './profile-privacy.ts';
import * as departments from './departments.ts';
import * as places from './places/catalog.ts';
import * as mapPoints from './places/public-map-point.ts';
import * as locationPrivacy from './location-privacy.ts';
import * as core from './places/core.ts';
import * as media from './project-media-rights.ts';
import * as prices from './listing-price.ts';
import * as categories from './companyCategories.ts';
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
 const db={from(table){let from=0,to=Infinity;const constraints=[];const q={select(value){constraints.push(['select',value]);return q},eq(...v){constraints.push(['eq',...v]);return q},in(...v){constraints.push(['in',...v]);return q},or(...v){constraints.push(['or',...v]);return q},not(){return q},neq(){return q},order(){return q},abortSignal(){return q},range(a,b){from=a;to=b;return q},then(resolve,reject){queries.push({table,from,to,constraints});let data=table==='profiles'?rows:(options.tables?.[table]??[]);for(const [method,key,value]of constraints){if(method==='eq')data=data.filter(r=>r[key]===value);if(method==='in')data=data.filter(r=>value.includes(r[key]));}return Promise.resolve({data:data.slice(from,to+1),error:options.databaseError?{code:'TEST'}:null}).then(resolve,reject)}};return q;}};
 const server=load('./unified-search-server.ts',{'server-only':{},'@/lib/db':{db},'next-intl/server':translations,'@/lib/profile-privacy-server':{profileAccessFor:async ids=>{if(options.privacyError)throw new Error('private');return new Map(ids.map(id=>[id,options.permissions?.[id]??publicAccess]))}},'@/lib/profile-privacy':privacy,'@/lib/departments':departments,'@/lib/places/public-map-point':mapPoints,'@/lib/location-privacy':locationPrivacy,'@/lib/places/catalog':places,'@/lib/places/core':core,'@/lib/project-media-rights':media,'@/lib/listing-price':prices,'@/lib/companyCategories':categories,'@/lib/unified-search-matching':matching,'@/lib/unified-search':unified,'@/lib/unified-search-nearby':nearby,'@/lib/unified-search-areas':areas,'@/lib/unified-search-production':production,'@/lib/unified-search-catering':catering});
 const planServer=load('./unified-search-plan-server.ts',{'server-only':{},'next-intl/server':translations,'./departments':departments,'./places/catalog':places,'./unified-search':unified,'./genie-error':{GenieError},'./unified-search-intent':intent});
 const route=load('../app/api/search/unified/route.ts',{'next/server':{NextRequest,NextResponse},'next-intl/server':translations,'@/lib/auth':{getCurrentUser:async()=>{if(options.authError)throw new Error('auth unavailable');return options.userId?{userId:options.userId}:null}},'@/lib/request-origin':{trustedMutationOrigin:({origin})=>origin==='https://www.cinegenius.co'},'@/lib/genie-server':{GenieError,readGenieBody:req=>{usage.body++;return req.json()}},'@/lib/unified-search-plan-server':planServer,'@/lib/unified-search-server':server,'@/lib/unified-search-access':access,'@/lib/unified-search':unified,'@/lib/unified-search-nearby':nearby,'@/lib/rateLimit':{rateLimit:async()=>{usage.quota++;return{allowed:!options.denied}}}});
 return{...server,queries,usage,route};
}
const run=(f,p,cursor)=>f.executeUnifiedSearch(p,'de',null,new AbortController().signal,cursor);
const request=body=>new NextRequest('https://www.cinegenius.co/api/search/unified',{method:'POST',headers:{origin:'https://www.cinegenius.co','content-type':'application/json'},body:JSON.stringify(body)});

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
 assert.ok(!JSON.stringify(broad).includes('ghost'));
 await assert.rejects(run(fixture({privacyError:true}),plan(wish('Fahrer'))));
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
 assert.equal(access.unifiedSearchAccess('member').canReadResults,true);
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
