import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {setImmediate as nextTurn} from 'node:timers/promises';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import {translatorFor} from './i18n-test-fixture.mjs';
import * as genie from './genie.ts';
import * as search from './genie-search.ts';
import * as conversation from './genie-conversation.ts';

const require=createRequire(import.meta.url),jsx=require('react/jsx-runtime');
const compile=file=>ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX},
}).outputText;
const panelCode=compile('../components/GeniePanel.tsx'),launcherCode=compile('../components/Genie.tsx');
function defer(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
function elements(value,predicate,result=[]){if(Array.isArray(value))for(const child of value)elements(child,predicate,result);else if(value&&typeof value==='object'&&value.props){if(predicate(value))result.push(value);elements(value.props.children,predicate,result);}return result;}
function text(value){if(value==null||typeof value==='boolean')return'';if(Array.isArray(value))return value.map(text).join(' ');return typeof value==='object'?text(value.props?.children):String(value);}
function sessionStore(){
 let value=null;const check=key=>assert.equal(key,'cg_genie_conversation_v1');
 return{get value(){return value;},getItem(key){check(key);return value;},setItem(key,next){check(key);value=String(next);},removeItem(key){check(key);value=null;}};
}

// Exercise real event handlers and effects. Every import, browser API and request
// is explicit so a new data source or persistence dependency fails this fixture.
// DOM refs record focus calls and blur disabled/detached targets. They do not
// emulate browser layout, software keyboards, native focus or screen readers.
function fixture({locale='en',pathname='/profile/member-private-id',search='',handler,component='panel',cookieVisible=false,chatOpen=false,viewport=false,memoryScope='member-session',sessionLoaded=true,storage=sessionStore()}={}){
 let cursor=0,dirty=false,tree,disposed=false,active=true,language=locale,timerId=0,stateWritesAfterDispose=0,formSubmissions=0,activeElement=null;
 const slots=[],pendingEffects=[],calls=[],timers=new Map(),listeners=new Map(),dynamicLoads=[],requestRef={current:null};
 const frames=new Map(),focusCalls=[],domNodes=new WeakMap(),attachedRefs=new Set(),viewportListeners=new Map();let viewportUpdates=0,frameId=0;
 const visualViewport=viewport?{height:740,offsetTop:0,addEventListener(name,callback){viewportListeners.set(name,callback);},removeEventListener(name){viewportListeners.delete(name);}}:undefined;
 const same=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((value,index)=>Object.is(value,b[index]));
 const hooks={
  useState(initial){const index=cursor++;if(!slots[index]){slots[index]={value:typeof initial==='function'?initial():initial};slots[index].set=next=>{if(disposed)stateWritesAfterDispose++;const value=typeof next==='function'?next(slots[index].value):next;if(!Object.is(value,slots[index].value)){slots[index].value=value;dirty=true;}};}return[slots[index].value,slots[index].set];},
  useRef(initial){const index=cursor++;slots[index]??={current:initial};return slots[index];},
  useId(){const index=cursor++;slots[index]??={value:`genie-fixture-${index}`};return slots[index].value;},
  useCallback(callback,deps){const index=cursor++;if(!same(slots[index]?.deps,deps))slots[index]={deps:[...deps],value:callback};return slots[index].value;},
  useEffect(callback,deps){const index=cursor++;if(!same(slots[index]?.deps,deps)){const prior=slots[index];slots[index]={deps:deps&&[...deps],cleanup:prior?.cleanup};pendingEffects.push(()=>{prior?.cleanup?.();slots[index].cleanup=callback();});}},
  useSyncExternalStore(subscribe,snapshot){const index=cursor++;if(!slots[index]){slots[index]={};pendingEffects.push(()=>{slots[index].cleanup=subscribe(()=>{dirty=true;});});}return snapshot();},
 };
 const window={
  visualViewport,innerHeight:800,location:{pathname,search},
  setTimeout(callback,delay){timers.set(++timerId,{callback,delay});return timerId;},
  clearTimeout(id){timers.delete(id);},
  addEventListener(name,callback){listeners.set(name,callback);},removeEventListener(name){listeners.delete(name);},
  localStorage:{getItem(key){assert.equal(component,'launcher','chat panel must never read localStorage');assert.equal(key,'cg_cookies_ok');return cookieVisible?null:'1';}},
  sessionStorage:storage,
 };
 const forbiddenBrowserState=new Proxy({},{get(_target,key){assert.fail(`Genie read unrelated browser data: ${String(key)}`);}});
 const layoutDataset=new Proxy({messagesChatOpen:String(chatOpen)},{get(target,key){assert.equal(key,'messagesChatOpen');return target[key];}});
 const launcherBody=new Proxy({dataset:layoutDataset},{get(target,key){assert.equal(key,'dataset');return target[key];}});
 const launcherDocument=new Proxy({body:launcherBody},{get(target,key){assert.equal(key,'body');return target[key];}});
 const fetch=async(url,init={})=>{const call={url:String(url),init};calls.push(call);assert.equal(call.url,'/api/genie','chat may contact only its own advice endpoint');return handler?handler(call,calls.length):Response.json({reply:`Answer ${calls.length}`,links:[]});};
 const mocks={
  react:hooks,'react/jsx-runtime':jsx,'next/link':{default:props=>{const attributes={...props};delete attributes.prefetch;return jsx.jsx('a',attributes);}},
  'next/navigation':{usePathname:()=>pathname,useSearchParams:()=>new URLSearchParams(search)},
  'next-intl':{useLocale:()=>language,useTranslations:namespace=>translatorFor(language,namespace)},
  '@clerk/nextjs':{useSession:()=>({isLoaded:sessionLoaded,session:memoryScope?{id:memoryScope}:null})},
  'lucide-react':new Proxy({},{get:()=>()=>jsx.jsx('svg',{'aria-hidden':true})}),
  '@/lib/genie-voice':{nativeGenieVoice:()=>null},'@/lib/genie-search':search,'@/lib/use-form-router':{useFormRouter:()=>({push:()=>{}})},'./GenieVoiceControls':{default:()=>null},'@/lib/genie':genie,'@/lib/genie-conversation':conversation,'./GenieWelcome': {default: () => null}, './GenieLauncher': {default: 'genie-floating-launcher'}, './Genie.module.css':{default:new Proxy({},{get:(_target,key)=>String(key)})},
  'next/dynamic':{default:(loader,options)=>{dynamicLoads.push({loader,options});return 'genie-lazy-panel';}},
 };
 const mod={exports:{}};
 new Function('require','module','exports','fetch','window','document','navigator','requestAnimationFrame','cancelAnimationFrame',component==='panel'?panelCode:launcherCode)(
  name=>{assert.ok(Object.hasOwn(mocks,name),`Unexpected Genie import ${name}`);return mocks[name];},mod,mod.exports,fetch,window,component==='launcher'?launcherDocument:forbiddenBrowserState,forbiddenBrowserState,callback=>{frames.set(++frameId,callback);return frameId;},id=>frames.delete(id),
 );
 function attachElements(){
  const current=new Set();
  for(const element of elements(tree,node=>typeof node.type==='string'&&node.props.ref)){
   const ref=element.props.ref;assert.equal(typeof ref,'object');current.add(ref);
   if(!domNodes.has(ref)){
    const target={element,scrollHeight:0,scrollTop:0,style:{setProperty(){viewportUpdates++;}},toggleAttribute(){},focus(options){assert.ok(attachedRefs.has(ref),'Cannot focus an unmounted element');assert.notEqual(target.element.props.disabled,true,'Cannot focus a disabled control');activeElement=target;focusCalls.push({element:target.element,options});}};
    domNodes.set(ref,target);
   }
   const target=domNodes.get(ref);target.element=element;ref.current=target;
   if(activeElement===target&&element.props.disabled)activeElement=null;
  }
  for(const ref of attachedRefs)if(!current.has(ref)){if(activeElement===ref.current)activeElement=null;ref.current=null;}
  attachedRefs.clear();for(const ref of current)attachedRefs.add(ref);
 }
 function render(){assert.equal(disposed,false);cursor=0;dirty=false;tree=mod.exports.default({active,requestRef,memoryScope});while(tree&&typeof tree.type==='function')tree=tree.type(tree.props);attachElements();for(const effect of pendingEffects.splice(0))effect();return tree;}
 function node(predicate){const match=elements(tree,predicate)[0];assert.ok(match,'Expected UI control');return match;}
 return{
  calls,timers,dynamicLoads,focusCalls,listeners,viewportListeners,storage,render,get viewportUpdates(){return viewportUpdates;},get queuedFrames(){return frames.size;},get tree(){return tree;},get text(){return text(tree);},get writesAfterDispose(){return stateWritesAfterDispose;},get formSubmissions(){return formSubmissions;},get activeElement(){return activeElement;},
  input(){return node(item=>item.type==='textarea');},
  type(value){this.input().props.onChange({target:{value}});render();},
  submit(){return node(item=>item.type==='form').props.onSubmit({preventDefault(){}});},
  click(label){node(item=>item.type==='button'&&item.props['aria-label']===translatorFor(language,'Genie')(label)).props.onClick();render();},
  setActive(value){active=value;render();},setLocale(value){language=value;render();},
  setPathname(value){pathname=value;window.location.pathname=value;render();},
  setMessageChat(value){layoutDataset.messagesChatOpen=String(value);listeners.get('cinegenius:messages-chat-state')?.({detail:value});render();},
  flushFrames(){const current=[...frames.values()];frames.clear();for(const callback of current)callback();},
  keyDown(options={}){const event={key:'Escape',defaultPrevented:false,isComposing:false,preventDefault(){this.defaultPrevented=true;},...options};listeners.get('keydown')?.(event);render();return event;},
  inputKeyDown(options={}){const event={key:'Enter',shiftKey:false,repeat:false,nativeEvent:{isComposing:false,keyCode:13},defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},currentTarget:{form:{requestSubmit:()=>{formSubmissions++;return this.submit();}}},...options};this.input().props.onKeyDown(event);render();return event;},
  pointer(name,inside=false,options={}){const path=inside?[{},node(item=>item.props.role==='dialog').props.ref.current]:[{}];listeners.get(name)?.({composedPath:()=>path,isPrimary:true,button:0,pointerId:1,clientX:10,clientY:10,defaultPrevented:false,...options});render();},
  updateViewport(values,event='resize'){assert.ok(visualViewport);Object.assign(visualViewport,values);viewportListeners.get(event)?.();},
  async settle(){for(let pass=0;pass<8;pass++){if(dirty&&!disposed)render();await nextTurn();}if(!disposed)assert.equal(dirty,false);},
  dispose(){if(disposed)return;disposed=true;for(const slot of slots)slot?.cleanup?.();for(const ref of attachedRefs)ref.current=null;attachedRefs.clear();activeElement=null;},
 };
}

