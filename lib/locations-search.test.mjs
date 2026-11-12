import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {unstable_getResponseFromNextConfig,getRedirectUrl} from 'next/experimental/testing/server.js';
import {getPublicIconRedirects} from './public-icon-redirects.ts';
import * as images from './image-optimization-policy.ts';
const require=createRequire(import.meta.url);
const code=ts.transpileModule(readFileSync('next.config.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
const mocks={'next-intl/plugin':()=>config=>config,'./lib/public-icon-redirects':{getPublicIconRedirects},'./lib/image-optimization-policy':images};
const mod={exports:{}};new Function('require','module','exports',code)(name=>mocks[name]??require(name),mod,mod.exports);
const nextConfig=mod.exports.default;
const response=url=>unstable_getResponseFromNextConfig({url,nextConfig});
test('the retired search URL redirects permanently with all supported filters and literal search text intact',async()=>{
 for(const params of [{},{q:'Loft & Studio',cityText:'München',country:'DE',region:'DE.02',city:'geonames:2867714',type:'Filmstudio',min:'10',max:'400',sort:'rating',lage:'Innen & Außen',power:'1',instant:'1',verified:'1'},{q:'Unicode čeština + <member text>',country:''}]) {
  const url=new URL('https://www.cinegenius.co/locations/suche');Object.entries(params).forEach(([key,value])=>url.searchParams.set(key,value));
  const result=await response(url.href);assert.equal(result.status,308);
  const destination=new URL(getRedirectUrl(result));assert.equal(destination.origin,url.origin);assert.equal(destination.pathname,'/locations');assert.deepEqual([...destination.searchParams],[...url.searchParams]);
 }
});
test('main page and location detail URLs never loop through the retired search page',async()=>{
 for(const path of ['/locations','/locations/own-location-id'])assert.equal(getRedirectUrl(await response(`https://www.cinegenius.co${path}`)),null);
});
test('old search implementation is removed and homepage searches target the main page',()=>{
 assert.equal(existsSync('app/locations/suche/page.tsx'),false);assert.equal(existsSync('app/locations/LocationsContent.tsx'),false);
 assert.doesNotMatch(readFileSync('components/HeroSearch.tsx','utf8'),/locations\/suche/);
});
test('unrelated public icon redirects remain unchanged',async()=>{
 const result=await response('https://www.cinegenius.co/favicon.ico');assert.equal(result.status,307);assert.equal(getRedirectUrl(result),'https://www.cinegenius.co/icon.svg');
});
