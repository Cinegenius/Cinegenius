import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import {translatorFor} from './i18n-test-fixture.mjs';

// Execute the actual wrapper with controlled hooks and browser callbacks.
// This verifies its render gate/lifetime, not real Next chunk downloads or
// the CommunityBoard's own forms/network implementation.
function fixture({supported=true,loggedIn=false,locale='de',attachRoot=true}={}){
 const slots=[],pendingEffects=[],observers=[],frames=new Map(),timers=new Map(),microtasks=[],writes=[];
 let cursor=0,dirty=false,tree,props={loggedIn},phase='render',disposed=false,taskId=0,moduleLoads=0,loaderCalls=0;
 const root={fixture:'home-community-root'};
 const same=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((value,index)=>Object.is(value,b[index]));
 const hooks={
  useRef(initial){const index=cursor++;if(!slots[index])slots[index]={current:initial};return slots[index];},
  useState(initial){const index=cursor++;if(!slots[index]){
   const slot={value:typeof initial==='function'?initial():initial};
   slot.set=value=>{writes.push({phase,afterUnmount:disposed});if(disposed)return;const next=typeof value==='function'?value(slot.value):value;if(!Object.is(next,slot.value)){slot.value=next;dirty=true;}};
   slots[index]=slot;
  }return[slots[index].value,slots[index].set];},
  useEffect(create,dependencies){const index=cursor++,previous=slots[index];if(!previous||!same(previous.dependencies,dependencies)){
   const slot={create,dependencies,cleanup:previous?.cleanup};slots[index]=slot;pendingEffects.push(()=>{slot.cleanup?.();slot.cleanup=create();});
  }},
 };
 class Observer{
  constructor(callback,options){this.callback=callback;this.options=options;this.observed=[];this.disconnects=0;observers.push(this);}
  observe(target){this.observed.push(target);}
  disconnect(){this.disconnects++;}
  emit(entries,{queued=false}={}){if(this.disconnects&&!queued)return;phase='observer';this.callback(entries,this);phase='idle';}
 }
 let registeredLoader,DynamicBoard;
 const mocks={
  react:hooks,'react/jsx-runtime':jsxRuntime,
  'next/link':{default:({children,...attributes})=>React.createElement('a',attributes,children)},
  'next-intl':{useTranslations:namespace=>translatorFor(locale,namespace)},
  'next/dynamic':{default:loader=>{
   assert.equal(typeof loader,'function');registeredLoader=loader;
   DynamicBoard=function DeferredCommunityBoard(){return null;};return DynamicBoard;
  }},
  '@/components/CommunityBoard':{default:function BoardFixture(){return null;}},
 };
 const compiled=ts.transpileModule(readFileSync(new URL('../components/HomeCommunityBoard.tsx',import.meta.url),'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX},
 }).outputText;
 const mod={exports:{}};
 new Function('require','module','exports','IntersectionObserver','requestAnimationFrame','cancelAnimationFrame','queueMicrotask','setTimeout','clearTimeout',compiled)(name=>{
  assert.ok(Object.hasOwn(mocks,name),`Unexpected wrapper dependency: ${name}`);
  if(name==='@/components/CommunityBoard')moduleLoads++;
  return mocks[name];
 },mod,mod.exports,supported?Observer:undefined,
 callback=>{frames.set(++taskId,callback);return taskId;},id=>frames.delete(id),callback=>microtasks.push(callback),
 callback=>{timers.set(++taskId,callback);return taskId;},id=>timers.delete(id));
 function render(nextProps=props){props=nextProps;cursor=0;dirty=false;phase='render';tree=mod.exports.default(props);phase='idle';return tree;}
 function commitEffects(){if(attachRoot&&tree.props.ref)tree.props.ref.current=root;phase='effect';while(pendingEffects.length)pendingEffects.shift()();phase='idle';}
 function flushScheduled(){let iterations=0;while(frames.size||timers.size||microtasks.length){assert.ok(++iterations<10,'bounded fallback scheduling');const tasks=[...frames.values(),...timers.values(),...microtasks.splice(0)];frames.clear();timers.clear();phase='scheduled';for(const callback of tasks)callback(0);phase='idle';}}
 function flush(){flushScheduled();if(dirty&&!disposed){render();commitEffects();}return tree;}
 function board(){return tree?.props.children?.type===DynamicBoard?tree.props.children:null;}
 async function loadVisibleBoard(){assert.ok(board(),'the wrapper must actually render the deferred component first');loaderCalls++;return registeredLoader();}
 function unmount(){disposed=true;phase='cleanup';for(const slot of slots)slot?.cleanup?.();phase='idle';if(tree?.props.ref)tree.props.ref.current=null;}
 render();
 return{render,commitEffects,flushScheduled,flush,board,loadVisibleBoard,unmount,observers,writes,root,
  html:()=>renderToStaticMarkup(tree),get tree(){return tree;},get scheduled(){return frames.size+timers.size+microtasks.length;},
  get moduleLoads(){return moduleLoads;},get loaderCalls(){return loaderCalls;},
  replayEffects(){for(const slot of slots)if(slot?.create){phase='cleanup';slot.cleanup?.();phase='effect';slot.cleanup=slot.create();phase='idle';}},
 };
}