function boundaryFixture({initialSessionId='first-session',storage=sessionStore(),blockedStorage=false}={}){
 let state={isLoaded:true,session:{id:'first-session'},clerkLoaded:true},cursor=0;
 const slots=[],effects=[];
 const mocks={
  react:{Fragment:require('react').Fragment,
   useRef(initial){const index=cursor++;slots[index]??={current:initial};return slots[index];},
   useEffect(callback,deps){const index=cursor++;if(!slots[index]||deps.some((value,i)=>!Object.is(value,slots[index].deps[i]))){slots[index]={deps};effects.push(callback);}},
  },
  'react/jsx-runtime':jsx,'@clerk/nextjs':{useSession:()=>state,useClerk:()=>({loaded:state.clerkLoaded})},
  '@/lib/genie-conversation':conversation,
  'next-intl':{useTranslations:namespace=>translatorFor('en',namespace)},'lucide-react':{Loader2:()=>null},
 };
 const mod={exports:{}},window={get sessionStorage(){if(blockedStorage)throw new DOMException('Blocked','SecurityError');return storage;}};
 new Function('require','module','exports','window',compile('../components/AuthSessionBoundary.tsx'))(name=>{assert.ok(Object.hasOwn(mocks,name),`Unexpected boundary import ${name}`);return mocks[name];},mod,mod.exports,window);
 return{storage,render(nextState=state,children='private chat'){state=nextState;cursor=0;const tree=mod.exports.default({children,initialSessionId});for(const effect of effects.splice(0))effect();return tree;}};
}

