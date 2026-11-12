import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';import {setImmediate as nextTurn} from 'node:timers/promises';import React from 'react';import ts from 'typescript';import {intlClientFor} from './i18n-test-fixture.mjs';
const require=createRequire(import.meta.url);
function nodes(value,predicate,found=[]){if(Array.isArray(value))value.forEach(v=>nodes(v,predicate,found));else if(value&&typeof value==='object'&&value.props){if(predicate(value))found.push(value);nodes(value.props.children,predicate,found);}return found;}
function fixture(t,{compact=false}={}){
 const before=Object.fromEntries(['window','document','HTMLElement'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 let focused='',open=true,busy=false,dirty=true,cursor=0,tree;const slots=[],effects=[];
 class Element{isConnected=true;constructor(name){this.name=name;}focus(){focused=this.name;}}
 globalThis.HTMLElement=Element;const trigger=new Element('trigger');globalThis.document={activeElement:trigger,body:{style:{overflow:'auto'}}};
 const viewport=Object.assign(new EventTarget(),{height:700,offsetTop:0});globalThis.window=Object.assign(new EventTarget(),{innerHeight:700,visualViewport:viewport});
 const same=(a,b)=>a?.length===b?.length&&a?.every((v,i)=>Object.is(v,b[i]));
 function effect(create,deps){const i=cursor++,old=slots[i];if(!old||!same(old.deps,deps)){const slot={deps,cleanup:old?.cleanup};slots[i]=slot;effects.push(()=>{slot.cleanup?.();slot.cleanup=create();});}}
 const hooks={...React,useId:()=> 'dialog-title',useState(initial){const i=cursor++;if(!slots[i]){const slot={value:initial};slot.set=action=>{slot.value=typeof action==='function'?action(slot.value):action;dirty=true;};slots[i]=slot;}return[slots[i].value,slots[i].set];},useRef(initial){const i=cursor++;return slots[i]??={current:initial};},useEffect:effect,useLayoutEffect:effect};
 const native={open:false,showModal(){this.open=true;},close(){this.open=false;}};
 const source=ts.transpileModule(readFileSync(new URL('../components/messaging/MessagingDialog.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;const mod={exports:{}};new Function('require','module','exports',source)(name=>name==='react'?hooks:name==='next-intl'?intlClientFor():require(name),mod,mod.exports);
 function render(){cursor=0;dirty=false;tree=mod.exports.default({open,busy,compact,title:'Own dialog',children:'Own artificial content',footer:'Actions',onClose:()=>{open=false;dirty=true;}});for(const node of nodes(tree,n=>!!n.props.ref)){node.props.ref.current=node.type==='dialog'?native:new Element('close');}for(const run of effects.splice(0))run();}
 t.after(()=>{for(const slot of slots)slot?.cleanup?.();for(const[key,descriptor]of Object.entries(before)){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}});
 return{native,viewport,get tree(){return tree;},get focused(){return focused;},get dialog(){return nodes(tree,n=>n.type==='dialog')[0];},async settle(){for(let n=0;n<15;n++){if(dirty)render();await nextTurn();if(!dirty&&!effects.length)return;}assert.fail('dialog did not settle');},busy(value){busy=value;dirty=true;}};
}
test('full message dialogs allocate definite body space and track the keyboard viewport',async t=>{
 const f=fixture(t);await f.settle();assert.equal(f.native.open,true);assert.equal(f.focused,'close');assert.equal(document.body.style.overflow,'hidden');assert.match(f.dialog.props.style.height,/min\(44rem, calc\(676px/);f.viewport.height=340;f.viewport.dispatchEvent(new Event('resize'));await f.settle();assert.match(f.dialog.props.style.height,/calc\(316px/);f.dialog.props.onCancel({preventDefault(){}});await f.settle();assert.equal(f.dialog,undefined);assert.equal(f.native.open,false);assert.equal(f.focused,'trigger');assert.equal(document.body.style.overflow,'auto');
});
test('real Back closes the modal without adding a history step, while busy Escape waits',async t=>{
 const f=fixture(t);await f.settle();f.busy(true);await f.settle();f.dialog.props.onCancel({preventDefault(){}});await f.settle();assert.equal(f.native.open,true);window.dispatchEvent(new Event('popstate'));await f.settle();assert.equal(f.native.open,false);assert.equal(f.dialog,undefined);
});
test('compact message actions keep natural height without a zero-basis flex body',async t=>{
 const f=fixture(t,{compact:true});await f.settle();assert.equal(f.dialog.props.style.height,undefined);assert.match(f.dialog.props.style.maxHeight,/676px/);const body=nodes(f.tree,n=>n.type==='div'&&n.props.className.includes('overflow-y-auto'))[0];assert.doesNotMatch(body.props.className,/flex-1/);
});
