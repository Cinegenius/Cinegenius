import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
function setup(){
 const events={},frames=new Map(),timers=new Map();let next=0,cleanup,observer,mutations,documentQueries=0,reads=0;
 class Element {constructor(card=false,children=[]){this.card=card;this.children=children;this.isConnected=true;this.props={};this.style={setProperty:(k,v)=>this.props[k]=v,removeProperty:k=>delete this.props[k]};}closest(){return this.card?this:null;}matches(){return this.card;}contains(node){return node===this;}querySelectorAll(){return this.children;}getBoundingClientRect(){reads++;return {left:0,top:0,width:100,height:100};}}
 const initial=new Element(true),document={documentElement:{classList:{add(){}}},body:{},querySelectorAll(){documentQueries++;return[initial];},addEventListener:(k,f)=>events[k]=f,removeEventListener:k=>delete events[k]};
 class IO{constructor(cb){this.cb=cb;this.seen=[];observer=this;}observe(node){this.seen.push(node);}unobserve(){}disconnect(){this.stopped=true;}}
 class MO{constructor(cb){this.cb=cb;mutations=this;}observe(){}disconnect(){this.stopped=true;}}
 const mod={exports:{}};
 const code=ts.transpileModule(readFileSync(new URL('../components/GlobalEffects.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','module','exports','document','Element','IntersectionObserver','MutationObserver','requestAnimationFrame','cancelAnimationFrame','setTimeout','clearTimeout',code)(()=>({useEffect:cb=>cleanup=cb()}),mod,mod.exports,document,Element,IO,MO,cb=>{frames.set(++next,cb);return next;},id=>frames.delete(id),cb=>{timers.set(++next,cb);return next;},id=>timers.delete(id));
 mod.exports.default();
 return{events,frames,timers,initial,Element,get observer(){return observer;},get mutations(){return mutations;},get reads(){return reads;},get queries(){return documentQueries;},cleanup:()=>cleanup(),paint(){const tasks=[...frames.values()];frames.clear();tasks.forEach(cb=>cb());}};
}
test('rapid pointer input uses the final position once per frame and never tilts a card after leaving it',()=>{
 const f=setup();for(let n=0;n<100;n++)f.events.mousemove({target:f.initial,clientX:n,clientY:n});assert.equal(f.reads,0);assert.equal(f.frames.size,1);f.paint();assert.equal(f.reads,1);assert.equal(f.initial.props['--mx'],'99%');
 f.events.mousemove({target:f.initial,clientX:10,clientY:10});f.events.mouseout({target:f.initial,relatedTarget:null});f.paint();assert.equal(f.initial.props['--rx'],undefined);assert.equal(f.reads,1);
 f.events.mousemove({target:f.initial,clientX:20,clientY:20});f.cleanup();assert.equal(f.frames.size,0);assert.equal(Object.keys(f.events).length,0);
});
test('added cards and nested cards are observed without rescanning the document on unrelated changes',()=>{
 const f=setup();[...f.timers.values()][0]();assert.equal(f.queries,1);
 const nested=new f.Element(true),parent=new f.Element(false,[nested]),card=new f.Element(true);
 f.mutations.cb([{addedNodes:[parent,card,{nodeType:3}]}]);assert.ok(f.observer.seen.includes(nested));assert.ok(f.observer.seen.includes(card));assert.equal(f.queries,1);
 f.cleanup();assert.equal(f.observer.stopped,true);assert.equal(f.mutations.stopped,true);
});
