import test from 'node:test';
import assert from 'node:assert/strict';
import {lockBodyScroll} from './body-scroll-lock.ts';

for (const order of ['child-first','parent-first']) test(`nested surface release restores scrolling once: ${order}`, t=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'document');
 const body={style:{overflow:'auto'}};
 Object.defineProperty(globalThis,'document',{configurable:true,value:{body}});
 t.after(()=>{if(previous)Object.defineProperty(globalThis,'document',previous);else delete globalThis.document;});
 const parent=lockBodyScroll(),child=lockBodyScroll();
 assert.equal(body.style.overflow,'hidden');
 const [first,last]=order==='child-first'?[child,parent]:[parent,child];
 first();first();assert.equal(body.style.overflow,'hidden');
 last();assert.equal(body.style.overflow,'auto');
 const next=lockBodyScroll();next();assert.equal(body.style.overflow,'auto');
});

test('a released old body cannot alter a new body or its lock',t=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'document');
 const old={style:{overflow:''}},current={style:{overflow:'scroll'}};
 Object.defineProperty(globalThis,'document',{configurable:true,writable:true,value:{body:old}});
 t.after(()=>{if(previous)Object.defineProperty(globalThis,'document',previous);else delete globalThis.document;});
 const releaseOld=lockBodyScroll();document.body=current;const releaseCurrent=lockBodyScroll();
 releaseOld();assert.equal(old.style.overflow,'');assert.equal(current.style.overflow,'hidden');
 releaseCurrent();assert.equal(current.style.overflow,'scroll');
});
