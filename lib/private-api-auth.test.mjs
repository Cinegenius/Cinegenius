import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {NextRequest,NextResponse} from 'next/server.js';
import {trustedMutationOrigin} from './request-origin.ts';
import {isProtectedCreatePath,isPublicProfilePath} from './public-access.ts';

function fixture(userId=null){
 const calls=[];
 const source=ts.transpileModule(readFileSync(new URL('../proxy.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const module={exports:{}};
 const mocks={
  '@/lib/request-origin':{trustedMutationOrigin},
  '@/lib/media-optimizer-guard':{mediaOptimizerBlockStatus:async()=>null},
  '@/lib/public-access':{isProtectedCreatePath,isPublicProfilePath},
  '@clerk/nextjs/server':{clerkMiddleware:fn=>fn,createRouteMatcher:patterns=>request=>patterns.some(pattern=>new RegExp('^'+pattern+'$').test(request.nextUrl.pathname))},
  'next/server':{NextRequest,NextResponse},
 };
 new Function('require','module','exports',source)(name=>{if(!mocks[name])throw Error('Missing mock '+name);return mocks[name]},module,module.exports);
 const auth=Object.assign(async()=>({userId}),{protect:async options=>{calls.push(options);if(!userId)throw Error('Protected browser navigation')}});
 return{run:request=>module.exports.default(auth,request),calls};
}
const request=(path,method='GET',origin='https://www.cinegenius.co')=>new NextRequest('https://www.cinegenius.co'+path,{method,headers:{origin}});

test('signed-out private APIs return non-cacheable JSON instead of a hosted sign-in redirect',async()=>{
 for(const path of ['/api/form-drafts?key=listing%3Anew','/api/company-equipment/own/submit','/api/conversations']){
  const f=fixture();const response=await f.run(request(path));assert.equal(response.status,401);assert.deepEqual(await response.json(),{code:'account'});assert.equal(response.headers.get('location'),null);assert.match(response.headers.get('cache-control'),/no-store/);assert.equal(f.calls.length,0);
 }
});
test('private draft mutations retain origin protection and never redirect an expired session',async()=>{
 const f=fixture();assert.equal((await f.run(request('/api/form-drafts','PUT'))).status,401);assert.equal((await f.run(request('/api/form-drafts','PUT','https://foreign.example'))).status,403);assert.equal(f.calls.length,0);
});
test('authenticated private APIs still pass through Clerk protect and public reads remain public',async()=>{
 const f=fixture('own-member');const response=await f.run(request('/api/form-drafts'));assert.equal(response.headers.get('x-middleware-next'),'1');assert.equal(f.calls.length,1);
 const publicGuest=fixture();assert.equal((await publicGuest.run(request('/api/listings'))).headers.get('x-middleware-next'),'1');assert.equal(publicGuest.calls.length,0);
});
test('protected browser pages retain the same-host sign-in destination',async()=>{
 const f=fixture();await assert.rejects(()=>f.run(request('/dashboard?tab=listings')),/Protected browser navigation/);assert.equal(f.calls[0].unauthenticatedUrl,'https://www.cinegenius.co/sign-in?redirect_url=%2Fdashboard%3Ftab%3Dlistings');
});
