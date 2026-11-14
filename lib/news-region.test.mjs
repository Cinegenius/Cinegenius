import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import {createHash} from 'node:crypto';
import * as region from './news-region.ts';
import { resolveLocale } from './i18n/locales.ts';

test('manual region wins over profile/network; unknown geography never assumes Germany', () => {
  assert.equal(region.resolvedNewsCountry('IT', 'DE', 'GB'), 'IT');
  assert.equal(region.resolvedNewsCountry('all', 'IT', 'DE'), '');
  assert.equal(region.resolvedNewsCountry('auto', 'IT', 'DE'), 'IT');
  assert.equal(region.resolvedNewsCountry('auto', '', 'IT'), 'IT');
  assert.equal(region.resolvedNewsCountry('auto', '', 'XX'), '');
  assert.equal(region.newsCountryChoice('"DE,or(secret.eq.true)"'), undefined);
});
test('entry country overrides source; explicit source country is allowed only without an entry city', () => {
  const source = {region:'Deutschland · bundesweit'};
  assert.equal(region.newsEntryCountry({organization:source}), 'DE');
  assert.equal(region.newsEntryCountry({organization:{region:'Schweiz'}}), 'CH');
  assert.equal(region.newsEntryCountry({place_country_code:'IT',city:'Roma',organization:source}), 'IT');
  assert.equal(region.newsEntryCountry({city:'Rome',organization:source}), '');
  assert.equal(region.newsEntryCountry({organization:{city:'Berlin'}}), '');
  assert.equal(region.newsEntryCountry({organization:{region:'Deutschland / Österreich'}}), '');
  assert.equal(region.newsEntryCountry({organization:[{place_country_code:'IT',region:'Deutschland'}]}), 'IT');
});
test('language uses manual choice, then browser; coarse geography is only a fallback', () => {
  assert.equal(resolveLocale('en', 'de', 'IT'), 'en');
  assert.equal(resolveLocale(null, 'it-IT,it;q=.9', 'DE'), 'it');
  assert.equal(resolveLocale(null, 'de-DE', 'IT'), 'de');
  assert.equal(resolveLocale(null, '', 'IT'), 'it');
  assert.equal(resolveLocale(null, 'fr', 'CH'), 'de');
  assert.equal(resolveLocale(null, '*', 'ZZ'), 'de');
});

test('manual cookie is canonical, account-bound, and reports blocked storage without throwing', context => {
  const oldDocument=globalThis.document,oldLocation=globalThis.location;
  context.after(()=>{if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;if(oldLocation===undefined)delete globalThis.location;else globalThis.location=oldLocation;});
  globalThis.document={cookie:''};globalThis.location={protocol:'https:'};
  assert.equal(region.rememberNewsCountry('cg_news_country_guest','Italia'),true);
  assert.match(document.cookie,/cg_news_country_guest=IT;/);assert.match(document.cookie,/Secure/);
  assert.equal(region.rememberNewsCountry('bad; injected','IT'),false);
  assert.equal(region.rememberNewsCountry('cg_news_country_guest','IT; Injected=true'),false);
  Object.defineProperty(globalThis,'document',{value:{get cookie(){throw Error('SecurityError');}},configurable:true,writable:true});
  assert.equal(region.rememberNewsCountry('cg_news_country_guest','IT'),false);
});

function serverFixture() {
  let actor = null, profile = '', failure = false;
  const jar = new Map(), headers = new Map([['x-vercel-ip-country', 'IT']]), calls = [];
  const module = {exports:{}};
  const code = ts.transpileModule(readFileSync(new URL('./news-region-server.ts',import.meta.url),'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const mocks = {'server-only':{},'node:crypto':{createHash},'@clerk/nextjs/server':{auth:async()=>({userId:actor})},'next/headers':{cookies:async()=>({get:key=>jar.has(key)?{value:jar.get(key)}:undefined}),headers:async()=>headers},'@/lib/news-region':region,'@/lib/browse-geography-server':{ownBrowsePlace:async()=>{calls.push(actor);if(failure)throw Error('failure');return {place:{country:profile}};}}};
  new Function('require','module','exports',code)(name=>mocks[name],module,module.exports);
  return {read:module.exports.newsRegion,jar,calls,set:(id,country='',fail=false)=>{actor=id;profile=country;failure=fail;}};
}
test('account-scoped preference never carries between guest and other users, and manual choice skips profile query',async()=>{
  const f=serverFixture();
  const guest=await f.read();assert.equal(guest.country,'IT');assert.deepEqual(f.calls,[]);
  f.jar.set(guest.cookieName,'DE');assert.equal((await f.read()).country,'DE');
  f.set('alice','CH');const alice=await f.read();assert.equal(alice.country,'CH');assert.notEqual(alice.cookieName,guest.cookieName);
  f.jar.set(alice.cookieName,'all');const calls=f.calls.length;assert.equal((await f.read()).country,'');assert.equal(f.calls.length,calls);
  f.set('bob','IT');assert.equal((await f.read()).country,'IT');
  assert.equal((await f.read('GB')).country,'GB');
  f.set('alice','',true);assert.equal((await f.read('auto')).country,'IT');
});
