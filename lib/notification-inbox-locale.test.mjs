import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setImmediate as nextTurn} from 'node:timers/promises';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import {createInboxPolling} from './inbox-polling.ts';
import {notificationCopy,translatorFor} from './i18n-test-fixture.mjs';
import {SUPPORTED_LOCALES} from './i18n/locales.ts';
const fixtureRoot=process.env.CINEGENIUS_INBOX_TEST_SOURCE??fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(import.meta.url),identity={userId:'member-a',sessionId:'session-a'};
const memberName='Film als Kunst GmbH <東京> & Zoë';
const canonical={id:'canonical-notice',type:'friend_request',...notificationCopy.localizedNotification({title:{key:'n_cbf93b99dd39'},body:{key:'n_aa80d88f1a90',values:{value0:memberName}}}),href:'/profile/member-a',read:false,created_at:'2026-11-10T08:00:00Z'};
const manual={id:'member-notice',type:'review_request',title:'Personal “als” title 東京',body:'My own <private> words {never_translate}.',href:'/dashboard?tab=own',read:true,created_at:'2026-11-10T08:01:00Z'};
function payload(locale,count=3,read=false){const native=notificationCopy.localizeNotification(canonical,translatorFor(locale,'NotificationCopy'));delete native.localization;return{count,notifications:[{...native,read},{...manual}]};}
const json=(locale,count=3,read=false)=>Response.json(payload(locale,count,read));
function deferred(){let resolve;const promise=new Promise(done=>{resolve=done});return{promise,resolve};}
const tick=async()=>{for(let i=0;i<20;i++)await Promise.resolve();await nextTurn();};
function load(file,mocks){const code=ts.transpileModule(readFileSync(resolve(fixtureRoot,'lib',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;const m={exports:{}};new Function('require','module','exports',code)(name=>Object.hasOwn(mocks,name)?mocks[name]:require(name),m,m.exports);return m.exports;}

function hookFixture(){
 const globals=['window','document','navigator','fetch'],before=Object.fromEntries(globals.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 let locale='de',cursor=0,dirty=false,current;const slots=[],effects=[],calls=[],counts=[];const timers=new Map();let timerId=0;
 const browser=new EventTarget(),document=new EventTarget();document.visibilityState='visible';
 browser.setInterval=fn=>{timers.set(++timerId,fn);return timerId};browser.clearInterval=id=>timers.delete(id);
 Object.defineProperty(globalThis,'window',{value:browser,configurable:true});Object.defineProperty(globalThis,'document',{value:document,configurable:true});Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});
 Object.defineProperty(globalThis,'fetch',{value:(url,init={})=>{const task=deferred();calls.push({url,init,locale,task});return task.promise;},configurable:true});
 const equal=(a,b)=>a&&a.length===b.length&&b.every((x,i)=>Object.is(x,a[i]));
 const hooks={useState(initial){const i=cursor++;if(!slots[i])slots[i]={value:typeof initial==='function'?initial():initial};return[slots[i].value,value=>{const next=typeof value==='function'?value(slots[i].value):value;if(!Object.is(slots[i].value,next)){slots[i].value=next;dirty=true;}}];},useRef(initial){const i=cursor++;return(slots[i]??={value:{current:initial}}).value;},useCallback(fn,deps){const i=cursor++;if(!slots[i]||!equal(slots[i].deps,deps))slots[i]={value:fn,deps};return slots[i].value;},useEffect(fn,deps){const i=cursor++;if(!slots[i]||!equal(slots[i].deps,deps)){const previous=slots[i];slots[i]={deps,cleanup:previous?.cleanup};effects.push(()=>{previous?.cleanup?.();slots[i].cleanup=fn();});}}};
 const getToken=async()=> 'synthetic-token';
 const hook=load('./use-authenticated-inbox.ts',{'react':hooks,'next-intl':{useLocale:()=>locale},'@clerk/nextjs':{useAuth:()=>({isLoaded:true,isSignedIn:true,...identity,getToken}),useSession:()=>({isLoaded:true,session:{id:identity.sessionId,user:{id:identity.userId},status:'active'}})},'@/lib/inbox-polling':{createInboxPolling},'@/lib/message-refresh-policy':{INBOX_FALLBACK_REFRESH_MS:30000},'@/lib/message-read-sync':{subscribeToMessageReads:()=>()=>{}},'@/lib/unread-count-store':{publishUnreadCount:(...args)=>counts.push(args)}}).useAuthenticatedInbox;
 function render(){cursor=0;dirty=false;current=hook();for(const effect of effects.splice(0))effect();return current;}
 return{calls,counts,timers,render,get value(){return current},locale(value){locale=value;return render();},async settle(){for(let i=0;i<12;i++){if(dirty)render();await tick();}if(dirty)render();},respond(index,response=json(calls[index].locale)){calls[index].task.resolve(response);},dispose(){for(const slot of slots)slot?.cleanup?.();for(const key of globals){if(before[key])Object.defineProperty(globalThis,key,before[key]);else delete globalThis[key];}}};
}
function renderCenter(locale,inbox){const component=load('../components/NotificationCenter.tsx',{'react':{...React,useState:()=>[true,()=>{}]},'next-intl':{useLocale:()=>locale,useTranslations:namespace=>translatorFor(locale,namespace)},'next/navigation':{useRouter:()=>({push(){}})},'next/link':{default:({children,href,...props})=>React.createElement('a',{href,...props},children)},'@/lib/notifications':{timeAgo:()=>'',notificationMeta:{}}}).default;return renderToStaticMarkup(React.createElement(component,{inbox}));}
const markup=value=>renderToStaticMarkup(React.createElement(React.Fragment,null,value));

for(const locale of SUPPORTED_LOCALES){
 test(`${locale}: actual shared inbox and open notification center refresh on locale change without polling or writes`,async()=>{
  const f=hookFixture();try{
   f.render();await f.settle();assert.equal(f.calls.length,1);f.respond(0);await f.settle();
   const target=locale==='de'?'en':locale;const before=f.calls.length;const transition=f.locale(target);
   assert.deepEqual(transition.notifications,[],'prior-language titles are hidden immediately');
   await f.settle();assert.equal(f.calls.length,before+1,'locale change starts a GET without a timer tick');
   assert.equal(f.calls.at(-1).init.method??'GET','GET');f.respond(f.calls.length-1);await f.settle();
   const expected=payload(target);assert.deepEqual(f.value.notifications,expected.notifications);assert.equal(f.value.count,3);
   const html=renderCenter(target,f.value);assert.ok(html.includes(markup(translatorFor(target,'notifications')('heading'))));
   for(const n of expected.notifications){assert.ok(html.includes(markup(n.title)));assert.ok(html.includes(markup(n.body)));}
   assert.deepEqual(f.value.notifications.find(n=>n.id===manual.id),manual,'member-written notification remains exact');
   assert.equal(f.timers.size,1,'locale does not recreate the session owner/timer');
   assert.ok(f.calls.every(call=>call.url==='/api/inbox'&&(call.init.method??'GET')==='GET'));
   assert.ok(!f.counts.some(([owner,count])=>owner===null&&count===0),'language changes never reset unread receipts');
  }finally{f.dispose();}
 });
}

for(const oldResult of ['late-json','late-401','late-error'])test(`shared inbox ignores ${oldResult} from an older locale`,async()=>{
 const f=hookFixture();try{
  f.render();await f.settle();const old=f.calls[0];
  let body;if(oldResult==='late-json'||oldResult==='late-error'){body=deferred();old.task.resolve({status:200,ok:true,json:async()=>{const result=await body.promise;if(oldResult==='late-error')throw Error('Older locale parsing failed');return result;}});await tick();}
  f.locale('nl');await f.settle();assert.equal(f.calls.length,2);assert.equal(old.init.signal.aborted,true);
  f.respond(1);await f.settle();assert.deepEqual(f.value.notifications,payload('nl').notifications);
  if(body)body.resolve(payload('de',99));else old.task.resolve(Response.json({code:'account'},{status:401}));
  await f.settle();assert.equal(f.value.status,'ready');assert.equal(f.value.count,3);assert.deepEqual(f.value.notifications,payload('nl').notifications);
 }finally{f.dispose();}
});

test('old GET cleanup cannot release the newer locale request or permit duplicate polling',async()=>{
 const calls=[];const poll=createInboxPolling(identity,async()=> 'token',{locale:'de',fetch:(url,init)=>{const task=deferred();calls.push({url,init,task});return task.promise;}});
 try{const old=poll.refresh();await tick();const latest=poll.setLocale('en');await tick();assert.equal(calls.length,2);calls[0].task.resolve(json('de'));await old;const same=poll.refresh();assert.equal(calls.length,2);calls[1].task.resolve(json('en'));await latest;await same;assert.deepEqual(poll.getSnapshot().notifications,payload('en').notifications);}finally{poll.stop();}
});

test('locale refresh preserves pending read mutation and refetches if its revision overtakes the translated GET',async()=>{
 const calls=[];const poll=createInboxPolling(identity,async()=> 'token',{locale:'de',fetch:(url,init)=>{const task=deferred();calls.push({url,init,task});return task.promise;}});
 try{
  const initial=poll.refresh();await tick();calls[0].task.resolve(json('de'));await initial;
  const mark=poll.markRead(canonical.id);await tick();const mutation=calls[1];assert.equal(mutation.init.method,'POST');assert.deepEqual(JSON.parse(mutation.init.body),{id:canonical.id});
  const change=poll.setLocale('sv');await tick();assert.equal(mutation.init.signal.aborted,false);
  mutation.task.resolve(Response.json({success:true}));assert.equal(await mark,true);
  calls[2].task.resolve(json('sv'));await change;await tick();assert.equal(calls.length,4,'read-revision race requests a current-language replacement');
  calls[3].task.resolve(json('sv',3,true));await tick();assert.equal(poll.getSnapshot().status,'ready');assert.equal(poll.getSnapshot().notifications[0].read,true);assert.equal(poll.getSnapshot().notifications[0].body,payload('sv').notifications[0].body);assert.equal(calls.filter(call=>call.init.method==='POST').length,1);
 }finally{poll.stop();}
});

test('locale changes retain expiry and require the existing explicit session retry',async()=>{
 let valid=false,calls=0;const poll=createInboxPolling(identity,async()=> 'token',{locale:'de',fetch:async()=>{calls++;return valid?json('nl'):Response.json({code:'account'},{status:401});}});
 try{await poll.refresh();assert.equal(poll.getSnapshot().status,'expired');await poll.setLocale('nl');assert.equal(calls,1);assert.equal(poll.getSnapshot().status,'expired');valid=true;await poll.refresh(true);assert.equal(calls,2);assert.equal(poll.getSnapshot().status,'ready');}finally{poll.stop();}
});


test('actual hook keeps the expired-session action localized without automatically retrying it',async()=>{
 const f=hookFixture();try{
  f.render();await f.settle();f.respond(0,Response.json({code:'account'},{status:401}));await f.settle();assert.equal(f.value.status,'expired');
  f.locale('en');await f.settle();assert.equal(f.calls.length,1);assert.equal(f.value.status,'expired');assert.ok(renderCenter('en',f.value).includes(markup(translatorFor('en','notifications')('sessionExpired'))));
  const retry=f.value.refresh(true);await f.settle();assert.equal(f.calls.length,2);f.respond(1);await retry;await f.settle();assert.equal(f.value.status,'ready');assert.deepEqual(f.value.notifications,payload('en').notifications);
 }finally{f.dispose();}
});

test('actual hook replaces a prior-language failed load immediately rather than waiting for its backoff or poll',async()=>{
 const f=hookFixture();try{
  f.render();await f.settle();f.respond(0,Response.json({error:'fixture failure'},{status:503}));await f.settle();assert.equal(f.value.status,'error');
  f.locale('hu');await f.settle();assert.equal(f.calls.length,2);f.respond(1);await f.settle();assert.equal(f.value.status,'ready');assert.deepEqual(f.value.notifications,payload('hu').notifications);
  assert.ok(f.calls.every(call=>(call.init.method??'GET')==='GET'));
 }finally{f.dispose();}
});

test('rapid DE to EN to DE refreshes keep a distinct generation even when the locale name returns',async()=>{
 const f=hookFixture();try{
  f.render();await f.settle();f.locale('en');await f.settle();f.locale('de');await f.settle();assert.equal(f.calls.length,3);
  assert.equal(f.calls[0].init.signal.aborted,true);assert.equal(f.calls[1].init.signal.aborted,true);
  f.respond(2,json('de',7,true));await f.settle();assert.equal(f.value.count,7);assert.equal(f.value.notifications[0].read,true);
  f.respond(0,Response.json({code:'account'},{status:401}));f.respond(1,json('en',99,false));await f.settle();
  assert.equal(f.value.status,'ready');assert.equal(f.value.count,7);assert.deepEqual(f.value.notifications,payload('de',7,true).notifications);assert.equal(f.timers.size,1);
 }finally{f.dispose();}
});
