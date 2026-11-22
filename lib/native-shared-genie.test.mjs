import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as contract from './native-shared-genie.ts';
import {nativeBootSession} from './native-app-boot-readiness.ts';

function browser(){
 const saved=Object.fromEntries(['window','document','MutationObserver','getComputedStyle','fetch'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 const attrs=new Map(),listeners=new Map(),observers=[];let dialogs=[],inert=null;
 const on=(name,fn)=>{if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn)};
 const off=(name,fn)=>listeners.get(name)?.delete(fn);
 const root={getAttribute:key=>attrs.get(key)??null,setAttribute(key,value){attrs.set(key,value)}};
 const window={location:{pathname:'/search'},webkit:{messageHandlers:{bridge:{postMessage(){assert.fail('presentation must never call Capacitor')}}}},addEventListener:on,removeEventListener:off};window.top=window;window.self=window;
 const document={documentElement:root,body:{inert:false},visibilityState:'visible',querySelector:()=>inert,querySelectorAll:()=>dialogs,addEventListener:on,removeEventListener:off};
 class MutationObserver{constructor(fn){this.fn=fn;observers.push(this)}observe(){}disconnect(){this.disconnected=true}}
 Object.assign(globalThis,{window,document,MutationObserver,getComputedStyle:node=>node.style??{display:'block',visibility:'visible',opacity:'1'},fetch(){assert.fail('presentation has no requests')}});
 return {attrs,window,document,listeners,observers,own(){attrs.set(contract.SHARED_GENIE_OWNER,contract.SHARED_GENIE_VERSION)},modal(options={}){dialogs=[{getClientRects:()=>[{}],...options}]},clearModal(){dialogs=[]},inert(value){inert=value},emit(name,options={}){const event={cancelable:true,target:window,defaultPrevented:false,preventDefault(){this.defaultPrevented=true},...options};for(const fn of [...(listeners.get(name)??[])])fn(event);return event},restore(){for(const [key,descriptor]of Object.entries(saved)){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}}};
}

test('only the installed top-frame native owner replaces the website launcher; SSR remains unresolved',()=>{
 const f=browser();try{
  assert.equal(contract.nativeGenieOwnerServerSnapshot(),null);assert.equal(contract.nativeGenieOwnerSnapshot(),false);
  f.own();assert.equal(contract.nativeGenieOwnerSnapshot(),true);
  f.window.top={};assert.equal(contract.nativeGenieOwnerSnapshot(),false);f.window.top=f.window;
  delete f.window.webkit;assert.equal(contract.nativeGenieOwnerSnapshot(),false);
 }finally{f.restore()}
});

test('the actual presentation classifier blocks modal, inert, hidden, guest/auth and open-panel states',()=>{
 const f=browser();try{f.own();const state=(eligible=true,open=false)=>contract.nativeGeniePresentation({eligible,open});
  assert.equal(state(),'available');assert.equal(state(false),'hidden');assert.equal(state(true,true),'open');
  f.document.visibilityState='hidden';assert.equal(state(),'hidden');f.document.visibilityState='visible';
  for(const path of ['/sign-in','/sign-up/verify','/profile-setup','/agb','/datenschutz','/impressum','/offline.html']){f.window.location.pathname=path;assert.equal(state(),'hidden',path)}
  f.window.location.pathname='/messages';f.document.body.inert=true;assert.equal(state(),'blocked');f.document.body.inert=false;
  f.inert({});assert.equal(state(),'blocked');f.inert(null);
  f.modal();assert.equal(state(),'blocked');f.modal({getClientRects:()=>[]});assert.equal(state(),'available');f.modal({style:{display:'none'}});assert.equal(state(),'available');
 }finally{f.restore()}
});

test('presentation publication contains only bounded state and a label, with no account, storage or action payload',()=>{
 const f=browser();try{
  contract.publishNativeGeniePresentation('available','Open');assert.equal(f.attrs.size,0);f.own();
  contract.publishNativeGeniePresentation('available',' Genie öffnen ');assert.equal(f.attrs.get(contract.SHARED_GENIE_LABEL),'Genie öffnen');
  for(const label of ['', 'x'.repeat(121),'Open\nOther']){contract.publishNativeGeniePresentation('blocked',label);assert.equal(f.attrs.get(contract.SHARED_GENIE_LABEL),'Genie')}
  assert.deepEqual([...f.attrs.keys()].sort(),[contract.SHARED_GENIE_OWNER,contract.SHARED_GENIE_AVAILABILITY,contract.SHARED_GENIE_LABEL].sort());
 }finally{f.restore()}
});

const hookCode=ts.transpileModule(readFileSync(new URL('./use-native-shared-genie.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function hookFixture(){
 let auth={isLoaded:true,isSignedIn:true,userId:'user_Current',sessionId:'sess_Current'},session={isLoaded:true,session:{id:'sess_Current',status:'active',user:{id:'user_Current'}}},effect,cleanup,opens=0;
 const mod={exports:{}};
 new Function('require','module','exports',hookCode)(name=>{
  if(name==='react')return{useLayoutEffect:fn=>{effect=fn},useSyncExternalStore:(_subscribe,snapshot)=>snapshot()};
  if(name==='@clerk/nextjs')return{useAuth:()=>auth,useSession:()=>session};
  if(name==='./native-app-boot-readiness')return{nativeBootSession};
  if(name==='./native-shared-genie')return contract;
  assert.fail(name);
 },mod,mod.exports);
 return{get opens(){return opens},render(options={}){cleanup?.();mod.exports.useNativeSharedGenie({enabled:true,owned:true,eligible:true,open:false,label:'Genie öffnen',onOpen:()=>{opens++},...options});cleanup=effect?.()},auth(value){auth={...auth,...value}},session(value){session={...session,...value}},dispose(){cleanup?.()}};
}

test('the real hook opens the existing panel only from the fixed accepted native event and current matching SDK session',()=>{
 const f=browser();let hook;try{f.own();hook=hookFixture();hook.render();
  assert.equal(f.attrs.get(contract.SHARED_GENIE_AVAILABILITY),'available');
  for(const options of [{cancelable:false},{target:{} }])assert.equal(f.emit(contract.SHARED_GENIE_OPEN,options).defaultPrevented,false);
  assert.equal(hook.opens,0);assert.equal(f.emit(contract.SHARED_GENIE_OPEN).defaultPrevented,true);assert.equal(hook.opens,1);
  hook.render({open:true});assert.equal(f.emit(contract.SHARED_GENIE_OPEN).defaultPrevented,false);assert.equal(hook.opens,1);
  hook.render();f.modal();f.emit('cinegenius:messages-chat-state');assert.equal(f.attrs.get(contract.SHARED_GENIE_AVAILABILITY),'blocked');assert.equal(f.emit(contract.SHARED_GENIE_OPEN).defaultPrevented,false);f.clearModal();
  for(const auth of [{isLoaded:false},{isLoaded:true,isSignedIn:false},{isSignedIn:true,sessionId:'sess_Other'},{sessionId:'sess_Current',userId:'user_Other'}]){hook.auth(auth);hook.render();assert.equal(f.attrs.get(contract.SHARED_GENIE_AVAILABILITY),'hidden');assert.equal(f.emit(contract.SHARED_GENIE_OPEN).defaultPrevented,false)}
  hook.auth({isLoaded:true,isSignedIn:true,userId:'user_Current',sessionId:'sess_Current'});hook.session({session:{id:'sess_Current',status:'active',user:{id:'user_Different'}}});hook.render();assert.equal(f.emit(contract.SHARED_GENIE_OPEN).defaultPrevented,false);
  hook.session({session:{id:'sess_Current',status:'active',user:{id:'user_Current'}}});hook.render();f.attrs.delete(contract.SHARED_GENIE_OWNER);assert.equal(f.emit(contract.SHARED_GENIE_OPEN).defaultPrevented,false);assert.equal(hook.opens,1);
 }finally{hook?.dispose();f.restore()}
});

test('unmount removes the native action and publishes hidden without changing the existing conversation',()=>{
 const f=browser();try{f.own();const hook=hookFixture();hook.render();hook.dispose();assert.equal(f.attrs.get(contract.SHARED_GENIE_AVAILABILITY),'hidden');assert.equal(f.listeners.get(contract.SHARED_GENIE_OPEN)?.size??0,0);f.emit(contract.SHARED_GENIE_OPEN);assert.equal(hook.opens,0);assert.ok(f.observers.every(observer=>observer.disconnected));}finally{f.restore()}
});


test('a secondary native presentation suppresses its Web fallback without ever claiming native ownership or actions',()=>{
 const f=browser();try{
  f.attrs.set(contract.SHARED_GENIE_PRESENTATION,'embedded-v1');assert.equal(contract.nativeGenieEmbeddedSnapshot(),true);assert.equal(contract.nativeGenieOwnerSnapshot(),false);
  const hook=hookFixture();hook.render({owned:false});assert.equal(f.listeners.get(contract.SHARED_GENIE_OPEN)?.size??0,0);assert.equal(f.emit(contract.SHARED_GENIE_OPEN).defaultPrevented,false);hook.dispose();
  delete f.window.webkit;assert.equal(contract.nativeGenieEmbeddedSnapshot(),false);
 }finally{f.restore()}
});
