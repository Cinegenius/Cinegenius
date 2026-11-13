import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {placeReadFields} from './places/catalog.ts';
import {publicMapPoint} from './places/public-map-point.ts';
import {cinegeniusMapStyle, mapLabelExpression, MAP_ATTRIBUTION} from './map-style.ts';
import {validateStyleMin} from '@maplibre/maplibre-gl-style-spec';

function directory(rows, failAt = -1) {
 const calls=[];
 const db={from(table){assert.equal(table,'companies');let columns,filters=[],offset=0,end=0;const query={
  select(value){columns=value.split(',');return query;},eq(key,value){filters.push([key,value]);return query;},order(){return query;},range(from,to){offset=from;end=to;return query;},
  then(resolve,reject){calls.push({columns,filters,offset,end});const data=rows.filter(row=>filters.every(([key,value])=>row[key]===value)).slice(offset,end+1).map(row=>Object.fromEntries(columns.map(key=>[key,row[key]??null])));return Promise.resolve(offset===failAt?{error:new Error('fixture failed')}:{data,error:null}).then(resolve,reject);}
 };return query;}};
 const code=ts.transpileModule(readFileSync(new URL('./company-directory.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const module={exports:{}};new Function('require','module','exports',code)(name=>({'@/lib/db':{db},'@/lib/places/catalog':{placeReadFields},'@/lib/places/public-map-point':{publicMapPoint}}[name]),module,module.exports);
 return {load:module.exports.getDirectoryCompanies,calls};
}
const company=(id,overrides={})=>({id,slug:id,name:id,city:'München, Bayern, DE',place_status:'pending',published:true,created_at:'2026-11-13',categories:['filmproduktion'],services:[],description:'',verified:false,owner_user_id:'PRIVATE ACCOUNT',address:'PRIVATE STREET',responsible_person:{name:'PRIVATE PERSON'},...overrides});
test('company map loads every public page with city centres and no private contact/address fields',async()=>{
 const rows=Array.from({length:573},(_,i)=>company('public-'+i));rows.splice(4,0,company('secret-draft',{published:false}));rows.push(company('unknown',{city:'An unknown city'}));
 const f=directory(rows),result=await f.load('de');
 assert.equal(result.length,574);assert.equal(new Set(result.map(row=>row.id)).size,574);assert.deepEqual(f.calls.map(call=>call.offset),[0,250,500]);
 assert.ok(result[0].lat>48&&result[0].lat<49);assert.ok(result[0].lng>11&&result[0].lng<12);
 assert.equal(result.at(-1).lat,null);assert.equal(result.at(-1).lng,null);
 assert.ok(!JSON.stringify(result).includes('PRIVATE'));assert.ok(!JSON.stringify(result).includes('secret-draft'));
 for(const call of f.calls){assert.deepEqual(call.filters,[['published',true]]);assert.ok(!call.columns.includes('*'));assert.ok(!call.columns.includes('address'));}
});
test('failed later company page never returns a misleading partial map',async()=>{
 const f=directory(Array.from({length:300},(_,i)=>company(String(i))),250);
 await assert.rejects(f.load('de'),/Unable to load/);
});
test('original map style validates in all locales and retains data attribution',()=>{
 for(const locale of ['de','en','es','it','cs','hu','nl','nl-BE','sv']){
  const style=cinegeniusMapStyle(locale);assert.deepEqual(validateStyleMin(style),[],locale);
  const labels=style.layers.filter(layer=>layer.type==='symbol');assert.ok(labels.length>3);
  for(const layer of labels)assert.deepEqual(layer.layout['text-field'],mapLabelExpression(locale));
  assert.equal(style.sources.openmaptiles.url,'https://tiles.openfreemap.org/planet');
 }
 for(const source of ['openfreemap.org','openmaptiles.org','openstreetmap.org/copyright'])assert.ok(MAP_ATTRIBUTION.includes(source));
 assert.ok(!MAP_ATTRIBUTION.includes('onclick'));
});
