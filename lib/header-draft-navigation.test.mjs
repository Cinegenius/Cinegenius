import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import React from 'react';
import ts from 'typescript';
import {lockBodyScroll} from './body-scroll-lock.ts';
const require=createRequire(import.meta.url);
function fixture(){
 let cursor=0;const cells=[],pending=[],actions=[],announcements=[];let unsafe=true;
 const slot=initial=>{const i=cursor++;if(!(i in cells))cells[i]=typeof initial==='function'?initial():initial;return[i,cells[i]]};
 const hooks={...React,useState(initial){const[i,v]=slot(initial);return[v,value=>{cells[i]=typeof value==='function'?value(cells[i]):value}]},useRef(initial){const[,value]=slot(()=>({current:initial}));return value},useCallback:fn=>fn,useMemo:fn=>fn(),useEffect(){}};
 const mocks={react:hooks,'next/navigation':{useRouter:()=>({push(){}})},'next-intl':{useTranslations:()=>key=>key},'react-dom':{createPortal:node=>node},'lucide-react':{Loader2:()=>null},'@/lib/form-navigation-events':{announceFormNavigation(){announcements.push('leave')}},'@/lib/body-scroll-lock':{lockBodyScroll}};
 const output=ts.transpileModule(readFileSync(new URL('../contexts/FormDraftContext.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const module={exports:{}};new Function('require','module','exports',output)(id=>mocks[id]??require(id),module,module.exports);
 const render=()=>{cursor=0;return module.exports.default({children:null})};
 let tree=render();const context=tree.props.value;context.register(Symbol(),{unsafe:()=>unsafe,flush:()=>new Promise(resolve=>pending.push(resolve)),discard:async()=>{unsafe=false}});
 const find=(node,predicate)=>{if(Array.isArray(node))return node.map(n=>find(n,predicate)).find(Boolean);if(!node||typeof node!=='object')return;if(predicate(node))return node;return find(node.props?.children,predicate)};
 return{leave:(name,options)=>context.leave(()=>actions.push(name),options),announcements,stay(){globalThis.document??={body:{}};const t=render();find(t,n=>n.props?.['data-stay'])?.props.onClick()},pending,actions,setUnsafe:v=>{unsafe=v},render};
}
const settle=async()=>{for(let i=0;i<5;i++)await Promise.resolve()};
test('Stay immediately permits a fresh attempt; an old save cannot execute either abandoned or newer navigation',async()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'document');try{
 const f=fixture();f.leave('abandoned messages');assert.equal(f.pending.length,1);f.stay();f.leave('new search');assert.equal(f.pending.length,2);
 f.setUnsafe(false);f.pending[0](true);await settle();assert.deepEqual(f.actions,[]);
 f.pending[1](true);await settle();assert.deepEqual(f.actions,['new search']);
 }finally{if(original)Object.defineProperty(globalThis,'document',original);else delete globalThis.document}
});
test('late failure after Stay does not hold the guard busy and clean navigation remains direct',async()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'document');try{
 const f=fixture();f.leave('abandoned menu');f.stay();f.pending[0](false);await settle();f.setUnsafe(false);f.leave('clean messages');assert.deepEqual(f.actions,['clean messages']);assert.equal(f.pending.length,1);
 }finally{if(original)Object.defineProperty(globalThis,'document',original);else delete globalThis.document}
});

test('local surface changes retain the same unsafe-input decision without closing the surface first',async()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'document');try{const f=fixture();f.leave('local thread',{withinSurface:true});assert.equal(f.pending.length,1);assert.deepEqual(f.actions,[]);assert.deepEqual(f.announcements,[]);f.setUnsafe(false);f.pending[0](true);await settle();assert.deepEqual(f.actions,['local thread']);f.leave('ordinary route');assert.deepEqual(f.announcements,['leave']);}finally{if(original)Object.defineProperty(globalThis,'document',original);else delete globalThis.document}
});

test('Stay can resume a closed native compose dialog without replaying its abandoned navigation',async()=>{
 const originals=Object.fromEntries(['document','window'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));try{const resumes=[];globalThis.window={setTimeout:fn=>resumes.push(fn)};const f=fixture();let reopened=0;f.leave('abandoned group',{withinSurface:true,onStay:()=>reopened++});f.stay();assert.equal(reopened,0);assert.equal(resumes.length,1);resumes.shift()();assert.equal(reopened,1);f.setUnsafe(false);f.pending[0](true);await settle();assert.deepEqual(f.actions,[]);f.leave('fresh route');assert.deepEqual(f.actions,['fresh route']);}finally{for(const[k,d]of Object.entries(originals)){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k]}}
});
