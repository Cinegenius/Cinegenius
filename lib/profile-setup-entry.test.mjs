import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import * as flow from './profile-setup-flow.ts';
import * as redirects from './auth-redirect.ts';
const require=createRequire(import.meta.url);
function load(file,deps){const compiled=ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;const module={exports:{}};new Function('require','module','exports',compiled)(n=>deps[n]??require(n),module,module.exports);return module.exports;}
function fixture({profile=null,saved=null,userId='test-member',path='/dashboard',failed=false}={}){
 const queried=[],clerkUsers=[];
 const query={select:()=>query,eq:(key,value)=>{queried.push([key,value]);return query;},maybeSingle:async()=>({data:profile,error:failed?{code:'offline'}:null})};
 const server=load('./profile-setup-entry-server.ts',{'server-only':{},'@clerk/nextjs/server':{clerkClient:async()=>({users:{getUser:async id=>{clerkUsers.push(id);return {privateMetadata:{cinegeniusOnboarding:saved}};}}})},'@/lib/db':{db:{from:()=>query}},'@/lib/profile-setup-flow':flow});
 const Redirect=class extends Error {constructor(url){super('redirect');this.url=url;}};
 const layout=load('../app/dashboard/layout.tsx',{'@clerk/nextjs/server':{auth:async()=>({userId})},'next/headers':{headers:async()=>new Headers({'X-CineGenius-Return-Path':path})},'next/navigation':{redirect:url=>{throw new Redirect(url);}},'next/link':{default:'a'},'@/lib/profile-setup-entry-server':server,'@/lib/auth-redirect':redirects});
 return {layout:()=>layout.default({children:'PRIVATE DASHBOARD CONTENT'}),queried,clerkUsers,Redirect};
}

test('dashboard initial request redirects an empty signed-in account before rendering the dashboard',async()=>{
 const f=fixture();await assert.rejects(f.layout(),e=>e instanceof f.Redirect&&e.url==='/profile-setup?welcome=1&redirect=%2Fdashboard');
 assert.deepEqual(f.queried,[['user_id','test-member']]);assert.deepEqual(f.clerkUsers,['test-member']);
});
test('resume preserves the original protected action and prevents blank-profile loops with stale metadata',async()=>{
 const resume=fixture({saved:{quickStart:{step:'details'},setupComplete:false},path:'/dashboard?tab=listings&editListing=test-draft'});
 await assert.rejects(resume.layout(),e=>e.url==='/profile-setup?resume=1&redirect=%2Fdashboard%3Ftab%3Dlistings%26editListing%3Dtest-draft');
 const stale=fixture({profile:{display_name:'',positions:[]},saved:{setupComplete:true,intent:'crew'}});
 await assert.rejects(stale.layout(),e=>e.url.startsWith('/profile-setup?welcome=1'));
});
test('return visits and completed non-personal accounts render the existing dashboard',async()=>{
 const f=fixture({profile:{display_name:'Alex',location:'Berlin',positions:['Licht']}});
 assert.equal((await f.layout()).props.children,'PRIVATE DASHBOARD CONTENT');
 const search=fixture({saved:{setupComplete:true,intent:'search'}});
 assert.equal((await search.layout()).props.children,'PRIVATE DASHBOARD CONTENT');
});
test('signed-out requests go to sign-in and status failures never masquerade as a usable empty dashboard',async()=>{
 const guest=fixture({userId:null});await assert.rejects(guest.layout(),e=>e.url==='/sign-in?redirect_url=%2Fdashboard');assert.deepEqual(guest.queried,[]);
 const failed=fixture({failed:true});const result=await failed.layout();assert.notEqual(result.props.children,'PRIVATE DASHBOARD CONTENT');
 assert.match(JSON.stringify(result),/Einrichtungsstand konnte nicht geladen/);
});
test('unsafe return paths cannot become an external redirect',async()=>{
 const f=fixture({path:'https://evil.invalid'});await assert.rejects(f.layout(),e=>e.url==='/profile-setup?welcome=1&redirect=%2Fdashboard');
});
