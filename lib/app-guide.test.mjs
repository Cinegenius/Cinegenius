import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync(new URL('./app-guide.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function fixture(){
 const attrs=new Map([['data-cg-native-community-appearance','app'],['data-native-app-boot-ready','v1']]),values=new Map(),listeners=new Map(),frames=new Map(),observers=[];
 let id=0,blocked=false,inert=null,dialogs=[];
 const on=(name,fn)=>{if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn);};
 const off=(name,fn)=>listeners.get(name)?.delete(fn);
 const window={localStorage:{getItem:key=>values.get(key)??null,setItem(key,value){if(blocked)throw Error('Storage blocked');values.set(key,value)}},addEventListener:on,removeEventListener:off};window.top=window;window.self=window;
 const document={documentElement:{getAttribute:key=>attrs.get(key)??null},body:{inert:false},visibilityState:'visible',activeElement:null,querySelector:()=>inert,querySelectorAll:()=>dialogs,addEventListener:on,removeEventListener:off};
 const location={pathname:'/search'};
 class MutationObserver{constructor(fn){this.fn=fn;observers.push(this)}observe(){}disconnect(){this.disconnected=true}}
 const mod={exports:{}};
 new Function('module','exports','window','document','location','MutationObserver','requestAnimationFrame','cancelAnimationFrame','getComputedStyle',code)(mod,mod.exports,window,document,location,MutationObserver,fn=>{frames.set(++id,fn);return id},i=>frames.delete(i),node=>node.style??{visibility:'visible'});
 return{api:mod.exports,attrs,window,document,location,values,frames,observers,listeners,blockStore(){blocked=true},inert(value){inert=value},modal(value){dialogs=value?[{getClientRects:()=>[{}]}]:[]},change(){observers.filter(o=>!o.disconnected).forEach(o=>o.fn())},emit(name){for(const fn of listeners.get(name)??[])fn()},flush(){const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn())}};
}
test('first-use UI starts only on a ready, visible app surface and never marks itself completed',()=>{
 const f=fixture();assert.equal(f.api.appGuideCanOpen(),true);assert.equal(f.api.appGuideCompleted(),false);assert.equal(f.values.size,0);
 for(const key of ['data-cg-native-community-appearance','data-native-app-boot-ready']){const old=f.attrs.get(key);f.attrs.delete(key);assert.equal(f.api.appGuideCanOpen(),false);f.attrs.set(key,old)}
 for(const path of ['/sign-in','/sign-up/verify','/profile-setup','/profile-setup/review','/work','/work/floor','/app/workspace','/agb','/datenschutz','/impressum']){f.location.pathname=path;assert.equal(f.api.appGuideCanOpen(),false,path)}
 f.location.pathname='/search';f.window.top={};assert.equal(f.api.appGuideCanOpen(),false);f.window.top=f.window;f.document.visibilityState='hidden';assert.equal(f.api.appGuideCanOpen(),false);assert.equal(f.values.size,0);
});
test('typing, existing dialogs and inert content defer the tour',()=>{
 const f=fixture();for(const active of [{isContentEditable:true},{closest:()=>({})}]){f.document.activeElement=active;assert.equal(f.api.appGuideCanOpen(),false)}f.document.activeElement=null;
 f.document.body.inert=true;assert.equal(f.api.appGuideCanOpen(),false);f.document.body.inert=false;f.inert({});assert.equal(f.api.appGuideCanOpen(),false);f.inert(null);f.modal(true);assert.equal(f.api.appGuideCanOpen(),false);f.modal(false);assert.equal(f.api.appGuideCanOpen(),true);
});
test('explicit completion persists only the fixed UI flag; blocked storage remains usable in memory',()=>{
 for(const blocked of [false,true]){const f=fixture();if(blocked)f.blockStore();f.api.completeAppGuide();assert.equal(f.api.appGuideCompleted(),true);assert.deepEqual([...f.values],blocked?[]:[[f.api.APP_GUIDE_KEY,'done']]);}
});
test('observer waits for boot, batches changes, opens once, and releases listeners',()=>{
 const f=fixture();f.attrs.delete('data-native-app-boot-ready');let opens=0;const stop=f.api.observeFirstAppGuide(()=>opens++);f.flush();assert.equal(opens,0);
 f.attrs.set('data-native-app-boot-ready','v1');f.change();f.change();assert.equal(f.frames.size,1);f.flush();assert.equal(opens,1);f.change();f.emit('cinegenius:app-resume');f.flush();assert.equal(opens,1);assert.equal(f.values.size,0);
 stop();assert.equal(f.frames.size,0);assert.ok(f.observers.every(o=>o.disconnected));assert.ok([...f.listeners.values()].every(s=>s.size===0));
});
test('focus and modal removal resume a deferred first use without polling',()=>{
 for(const blocker of ['typing','modal']){const f=fixture();if(blocker==='typing')f.document.activeElement={closest:()=>({})};else f.modal(true);let opens=0;const stop=f.api.observeFirstAppGuide(()=>opens++);f.flush();assert.equal(opens,0);assert.equal(f.frames.size,0);
 f.document.activeElement=null;f.modal(false);if(blocker==='typing')f.emit('focusout');else f.change();f.flush();assert.equal(opens,1);stop();}
});
test('cleanup cancels scheduled opening and completed installations do not reopen',()=>{
 const f=fixture();let opens=0;const stop=f.api.observeFirstAppGuide(()=>opens++);stop();f.flush();assert.equal(opens,0);f.api.completeAppGuide();const stop2=f.api.observeFirstAppGuide(()=>opens++);f.flush();assert.equal(opens,0);stop2();
});