function checkPayload(call){
 assert.equal(call.init.method,'POST');assert.equal(call.init.credentials,'same-origin');assert.equal(call.init.cache,'no-store');assert.equal(call.init.referrerPolicy,'no-referrer');
 assert.deepEqual(call.init.headers,{'Content-Type':'application/json'});
 const body=JSON.parse(call.init.body);assert.deepEqual(Object.keys(body).sort(),['area','locale','messages']);
 assert.ok(body.messages.length<=genie.GENIE_MAX_MESSAGES);
 assert.ok(body.messages.reduce((length,message)=>length+message.content.length,0)<=genie.GENIE_MAX_HISTORY_CHARS);
 body.messages.forEach((message,index)=>{assert.deepEqual(Object.keys(message).sort(),['content','role']);assert.equal(message.role,index%2?'assistant':'user');assert.ok(message.content.length<=genie.GENIE_MAX_MESSAGE_CHARS);});
 assert.equal(body.messages.at(-1).role,'user');return body;
}

function checkLoginGate(f,locale,destination){
 const t=translatorFor(locale,'Genie');
 assert.ok(f.text.includes(t('loginTitle')),`${locale}: login title`);
 assert.ok(f.text.includes(t('loginHint')),`${locale}: login explanation`);
 assert.equal(elements(f.tree,node=>node.type==='form'||node.type==='textarea'||node.props.type==='submit').length,0,'a login gate must not expose a composer');
 for(const [path,key] of [['/sign-in','signIn'],['/sign-up','signUp']]){
  const links=elements(f.tree,node=>typeof node.props.href==='string'&&node.props.href.startsWith(`${path}?`));
  assert.equal(links.length,1,`${locale}: one ${path} link`);
  assert.equal(text(links[0]),t(key));
  const url=new URL(links[0].props.href,'https://cinegenius.co');
  assert.equal(url.pathname,path);assert.equal(url.searchParams.get('redirect_url'),destination);
 }
}

test('hiding Genie survives navigation and locale changes but resets on a new visit or app return',t=>{
 const f=fixture({component:'launcher'});t.after(()=>f.dispose());f.render();
 const shown=()=>elements(f.tree,node=>node.type==='button'&&node.props['aria-label']===translatorFor('en','Genie')('open')).length===1;
 const hide=()=>{elements(f.tree,node=>node.type==='genie-floating-launcher')[0].props.onHide();f.render();};
 assert.equal(shown(),true);hide();assert.equal(shown(),false);
 f.setPathname('/companies');assert.equal(shown(),false);
 f.setLocale('de');assert.equal(elements(f.tree,node=>node.props['data-genie-open']!==undefined).length,0);
 f.listeners.get('pageshow')({persisted:false});f.render();assert.equal(elements(f.tree,node=>node.props['data-genie-open']!==undefined).length,0);
 f.setLocale('en');f.listeners.get('pageshow')({persisted:true});f.render();assert.equal(shown(),true);
 hide();f.listeners.get('cinegenius:app-resume')();f.render();assert.equal(shown(),true);
 const newVisit=fixture({component:'launcher'});t.after(()=>newVisit.dispose());newVisit.render();
 assert.equal(elements(newVisit.tree,node=>node.props['data-genie-open']!==undefined).length,1);
 assert.equal(f.calls.length,0);assert.equal(f.storage.value,null);
 f.dispose();assert.equal(f.listeners.has('pageshow'),false);assert.equal(f.listeners.has('cinegenius:app-resume'),false);
});

test('launcher is silent and loads its panel only after an explicit open; cookie notice hides it',()=>{
 const hidden=fixture({component:'launcher',cookieVisible:true});hidden.render();assert.equal(hidden.tree,null);assert.equal(hidden.calls.length,0);hidden.dispose();
 const f=fixture({component:'launcher'});f.render();assert.equal(elements(f.tree,node=>node.type==='genie-lazy-panel').length,0);assert.equal(f.calls.length,0);
 assert.equal(f.dynamicLoads.length,1);assert.equal(f.dynamicLoads[0].options.ssr,false);
 f.click('open');assert.equal(elements(f.tree,node=>node.type==='genie-lazy-panel').length,1);assert.equal(f.calls.length,0);
 const pending=new AbortController();elements(f.tree,node=>node.type==='genie-lazy-panel')[0].props.requestRef.current=pending;f.click('close');assert.equal(pending.signal.aborted,true,'the close action aborts synchronously');assert.equal(elements(f.tree,node=>node.type==='genie-lazy-panel')[0].props.active,false);f.dispose();
});

test('the actual launcher follows initial and event-driven message chat state only on the messages route',t=>{
 const f=fixture({component:'launcher',pathname:'/messages',chatOpen:true});t.after(()=>f.dispose());f.render();
 const launcherCount=()=>elements(f.tree,node=>node.type==='button'&&node.props['aria-label']===translatorFor('en','Genie')('open')).length;
 assert.equal(launcherCount(),0,'a direct visit to an open chat must leave Send uncovered');
 assert.equal(f.listeners.has('cinegenius:messages-chat-state'),true);
 f.setMessageChat(false);assert.equal(launcherCount(),1,'the inbox keeps its usual launcher');
 f.setMessageChat(true);assert.equal(launcherCount(),0,'opening a chat hides the launcher');
 f.setPathname('/projects');assert.equal(launcherCount(),1,'a stale chat flag cannot hide Genie elsewhere');
 f.setPathname('/messages');assert.equal(launcherCount(),0);
 assert.equal(f.calls.length,0);assert.equal(elements(f.tree,node=>node.type==='genie-lazy-panel').length,0);
 f.dispose();assert.equal(f.listeners.has('cinegenius:messages-chat-state'),false);
});

