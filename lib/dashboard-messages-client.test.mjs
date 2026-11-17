import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {dashboardLegacyDestination} from './personal-area-navigation.ts';

// Dashboard no longer owns a chat reader/composer. Actual conversation, stale
// response and read-receipt security remain exercised in message-loading.test.mjs,
// message-read-state.test.mjs and the shared message API/composer suites.
const source=readFileSync(new URL('../app/dashboard/page.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('dashboard.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let analyticsEffect;
function visit(node){
 if(ts.isCallExpression(node)&&node.expression.getText(ast)==='useEffect'){
  const callback=node.arguments[0];
  if(callback?.getText(ast).includes('fetch("/api/conversations"')) analyticsEffect=callback;
 }
 ts.forEachChild(node,visit);
}
visit(ast);
assert.ok(analyticsEffect);
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done});return{resolve,promise}};
const response=(body,status=200)=>({ok:status>=200&&status<300,json:async()=>body});
const settle=async()=>{for(let n=0;n<20;n++)await Promise.resolve()};
function fixture(fetch,{tab='analytics',legacy=null}={}){
 const state={data:[],loading:false,error:false,ready:false};
 const set=key=>value=>{state[key]=typeof value==='function'?value(state[key]):value};
 const deps={fetch,activeTab:tab,legacyDestination:legacy,AbortController,queueMicrotask,setConvsLoading:set('loading'),setConversationsLoadError:set('error'),setConversations:set('data'),setConversationsReady:set('ready')};
 const code=ts.transpileModule('const execute='+analyticsEffect.getText(ast),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 return{state,load:()=>new Function(...Object.keys(deps),code+';return execute;')(...Object.values(deps))()};
}

test('saved dashboard message links preserve the intended conversation in the canonical inbox',()=>{
 assert.equal(dashboardLegacyDestination(new URLSearchParams('tab=messages')),'/messages');
 for(const key of ['conversation','conv']){
  const id='20000000-0000-4000-8000-000000000001';
  assert.equal(dashboardLegacyDestination(new URLSearchParams({tab:'messages',[key]:id})),`/messages?conv=${id}`);
 }
});

test('overview, bookings and legacy redirects never request conversation histories or analytics',async()=>{
 for(const tab of ['overview','bookings','listings','jobs','settings']){
  let calls=0;const f=fixture(async()=>{calls++;return response({data:[]})},{tab});f.load();await settle();assert.equal(calls,0,tab);
 }
 let calls=0;const f=fixture(async()=>{calls++;return response({data:[]})},{legacy:'/messages'});f.load();await settle();assert.equal(calls,0);
 assert.doesNotMatch(source,/\/api\/conversations\/\$\{|incomingUnreadMessageIds|notifyMessagesRead|MessageComposer/);
 assert.match(source,/const inbox = useAuthenticatedInbox\(\)/);
});

test('analytics is read-only, validates its snapshot, and retains confirmed data on failure',async()=>{
 const calls=[];const f=fixture(async(url,init)=>{calls.push({url,init});return response({data:[{id:'inquiry',listing_id:'offer'}]})});
 const cleanup=f.load();await settle();assert.equal(f.state.ready,true);assert.equal(f.state.data[0].id,'inquiry');
 assert.equal(calls.length,1);assert.equal(calls[0].url,'/api/conversations');assert.equal(calls[0].init.method,undefined);assert.equal(calls[0].init.cache,'no-store');cleanup?.();
 for(const answer of [response({},200),response({data:'invalid'},200),response({error:'unavailable'},503)]){
  const failed=fixture(async()=>answer);failed.state.data=[{id:'confirmed'}];const cancel=failed.load();await settle();assert.equal(failed.state.error,true);assert.equal(failed.state.ready,false);assert.deepEqual(failed.state.data,[{id:'confirmed'}]);cancel?.();
 }
});

test('leaving analytics aborts a pending snapshot and ignores late data and errors',async()=>{
 for(const answer of [response({data:[{id:'late'}]}),response({},503)]){
  const waiting=deferred();const f=fixture(()=>waiting.promise);const cleanup=f.load();await settle();cleanup();waiting.resolve(answer);await settle();assert.equal(f.state.ready,false);assert.deepEqual(f.state.data,[]);assert.equal(f.state.error,false);
 }
});
