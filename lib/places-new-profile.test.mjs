import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {createClient} from '@supabase/supabase-js';
import * as places from './places/catalog.ts';
import {placeOptions} from './places/core.ts';

const require=createRequire(import.meta.url);
const {NextRequest}=require('next/server');
const handlerSource=ts.transpileModule(readFileSync(new URL('../app/api/profile/route.ts',import.meta.url),'utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText;
const profileDependencies=Object.fromEntries(await Promise.all([
 ['@/lib/profile-types','./profile-types.ts'],['@/lib/profile-display','./profile-display.ts'],
 ['@/lib/crew-occupations','./crew-occupations.ts'],['@/lib/primary-occupation','./primary-occupation.ts'],
 ['@/lib/profile-cover','./profile-cover.ts'],['@/lib/profile-db-compat','./profile-db-compat.ts'],
].map(async([name,path])=>[name,await import(path)])));

/** Real POST/PATCH/GET handlers and validators; only identity and HTTP transport
 * are replaced. Each fixture begins with no profile and never opens a socket. */
function fixture(){
 const owner='own-new-profile';let saved=null;
 const writes=[],metadataWrites=[],invalidations=[];
 const db=createClient('https://fixture.invalid','own-fixture-key',{auth:{persistSession:false},global:{fetch:async(input,init={})=>{
  const url=new URL(input),method=init.method??'GET';
  assert.equal(url.origin,'https://fixture.invalid');assert.equal(url.pathname,'/rest/v1/profiles');
  if(method==='POST'||method==='PATCH'){
   const payload=JSON.parse(init.body);
   if(method==='POST')assert.equal(payload.user_id,owner);
   else {assert.equal(url.searchParams.get('user_id'),`eq.${owner}`);assert.ok(saved,'PATCH must follow creation of this fixture profile');}
   writes.push({method,payload:structuredClone(payload)});saved={...(saved??{}),...payload};
  }else assert.equal(url.searchParams.get('user_id'),`eq.${owner}`);
  if(!saved)return Response.json(null);
  const selection=url.searchParams.get('select');
  const row=!selection||selection==='*'?saved:Object.fromEntries(selection.split(',').map(key=>[key.trim(),saved[key.trim()]??null]));
  return Response.json(row);
 }}});
 const deps={...profileDependencies,
  '@/lib/db':{db},'@/lib/auth':{requireAuth:async()=>({userId:owner})},'@/lib/places/catalog':places,
  '@clerk/nextjs/server':{clerkClient:async()=>({users:{updateUserMetadata:async(...args)=>metadataWrites.push(args)}})},
  'next/cache':{revalidateTag:(...args)=>invalidations.push(args)},'next-intl/server':{getTranslations:async()=>key=>key},
 };
 const mod={exports:{}};new Function('require','module','exports',handlerSource)(name=>deps[name]??require(name),mod,mod.exports);
 const call=(method,body)=>mod.exports[method](new NextRequest('https://fixture.invalid/api/profile',{
  method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body),
 }));
 return {call,read:()=>mod.exports.GET(),saved:()=>structuredClone(saved),writes,metadataWrites,invalidations};
}
const createBody=(location,selectedCityId)=>({display_name:'Own sample member',profile_types:['location'],positions:[],location,...(selectedCityId?{selected_place_city_id:selectedCityId}:{})});

test('new Cologne profiles store one city identity for German and English names with separate country and region',async()=>{
 const rows=[];
 for(const raw of ['Köln, Nordrhein-Westfalen, Deutschland','Cologne, North Rhine-Westphalia, Germany','Koeln, DE']){
  const f=fixture(),response=await f.call('POST',{
   ...createBody(raw,'geonames:2886242'),
   // Canonical-looking client fields must never replace the server selection.
   place_country_code:'US',place_region_id:'US:forged',place_city_id:'geonames:1',place_city_name:'Forged city',place_status:'verified',
  });
  assert.equal(response.status,200,raw);assert.equal(f.writes.length,1);assert.equal(f.writes[0].method,'POST');
  const row=f.saved();assert.equal(row.user_id,'own-new-profile');assert.equal(row.location,raw);assert.equal(row.place_original,raw);
  assert.equal(row.place_country_code,'DE');assert.equal(row.place_region_id,'DE:geonames:2861876');assert.equal(row.place_city_id,'geonames:2886242');
  assert.equal(row.place_city_name,'Köln');assert.equal(row.place_status,'verified');assert.ok(row.place_region_name);
  assert.equal(f.metadataWrites.length,1);rows.push(places.placeReadFields(raw,row,'de'));
 }
 assert.deepEqual(placeOptions(rows,'country','de'),[{value:'DE',label:'Deutschland'}]);
 assert.equal(placeOptions(rows,'region','de').length,1);
 const cities=placeOptions(rows,'city','de');assert.equal(cities.length,1);assert.equal(cities[0].value,'geonames:2886242');assert.match(cities[0].label,/Köln/);assert.doesNotMatch(cities[0].label,/Cologne|Forged/);
});

test('new Frankfurt profiles resolve reviewed abbreviations and explicit city IDs to the same separate fields',async()=>{
 const rows=[];
 for(const raw of ['Frankfurt a.M., Hessen, DE','Frankfurt am Main, Hesse, Germany','Frankfurt/Main, Deutschland']){
  const f=fixture();assert.equal((await f.call('POST',createBody(raw,'geonames:2925533'))).status,200,raw);
  const row=f.saved();assert.equal(row.place_country_code,'DE');assert.equal(row.place_region_id,'DE:geonames:2905330');
  assert.equal(row.place_city_id,'geonames:2925533');assert.equal(row.place_city_name,'Frankfurt am Main');assert.equal(row.place_status,'verified');assert.equal(row.place_original,raw);
  rows.push(places.placeReadFields(raw,row,'de'));
 }
 assert.equal(placeOptions(rows,'city','de').length,1);assert.equal(placeOptions(rows,'region','de').length,1);
});

test('new profiles reject region-only and country-only locations before any persistence',async()=>{
 for(const raw of ['Bayern, DE','Bayern','DE','Deutschland','Germany']){
  for(const selected of [undefined,'geonames:2950159']){
   const f=fixture(),response=await f.call('POST',createBody(raw,selected));
   assert.equal(response.status,400,`${raw}, selection=${selected}`);assert.ok((await response.json()).fieldErrors.location);
   assert.equal(f.writes.length,0);assert.equal(f.saved(),null);assert.equal(f.metadataWrites.length,0);assert.equal(f.invalidations.length,0);
  }
 }
});

test('editing a just-created profile rejects country or region as a city and leaves its saved location untouched',async()=>{
 const f=fixture();assert.equal((await f.call('POST',createBody('Köln, Nordrhein-Westfalen, DE','geonames:2886242'))).status,200);
 const before=f.saved();
 for(const raw of ['Bayern, DE','Deutschland','DE']){
  const response=await f.call('PATCH',{location:raw,selected_place_city_id:'geonames:2950159'});
  assert.equal(response.status,400,raw);assert.ok((await response.json()).fieldErrors.location);
  assert.deepEqual(f.saved(),before);assert.equal(f.writes.length,1);assert.equal(f.metadataWrites.length,1);
 }
});

test('Berlin and Hamburg remain valid city selections even though their regions have the same name',async()=>{
 const choices=[['Berlin, Berlin, DE','geonames:2950159','DE:geonames:2950157'],['Hamburg, Hamburg, Deutschland','geonames:2911298','DE:geonames:2911297']];
 for(const [raw,cityId,regionId] of choices){
  const f=fixture();assert.equal((await f.call('POST',createBody(raw,cityId))).status,200,raw);
  const row=f.saved();assert.equal(row.place_country_code,'DE');assert.equal(row.place_city_id,cityId);assert.equal(row.place_region_id,regionId);assert.equal(row.place_status,'verified');
  assert.ok(row.place_city_name);assert.ok(row.place_region_name);assert.notEqual(row.place_city_id,row.place_region_id);
  assert.equal(placeOptions([row],'city','de').length,1);
 }
 const f=fixture();assert.equal((await f.call('POST',createBody(choices[0][0],choices[0][1]))).status,200);
 assert.equal((await f.call('PATCH',{location:choices[1][0],selected_place_city_id:choices[1][1]})).status,200);
 assert.equal(f.saved().place_city_id,choices[1][1]);assert.equal(f.saved().place_region_id,choices[1][2]);assert.equal(f.writes.length,2);
});

test('an unknown international municipality retains its country and original text while remaining outside canonical city filters',async()=>{
 const raw='Own synthetic small hamlet, Ticino, CH',f=fixture();
 assert.equal((await f.call('POST',createBody(raw))).status,200);
 const row=f.saved();assert.equal(row.location,raw);assert.equal(row.place_original,raw);assert.equal(row.place_country_code,'CH');
 assert.equal(row.place_city_name,'Own synthetic small hamlet');assert.equal(row.place_city_id,null);assert.equal(row.place_status,'pending');
 const ownerResponse=await f.read();assert.equal(ownerResponse.status,200);assert.match(ownerResponse.headers.get('Cache-Control'),/no-store/);
 const owner=(await ownerResponse.json()).profile;assert.equal(owner.location,raw);assert.equal(owner.place_country_code,'CH');assert.equal(owner.place_status,'pending');
 assert.deepEqual(placeOptions([owner],'city','de'),[]);assert.deepEqual(placeOptions([owner],'country','de'),[{value:'CH',label:'Schweiz'}]);
 const edited='Own second synthetic hamlet, Ticino, CH';assert.equal((await f.call('PATCH',{location:edited})).status,200);
 assert.equal(f.saved().place_original,edited);assert.equal(f.saved().place_country_code,'CH');assert.equal(f.saved().place_city_id,null);assert.equal(f.saved().place_status,'pending');
});

test('new and edited Ashford profiles retain the selected homonym identity and never accept a mismatched country or region',async()=>{
 const raw='Ashford, England, GB',ids=['geonames:2656954','geonames:2656955'],rows=[];
 for(const id of ids){
  const f=fixture();assert.equal((await f.call('POST',createBody(raw,id))).status,200);
  const row=f.saved();assert.equal(row.place_city_id,id);assert.equal(row.place_country_code,'GB');assert.equal(row.place_region_id,'GB:geonames:6269131');assert.equal(row.place_status,'verified');rows.push(row);
 }
 assert.deepEqual(new Set(placeOptions(rows,'city','de').map(option=>option.value)),new Set(ids));
 const f=fixture();assert.equal((await f.call('POST',createBody(raw,ids[0]))).status,200);
 assert.equal((await f.call('PATCH',{location:raw,selected_place_city_id:ids[1]})).status,200);
 assert.equal(f.saved().place_city_id,ids[1]);assert.equal(f.saved().place_status,'verified');
 for(const [location,selected] of [['Ashford, England, DE',ids[0]],['Ashford, Bavaria, GB',ids[1]],[raw,'geonames:2886242'],[raw,'geonames:1']]){
  const bad=fixture();assert.equal((await bad.call('POST',createBody(location,selected))).status,200);
  assert.equal(bad.saved().place_status,'pending');assert.equal(bad.saved().place_city_id,null);assert.equal(bad.saved().place_original,location);
  assert.deepEqual(placeOptions([bad.saved()],'city','de'),[]);
 }
});