test('opening a message chat preserves an intentionally open Genie panel, request and saved conversation',t=>{
 const storage=sessionStore();conversation.saveConversation(storage,'member-session',[{id:1,user:'Own completed question',reply:'Own completed answer',links:[]}]);const saved=storage.value;
 const f=fixture({component:'launcher',pathname:'/messages',storage});t.after(()=>f.dispose());f.render();f.click('open');
 const before=elements(f.tree,node=>node.type==='genie-lazy-panel')[0],pending=new AbortController();before.props.requestRef.current=pending;
 f.setMessageChat(true);
 const after=elements(f.tree,node=>node.type==='genie-lazy-panel')[0];
 assert.equal(after.props.active,true);assert.equal(after.props.requestRef,before.props.requestRef);assert.equal(after.props.memoryScope,'member-session');
 assert.equal(elements(f.tree,node=>node.props.role==='dialog')[0].props.hidden,false);assert.equal(pending.signal.aborted,false);assert.equal(storage.value,saved);
 f.click('close');f.flushFrames();assert.equal(pending.signal.aborted,true,'explicit close retains its usual cancellation behavior');
 assert.equal(elements(f.tree,node=>node.props.role==='dialog')[0].props.hidden,true);
 assert.equal(elements(f.tree,node=>node.type==='button'&&node.props['aria-label']===translatorFor('en','Genie')('open')).length,0);
 assert.equal(storage.value,saved);f.setMessageChat(false);f.click('open');assert.equal(elements(f.tree,node=>node.type==='genie-lazy-panel')[0].props.active,true);
 assert.equal(storage.value,saved);assert.equal(f.calls.length,0);
});

test('open focuses the labeled dialog and leaves textarea unfocused; close restores launcher focus after remount',t=>{
 const f=fixture({component:'launcher'});t.after(()=>f.dispose());f.render();assert.equal(f.focusCalls.length,0);f.click('open');
 assert.equal(f.focusCalls.length,1);const focused=f.focusCalls[0];assert.equal(focused.element.props.role,'dialog');assert.equal(focused.element.type,'section');assert.equal(focused.element.props.tabIndex,-1);assert.deepEqual(focused.options,{preventScroll:true});
 const heading=elements(f.tree,node=>node.props.id===focused.element.props['aria-labelledby'])[0];assert.ok(heading);assert.equal(text(heading),'Genie');
 const panel=fixture();t.after(()=>panel.dispose());panel.render();assert.equal(panel.focusCalls.length,0,'mounting the chat contents must not focus its textarea');
 f.click('close');assert.equal(f.focusCalls.length,1,'focus waits for the launcher to be mounted');assert.equal(f.queuedFrames,1);f.flushFrames();assert.equal(f.focusCalls.length,2);assert.equal(f.focusCalls.at(-1).element.type,'button');assert.equal(f.focusCalls.at(-1).element.props['aria-label'],translatorFor('en','Genie')('open'));assert.deepEqual(f.focusCalls.at(-1).options,{preventScroll:true});
});

test('Escape closes and aborts; consumed Escape and composition input leave the dialog open',t=>{
 const f=fixture({component:'launcher'});t.after(()=>f.dispose());f.render();f.click('open');const pending=new AbortController();elements(f.tree,node=>node.type==='genie-lazy-panel')[0].props.requestRef.current=pending;
 for(const event of [{defaultPrevented:true},{isComposing:true},{key:'Enter'}]){
  f.keyDown(event);assert.equal(elements(f.tree,node=>node.props.role==='dialog')[0].props.hidden,false);assert.equal(pending.signal.aborted,false);assert.equal(f.queuedFrames,0);
 }
 const escape=f.keyDown();assert.equal(escape.defaultPrevented,true);assert.equal(pending.signal.aborted,true);assert.equal(elements(f.tree,node=>node.props.role==='dialog')[0].props.hidden,true);assert.equal(f.listeners.has('keydown'),false);f.flushFrames();assert.equal(f.focusCalls.at(-1).element.props['aria-label'],translatorFor('en','Genie')('open'));
});

test('a completed outside click closes and aborts without taking focus; an inside click leaves the dialog open',t=>{
 const f=fixture({component:'launcher'});t.after(()=>f.dispose());f.render();assert.equal(f.listeners.has('pointerdown'),false);f.click('open');
 const pending=new AbortController();elements(f.tree,node=>node.type==='genie-lazy-panel')[0].props.requestRef.current=pending;
 for(const name of ['pointerdown','pointerup','click'])f.pointer(name,true);assert.equal(elements(f.tree,node=>node.props.role==='dialog')[0].props.hidden,false);assert.equal(pending.signal.aborted,false);assert.equal(f.queuedFrames,0);
 const focused=f.focusCalls.length;f.pointer('pointerdown');assert.equal(pending.signal.aborted,false,'touch-down may still become a scroll gesture');f.pointer('pointerup');f.pointer('click');assert.equal(elements(f.tree,node=>node.props.role==='dialog')[0].props.hidden,true);assert.equal(pending.signal.aborted,true);assert.equal(f.listeners.has('pointerdown'),false);assert.equal(f.queuedFrames,0);f.flushFrames();assert.equal(f.focusCalls.length,focused,'the clicked page control must keep its focus');
 f.click('open');assert.equal(f.listeners.has('pointerdown'),true);f.dispose();assert.equal(f.listeners.has('pointerdown'),false);
});

test('outside scrolling, cancelled gestures and consumed clicks do not close or abort Genie',t=>{
 const f=fixture({component:'launcher'});t.after(()=>f.dispose());f.render();f.click('open');
 const pending=new AbortController();elements(f.tree,node=>node.type==='genie-lazy-panel')[0].props.requestRef.current=pending;
 for(const kind of ['scroll','cancel','consumed']){
  f.pointer('pointerdown');
  if(kind==='scroll')f.pointer('pointermove',false,{clientY:80});
  if(kind==='cancel')f.pointer('pointercancel');else f.pointer('pointerup',false,{clientY:kind==='scroll'?80:10});
  f.pointer('click',false,{defaultPrevented:kind==='consumed'});
  assert.equal(elements(f.tree,node=>node.props.role==='dialog')[0].props.hidden,false,kind);assert.equal(pending.signal.aborted,false,kind);assert.equal(f.queuedFrames,0);
 }
});

