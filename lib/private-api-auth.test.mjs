import {createTranslator} from 'next-intl';
import {resolveLocale} from './i18n/locales.ts';
import {messagesFor} from './i18n-test-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {createRequire} from 'node:module';
import {NextRequest,NextResponse} from 'next/server.js';
import {trustedMutationOrigin} from './request-origin.ts';
import {isProtectedCreatePath,isPublicProfilePath} from './public-access.ts';
const {createRouteMatcher:actualCreateRouteMatcher}=createRequire(import.meta.url)('@clerk/nextjs/server');

function fixture(userId=null,options={}){
 const calls=[];let activeUserId=userId,authCalls=0;
 const source=ts.transpileModule(readFileSync(new URL('../proxy.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const loadedModule={exports:{}};
 const mocks={
  'next-intl':{createTranslator},
  '@/lib/i18n/locales':{resolveLocale},
  '@/lib/i18n/messages':{loadMessages:async locale=>messagesFor(locale)},
  '@/lib/request-origin':{trustedMutationOrigin},
  '@/lib/media-optimizer-guard':{mediaOptimizerBlockStatus:async()=>null},
  '@/lib/public-access':{isProtectedCreatePath,isPublicProfilePath},
  '@clerk/nextjs/server':{clerkMiddleware:fn=>fn,createRouteMatcher:options.actualMatcher?actualCreateRouteMatcher:patterns=>request=>patterns.some(pattern=>new RegExp('^'+pattern+'$').test(request.nextUrl.pathname))},
  'next/server':{NextRequest,NextResponse},
 };
 new Function('require','module','exports',source)(name=>{if(!mocks[name])throw Error('Missing mock '+name);return mocks[name]},loadedModule,loadedModule.exports);
 const auth=Object.assign(async()=>{authCalls++;if(options.authThrows)throw Error('PRIVATE_AUTH_FAILURE');return{userId:activeUserId}},{protect:async options=>{calls.push(options);if(!activeUserId)throw Error('Protected browser navigation')}});
 return{run:request=>loadedModule.exports.default(auth,request),calls,setUserId:value=>{activeUserId=value},get authCalls(){return authCalls}};
}
const request=(path,method='GET',origin='https://www.cinegenius.co')=>new NextRequest('https://www.cinegenius.co'+path,{method,headers:{origin}});

test('signed-out private APIs return non-cacheable JSON instead of a hosted sign-in redirect',async()=>{
 for(const path of ['/api/form-drafts?key=listing%3Anew','/api/company-equipment/own/submit','/api/conversations','/api/inbox']){
  const f=fixture();const response=await f.run(request(path));assert.equal(response.status,401);assert.deepEqual(await response.json(),{code:'account'});assert.equal(response.headers.get('location'),null);assert.match(response.headers.get('cache-control'),/no-store/);assert.equal(f.calls.length,0);
 }
});
test('only the exact GET reminder cron route can reach its own secret authorization without a member session',async()=>{
 const allowed=fixture();const response=await allowed.run(request('/api/cron/listing-freshness'));
 assert.equal(response.headers.get('x-middleware-next'),'1');assert.equal(allowed.calls.length,0);
 for(const path of ['/api/cron/listing-freshness/private','/api/cron/listing-freshness-extra','/api/cron/other']){
  assert.equal((await fixture().run(request(path))).status,401,path);
 }
 for(const method of ['HEAD','POST','PUT','PATCH','DELETE']){
  assert.equal((await fixture().run(request('/api/cron/listing-freshness',method))).status,401,method);
 }
});
test('the exact Genie POST requires a session without redirects and retains origin protection',async()=>{
 const guest=fixture();const rejected=await guest.run(request('/api/genie','POST'));
 assert.equal(rejected.status,401);assert.deepEqual(await rejected.json(),{error:'unauthorized'});
 assert.equal(rejected.headers.get('location'),null);assert.match(rejected.headers.get('cache-control'),/private.*no-store/);
 assert.equal(rejected.headers.get('cdn-cache-control'),'no-store');assert.equal(rejected.headers.get('vercel-cdn-cache-control'),'no-store');
 assert.equal(rejected.headers.get('x-content-type-options'),'nosniff');assert.equal(guest.authCalls,1);assert.equal(guest.calls.length,0);
 const member=fixture('own-member');const response=await member.run(request('/api/genie','POST'));
 assert.equal(response.headers.get('x-middleware-next'),'1');assert.equal(member.calls.length,0);assert.equal(member.authCalls,1);
 assert.equal(response.headers.get('x-content-type-options'),'nosniff');
 const foreign=fixture('own-member');const denied=await foreign.run(request('/api/genie','POST','https://foreign.example'));
 assert.equal(denied.status,403);assert.equal(foreign.calls.length,0);
 assert.match(denied.headers.get('cache-control'),/private.*no-store/);
 assert.equal(denied.headers.get('cdn-cache-control'),'no-store');
 assert.equal(denied.headers.get('vercel-cdn-cache-control'),'no-store');
 for(const path of ['/api/genie/private','/api/genie-extra','/api/genie/']){
  assert.equal((await fixture().run(request(path,'POST'))).status,401,path);
 }
 for(const method of ['GET','HEAD','PUT','PATCH','DELETE','OPTIONS']){
  assert.equal((await fixture().run(request('/api/genie',method))).status,401,method);
 }
});
test('private draft mutations retain origin protection and never redirect an expired session',async()=>{
 const f=fixture();assert.equal((await f.run(request('/api/form-drafts','PUT'))).status,401);assert.equal((await f.run(request('/api/form-drafts','PUT','https://foreign.example'))).status,403);assert.equal(f.calls.length,0);
});
test('Genie rejects guests before the IP limiter, then throttles signed-in input before consuming its body',async()=>{
 const f=fixture();
 const makeRequest=(ip,body)=>new NextRequest('https://www.cinegenius.co/api/genie',{
  method:'POST',headers:{origin:'https://www.cinegenius.co','x-forwarded-for':ip,'content-type':'application/json'},body,
 });
 for(let index=0;index<25;index++){
  const req=makeRequest('192.0.2.1',index%2?'{invalid':'x'.repeat(50_000));
  const response=await f.run(req);
  assert.equal(response.status,401);assert.deepEqual(await response.json(),{error:'unauthorized'});
  assert.equal(req.bodyUsed,false);
 }
 f.setUserId('own-member');
 for(let index=0;index<20;index++){
  const req=makeRequest('192.0.2.1',index%2?'{invalid':'x'.repeat(50_000));
  assert.equal((await f.run(req)).headers.get('x-middleware-next'),'1');
  assert.equal(req.bodyUsed,false);
 }
 const blocked=makeRequest('192.0.2.1','{invalid');
 const response=await f.run(blocked);
 assert.equal(response.status,429);
 assert.deepEqual(await response.json(),{error:'rate_limited'});
 assert.equal(blocked.bodyUsed,false);
 assert.equal(f.calls.length,0);
 assert.ok(Number(response.headers.get('retry-after'))>0);
 assert.match(response.headers.get('cache-control'),/private.*no-store/);
 assert.equal(response.headers.get('cdn-cache-control'),'no-store');
 assert.equal(response.headers.get('vercel-cdn-cache-control'),'no-store');
 f.setUserId(null);
 assert.equal((await f.run(makeRequest('192.0.2.1','{}'))).status,401,'an exhausted IP bucket must not replace guest authentication failure');
 f.setUserId('own-member');
 assert.equal((await f.run(makeRequest('192.0.2.2','{}'))).headers.get('x-middleware-next'),'1');
});
test('Genie authentication failures are sanitized and never consume the early IP allowance',async()=>{
 const options={authThrows:true};const f=fixture('own-member',options);
 for(let index=0;index<25;index++){
  const response=await f.run(request('/api/genie','POST'));
  assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:'unavailable'});
  assert.equal(response.headers.get('location'),null);assert.match(response.headers.get('cache-control'),/private.*no-store/);
  assert.equal(response.headers.get('cdn-cache-control'),'no-store');assert.equal(response.headers.get('vercel-cdn-cache-control'),'no-store');
 }
 options.authThrows=false;
 for(let index=0;index<20;index++)assert.equal((await f.run(request('/api/genie','POST'))).headers.get('x-middleware-next'),'1');
 assert.equal((await f.run(request('/api/genie','POST'))).status,429);assert.equal(f.calls.length,0);
});
test('authenticated private APIs still pass through Clerk protect and public reads remain public',async()=>{
 const f=fixture('own-member');const response=await f.run(request('/api/form-drafts'));assert.equal(response.headers.get('x-middleware-next'),'1');assert.equal(f.calls.length,1);
 const publicGuest=fixture();assert.equal((await publicGuest.run(request('/api/listings'))).headers.get('x-middleware-next'),'1');assert.equal(publicGuest.calls.length,0);
});
test('the exact public listing-rating summary passes the real route matcher without a session',async()=>{
 const f=fixture(null,{actualMatcher:true});
 const response=await f.run(request('/api/listing-ratings?ids=public-offer,company-offer'));
 assert.equal(response.status,200);assert.equal(response.headers.get('x-middleware-next'),'1');
 assert.equal(response.headers.get('location'),null);assert.equal(response.headers.get('x-content-type-options'),'nosniff');
 assert.equal(f.authCalls,0);assert.equal(f.calls.length,0);
});
test('public listing-rating reads do not open writes or disable their origin checks',async()=>{
 for(const method of ['POST','PUT','PATCH','DELETE']){
  const guest=fixture(null,{actualMatcher:true});await assert.rejects(()=>guest.run(request('/api/listing-ratings',method)),/Protected browser navigation/);assert.equal(guest.calls.length,1,method+' requires Clerk protect');
  const member=fixture('own-member',{actualMatcher:true});assert.equal((await member.run(request('/api/listing-ratings',method))).headers.get('x-middleware-next'),'1');assert.equal(member.calls.length,1);
  const foreign=fixture('own-member',{actualMatcher:true});assert.equal((await foreign.run(request('/api/listing-ratings',method,'https://foreign.example'))).status,403);assert.equal(foreign.calls.length,0);
 }
});
test('the listing-rating exception cannot open prefixed endpoints or other private account APIs',async()=>{
 for(const path of ['/api/listing-ratings/private','/api/listing-ratings-extra','/api/listing-ratings.json','/api/listing-rating','/api/favorites','/api/inbox','/api/notifications']){
  const f=fixture(null,{actualMatcher:true}),response=await f.run(request(path));
  assert.equal(response.status,401,path);assert.deepEqual(await response.json(),{code:'account'});assert.equal(response.headers.get('location'),null);assert.match(response.headers.get('cache-control'),/no-store/);assert.equal(f.calls.length,0);
 }
});
test('protected browser pages retain the same-host sign-in destination',async()=>{
 const f=fixture();await assert.rejects(()=>f.run(request('/dashboard?tab=listings')),/Protected browser navigation/);assert.equal(f.calls[0].unauthenticatedUrl,'https://www.cinegenius.co/sign-in?redirect_url=%2Fdashboard%3Ftab%3Dlistings');
});

test('the public application manifest is not redirected to an HTML sign-in page; private paths still require auth',async()=>{
 const f=fixture();
 const response=await f.run(request('/manifest.webmanifest'));
 assert.equal(response.headers.get('x-middleware-next'),'1');
 assert.equal(f.calls.length,0);
 for(const path of ['/manifest.webmanifest/private','/dashboard','/inserat']){
  await assert.rejects(()=>fixture().run(request(path)),/Protected browser navigation/);
 }
});


test('strict CSP uses the same fresh nonce for server rendering and the browser; supplied headers cannot override it',async()=>{
 const f=fixture();const observed=new Set();
 for(const path of ['/','/sign-in','/creators']){
  const req=new NextRequest('https://www.cinegenius.co'+path,{headers:{'x-nonce':'untrusted','content-security-policy':"script-src *"}});
  const res=await f.run(req);const csp=res.headers.get('content-security-policy');
  const nonce=res.headers.get('x-middleware-request-x-nonce');
  assert.ok(nonce && nonce!=='untrusted');assert.ok(!observed.has(nonce));observed.add(nonce);
  assert.equal(res.headers.get('x-middleware-request-content-security-policy'),csp);
  assert.ok(csp.includes("'nonce-"+nonce+"'"));assert.ok(csp.includes("'strict-dynamic'"));
  assert.doesNotMatch(csp,/script-src \*/);assert.match(csp,/frame-src[^;]*https:\/\/challenges\.cloudflare\.com/);
  assert.match(csp,/connect-src[^;]*https:\/\/\*\.protect\.clerk\.com:\*/);
 }
});


test('catalogue suggestions and public place options are readable without a session at their exact routes',async()=>{
 for(const path of ['/api/places?country=DE&q=Koeln&locale=de','/api/places/options?scope=marketplace','/api/places/options?scope=locations'])for(const method of ['GET','HEAD']){
  const f=fixture();const response=await f.run(request(path,method));
  assert.equal(response.headers.get('x-middleware-next'),'1',`${method} ${path}`);
  assert.equal(response.headers.get('location'),null);assert.equal(f.calls.length,0);
  assert.equal(response.headers.get('x-content-type-options'),'nosniff');
 }
});

test('public place reads never expose nested routes, admin review or unauthenticated mutations',async()=>{
 for(const path of ['/api/places/private','/api/places/options/private','/api/places-other','/api/places/options-extra','/api/admin/places']){
  const response=await fixture().run(request(path));assert.equal(response.status,401,path);assert.equal(response.headers.get('location'),null);
 }
 for(const path of ['/api/places','/api/places/options'])for(const method of ['POST','PUT','PATCH','DELETE']){
  const guest=fixture();await assert.rejects(()=>guest.run(request(path,method)),/Protected browser navigation/);
  assert.equal(guest.calls.length,1,`${method} ${path} must invoke session protection`);
  const foreign=fixture();assert.equal((await foreign.run(request(path,method,'https://foreign.example'))).status,403);
  assert.equal(foreign.calls.length,0);
  const member=fixture('own-member');assert.equal((await member.run(request(path,method))).headers.get('x-middleware-next'),'1');assert.equal(member.calls.length,1);
 }
 const memberAdmin=await fixture('own-member').run(request('/api/admin/places'));assert.equal(memberAdmin.status,403);
});
