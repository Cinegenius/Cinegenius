import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as filters from './organization-directory-filters.ts';
import * as countries from './browse-country.ts';
import * as core from './places/core.ts';
import * as points from './places/public-map-point.ts';
import {placeWriteFields} from './places/catalog.ts';

const org=(id,city='Berlin',country='DE',extra={})=>({id,slug:id,name:id,logo_url:null,moderation_status:'approved',city,...placeWriteFields(`${city}, ${country}`),...extra});
const defaults={country:'',city:'',q:'',page:1};
function fixture(rows,options={}){
 const calls=[];
 const db={from(table){const call={table,where:[],from:0,to:Infinity};const q={
  select(fields,opts){call.fields=fields;call.count=opts?.count;return q},
  eq(...args){call.where.push(['eq',...args]);return q},or(value){call.where.push(['or',value]);return q},ilike(...args){call.where.push(['ilike',...args]);return q},
  order(){return q},range(from,to){call.from=from;call.to=to;return q},abortSignal(signal){call.signal=signal;return q},
  async then(resolve,reject){try{calls.push(call);call.signal.throwIfAborted();if(options.gate)await options.gate(call);
   let selected=rows;
   for(const [method,key,value] of call.where){if(method==='eq')selected=selected.filter(row=>row[key]===value);
    if(method==='or'){assert.equal(key,'place_country_code.is.null,place_country_code.eq.""');selected=selected.filter(row=>!row.place_country_code)}
    if(method==='ilike')selected=selected.filter(row=>row[key].toLocaleLowerCase().includes(value.slice(1,-1).toLocaleLowerCase()));}
   const result={data:selected.slice(call.from,call.to+1),count:call.count==='exact'?selected.length:null,error:options.error?{}:null};
   return resolve(result);
  }catch(error){return reject(error)}}
 };return q}};
 const mocks={'server-only':{},'@/lib/db':{db},'@/lib/browse-country':countries,'@/lib/places/core':core,'@/lib/places/public-map-point':points,'./organization-directory-filters':filters};
 const mod={exports:{}};const source=ts.transpileModule(readFileSync('lib/organization-directory.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','module','exports',source)(id=>{assert.ok(id in mocks,id);return mocks[id]},mod,mod.exports);
 return {calls,read:(params={},signal=AbortSignal.timeout(10000))=>mod.exports.organizationDirectory({...defaults,...params},'de',signal)};
}

test('organization city choices inspect the full approved country pool, while results and exact counts are filtered before paging',async()=>{
 const rows=[...Array.from({length:260},(_,i)=>org(`berlin-${i}`)),org('hamburg','Hamburg'),org('vienna','Wien','AT'),org('private','München','DE',{moderation_status:'draft'})];
 const f=fixture(rows),page=await f.read({country:'DE',page:11});
 assert.equal(page.count,261);assert.equal(page.organizations.length,21);assert.equal(page.hasMore,false);
 assert.equal(page.cities.length,2);assert.ok(page.cities.some(city=>city.label==='Hamburg'));
 const hamburg=page.cities.find(city=>city.label==='Hamburg').value;
 const filtered=await f.read({country:'DE',city:hamburg});assert.equal(filtered.count,1);assert.deepEqual(filtered.organizations.map(row=>row.id),['hamburg']);
 assert.ok(filtered.organizations[0].lat!==null);
 assert.ok(f.calls.some(call=>!call.count&&call.from===250));
 assert.ok(f.calls.every(call=>call.table==='organizations'&&call.where.some(item=>item[1]==='moderation_status'&&item[2]==='approved')));
 assert.ok(f.calls.every(call=>!/(email|phone|members|user_id|address)/.test(call.fields)));
});

test('same-name unverified cities stay separate by country; unknown seats stay in the list without invented coordinates',async()=>{
 const legacy=(id,country)=>org(id,'Springfield',country,{place_status:'pending',place_city_id:null,place_city_name:null,place_country_code:country});
 const f=fixture([legacy('us','US'),legacy('ca','CA'),org('unknown','',null,{city:'Unbekannter Ort',place_status:'pending',place_city_id:null,place_city_name:null,place_country_code:null})]);
 const all=await f.read();assert.equal(all.count,3);assert.equal(all.cities.length,3);
 const selected=await f.read({city:'text:CA:Springfield'});assert.deepEqual(selected.organizations.map(row=>row.id),['ca']);
 const missing=await f.read({country:core.UNASSIGNED_COUNTRY});assert.deepEqual(missing.organizations.map(row=>row.id),['unknown']);
 assert.equal(missing.organizations[0].lat,null);assert.equal(missing.organizations[0].lng,null);
 assert.equal(all.cities.filter(city=>city.label.startsWith('Springfield')).length,2);assert.notEqual(all.cities[0].label,all.cities[1].label);
});

test('search, no matches, page links and URL escaping preserve the selected country and city',async()=>{
 const f=fixture([org('Camera & Film'),org('Other')]);assert.equal((await f.read({q:'camera'})).count,1);
 const empty=await f.read({q:'absent'});assert.equal(empty.count,0);assert.deepEqual(empty.organizations,[]);
 const url=new URL(filters.organizationDirectoryHref({country:'DE',city:'text:DE:A & B',q:'Foto & Film',page:3}),'https://example.test');
 assert.equal(url.searchParams.get('city'),'text:DE:A & B');assert.equal(url.searchParams.get('q'),'Foto & Film');assert.equal(url.searchParams.get('page'),'3');assert.equal(url.searchParams.get('country'),'DE');
 assert.equal(new URL(filters.organizationDirectoryHref(defaults),'https://example.test').searchParams.get('country'),'all');
});

test('facet and result reads start independently; cancellation, query errors and malformed filters never become successful empty lists',async()=>{
 const gate=Promise.withResolvers(),f=fixture([org('one')],{gate:call=>call.count?undefined:gate.promise});
 const pending=f.read();await new Promise(resolve=>setImmediate(resolve));assert.equal(f.calls.length,2);gate.resolve();assert.equal((await pending).count,1);
 await assert.rejects(()=>fixture([],{error:true}).read(),/unavailable/);
 const aborted=new AbortController();aborted.abort();await assert.rejects(()=>fixture([]).read({},aborted.signal));
 for(const params of [{country:'invented-country'},{page:0},{page:1.2},{q:'x'.repeat(121)},{city:'text:bad:Paris'},{city:'id:'},{q:'\u0000'}]){
  const invalid=fixture([]);await assert.rejects(()=>invalid.read(params));assert.equal(invalid.calls.length,0);
 }
});
