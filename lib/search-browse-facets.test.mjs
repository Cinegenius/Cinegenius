import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { runInNewContext } from 'node:vm';

function endpoint({failCompanies=false}={}) {
  const rows={
    listings:[...Array.from({length:40},(_,id)=>({id:`vehicle-${id}`,type:'vehicle',published:true,title:'Match'})),{id:'job',type:'job',published:true,title:'Match'},{id:'private-prop',type:'prop',published:false,title:'Private'}],
    profiles:[...Array.from({length:100},(_,id)=>({user_id:`private-${id}`,display_name:'Private match'})),{user_id:'public-last-page',display_name:'Public match'}],
    companies:[{id:'public-company',slug:'company',published:true,name:'Public company'},{id:'private-company',published:false,name:'Private company'}],
  };
  const queries=[];
  const db={from(table){let source=rows[table],from=0,to=Infinity;const conditions=[];const builder={select(){return builder},eq(key,value){conditions.push([key,value]);source=source.filter(row=>row[key]===value);return builder},or(){return builder},not(){return builder},neq(){return builder},order(){return builder},limit(count){to=count-1;return builder},range(a,b){from=a;to=b;return builder},then(resolve,reject){queries.push({table,from,to,conditions});return Promise.resolve({data:source.slice(from,to+1),error:failCompanies&&table==='companies'?new Error('offline'):null}).then(resolve,reject)}};return builder}};
  const exports={};
  const labels=()=>Object.assign(key=>key,{has:()=>true});
  const code=ts.transpileModule(readFileSync(new URL('../app/api/search/route.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  runInNewContext(code,{exports,require(name){
    if(name==='@/lib/db')return {db};
    if(name==='next-intl/server')return {getTranslations:async()=>labels(),getLocale:async()=>'de'};
    if(name==='next/server')return {NextResponse:{json:(body,init)=>({body,init})}};
    if(name==='@/lib/trust')return {getPrivateProfileIds:async ids=>new Set(ids.filter(id=>id.startsWith('private-')))};
    if(name==='@/lib/animal-taxonomy')return {animalProfileSearchValues:()=>[],animalCompanySearchFilter:()=>''};
    if(name==='@/lib/catering-taxonomy')return {getCateringProfileSearchValues:()=>[],isCateringSearchQuery:()=>false};
    if(name==='@/lib/safety-medical-taxonomy')return {safetyMedicalProfileValues:()=>[],safetyMedicalSearchTerms:()=>false};
    if(name==='@/lib/marketplaceCategories')return {marketplaceSearchCategories:()=>[]};
    if(name==='@/lib/places/catalog')return {placeSearchFilter:()=>'',placeReadFields:()=>({})};
    if(name==='@/lib/places/core')return {placeDisplay:()=>''};
    if(name==='@/lib/listing-price')return {listingPriceLabel:()=>''};
    throw new Error(name);
  }});
  return {get:type=>exports.GET({nextUrl:new URL(`https://fixture.invalid/api/search?q=match&type=${type}`)}),queries};
}

test('search facets represent each public type beyond the mixed result cap, including later public profiles',async()=>{
  const api=endpoint();const result=await api.get('all');
  assert.deepEqual(new Set(result.body.availableTypes),new Set(['vehicle','job','profile','company']));
  assert(result.body.results.some(row=>row.id==='public-last-page'));
  assert(!result.body.results.some(row=>row.id.startsWith('private')));
  assert(api.queries.some(query=>query.table==='profiles'&&query.from===100));
  for(const query of api.queries.filter(query=>['listings','companies'].includes(query.table)))assert(query.conditions.some(([key,value])=>key==='published'&&value===true));
});
test('changing the selected search type retains other real choices and only returns the requested type',async()=>{
  const result=await endpoint().get('job');
  assert.deepEqual(Array.from(result.body.results,row=>row.id),['job']);
  assert.deepEqual(new Set(result.body.availableTypes),new Set(['vehicle','job','profile','company']));
  assert.equal(result.init.headers['Cache-Control'],'private, no-store');
});
test('query failures do not turn an available search type into an empty facet',async()=>{
  await assert.rejects(endpoint({failCompanies:true}).get('all'),/search_unavailable/);
});
