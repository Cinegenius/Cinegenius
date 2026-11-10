import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {placeCatalog,placeFieldsForId,placeReadFields,placeWriteFields} from './places/catalog.ts';
import {canonicalFilterValue,matchesPlace,placeOptions,placeSearchMatches} from './places/core.ts';
import * as localeConfig from './i18n/locales.ts';

const locales=localeConfig.SUPPORTED_LOCALES;
const cityStates=[
 {regionId:'DE:geonames:2950157',cityId:'geonames:2950159',city:'Berlin',legacy:'Land Berlin',names:['Berlin','Berlin','Berlín','Berlino','Berlín','Berlin','Berlijn','Berlijn','Berlin']},
 {regionId:'DE:geonames:2911297',cityId:'geonames:2911298',city:'Hamburg',legacy:'Freie und Hansestadt Hamburg',names:['Hamburg','Hamburg','Hamburgo','Amburgo','Hamburk','Hamburg','Hamburg','Hamburg','Hamburg']},
 {regionId:'DE:geonames:2944387',cityId:'geonames:2944388',city:'Bremen',legacy:'Freie Hansestadt Bremen',names:['Bremen','Bremen','Brema','Brema','Brémy','Bréma','Bremen','Bremen','Bremen']},
];

test('public city-state region filters show familiar localized names without changing stored identities',()=>{
 for(const state of cityStates){
  const stored={...placeWriteFields(`${state.city}, DE`,state.cityId),place_region_name:state.legacy};
  for(const [index,locale] of locales.entries()){
   const row=placeReadFields(state.city,stored,locale),label=state.names[index];
   assert.deepEqual(placeOptions([row],'region',locale),[{value:state.regionId,label}]);
   assert.equal(row.place_region_name,label);
   assert.equal(row.place_country_code,'DE');
   assert.equal(row.place_city_id,state.cityId);
   assert.equal(matchesPlace(row,'region',state.regionId),true);
   assert.equal(canonicalFilterValue(state.legacy,[row],'region'),state.regionId);
   assert.equal(placeSearchMatches(row,state.legacy),true);
   assert.ok(placeOptions([row],'city',locale)[0].label.includes(label));
  }
  assert.equal(stored.place_region_name,state.legacy);
 }
 const unknown={place_country_code:'DE',place_region_id:'custom:region',place_city_id:null,place_region_name:'Land Somewhere',place_status:'pending'};
 assert.equal(placeReadFields('',unknown).place_region_name,'Land Somewhere');
 assert.equal(placeCatalog.regions.find(region=>region.id===cityStates[0].regionId).names.de,'Land Berlin');
});

test('short and historical city-state region paths validate the same explicit city and reject a different region',()=>{
 for(const state of cityStates){
  for(const region of [...state.names,state.legacy]){
   const fields=placeFieldsForId(state.cityId,`${state.city}, ${region}, DE`);
   assert.equal(fields?.place_region_id,state.regionId,region);
   assert.equal(fields?.place_city_id,state.cityId,region);
  }
  assert.equal(placeFieldsForId(state.cityId,`${state.city}, Bayern, DE`),null);
  assert.equal(placeFieldsForId(state.cityId,`${state.city}, ${state.names[0]}, US`),null);
 }
});

test('actual place suggestions use short region labels in every locale and remain saveable',async()=>{
 const require=createRequire(import.meta.url),{NextRequest}=require('next/server');
 const source=ts.transpileModule(readFileSync(new URL('../app/api/places/route.ts',import.meta.url),'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
 }).outputText;
 const routeModule={exports:{}};
 new Function('require','module','exports',source)(name=>name==='@/lib/i18n/locales'?localeConfig:require(name),routeModule,routeModule.exports);
 for(const [index,locale] of locales.entries()){
  for(const state of cityStates){
   const response=await routeModule.exports.GET(new NextRequest(`https://fixture.invalid/api/places?${new URLSearchParams({country:'DE',q:state.city,region:state.regionId,locale})}`));
   assert.equal(response.status,200);
   const {regions,cities}=await response.json(),region=regions.find(option=>option.id===state.regionId),city=cities.find(option=>option.id===state.cityId);
   assert.equal(region.name,state.names[index]);
   assert.ok(region.aliases.includes(state.legacy));
   assert.equal(city.region,region.name);
   const saved=placeFieldsForId(city.id,`${city.name}, ${city.region}, DE`);
   assert.equal(saved?.place_city_id,state.cityId);
   assert.equal(saved?.place_region_id,state.regionId);
  }
 }
});