test('server/first render keeps the board code gated and exposes the native accessible community link in all nine locales',()=>{
 for(const locale of ['de','en','es','it','cs','hu','nl','nl-BE','sv']){
  const f=fixture({locale});
  assert.equal(f.board(),null);assert.equal(f.moduleLoads,0);assert.equal(f.loaderCalls,0);assert.equal(f.observers.length,0);
  const html=f.html();assert.match(html,/href="\/community"/);assert.match(html,/min-h-11/);
  const expected=renderToStaticMarkup(React.createElement(React.Fragment,null,translatorFor(locale,'home')('boardSeeAll')));
  assert.ok(html.includes(expected),locale);f.unmount();
 }
});

test('observes the committed root with a 300px lead and leaves code unmounted for empty/offscreen entries',()=>{
 const f=fixture();f.commitEffects();
 assert.equal(f.observers.length,1);assert.deepEqual(f.observers[0].options,{rootMargin:'300px 0px'});
 assert.deepEqual(f.observers[0].observed,[f.root]);
 for(const entries of [[],[{isIntersecting:false}],[{isIntersecting:false},{isIntersecting:false}]]){
  f.observers[0].emit(entries);f.flush();assert.equal(f.board(),null);assert.equal(f.moduleLoads,0);
 }
 f.unmount();assert.equal(f.observers[0].disconnects,1);
});

test('first viewport contact renders the same stable board boundary permanently, even after leaving view',async()=>{
 const f=fixture({loggedIn:true});f.commitEffects();const observer=f.observers[0];
 observer.emit([{isIntersecting:false},{isIntersecting:true}]);f.flush();
 const first=f.board();assert.ok(first);assert.equal(first.props.loggedIn,true);assert.equal(observer.disconnects,1);
 const loadedBoard=await f.loadVisibleBoard();assert.equal(typeof loadedBoard.default,'function');assert.equal(f.moduleLoads,1);
 for(const entries of [[{isIntersecting:false}],[],[{isIntersecting:true}]]){
  observer.emit(entries,{queued:true});f.flush();const next=f.board();
  assert.equal(next.type,first.type);assert.equal(next.key,first.key);assert.equal(next.props.loggedIn,true);
  assert.equal(f.moduleLoads,1,'scroll changes must not request another board import');
 }
 assert.equal(f.observers.length,1);f.unmount();assert.ok(observer.disconnects>=2);
});

test('forwards the current loggedIn prop without resetting the mounted board boundary',()=>{
 const f=fixture({loggedIn:false});f.commitEffects();f.observers[0].emit([{isIntersecting:true}]);f.flush();
 const first=f.board();assert.equal(first.props.loggedIn,false);
 for(const loggedIn of [true,false,true]){f.render({loggedIn});f.commitEffects();assert.equal(f.board().props.loggedIn,loggedIn);assert.equal(f.board().type,first.type);assert.equal(f.board().key,first.key);}
 assert.equal(f.observers.length,1);f.unmount();
});

test('unmounting before viewport contact disconnects observation without loading the board',()=>{
 const f=fixture();f.commitEffects();const observer=f.observers[0];f.unmount();
 assert.equal(observer.disconnects,1);observer.emit([{isIntersecting:true}]);
 assert.equal(f.moduleLoads,0);assert.deepEqual(f.writes,[]);
});

test('unsupported IntersectionObserver schedules a safe fallback and preserves the loggedIn value',()=>{
 const f=fixture({supported:false,loggedIn:true});assert.equal(f.board(),null);f.commitEffects();
 assert.equal(f.observers.length,0);
 assert.equal(f.writes.some(write=>write.phase==='effect'),false,'fallback must avoid a synchronous effect-state update');
 f.flush();assert.ok(f.board());assert.equal(f.board().props.loggedIn,true);f.unmount();
});

test('unmount cancels unsupported-browser fallback before it can update state',()=>{
 const f=fixture({supported:false});f.commitEffects();f.unmount();f.flushScheduled();
 assert.equal(f.writes.some(write=>write.afterUnmount),false);assert.equal(f.moduleLoads,0);
});

test('StrictMode-style effect replay disconnects the first observer and retains exactly one live observation',()=>{
 const f=fixture();f.commitEffects();f.replayEffects();
 assert.equal(f.observers.length,2);assert.equal(f.observers[0].disconnects,1);assert.equal(f.observers[1].disconnects,0);
 f.observers[1].emit([{isIntersecting:true}]);f.flush();assert.ok(f.board());assert.equal(f.observers[1].disconnects,1);f.unmount();
});
