import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {placeCatalog,placeFieldsForId,placeWriteFields,resolvePlace} from './places/catalog.ts';
import {countryName,placeKey} from './places/core.ts';
import {SUPPORTED_LOCALES} from './i18n/locales.ts';
import {COUNTRY_CODES} from './places/countries.ts';

const regions=new Map(placeCatalog.regions.map(region=>[region.id,region]));
const cities=new Map(placeCatalog.cities.map(city=>[city.id,city]));
const countryLabels=new Map(SUPPORTED_LOCALES.map(locale=>[locale,new Map(placeCatalog.countries.map(code=>[code,countryName(code,locale)]))]));
const washington=cities.get('geonames:4140963');

function assertSelection(city,raw,select=placeFieldsForId){
 const result=select(city.id,raw);
 assert.ok(result,`${city.id}: ${raw}`);
 assert.equal(result.place_city_id,city.id,raw);
 assert.equal(result.place_country_code,city.country,raw);
 assert.equal(result.place_region_id,regions.get(city.region)?.id??null,raw);
 assert.equal(result.place_city_name,city.name,raw);
 assert.equal(result.place_status,'verified',raw);
 assert.equal(result.place_original,raw,'Original text must remain lossless');
}

test('every canonical city path and its selected-ID writer keep the same separate fields',t=>{
 assert.ok(placeCatalog.cities.length>=31793,'Test the complete catalogue rather than a sample');
 for(const city of placeCatalog.cities){
  const raw=[city.name,regions.get(city.region)?.name??'',city.country].join(', ');
  assertSelection(city,raw);
  assertSelection(city,raw,(id,value)=>placeWriteFields(value,id));
 }
 t.diagnostic(`${placeCatalog.cities.length} canonical paths and selected-ID writes checked`);
});

for(const locale of SUPPORTED_LOCALES)test(`${locale}: every localized city/region/country path works with optional region and empty region slot`,t=>{
 for(const city of placeCatalog.cities){
  const region=regions.get(city.region),cityName=city.names[locale]??city.name;
  const regionName=region?.names[locale]??region?.name??'';
  const country=countryLabels.get(locale).get(city.country);
  for(const raw of [[cityName,regionName,country].join(', '),[cityName,country].join(', '),[cityName,'',country].join(', ')])assertSelection(city,raw);
 }
 t.diagnostic(`${placeCatalog.cities.length*3} complete, optional and empty-region paths checked`);
});

test('Washington, D.C. and actual comma-bearing canonical names are selected without inventing IDs',()=>{
 assert.ok(washington.aliases.some(alias=>placeKey(alias)===placeKey('Washington, D.C.')));
 for(const raw of ['Washington, D.C., District of Columbia, United States','Washington, D.C., US','Washington, D.C., , US'])assertSelection(washington,raw);
 const commaCities=placeCatalog.cities.filter(city=>city.name.includes(','));
 assert.ok(commaCities.length>=2);
 for(const city of commaCities)assertSelection(city,[city.name,regions.get(city.region)?.name??'',city.country].join(', '));
 for(const city of placeCatalog.cities){
  const commaAliases=new Set([...city.aliases,...Object.values(city.names)].filter(alias=>alias.includes(',')));
  for(const alias of commaAliases){
   assertSelection(city,[alias,regions.get(city.region)?.name??'',city.country].join(', '));
   assertSelection(city,[alias,city.country].join(', '));
  }
 }
});

test('catalogued comma-bearing region aliases retain their exact parent identity',()=>{
 let checked=0;
 for(const region of placeCatalog.regions){
  const labels=new Set([region.name,...region.aliases,...Object.values(region.names)].filter(label=>label.includes(',')));
  if(!labels.size)continue;
  const city=placeCatalog.cities.find(city=>city.region===region.id);
  if(!city)continue;
  for(const label of labels)for(const locale of SUPPORTED_LOCALES){
   assertSelection(city,[city.names[locale]??city.name,label,countryLabels.get(locale).get(city.country)].join(', '));
   checked++;
  }
 }
 assert.ok(checked>0,'Include the actual Spanish Tierra del Fuego region name');
});

/** Country labels come from Intl, whose CLDR version can vary by runtime.
 * Supply an explicit legitimate comma-bearing BQ display label to the actual
 * core/catalog modules; no country aliases or production data are modified. */