test('viewport event handling is installed only while open and removed on close or disposal',()=>{
 const f=fixture({component:'launcher',viewport:true});f.render();assert.equal(f.viewportListeners.size,0);f.click('open');assert.equal(f.viewportListeners.size,2);const initial=f.viewportUpdates;assert.ok(initial>0);
 f.updateViewport({height:400});f.updateViewport({height:410});assert.equal(f.viewportUpdates,initial);assert.equal(f.queuedFrames,1,'resize bursts should share one animation frame');f.flushFrames();assert.ok(f.viewportUpdates>initial);
 const resized=f.viewportUpdates;f.updateViewport({offsetTop:20},'scroll');f.flushFrames();assert.ok(f.viewportUpdates>resized);
 const unchanged=f.viewportUpdates;f.updateViewport({offsetTop:20},'scroll');f.flushFrames();assert.equal(f.viewportUpdates,unchanged,'unchanged geometry must not rewrite styles');
 f.updateViewport({height:420});f.click('close');assert.equal(f.viewportListeners.size,0);const closed=f.viewportUpdates;f.updateViewport({height:700});assert.equal(f.viewportUpdates,closed);f.flushFrames();assert.equal(f.viewportUpdates,closed,'closing cancels queued viewport work');f.click('open');assert.equal(f.viewportListeners.size,2);f.dispose();assert.equal(f.viewportListeners.size,0);assert.equal(f.listeners.has('keydown'),false);
});

test('Enter submits once while Shift+Enter, composition and held Enter do not submit',async t=>{
 const reply=defer();const f=fixture({handler:()=>reply.promise});t.after(()=>f.dispose());f.render();f.type('First line\nSecond line');
 for(const options of [{shiftKey:true},{nativeEvent:{isComposing:true,keyCode:13}},{nativeEvent:{isComposing:false,keyCode:229}},{key:'a'}]){
  const event=f.inputKeyDown(options);assert.equal(event.defaultPrevented,false);assert.equal(f.formSubmissions,0);assert.equal(f.calls.length,0);assert.equal(f.input().props.value,'First line\nSecond line');
 }
 const repeat=f.inputKeyDown({repeat:true});assert.equal(repeat.defaultPrevented,true);assert.equal(f.formSubmissions,0);
 const enter=f.inputKeyDown();assert.equal(enter.defaultPrevented,true);assert.equal(f.formSubmissions,1);assert.equal(f.calls.length,1);assert.equal(checkPayload(f.calls[0]).messages[0].content,'First line\nSecond line');
 f.inputKeyDown();f.inputKeyDown({repeat:true});assert.equal(f.formSubmissions,1);assert.equal(f.calls.length,1);
 reply.resolve(Response.json({reply:'Keyboard answer',links:[]}));await f.settle();assert.ok(f.text.includes('Keyboard answer'));assert.equal(f.input().props.readOnly,false);
});

test('a keyboard send keeps the same enabled input focused through success or failure without duplicate submits',async t=>{
 for(const fails of [false,true]){
  const response=defer();const f=fixture({handler:()=>response.promise});t.after(()=>f.dispose());f.render();f.type('A keyboard question');
  const input=f.input().props.ref.current;input.focus({preventScroll:true});f.inputKeyDown();
  assert.equal(f.activeElement,input);assert.notEqual(f.input().props.disabled,true);assert.equal(f.input().props.readOnly,true);
  f.type('An accidental change during the request');assert.equal(f.input().props.value,'');f.inputKeyDown();assert.equal(f.calls.length,1);assert.equal(f.formSubmissions,1);
  if(fails)response.reject(new Error('Network unavailable'));else response.resolve(Response.json({reply:'Keyboard reply',links:[]}));
  await f.settle();assert.equal(f.input().props.ref.current,input);assert.equal(f.activeElement,input);assert.equal(f.input().props.readOnly,false);
  assert.equal(f.focusCalls.length,1,'the input must retain focus without reopening the keyboard through a later focus call');
  f.type('Continue without clicking the input');assert.equal(f.input().props.value,'Continue without clicking the input');assert.equal(f.activeElement,input);
 }
});

test('opening and greeting make no request; explicit sends contain only coarse area, locale and typed conversation',async t=>{
 const f=fixture({pathname:'/profile/private-member-974',locale:'de'});t.after(()=>f.dispose());f.render();await f.settle();assert.equal(f.calls.length,0);
 assert.equal(elements(f.tree,node=>node.type==='form').length,1);assert.ok(!f.text.includes(translatorFor('de','Genie')('loginHint')));
 f.setActive(false);f.setActive(true);await f.settle();assert.equal(f.calls.length,0);
 f.type('  How do I edit my profile?  ');await f.submit();await f.settle();
 assert.deepEqual(checkPayload(f.calls[0]),{area:'profile',locale:'de',messages:[{role:'user',content:'How do I edit my profile?'}]});
 f.setLocale('sv');f.type('And my photo?');await f.submit();await f.settle();
 assert.deepEqual(checkPayload(f.calls[1]),{area:'profile',locale:'sv',messages:[{role:'user',content:'How do I edit my profile?'},{role:'assistant',content:'Answer 1'},{role:'user',content:'And my photo?'}]});
 assert.ok(!f.calls.some(call=>call.init.body.includes('private-member-974')));assert.ok(!f.calls.some(call=>call.init.body.includes(translatorFor('de','Genie')('greeting'))));
});

