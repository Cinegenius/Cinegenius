import * as marketplaceCatalog from "./marketplaceCategories.ts";
import * as offerModeration from './offer-moderation.ts';
import * as navigationContext from './navigation-context.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {NextResponse} from 'next/server.js';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function load(file,mocks){
 const source=ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const mod={exports:{}};
 new Function('require','module','exports',source)(name=>Object.hasOwn(mocks,name)?mocks[name]:name==="@/lib/marketplaceCategories"?marketplaceCatalog:require(name),mod,mod.exports);
 return mod.exports;
}

test('initial Clerk hydration keeps the verified page mounted; account changes and logout still reset it',()=>{
 let state={isLoaded:false,session:null};
 const component=load('../components/AuthSessionBoundary.tsx',{'@clerk/nextjs':{useSession:()=>state}}).default;
 const key=()=>component({initialSessionId:'own-session-a',children:'Own private page'}).key;
 assert.equal(key(),'own-session-a');
 state={isLoaded:true,session:{id:'own-session-a'}};assert.equal(key(),'own-session-a');
 state={isLoaded:true,session:{id:'own-session-b'}};assert.equal(key(),'own-session-b');
 state={isLoaded:true,session:null};assert.equal(key(),'signed-out');
});

test('server-confirmed admin shell renders before client auth initializes, but a resolved signed-out session hides it',()=>{
 const Context=React.createContext(null);
 function render(serverId,auth){
  const api=load('../app/admin/page.tsx',{
   '@/components/OfferModerationStatus':{default:()=>null},
   '@/lib/offer-moderation':offerModeration,
   '@/lib/navigation-context':navigationContext,
   '@/components/admin/AdminReviewLink':{default:()=>null},
   '@/lib/admin-review':{reportReviewPath:()=>null},
   '@/components/ResponsiblePersonAdmin':{default:()=>null},
   '@clerk/nextjs':{useAuth:()=>auth},
   '@/lib/server-admin-context':{ServerAdminContext:Context},
   'next-intl':{useTranslations:()=>key=>key},
   '@/lib/use-view-state':{useViewState:(_key,initial)=>React.useState(initial)},
   '@/components/admin/SupportMessageAction':{SupportMessageAction:()=>null},
   'next/dynamic':{default:()=>()=>null},
   '@/components/MediaImage':{default:({src,alt})=>React.createElement('img',{src,alt})},
  });
  return renderToStaticMarkup(React.createElement(Context.Provider,{value:serverId},React.createElement(api.default)));
 }
 assert.match(render('own-admin',{isLoaded:false,userId:null}),/Adminbereich/);
 assert.equal(render(null,{isLoaded:false,userId:null}),'');
 assert.equal(render('own-admin',{isLoaded:true,userId:null}),'');
 assert.match(render('own-admin',{isLoaded:true,userId:'own-admin'}),/Adminbereich/);
});

function overviewFixture(authorized=true){
 const started=[],pending=[];
 const db={from(table){let head=false;const query={
  select(_columns,options){head=!!options?.head;return query},eq(){return query},in(){return query},gt(){return query},order(){return query},limit(){return query},
  then(resolve,reject){started.push({table,head});return new Promise(done=>pending.push(()=>done({data:head?null:[{id:'own-listing',title:'Own test listing'}],count:2,error:null}))).then(resolve,reject)},
 };return query}};
 const api=load('../app/api/admin/overview/route.ts',{'@/lib/db':{db},'@/lib/requireAdmin':{requireAdmin:async()=>authorized?{userId:'own-admin'}:NextResponse.json({error:'Forbidden'},{status:403})}});
 return{api,started,pending};
}

test('all overview reads, including recent listings, begin in one parallel round',async()=>{
 const app=overviewFixture();const response=app.api.GET(new Request("https://fixture.invalid/api/admin/overview"));
 for(let i=0;i<10;i++)await Promise.resolve();
 assert.equal(app.started.length,22);
 assert.equal(app.started.filter(query=>!query.head).length,1,'recent listings must not wait for all counts');
 for(const release of app.pending)release();
 const result=await response;
 assert.equal(result.status,200);
 assert.equal(result.headers.get('Cache-Control'),'private, no-store');
 assert.match(result.headers.get('Server-Timing'),/^auth;dur=\d+\.\d, database;dur=\d+\.\d$/);
 const data=await result.json();
 assert.equal(data.counts.profiles,2);assert.equal(data.recentListings[0].id,'own-listing');
});

test('overview makes no database requests for an unauthorized session',async()=>{
 const app=overviewFixture(false);
 assert.equal((await app.api.GET(new Request("https://fixture.invalid/api/admin/overview"))).status,403);
 assert.deepEqual(app.started,[]);
});

test('other admin sections request only three navigation counters, without full overview or listing reads',async()=>{
 const app=overviewFixture();
 const response=app.api.GET(new Request('https://fixture.invalid/api/admin/overview?summary=attention'));
 for(let i=0;i<10;i++)await Promise.resolve();
 assert.equal(app.started.length,3);
 assert.ok(app.started.every(query=>query.head));
 assert.deepEqual(app.started.map(query=>query.table).sort(),['admin_company_membership_clarifications','reports','verification_requests']);
 for(const release of app.pending)release();
 const result=await response;assert.equal(result.status,200);
 assert.deepEqual(await result.json(),{counts:{pendingReports:2,pendingVerifications:2,companyClarifications:2}});
});
