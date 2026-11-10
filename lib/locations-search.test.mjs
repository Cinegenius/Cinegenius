import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {renderToStaticMarkup} from 'react-dom/server';
import {placeFieldsForId, placeReadFields, placeWriteFields} from './places/catalog.ts';

const require=createRequire(import.meta.url);
const berlin=placeFieldsForId('geonames:2950159','Berlin, DE');
const vienna=placeFieldsForId('geonames:2761369','Wien, AT');
const listing=(id,place,overrides={})=>({
 id,user_id:'own-fixture-owner',type:'location',published:true,title:`Own fixture ${id}`,
 city:place.place_city_name,price:0,image_url:null,category:'Studio',description:'Own description',metadata:{},
 ...place,...overrides,
});
const rows=[
 listing('berlin',berlin),listing('vienna',vienna),
 listing('pending',placeWriteFields('Own unassigned city')),
 listing('private',berlin,{published:false}),listing('marketplace',berlin,{type:'prop'}),
];

async function renderSearch(searchParams) {
 const filters=[],ratings=[];
 let output;
 const query={
  select(){return query;},eq(column,value){filters.push([column,value]);return query;},
  order(){return query;},async limit(maximum){return {data:rows.filter(row=>filters.every(([column,value])=>row[column]===value)).slice(0,maximum),error:null};},
 };
 const dependencies={
  '@/lib/db':{db:{from(table){assert.equal(table,'listings');return query;}}},
  '@/lib/places/catalog':{placeReadFields},
  '@/lib/ratings':{fetchRatings:async(ids,kind)=>{ratings.push({ids,kind});return {}; }},
  'next-intl/server':{getLocale:async()=> 'de',getTranslations:async()=>key=>key},
  '@/components/PageHeader':()=>null,
  '../LocationsContent':({serverListings})=>{output=serverListings;return null;},
 };
 const source=ts.transpileModule(readFileSync(new URL('../app/locations/suche/page.tsx',import.meta.url),'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},
 }).outputText;
 const compiled={exports:{}};
 new Function('require','module','exports',source)(name=>Object.hasOwn(dependencies,name)?dependencies[name]:require(name),compiled,compiled.exports);
 const originalFetch=globalThis.fetch;
 globalThis.fetch=async()=>Response.json([{lat:'52.5',lon:'13.4'}]);
 try {renderToStaticMarkup(await compiled.exports.default({searchParams:Promise.resolve(searchParams)}));}
 finally {globalThis.fetch=originalFetch;}
 assert.ok(filters.some(([column,value])=>column==='published'&&value===true));
 assert.ok(filters.some(([column,value])=>column==='type'&&value==='location'));
 assert.deepEqual(ratings,[{ids:output.map(row=>row.id),kind:'listing'}]);
 return {filters,ids:output.map(row=>row.id)};
}

for(const key of ['country','region','city'])test(`an empty ${key} URL parameter means all published locations in the actual search page`,async()=>{
 const {filters,ids}=await renderSearch({[key]:''});
 assert.deepEqual(ids,['berlin','vienna','pending']);
 assert.equal(filters.some(([column])=>column.startsWith('place_')),false);
});

test('clearing every place parameter retains pending offers and the complete public location list',async()=>{
 const {filters,ids}=await renderSearch({country:'',region:'',city:''});
 assert.deepEqual(ids,['berlin','vienna','pending']);
 assert.equal(filters.some(([column])=>column.startsWith('place_')),false);
});

test('nonempty country, region and city selections still filter when other URL parameters are empty',async()=>{
 for(const [key,value,column] of [
  ['country','DE','place_country_code'],
  ['region',berlin.place_region_id,'place_region_id'],
  ['city',berlin.place_city_id,'place_city_id'],
 ]) {
  const {filters,ids}=await renderSearch({country:'',region:'',city:'',[key]:value});
  assert.deepEqual(ids,['berlin']);
  assert.deepEqual(filters.filter(([name])=>name.startsWith('place_')),[[column,value]]);
 }
 const combined=await renderSearch({country:'AT',region:vienna.place_region_id,city:vienna.place_city_id});
 assert.deepEqual(combined.ids,['vienna']);
 assert.equal(combined.filters.filter(([name])=>name.startsWith('place_')).length,3);
});
