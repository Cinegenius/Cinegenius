import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function fixture(choice='accepted',event='news_impression'){
 let effect,callback,disconnected=false,time=0;const scheduled=new Map(),captures=[],doc=new EventTarget();doc.visibilityState='visible';
 const element={id:'visible-card'},anchor={closest:()=>element},Observer=class{constructor(fn){callback=fn}observe(node){assert.equal(node,element)}disconnect(){disconnected=true}};
 const mod={exports:{}};const code=ts.transpileModule(readFileSync(new URL('../components/organizations/NewsObservation.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 new Function('require','module','exports','window','document','IntersectionObserver','setTimeout','clearTimeout',code)(name=>{
  if(name==='react')return{useRef:()=>({current:anchor}),useEffect:fn=>{effect=fn},useSyncExternalStore:(_s,snapshot)=>snapshot()};
  if(name==='next/navigation')return{usePathname:()=>'/news'};
  if(name==='@/components/ProductAnalytics')return{captureNews:async(...args)=>{captures.push(args);return args[2]()}};
  if(name==='@/lib/analytics-consent')return{readAnalyticsConsent:()=>choice,subscribeAnalyticsConsent:()=>()=>{}};
  return require(name);
 },mod,mod.exports,{IntersectionObserver:Observer},doc,Observer,(fn,delay)=>{const id=++time;scheduled.set(id,{fn,delay});return id},id=>scheduled.delete(id));
 mod.exports.default({id:'11111111-1111-4111-8111-111111111111',event});const cleanup=effect();
 return{captures,doc,scheduled,get disconnected(){return disconnected},intersection:ratio=>callback?.([{isIntersecting:ratio>0,intersectionRatio:ratio}]),tick:()=>{const entries=[...scheduled.values()];scheduled.clear();entries.forEach(x=>{assert.equal(x.delay,1000);x.fn()})},cleanup};
}
test('fetched/offscreen cards, brief exposure and hidden tabs are not impressions',async()=>{
 const f=fixture();assert.equal(f.scheduled.size,0);f.intersection(.3);assert.equal(f.scheduled.size,0);f.intersection(.6);assert.equal(f.scheduled.size,1);f.intersection(0);f.tick();assert.equal(f.captures.length,0);
 f.intersection(.9);f.doc.visibilityState='hidden';f.doc.dispatchEvent(new Event('visibilitychange'));f.tick();assert.equal(f.captures.length,0);
 f.doc.visibilityState='visible';f.doc.dispatchEvent(new Event('visibilitychange'));f.tick();await Promise.resolve();assert.equal(f.captures.length,1);f.intersection(.9);f.tick();assert.equal(f.captures.length,1);f.cleanup();
});
test('no consent means no observer/timer, and leaving the page cancels pending measurement',()=>{
 for(const choice of [null,'rejected']){const f=fixture(choice);f.intersection(1);f.tick();assert.equal(f.captures.length,0);assert.equal(f.cleanup,undefined)}
 const f=fixture();f.intersection(1);f.cleanup();f.tick();assert.equal(f.captures.length,0);assert.equal(f.disconnected,true);
});
test('article open measures visible header and keeps its async cancellation predicate alive',()=>{
 const f=fixture('accepted','news_view');f.intersection(.05);assert.equal(f.scheduled.size,0);f.intersection(.15);f.tick();assert.equal(f.captures[0][0],'news_view');assert.equal(f.captures[0][2](),true);f.cleanup();assert.equal(f.captures[0][2](),false);
});
