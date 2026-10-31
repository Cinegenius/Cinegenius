import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import {NextResponse} from 'next/server.js';
import {createInboxPolling} from './inbox-polling.ts';
const require=createRequire(import.meta.url);
function load(file,mocks){
 const source=ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const mod={exports:{}};new Function('require','module','exports',source)(name=>Object.hasOwn(mocks,name)?mocks[name]:require(name),mod,mod.exports);return mod.exports;
}

test('the installed Clerk SDK emits a nonce-bearing script only through the dynamic server slot enabled in our layout',async()=>{
 const layout=readFileSync(new URL('../app/layout.tsx',import.meta.url),'utf8');
 const ast=ts.createSourceFile('layout.tsx',layout,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let provider;
 const visit=node=>{if(ts.isJsxOpeningElement(node)&&node.tagName.getText(ast)==='ClerkProvider')provider=node;ts.forEachChild(node,visit)};visit(ast);
 assert.ok(provider.attributes.properties.some(p=>p.name?.getText(ast)==='dynamic'));
 const nonce='own-test-nonce';
 const scriptTags=load('../node_modules/@clerk/nextjs/dist/esm/utils/clerk-script-tags.js',{
  '../chunk-BUSYA2B4.js':{},react:{default:React},
  '@clerk/shared/loadClerkJsScript':{clerkJSScriptUrl:()=> 'https://clerk.cinegenius.co/npm/@clerk/clerk-js@6/dist/clerk.browser.js',clerkUIScriptUrl:()=> 'https://clerk.cinegenius.co/ui.js',buildClerkJSScriptAttributes:options=>({nonce:options.nonce})},
 });
 const scripts=load('../node_modules/@clerk/nextjs/dist/esm/app-router/server/DynamicClerkScripts.js',{
  '../../chunk-BUSYA2B4.js':{},react:{default:React},'next/headers':{headers:async()=>new Headers({'x-nonce':nonce})},
  '../../utils/clerk-script-tags':scriptTags,'./utils':{getScriptNonceFromHeader:()=>null,isPrerenderingBailout:()=>false},
 });
 const html=renderToStaticMarkup(await scripts.DynamicClerkScripts({publishableKey:'own-test-public-key'}));
 assert.match(html,/<script[^>]+nonce="own-test-nonce"/);assert.match(html,/clerk\.cinegenius\.co/);
});

test('the actual inbox hook waits for a loaded active session, stops on cleanup and handles strict-effect remounting',async()=>{
 const before={window:globalThis.window,document:globalThis.document,fetch:globalThis.fetch};
 let intervals=0,requests=0;const pendingEffects=[];let session={isLoaded:false,session:null};let auth={isLoaded:false,isSignedIn:false,userId:null,sessionId:null,getToken:async()=> 'own-test-token'};
 globalThis.window={setInterval:()=>{intervals++;return intervals},clearInterval:()=>{intervals--},addEventListener:()=>{},removeEventListener:()=>{}};
 globalThis.document={visibilityState:'visible',addEventListener:()=>{},removeEventListener:()=>{}};
 globalThis.fetch=async url=>{requests++;return Response.json({count:2,notifications:[]})};
 const hook=load('./use-authenticated-inbox.ts',{
  react:{...React,useEffect:fn=>pendingEffects.push(fn),useState:initial=>[initial,()=>{}],useRef:initial=>({current:initial}),useCallback:fn=>fn},
  '@clerk/nextjs':{useAuth:()=>auth,useSession:()=>session},'@/lib/inbox-polling':{createInboxPolling},
  '@/lib/message-read-sync':{subscribeToMessageReads:()=>()=>{}},'@/lib/unread-count-store':{publishUnreadCount:()=>{}},
 }).useAuthenticatedInbox;
 const run=()=>{hook();return pendingEffects.pop()()};const settle=async()=>{for(let i=0;i<30;i++)await Promise.resolve()};
 try{
  run();await settle();assert.equal(requests,0);assert.equal(intervals,0);
  auth={...auth,isLoaded:true};session={isLoaded:true,session:null};run();await settle();assert.equal(requests,0);
  auth={...auth,isSignedIn:true,userId:'own-a',sessionId:'own-session'};session={isLoaded:true,session:{id:'own-session',user:{id:'own-a'},status:'pending'}};run();await settle();assert.equal(requests,0);
  session={isLoaded:true,session:{id:'own-session',user:{id:'own-a'},status:'active'}};const stop=run();await settle();assert.equal(requests,1);assert.equal(intervals,1);stop();assert.equal(intervals,0);
  const stopAgain=run();await settle();assert.equal(requests,2);assert.equal(intervals,1);stopAgain();assert.equal(intervals,0);
 }finally{Object.assign(globalThis,before)}
});

function apiFixture(member='own-a',failure=false){
 const queries=[];const db={from(table){const filters=[];const q={select(){return q},eq(key,value){filters.push([key,value]);return q},neq(){return q},order(){return q},limit(){return q},update(){return q},maybeSingle(){return q},then(resolve){queries.push({table,filters});return Promise.resolve({data:failure?null:[],error:failure?{code:'own-test-error'}:null}).then(resolve)}};return q}};
 const auth={getCurrentUser:async()=>member?{userId:member}:null,requireAuth:async()=>member?{userId:member}:NextResponse.json({code:'account'},{status:401})};
 const inboxData=load('./inbox-data.ts',{'server-only':{},'@/lib/db':{db}});
 const notifications=load('../app/api/notifications/route.ts',{'@/lib/db':{db},'@/lib/inbox-data':inboxData,'@/lib/auth':auth,'next/server':{NextResponse}});
 const unread=load('../app/api/unread-count/route.ts',{'@/lib/auth':auth,'next/server':{NextResponse},'@/lib/unread-message-counts':{getUnreadMessageCounts:async id=>{queries.push({userId:id});if(failure)throw Error('test failure');return {count:2}}}});
 return {notifications,unread,queries};
}
test('both actual API GET handlers reject guests without accessing any data, even without Proxy',async()=>{
 const f=apiFixture(null);for(const handler of [f.notifications.GET,f.unread.GET]){const r=await handler();assert.equal(r.status,401);assert.match(r.headers.get('cache-control'),/no-store/)}assert.deepEqual(f.queries,[]);
});
test('authenticated API responses are current-account scoped and non-cacheable; database failures are not empty success',async()=>{
 for(const failure of [false,true]){
  const f=apiFixture('own-member-b',failure);
  for(const handler of [f.notifications.GET,f.unread.GET]){const r=await handler();assert.equal(r.status,failure?500:200);assert.match(r.headers.get('cache-control'),/no-store/)}
  assert.ok(f.queries[0].filters.some(([key,id])=>key==='user_id'&&id==='own-member-b'));assert.equal(f.queries[1].userId,'own-member-b');
  const r=await f.notifications.PATCH();assert.equal(r.status,failure?500:200);
 }
});

test('the notification panel distinguishes loading, expiry, network failure, and a genuinely empty result in all locales',()=>{
 for(const locale of ['de','en','es','it','cs','hu']){
  const messages=JSON.parse(readFileSync(new URL('../messages/'+locale+'.json',import.meta.url),'utf8')).notifications;
  for(const status of ['idle','loading','expired','error','ready']){
   const component=load('../components/NotificationCenter.tsx',{
    react:{...React,useState:()=>[true,()=>{}]},'next/navigation':{useRouter:()=>({push:()=>{}})},'next-intl':{useTranslations:()=>key=>messages[key]},
    'next/link':{default:({children,href,...props})=>React.createElement('a',{href,...props},children)},
    '@/lib/notifications':{timeAgo:()=>'',notificationMeta:{}},
   }).default;
   const html=renderToStaticMarkup(React.createElement(component,{inbox:{status,count:null,notifications:[],refresh:async()=>{},markRead:async()=>true}}));
   if(status==='ready')assert.ok(html.includes(messages.empty));
   else{assert.ok(!html.includes(messages.empty));assert.ok(html.includes(messages[status==='idle'?'signIn':status==='loading'?'loading':status==='expired'?'sessionExpired':'loadError']))}
   assert.equal(html.includes('href="/sign-in?redirect_url=%2Fnotifications"'),status==='expired'||status==='idle');
  }
 }
});
