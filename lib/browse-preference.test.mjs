import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {countryCode} from './places/core.ts';

function fixture() {
  let own={userId:null,place:null}, failed=false;
  const request=new Map(),env={VERCEL:'1'};
  const code=ts.transpileModule(readFileSync(new URL('./browse-preference-server.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  const mod={exports:{}};
  const deps={'server-only':{},react:{cache:fn=>fn},'next/headers':{headers:async()=>request},'@/lib/places/core':{countryCode},'@/lib/browse-geography-server':{ownBrowsePlace:async()=>{if(failed)throw Error('unavailable');return own;}}};
  new Function('require','exports','module','process',code)(name=>{assert.ok(name in deps);return deps[name]},mod.exports,mod,{env});
  return {read:mod.exports.preferredBrowsePlace,request,env,set:(value,fail=false)=>{own=value;failed=fail}};
}

test('guests get only a canonical coarse request country, including all requested markets',async()=>{
  const f=fixture();
  for(const country of ['MX','IT','ES','FR','CH','AT','HU','JP','US']){
    f.request.set('x-vercel-ip-country',country);
    assert.deepEqual(await f.read(),{userId:null,place:{country,region:'',city:''},source:'request'});
  }
  for(const country of ['XX','', 'MX,or(user_id.eq.private)']){
    f.request.set('x-vercel-ip-country',country);assert.equal((await f.read()).place,null);
  }
  f.request.set('x-vercel-ip-country','MX');delete f.env.VERCEL;
  assert.equal((await f.read()).place,null,'a local untrusted header must not become production geography');
});

test('travel country wins; saved city refines only the same country; no language-based location',async()=>{
  const f=fixture();const berlin={country:'DE',region:'DE:BE',city:'geonames:2950159'};
  f.set({userId:'A',place:berlin});f.request.set('x-vercel-ip-country','MX');
  assert.deepEqual((await f.read()).place,{country:'MX',region:'',city:''});
  f.request.set('x-vercel-ip-country','DE');assert.deepEqual((await f.read()).place,berlin);
  f.request.delete('x-vercel-ip-country');f.request.set('accept-language','es-MX');
  assert.deepEqual((await f.read()).place,berlin);
  f.set({userId:'B',place:null});assert.deepEqual(await f.read(),{userId:'B',place:null,source:'none'});
  f.set({userId:null,place:null});assert.equal((await f.read()).place,null);
  f.set(null,true);await assert.rejects(f.read(),/unavailable/);
});
