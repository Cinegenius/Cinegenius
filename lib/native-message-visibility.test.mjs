import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {join} from 'node:path';
const require=createRequire(join(process.cwd(),'package.json'));
const ts=require('typescript'),loaded={exports:{}};
new Function('require','module','exports',ts.transpileModule(readFileSync(new URL('./native-message-visibility.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(()=>({}),loaded,loaded.exports);
const {nativeMessageVisibleSnapshot:snapshot,subscribeNativeMessageVisibility:subscribe,NATIVE_WORKSPACE_COVERED:attribute}=loaded.exports;
function fixture(t){
 const before=Object.fromEntries(['window','document','MutationObserver'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 const window=new EventTarget(),document=new EventTarget(),attributes=new Set(),observers=new Set();
 document.visibilityState='visible';document.documentElement={hasAttribute:key=>attributes.has(key)};
 Object.assign(globalThis,{window,document,MutationObserver:class{constructor(callback){this.callback=callback}observe(_target,options){assert.deepEqual(options.attributeFilter,[attribute]);observers.add(this)}disconnect(){observers.delete(this)}}});
 t.after(()=>{for(const[key,value]of Object.entries(before)){if(value)Object.defineProperty(globalThis,key,value);else delete globalThis[key]}});
 return {set(covered){if(covered)attributes.add(attribute);else attributes.delete(attribute);for(const observer of observers)observer.callback();window.dispatchEvent(new Event(covered?'cinegenius:native-workspace-presented':'cinegenius:native-workspace-dismissed'));},document,observers};
}
test('retained native Work hides message reads while the document itself remains visible',t=>{const f=fixture(t);assert.equal(snapshot(),true);f.set(true);assert.equal(snapshot(),false);f.set(false);assert.equal(snapshot(),true)});
test('background remains hidden after Work closes; only real foreground restores visibility',t=>{const f=fixture(t);f.set(true);f.document.visibilityState='hidden';f.set(false);assert.equal(snapshot(),false);f.document.visibilityState='visible';assert.equal(snapshot(),true)});
test('marker and lifecycle events coalesce, and subscription cleanup removes the observer',t=>{const f=fixture(t);let calls=0;const stop=subscribe(()=>calls++);f.set(true);f.set(true);assert.equal(calls,1);f.set(false);assert.equal(calls,2);f.document.visibilityState='hidden';f.document.dispatchEvent(new Event('visibilitychange'));assert.equal(calls,3);stop();assert.equal(f.observers.size,0);f.set(true);assert.equal(calls,3)});