test('same-session reload restores only the latest completed pairs without sending or restoring drafts',async t=>{
 const storage=sessionStore(),late=defer(),memoryScope='member-session';
 const first=fixture({storage,memoryScope,handler:(_call,index)=>index===6?late.promise:Response.json({reply:`Saved answer ${index}`,links:[]})});t.after(()=>first.dispose());first.render();
 for(let index=1;index<=5;index++){first.type(`Saved question ${index}`);await first.submit();await first.settle();}
 const saved=storage.value;assert.ok(saved);assert.equal(JSON.parse(saved).exchanges.length,4);
 first.type('Unsent private draft');assert.equal(storage.value,saved);first.type('Pending private question');const pending=first.submit();await first.settle();assert.equal(storage.value,saved);first.dispose();assert.equal(first.calls.at(-1).init.signal.aborted,true);
 const reloaded=fixture({storage,memoryScope});t.after(()=>reloaded.dispose());reloaded.render();await reloaded.settle();assert.equal(reloaded.calls.length,0);assert.equal(reloaded.input().props.value,'');
 assert.ok(!reloaded.text.includes('Saved question 1'));for(let index=2;index<=5;index++){assert.ok(reloaded.text.includes(`Saved question ${index}`));assert.ok(reloaded.text.includes(`Saved answer ${index}`));}
 assert.ok(!reloaded.text.includes('Unsent private draft'));assert.ok(!reloaded.text.includes('Pending private question'));
 late.resolve(Response.json({reply:'Late answer from discarded instance',links:[]}));await pending;assert.equal(storage.value,saved);assert.equal(first.writesAfterDispose,0);
 reloaded.type('Continue the saved chat');await reloaded.submit();await reloaded.settle();assert.deepEqual(checkPayload(reloaded.calls[0]).messages.map(message=>message.content),['Saved question 2','Saved answer 2','Saved question 3','Saved answer 3','Saved question 4','Saved answer 4','Saved question 5','Saved answer 5','Continue the saved chat']);
 const secondReload=fixture({storage,memoryScope});t.after(()=>secondReload.dispose());secondReload.render();assert.ok(secondReload.text.includes('Continue the saved chat'),'new exchanges must remain restorable after continuing a saved chat');assert.equal(secondReload.calls.length,0);
});

test('guests can open Genie but see only localized sign-in and account creation actions without sending',async t=>{
 const launcher=fixture({component:'launcher',memoryScope:null});t.after(()=>launcher.dispose());launcher.render();launcher.click('open');
 const lazy=elements(launcher.tree,node=>node.type==='genie-lazy-panel');assert.equal(lazy.length,1);assert.equal(lazy[0].props.memoryScope,null);assert.equal(launcher.calls.length,0);
 const pathname='/projects/my%20project',search='?view=crew&filter=C%2B%2B';
 for(const locale of ['de','en','es','it','cs','hu','nl','nl-BE','sv']){
  const guest=fixture({locale,pathname,search,memoryScope:null});t.after(()=>guest.dispose());guest.render();await guest.settle();
  checkLoginGate(guest,locale,pathname+search);assert.equal(guest.calls.length,0);assert.equal(guest.storage.value,null);assert.equal(guest.timers.size,0);
  guest.setActive(false);guest.setActive(true);await guest.settle();checkLoginGate(guest,locale,pathname+search);assert.equal(guest.calls.length,0);
 }
});

test('401 replaces the composer with localized login actions and never retries an expired session',async t=>{
 const pathname='/locations/new',search='?step=description';
 for(const locale of ['de','en','es','it','cs','hu','nl','nl-BE','sv']){
  const storage=sessionStore();conversation.saveConversation(storage,'member-session',[{id:1,user:'Previous private question',reply:'Previous private answer',links:[]}]);
  const f=fixture({locale,pathname,search,storage,handler:()=>Response.json({error:'unauthorized',detail:'SECRET_AUTH_DETAIL'},{status:401})});t.after(()=>f.dispose());f.render();f.type('My pending question');await f.submit();await f.settle();
  checkLoginGate(f,locale,pathname+search);assert.equal(f.calls.length,1);assert.equal(f.timers.size,0);assert.ok(!f.text.includes('SECRET_AUTH_DETAIL'));
  assert.equal(storage.value,null,'an expired session must not retain restorable chat history');assert.ok(!f.text.includes('Previous private'));
  assert.ok(!f.text.includes(translatorFor(locale,'Genie')('errorFailed')));assert.ok(!f.text.includes(translatorFor(locale,'Genie')('errorNetwork')));
  f.setActive(false);f.setActive(true);await f.settle();checkLoginGate(f,locale,pathname+search);assert.equal(f.calls.length,1,'reopening must not retry the expired request');
 }
});

test('401 still requires login when its response has a different error code or no valid JSON',async t=>{
 for(const response of [Response.json({error:'unavailable'},{status:401}),new Response(null,{status:401}),new Response('invalid JSON',{status:401})]){
  const f=fixture({handler:()=>response});t.after(()=>f.dispose());f.render();f.type('Session expired');await f.submit();await f.settle();
  checkLoginGate(f,'en','/profile/member-private-id');assert.equal(f.calls.length,1);assert.equal(f.timers.size,0);
 }
});

test('launcher waits for loaded authentication and another session or sign-out clears saved history',t=>{
 const storage=sessionStore(),saved=[{id:1,user:'Previous account question',reply:'Previous account answer',links:[]}];conversation.saveConversation(storage,'session-A',saved);const original=storage.value;
 const loading=fixture({component:'launcher',storage,memoryScope:'session-A',sessionLoaded:false});t.after(()=>loading.dispose());loading.render();assert.equal(loading.tree,null);assert.equal(storage.value,original);assert.equal(loading.calls.length,0);
 const own=fixture({component:'launcher',storage,memoryScope:'session-A'});t.after(()=>own.dispose());own.render();own.click('open');assert.equal(elements(own.tree,node=>node.type==='genie-lazy-panel')[0].props.memoryScope,'session-A');assert.equal(storage.value,original);own.dispose();
 for(const memoryScope of ['session-B',null]){
  conversation.saveConversation(storage,'session-A',saved);const changed=fixture({component:'launcher',storage,memoryScope});t.after(()=>changed.dispose());changed.render();assert.equal(storage.value,null);assert.equal(changed.calls.length,0);changed.dispose();
  const panel=fixture({storage,memoryScope});t.after(()=>panel.dispose());panel.render();assert.ok(!panel.text.includes('Previous account'));assert.equal(panel.calls.length,0);panel.dispose();
 }
 const former=fixture({storage,memoryScope:'session-A'});t.after(()=>former.dispose());former.render();assert.ok(!former.text.includes('Previous account'),'switching back must not resurrect cleared history');
});

