import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as facets from './browse-facets.ts';
import * as region from './news-region.ts';
import * as places from './places/core.ts';

function fixture(rows, failAt = Infinity) {
  const calls = [], loaded = {exports:{}};
  const mocks = {'server-only':{},react:{cache:fn=>fn},'@/lib/browse-facets':facets,'@/lib/news-region':region,'@/lib/places/core':places,
    '@/lib/db':{db:{from:table=>{
      const query={};for(const method of ['select','eq','in','ilike','order'])query[method]=(...args)=>{calls.push([table,method,...args]);return query;};
      query.range=async(from,to)=>{calls.push([table,'range',from,to]);return {data:from>=failAt?null:rows.slice(from,to+1),error:from>=failAt?{code:'TEST_FAILURE'}:null};};return query;
    }}}};
  const code=ts.transpileModule(readFileSync(new URL('./news-discovery.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function('require','module','exports',code)(name=>mocks[name],loaded,loaded.exports);
  return {...loaded.exports,calls};
}
test('discovery exhausts metadata beyond 1000, omits bodies/private data and fails honestly on interrupted pages',async()=>{
  const rows=Array.from({length:1007},(_,i)=>({id:String(i),entry_type:'news',moderation_status:'approved',organization:{region:i%2?'Schweiz':'Deutschland'}}));
  const f=fixture(rows),data=await f.newsDiscoveryIndex();assert.equal(data.length,1007);
  assert.equal(f.calls.filter(call=>call[1]==='range').length,5);
  assert.ok(f.calls.some(call=>call[1]==='eq'&&call[2]==='organization.moderation_status'&&call[3]==='approved'));
  assert.doesNotMatch(f.calls.find(call=>call[1]==='select')[2],/description|summary|image_url|email|owner_user_id/);
  assert.equal(f.regionalNews(data,'DE').length,504);
  assert.deepEqual(new Set(await f.newsCountries()),new Set(['DE','CH']));
  await assert.rejects(()=>fixture(rows,250).newsDiscoveryIndex(),/browse_facets_unavailable/);
});
test('homepage excludes ended and expired events while news source countries remain available',()=>{
  const f=fixture([]),base={organization:{region:'Deutschland'},moderation_status:'approved'};
  const rows=[{...base,id:'news',entry_type:'news'},{...base,id:'future',entry_type:'event',starts_at:'2027-01-01'},
    {...base,id:'expired',entry_type:'workshop',ends_at:'2025-01-01'},
    {...base,id:'ended',entry_type:'news',moderation_status:'ended'},
    {...base,id:'no-date',entry_type:'event'}];
  assert.deepEqual(f.regionalNews(rows,'DE',true,new Date('2026-11-14').getTime()).map(row=>row.id),['news','future']);
  assert.equal(f.regionalNews(rows,'IT',true).length,0);
});
