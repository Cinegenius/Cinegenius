import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {createTranslator} from 'next-intl';
import {resolveLocale} from './i18n/locales.ts';
import {trustedMutationOrigin} from './request-origin.ts';
import {isProtectedCreatePath, isPublicProfilePath} from './public-access.ts';
import {messagesFor, translatorFor} from './i18n-test-fixture.mjs';

const compiled = ts.transpileModule(readFileSync(new URL('../proxy.ts', import.meta.url), 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
}).outputText;

function proxy(locale, userId = null) {
  let loads = 0, protections = 0;
  class NextResponse extends Response {
    static json(data, init) {return Response.json(data, init);}
    static redirect(url) {return new Response(null, {status: 307, headers: {location: String(url)}});}
    static next() {return new NextResponse(null);}
  }
  const mocks = {
    'next-intl': {createTranslator},
    '@/lib/i18n/messages': {loadMessages: async selected => {loads++; return messagesFor(selected);}},
    '@/lib/i18n/locales': {resolveLocale},
    '@/lib/request-origin': {trustedMutationOrigin},
    '@/lib/media-optimizer-guard': {mediaOptimizerBlockStatus: async () => null},
    '@/lib/public-access': {isProtectedCreatePath, isPublicProfilePath},
    'next/server': {NextResponse},
    '@clerk/nextjs/server': {
      clerkMiddleware: callback => callback,
      createRouteMatcher: patterns => request => patterns.some(pattern => typeof pattern === 'string'
        ? new RegExp('^' + pattern.replaceAll('(.*)', '.*') + '$').test(request.nextUrl.pathname)
        : pattern.test(request.nextUrl.pathname)),
    },
  };
  const mod = {exports: {}};
  const context = vm.createContext({exports: mod.exports, module: mod, require: id => {
    assert.ok(Object.hasOwn(mocks, id), `unexpected dependency ${id}`); return mocks[id];
  }, Response, Headers, URL, Uint8Array, crypto, btoa, process: {env: {NODE_ENV: 'test', ADMIN_USER_IDS: 'designated-admin'}}});
  vm.runInContext(compiled, context);
  const auth = Object.assign(async () => ({userId}), {protect: async () => {protections++;}});
  const request = (path, method = 'GET', origin) => ({url: 'https://cinegenius.test' + path,
    nextUrl: new URL('https://cinegenius.test' + path), method,
    cookies: {get: name => name === 'cg_locale' ? {value: locale} : undefined},
    headers: new Headers({'accept-language': locale === 'de' ? 'sv' : 'de', ...(origin ? {origin} : {})}),
  });
  return {run: (path, method, origin) => mod.exports.default(auth, request(path, method, origin)), loads: () => loads, protections: () => protections};
}

for (const locale of ['de','en','es','it','cs','hu','nl','nl-BE','sv']) {
  test(`${locale}: localized proxy failures preserve authentication, origin and rate-limit guards`, async () => {
    const t = translatorFor(locale, 'System');
    const signedOut = proxy(locale);
    const unauthorized = await signedOut.run('/api/admin/users');
    assert.equal(unauthorized.status, 401);
    assert.deepEqual(await unauthorized.json(), {error: t('m_352f63d9d1d9')});
    const ordinary = proxy(locale, 'ordinary-member');
    const forbidden = await ordinary.run('/api/admin/users');
    assert.equal(forbidden.status, 403);
    assert.deepEqual(await forbidden.json(), {error: t('m_cd2f7b0a21cd')});
    const csrf = await ordinary.run('/api/listings', 'POST', 'https://foreign.example');
    assert.equal(csrf.status, 403);
    assert.deepEqual(await csrf.json(), {error: t('m_cd2f7b0a21cd')});
    assert.equal(ordinary.protections(), 0);
    const limited = proxy(locale, 'ordinary-member');
    for (let i = 0; i < 60; i++) assert.equal((await limited.run('/api/conversations')).status, 200);
    assert.equal(limited.loads(), 0, 'normal requests must not load an error catalog');
    const rate = await limited.run('/api/conversations');
    assert.equal(rate.status, 429);
    assert.deepEqual(await rate.json(), {error: t('m_35bd89251439')});
    assert.equal(rate.headers.get('X-RateLimit-Limit'), '60');
    assert.ok(Number(rate.headers.get('Retry-After')) > 0);
    assert.equal(limited.loads(), 1);
    assert.equal(limited.protections(), 60);
  });
}

test('public content translation permits only its exact origin-checked POST and retains flood/private-route guards',async()=>{
 const guest=proxy('de');
 assert.equal((await guest.run('/api/content-translations','POST','https://www.cinegenius.co')).status,200);
 assert.equal(guest.protections(),0);
 assert.equal((await guest.run('/api/content-translations','POST','https://evil.example')).status,403);
 for(const [path,method] of [['/api/content-translations','GET'],['/api/content-translations','PUT'],['/api/content-translations/private','POST'],['/api/messages','GET']]) {
   assert.equal((await guest.run(path,method,'https://www.cinegenius.co')).status,401);
 }
 const flood=proxy('en');
 for(let i=0;i<120;i++)assert.equal((await flood.run('/api/content-translations','POST','https://www.cinegenius.co')).status,200);
 assert.equal((await flood.run('/api/content-translations','POST','https://www.cinegenius.co')).status,429);
});

test('Smart results require a member session while retaining origin and private-path guards',async()=>{
 const guest=await proxy('de').run('/api/search/unified','POST','https://www.cinegenius.co');assert.equal(guest.status,401);assert.deepEqual(await guest.json(),{error:'unauthorized'});assert.match(guest.headers.get('cache-control'),/no-store/);
 const f=proxy('de','member');assert.equal((await f.run('/api/search/unified','POST','https://www.cinegenius.co')).status,200);assert.equal(f.protections(),1);
 assert.equal((await proxy('de').run('/api/search/unified','POST','https://foreign.example')).status,403);
 const other=proxy('de');await other.run('/api/search/unified/mutate','POST','https://www.cinegenius.co');assert.equal(other.protections(),1);
 const mutation=proxy('de');await mutation.run('/api/search/unified','DELETE','https://www.cinegenius.co');assert.equal(mutation.protections(),1);
 assert.equal((await proxy('de').run('/api/genie','POST','https://www.cinegenius.co')).status,401);
});

for(const locale of ['de','en','es','it','cs','hu','nl','nl-BE','sv'])test(locale+': native sends share the legacy IP budget and origin protection',async()=>{
 const p=proxy(locale,'member');
 for(let n=0;n<60;n++)assert.equal((await p.run(n%2?'/api/native/v1/conversations/id':'/api/conversations','POST','https://www.cinegenius.co')).status,200);
 assert.equal((await p.run('/api/native/v1/conversations','POST','https://www.cinegenius.co')).status,429);
 assert.equal((await p.run('/api/conversations/id','POST','https://www.cinegenius.co')).status,429);
 for(const [path,method]of[['/api/native/v1/conversations','POST'],['/api/native/v1/conversations/id','POST'],['/api/native/v1/friendships/id/favorite','PUT']]){
  const denied=await proxy(locale,'member').run(path,method,'https://foreign.example');assert.equal(denied.status,403);assert.match(denied.headers.get('cache-control'),/no-store/);
  const own=proxy(locale,'member');assert.equal((await own.run(path,method,'https://www.cinegenius.co')).status,200);assert.equal(own.protections(),1);
 }
});