test('trash removes saved history and a late aborted reply cannot recreate it',async t=>{
 const storage=sessionStore(),memoryScope='member-session',late=defer();
 const f=fixture({storage,memoryScope,handler:(_call,index)=>index===1?Response.json({reply:'Remembered answer',links:[]}):late.promise});t.after(()=>f.dispose());f.render();f.type('Remembered question');await f.submit();await f.settle();assert.ok(storage.value);
 f.type('Question pending when cleared');const pending=f.submit();await f.settle();f.click('clear');assert.equal(f.calls.at(-1).init.signal.aborted,true);assert.equal(storage.value,null);assert.ok(!f.text.includes('Remembered question'));assert.equal(f.input().props.value,'');
 late.resolve(Response.json({reply:'Discarded late reply',links:[]}));await pending;await f.settle();assert.equal(storage.value,null);assert.ok(!f.text.includes('Discarded late reply'));
 const reloaded=fixture({storage,memoryScope});t.after(()=>reloaded.dispose());reloaded.render();assert.ok(!reloaded.text.includes('Remembered question'));assert.equal(reloaded.calls.length,0);
});

test('pending request blocks duplicate submits, and network failure is explicit without automatic retry',async t=>{
 const reply=defer();const f=fixture({handler:()=>reply.promise});t.after(()=>f.dispose());f.render();f.type('Explain registration');const first=f.submit(),duplicate=f.submit();await f.settle();
 assert.equal(f.calls.length,1);assert.equal(f.input().props.readOnly,true);reply.reject(new Error('private upstream detail'));await Promise.all([first,duplicate]);await f.settle();
 assert.equal(f.calls.length,1);assert.equal(f.input().props.value,'Explain registration');assert.ok(f.text.includes(translatorFor('en','Genie')('errorNetwork')));assert.ok(!f.text.includes('private upstream detail'));assert.equal(f.timers.size,0);
});

test('history drops whole oldest exchanges for both message and character ceilings',async t=>{
 const f=fixture();t.after(()=>f.dispose());f.render();for(let i=1;i<=7;i++){f.type(`Question ${i}`);await f.submit();await f.settle();checkPayload(f.calls.at(-1));}
 assert.deepEqual(checkPayload(f.calls.at(-1)).messages.map(message=>message.content),['Question 3','Answer 3','Question 4','Answer 4','Question 5','Answer 5','Question 6','Answer 6','Question 7']);
 const reply='R'.repeat(genie.GENIE_MAX_MESSAGE_CHARS);const large=fixture({handler:()=>Response.json({reply,links:[]})});t.after(()=>large.dispose());large.render();
 for(let i=1;i<=4;i++){large.type(String(i).repeat(genie.GENIE_MAX_MESSAGE_CHARS));await large.submit();await large.settle();checkPayload(large.calls.at(-1));}
 const sent=checkPayload(large.calls.at(-1));assert.equal(sent.messages.length,3);assert.equal(sent.messages[0].content,'3'.repeat(genie.GENIE_MAX_MESSAGE_CHARS));assert.equal(sent.messages.at(-1).content,'4'.repeat(genie.GENIE_MAX_MESSAGE_CHARS));
 large.type('x'.repeat(genie.GENIE_MAX_MESSAGE_CHARS+1));await large.submit();await large.settle();assert.equal(large.calls.length,4);assert.ok(large.text.includes(translatorFor('en','Genie')('errorInvalid')));
});

test('closing aborts a pending reply, rejects its late result and permits an explicit retry',async t=>{
 const reply=defer();const f=fixture({handler:(_call,index)=>index===1?reply.promise:Response.json({reply:'Fresh answer',links:[]})});t.after(()=>f.dispose());f.render();f.type('My pending question');const first=f.submit();await f.settle();f.setActive(false);assert.equal(f.calls[0].init.signal.aborted,true);
 await f.settle();f.setActive(true);assert.equal(f.input().props.readOnly,false,'closing must release pending UI even if fetch ignores abort');assert.equal(f.calls.length,1);
 f.type('My new question');await f.submit();await f.settle();assert.equal(f.calls.length,2);assert.deepEqual(checkPayload(f.calls[1]).messages,[{role:'user',content:'My new question'}]);assert.ok(f.text.includes('Fresh answer'));
 reply.resolve(Response.json({reply:'Stale answer after closing',links:[]}));await first;await f.settle();assert.ok(!f.text.includes('Stale answer after closing'));assert.ok(f.text.includes('Fresh answer'));
});

test('client timeout aborts and unlocks the composer without retrying, even when fetch ignores abort',async t=>{
 const reply=defer();const f=fixture({handler:()=>reply.promise});t.after(()=>f.dispose());f.render();f.type('Question timing out');const pending=f.submit();await f.settle();
 const timer=[...f.timers.values()][0];assert.ok(timer.delay<=35_000);timer.callback();await f.settle();assert.equal(f.calls[0].init.signal.aborted,true);assert.equal(f.input().props.readOnly,false);assert.equal(f.calls.length,1);assert.ok(f.text.includes(translatorFor('en','Genie')('errorTimeout')));
 reply.resolve(Response.json({reply:'Too late',links:[]}));await pending;await f.settle();assert.ok(!f.text.includes('Too late'));assert.equal(f.calls.length,1);assert.equal(f.timers.size,0);
});

test('unmount aborts requests already parsing JSON and late completion cannot restore private state',async()=>{
 const parsed=defer();const f=fixture({handler:()=>({ok:true,json:()=>parsed.promise})});f.render();f.type('Private question from former session');const send=f.submit();await f.settle();f.dispose();assert.equal(f.calls[0].init.signal.aborted,true);
 parsed.resolve({reply:'Private late answer',links:[]});await send;await f.settle();assert.equal(f.writesAfterDispose,0);assert.equal(f.timers.size,0);
 const fresh=fixture();fresh.render();assert.equal(fresh.input().props.value,'');assert.ok(!fresh.text.includes('Private'));assert.equal(fresh.calls.length,0);fresh.dispose();
});

