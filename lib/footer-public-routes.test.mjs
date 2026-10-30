import { mediaOptimizerBlockStatus } from "./media-optimizer-guard.ts";
import { trustedMutationOrigin } from "./request-origin.ts";
import * as protectedMedia from "./protected-media.ts";
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {isProtectedCreatePath,isPublicProfilePath} from './public-access.ts';
const require=createRequire(import.meta.url),ts=require('typescript');
const compiled=ts.transpileModule(readFileSync(new URL('../proxy.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const loaded={exports:{}};
const deps={
 "@/lib/media-optimizer-guard": {mediaOptimizerBlockStatus},
 "@/lib/request-origin": {trustedMutationOrigin},
 "@/lib/protected-media": protectedMedia,
 '@clerk/nextjs/server':{clerkMiddleware:fn=>fn,createRouteMatcher:paths=>req=>paths.some(p=>new RegExp(`^${p}$`).test(req.nextUrl.pathname))},
 '@/lib/public-access':{isProtectedCreatePath,isPublicProfilePath},
};
new Function('require','module','exports',compiled)(name=>deps[name]??require(name),loaded,loaded.exports);
async function visit(path){
 const auth=async()=>({userId:null});let protectedCall=null;
 auth.protect=async options=>{protectedCall=options??{};throw new Error('test-sign-in-required')};
 const url=new URL(path,'https://www.cinegenius.co');
 try{return {response:await loaded.exports.default(auth,{url:url.href,nextUrl:url,method:'GET',headers:new Headers()}),protectedCall}}catch(error){assert.equal(error.message,'test-sign-in-required');return {protectedCall};}
}
test('all company and legal footer information pages reach the security-header response without authentication',async()=>{
 for(const path of ['/about','/help','/trust','/pricing','/datenschutz','/agb','/impressum','/ki-transparenz','/bildrechte']){
  const result=await visit(path);assert.equal(result.protectedCall,null,path);assert.equal(result.response.status,200,path);assert.equal(result.response.headers.get('X-Frame-Options'),'DENY',path);
 }
});
test('making the trust information page public does not open management, messages or neighboring paths',async()=>{
 for(const path of ['/trust/settings','/trustworthy','/bildrechte/settings','/ki-transparenz/settings','/ki-transparenz-extra','/dashboard','/profile','/messages','/projects/neu']){
  const {protectedCall}=await visit(path);assert.equal(protectedCall.unauthenticatedUrl,`https://www.cinegenius.co/sign-in?redirect_url=${encodeURIComponent(path)}`,path);
 }
 assert.equal((await visit('/admin')).response.status,307);
});