function commaCountryFixture(){
 const names={
  de:'Bonaire, Sint Eustatius und Saba',en:'Bonaire, Sint Eustatius and Saba',
  es:'Bonaire, San Eustaquio y Saba',it:'Bonaire, Sint Eustatius e Saba',
  cs:'Bonaire, Svatý Eustach a Saba',hu:'Bonaire, Sint Eustatius és Saba',
  nl:'Bonaire, Sint Eustatius en Saba','nl-BE':'Bonaire, Sint Eustatius en Saba',
  sv:'Bonaire, Sint Eustatius och Saba',
 };
 class DisplayNames extends Intl.DisplayNames{
  constructor(locales,options){super(locales,options);this.locale=locales[0];}
  of(code){return code==='BQ'?names[this.locale]:super.of(code);}
 }
 const dependencies={
  '../i18n/locales':{SUPPORTED_LOCALES},'./countries':{COUNTRY_CODES},
  './catalog.json':{default:placeCatalog},
 };
 function load(file){
  const exports={},source=ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  runInNewContext(source,{exports,Intl:{DisplayNames},require(name){assert.ok(Object.hasOwn(dependencies,name),name);return dependencies[name];}});
  return exports;
 }
 dependencies['./core']=load('./places/core.ts');
 return {names,...load('./places/catalog.ts')};
}

test('all nine comma-bearing country display labels require the complete matching country suffix',()=>{
 const fixture=commaCountryFixture(),city=placeCatalog.cities.find(city=>city.country==='BQ');
 assert.ok(city);
 for(const locale of SUPPORTED_LOCALES){
  const country=fixture.names[locale],region=regions.get(city.region);
  for(const raw of [[city.name,region?.name??'',country].join(', '),[city.name,country].join(', ')])assertSelection(city,raw,fixture.placeFieldsForId);
  assert.equal(fixture.placeFieldsForId(washington.id,[washington.name,country].join(', ')),null);
  assert.equal(fixture.placeFieldsForId(city.id,[city.name,country,'US'].join(', ')),null);
  assert.equal(fixture.placeFieldsForId(city.id,[city.name,'Unknown region',country].join(', ')),null);
 }
});

test('foreign, stale and forged IDs or paths remain rejected with comma-bearing city names',()=>{
 for(const raw of [
  'Washington, D.C.', 'Washington, D.C., District of Columbia',
  'Washington, D.C., District of Columbia, CA','Washington, D.C., District of Columbia, DE',
  'Washington, D.C., Maryland, US','Washington, D.C., Unknown region, US',
  'Washington, D.C., District of Columbia, CA, US','Paris, District of Columbia, US',
  ', District of Columbia, US','Washington, D.C., District of Columbia, ',
  'Washington, D.C., District of Columbia, US,','Washington<script>alert(1)</script>, US',
  '!!!, Washington, D.C., US','Washington, D.C., !!!, US','Washington, D.C., US, !!!',
  'US','United States','Washington D.C. US',
 ])assert.equal(placeFieldsForId(washington.id,raw),null,raw);
 const proper='Washington, D.C., District of Columbia, US';
 for(const id of ['geonames:2634715','geonames:4915545','geonames:2886242','geonames:0','geonames:4140963,geonames:2634715',' geonames:4140963 ',null,{},['geonames:4140963']])assert.equal(placeFieldsForId(id,proper),null,String(id));
 assert.equal(placeFieldsForId('geonames:2886242','Köln, Bayern, DE'),null);
 assert.equal(placeFieldsForId('geonames:2886242',', Nordrhein-Westfalen, DE'),null);
 assert.equal(placeFieldsForId('geonames:2886242','Bayern, DE'),null);
 assert.equal(placeFieldsForId('geonames:2886242','Köln, Nordrhein-Westfalen, FR'),null);
});

test('explicit homonyms still work while unselected international text remains pending and lossless',()=>{
 for(const id of ['geonames:2656954','geonames:2656955'])assertSelection(cities.get(id),'Ashford, England, GB');
 for(const raw of ['Washington, D.C., US','Misato, Saitama, JP','Small member-defined village, region, CH']){
  const fields=placeWriteFields(raw);
  assert.equal(fields.place_status,'pending',raw);
  assert.equal(fields.place_city_id,null,raw);
  assert.equal(fields.place_original,raw);
 }
 assert.equal(resolvePlace('Ashford, England, GB').status,'pending');
});