test('clear aborts and removes conversation; old finally cannot unlock or overwrite a newer pending send',async t=>{
 const replies=[defer(),defer()];const f=fixture({handler:(_call,index)=>replies[index-1].promise});t.after(()=>f.dispose());f.render();f.type('Discarded private question');const old=f.submit();await f.settle();f.click('clear');assert.equal(f.calls[0].init.signal.aborted,true);assert.equal(f.input().props.value,'');assert.ok(!f.text.includes('Discarded private question'));
 f.type('New question');const current=f.submit();await f.settle();replies[0].resolve(Response.json({reply:'Discarded answer',links:[]}));await old;await f.settle();assert.equal(f.input().props.readOnly,true);assert.ok(!f.text.includes('Discarded answer'));
 replies[1].resolve(Response.json({reply:'Current answer',links:[]}));await current;await f.settle();assert.deepEqual(checkPayload(f.calls[1]).messages,[{role:'user',content:'New question'}]);f.click('clear');assert.ok(!f.text.includes('Current answer'));assert.equal(f.input().props.value,'');
});

test('all server failures render localized safe messages in every locale without exposing upstream strings',async t=>{
 const cases={invalid_request:'errorInvalid',rate_limited:'errorRateLimited',unavailable:'errorUnavailable',timeout:'errorTimeout',failed:'errorFailed',unsafe_input:'errorUnsafe'};
 for(const locale of ['de','en','es','it','cs','hu','nl','nl-BE','sv'])for(const [error,key] of Object.entries(cases)){
  const f=fixture({locale,handler:()=>Response.json({error,detail:'SECRET_UPSTREAM_DETAIL'},{status:503})});t.after(()=>f.dispose());f.render();f.type('My question');await f.submit();await f.settle();assert.ok(f.text.includes(translatorFor(locale,'Genie')(key)),`${locale}: ${error}`);assert.ok(!f.text.includes('SECRET_UPSTREAM_DETAIL'));assert.equal(f.calls.length,1);assert.equal(f.input().props.value,'My question');
 }
});

test('reply markup remains text and only exact allowlisted destinations become links',async t=>{
 const safe=genie.GENIE_LINKS.find(link=>link.href==='/help');assert.ok(safe);
 const reply='<img src=x onerror="alert(1)"> [claim](https://evil.example) <script>alert(1)</script>';
 const f=fixture({handler:()=>Response.json({reply,links:[{label:'Help',href:safe.href},{label:'duplicate',href:safe.href},{label:'external',href:'https://evil.example'},{label:'script',href:'javascript:alert(1)'},{label:'query',href:'/help?private=1'},{label:'fragment',href:'/help#injected'},{label:'empty',href:''},{label:'x'.repeat(101),href:'/profile'},null]})});t.after(()=>f.dispose());f.render();f.type('Where is help?');await f.submit();await f.settle();
 assert.ok(f.text.includes(reply));const links=elements(f.tree,node=>typeof node.props.href==='string');assert.deepEqual(links.map(link=>link.props.href),['/datenschutz','/help']);
 assert.equal(elements(f.tree,node=>node.props.dangerouslySetInnerHTML!==undefined||node.type==='img'||node.type==='script').length,0);
 const html=renderToStaticMarkup(f.tree);assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<script>'));assert.ok(!html.includes('href="https://evil.example"'));
});

test('Genie is inside the actual session boundary whose key changes on account changes',()=>{
 const layout=readFileSync(new URL('../app/layout.tsx',import.meta.url),'utf8');const ast=ts.createSourceFile('layout.tsx',layout,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let integrated=false;
 function visit(node,insideBoundary=false){const element=ts.isJsxElement(node),name=element?node.openingElement.tagName.getText(ast):ts.isJsxSelfClosingElement(node)?node.tagName.getText(ast):'';if(name==='Genie'){assert.equal(insideBoundary,true,'Genie must remount with the authentication session');integrated=true;}ts.forEachChild(node,child=>visit(child,insideBoundary||(element&&name==='AuthSessionBoundary')));}visit(ast);assert.equal(integrated,true);
 const f=boundaryFixture();const first=f.render();const second=f.render({isLoaded:true,session:{id:'second-session'},clerkLoaded:true});assert.notEqual(first.key,second.key);
 const signingOut=f.render({isLoaded:true,session:null,clerkLoaded:true},'old chat');assert.notEqual(signingOut.props.children,'old chat');
});

test('the session boundary erases chat during provisional sign-out even when the guest tree never mounts',()=>{
 for(const settled of [false,true]){
  const f=boundaryFixture();conversation.saveConversation(f.storage,'first-session',[{id:1,user:'Private question',reply:'Private answer',links:[]}]);f.render();assert.ok(f.storage.value);
  const transition=f.render({isLoaded:settled,session:settled?null:undefined,clerkLoaded:true});
  assert.notEqual(transition.props.children,'private chat');assert.equal(f.storage.value,null,'clearing must happen in the boundary while Genie itself is absent');
 }
});

test('the boundary preserves same-session hydration but erases cache on account changes and tolerates blocked storage',()=>{
 const f=boundaryFixture();conversation.saveConversation(f.storage,'first-session',[{id:1,user:'Own question',reply:'Own answer',links:[]}]);const original=f.storage.value;
 const hydration=f.render({isLoaded:false,session:undefined,clerkLoaded:false});assert.equal(f.storage.value,original);
 const same=f.render({isLoaded:true,session:{id:'first-session'},clerkLoaded:true});assert.equal(hydration.key,same.key);assert.equal(f.storage.value,original);
 const other=f.render({isLoaded:true,session:{id:'second-session'},clerkLoaded:true});assert.notEqual(other.key,same.key);assert.equal(f.storage.value,null);
 conversation.saveConversation(f.storage,'second-session',[{id:1,user:'New account question',reply:'New account answer',links:[]}]);const current=f.storage.value;
 f.render();assert.equal(f.storage.value,current,'a same-session rerender must keep its conversation');
 const blocked=boundaryFixture({blockedStorage:true});blocked.render();assert.doesNotThrow(()=>blocked.render({isLoaded:false,session:undefined,clerkLoaded:true}));
});
