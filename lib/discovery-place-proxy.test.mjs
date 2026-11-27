import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url),{NextRequest,NextResponse}=require('next/server.js'),{createRouteMatcher}=require('@clerk/nextjs/server');
function fixture(){
 const calls=[],mocks={
  '@/lib/editorial-agent-policy':{editorialCredentialValid:()=>false,editorialRouteAllowed:()=>false},'next-intl':{createTranslator:()=>key=>key},'@/lib/i18n/messages':{loadMessages:async()=>({System:{}})},'@/lib/i18n/locales':{resolveLocale:()=> 'de'},
  '@/lib/request-origin':{trustedMutationOrigin:({requestUrl,origin})=>new URL(requestUrl).origin===origin},'@/lib/media-optimizer-guard':{mediaOptimizerBlockStatus:async()=>null},'@/lib/public-access':{isProtectedCreatePath:()=>false,isPublicProfilePath:()=>false},
  '@clerk/nextjs/server':{clerkMiddleware:fn=>fn,createRouteMatcher},'next/server':{NextRequest,NextResponse},
 };
 const mod={exports:{}},text=readFileSync(new URL('../proxy.ts',import.meta.url),'utf8'),code=ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','module','exports',code)(id=>{assert.ok(Object.hasOwn(mocks,id),id);return mocks[id];},mod,mod.exports);
 const auth=Object.assign(async()=>{calls.push('session');return{userId:null};},{protect:async()=>{calls.push('protect');throw Error('session required');}});
 return{calls,run:(path,method='GET',origin='https://app.invalid')=>mod.exports.default(auth,new NextRequest('https://app.invalid'+path,{method,headers:{origin}}))};
}
test('actual Clerk matcher permits only the exact public discovery read path without a session',async()=>{
 for(const method of ['GET','HEAD']){const f=fixture(),r=await f.run('/api/places/discovery?mode=cities&q=Berlin',method);assert.equal(r.headers.get('x-middleware-next'),'1');assert.deepEqual(f.calls,[]);}
 for(const path of ['/api/places/discovery/private','/api/places/discovery-extra','/api/places/discover'])for(const method of ['GET','HEAD']){const f=fixture(),r=await f.run(path,method);assert.equal(r.status,401,path);assert.deepEqual(await r.json(),{code:'account'});}
});
test('public discovery literal does not grant mutations and retains origin protection',async()=>{
 for(const method of ['POST','PUT','PATCH','DELETE']){const f=fixture();await assert.rejects(f.run('/api/places/discovery',method),/session required/);assert.deepEqual(f.calls,['protect']);const foreign=fixture();assert.equal((await foreign.run('/api/places/discovery',method,'https://foreign.invalid')).status,403);assert.deepEqual(foreign.calls,[]);}
});
