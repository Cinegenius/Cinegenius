import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import * as voice from './genie-voice.ts';
import {unifiedSearchHref} from './unified-search.ts';

const require=createRequire(import.meta.url);
const code=ts.transpileModule(readFileSync(new URL('../components/GenieVoiceControls.tsx',import.meta.url),'utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX},
}).outputText;
function elements(value,predicate,result=[]){
 if(Array.isArray(value))for(const item of value)elements(item,predicate,result);
 else if(value&&typeof value==='object'&&value.props){if(predicate(value))result.push(value);elements(value.props.children,predicate,result);}
 return result;
}

// Exercise the actual component's effects/controls with an explicit native audio
// boundary. Browser fixtures separately cover real React scheduling and routing.
function fixture(t){
 let cursor=0,dirty=false,tree,interrupts=0;
 const slots=[],effects=[],calls=[];
 const props={active:true,pending:false,locale:'de',resetKey:0,routeKey:'/props?q=Boot&cityText=Berlin',reply:null,onText(){},onUnauthorized(){},onInterrupt(){interrupts++;}};
 const same=(a,b)=>a?.length===b?.length&&a?.every((v,i)=>Object.is(v,b[i]));
 const hooks={
  useState(initial){const i=cursor++;if(!slots[i]){slots[i]={value:initial};slots[i].set=next=>{const value=typeof next==='function'?next(slots[i].value):next;if(!Object.is(value,slots[i].value)){slots[i].value=value;dirty=true;}};}return[slots[i].value,slots[i].set];},
  useRef(initial){const i=cursor++;slots[i]??={current:initial};return slots[i];},
  useEffect(callback,deps){const i=cursor++;if(!same(slots[i]?.deps,deps)){const previous=slots[i];slots[i]={deps,cleanup:previous?.cleanup};effects.push(()=>{previous?.cleanup?.();slots[i].cleanup=callback();});}},
 };
 let current=null;
 const native={
  speak(options){const call={...options,status:'speaking'};calls.push(call);return new Promise((resolve,reject)=>{call.resolve=resolve;call.reject=reject;current=call;});},
  stopSpeaking(){if(current){current.status='cancelled';current.reject(Error('cancelled'));current=null;}},
 };
 const mocks={
  react:hooks,'react/jsx-runtime':require('react/jsx-runtime'),
  'next-intl':{useTranslations:()=>key=>key},
  'lucide-react':new Proxy({},{get:()=>()=>null}),
  '@/lib/genie-recorder':{createGenieRecorder:()=>({cancel(){}})},
  '@/lib/genie-voice':{...voice,nativeGenieVoice:()=>native},
  './Genie.module.css':{default:{}},
 };
 const mod={exports:{}},events={addEventListener(){},removeEventListener(){}};
 new Function('require','module','exports','window','document',code)(
  name=>{assert.ok(Object.hasOwn(mocks,name),name);return mocks[name];},mod,mod.exports,events,{...events,visibilityState:'visible'},
 );
 function render(){
  for(let pass=0;pass<15;pass++){
   cursor=0;dirty=false;tree=mod.exports.default(props);
   for(const effect of effects.splice(0))effect();
   if(!dirty)return;
  }
  assert.fail('Voice controls did not settle');
 }
 t.after(()=>{for(const slot of slots)slot?.cleanup?.();});
 render();
 return{calls,get interrupts(){return interrupts;},update(next){Object.assign(props,next);render();},
  click(label){const button=elements(tree,e=>e.type==='button'&&e.props['aria-label']===label)[0];assert.ok(button,label);button.props.onClick();render();}};
}

test('expiring a spoken reply stops its audio without interrupting the next request',async t=>{
 const f=fixture(t),interrupts=f.interrupts;
 f.update({reply:{id:1,text:'Old reply',locale:'de',spoken:false}});f.click('speak');
 assert.equal(f.calls[0].status,'speaking');
 f.update({reply:null,pending:true});await Promise.resolve();
 assert.equal(f.calls[0].status,'cancelled');assert.equal(f.interrupts,interrupts);
 f.update({pending:false,reply:{id:2,text:'New reply',locale:'de',spoken:true}});
 assert.equal(f.calls.length,2);assert.equal(f.calls[1].text,'New reply');assert.equal(f.calls[1].status,'speaking');
});

for(const route of ['/props?genie=1&q=Boot&cityText=Berlin','/locations?genie=1&q=Studio&country=CH','/creators?genie=1&department=kamera']){
 test('repeating '+route.split('?')[0]+' waits for launch and normalized results before speaking',t=>{
  const f=fixture(t),fromRoute=route.replace('genie=1&','');
  f.update({routeKey:fromRoute});
  f.update({reply:{id:1,text:'Search reply',locale:'de',spoken:true,route,fromRoute}});
  assert.equal(f.calls.length,0,'the old matching result URL is not a completed navigation');
  f.update({routeKey:route});assert.equal(f.calls.length,0,'filters still being applied');
  f.update({routeKey:fromRoute});assert.equal(f.calls.length,1);
  f.update({routeKey:fromRoute});assert.equal(f.calls.length,1,'do not replay the same answer');
 });
}

test('expiry during queued navigation prevents the removed reply from playing later',t=>{
 const f=fixture(t),route='/locations?genie=1&q=Studio&country=CH';
 f.update({reply:{id:1,text:'Expired reply',locale:'de',spoken:true,route,fromRoute:'/props?q=Boot&cityText=Berlin'}});
 f.update({reply:null});f.update({routeKey:route});f.update({routeKey:route.replace('genie=1&','')});
 assert.equal(f.calls.length,0);
});

const unifiedRoute=unifiedSearchHref({version:1,searches:[
 {area:'crew',query:'Model',department:'',places:[{city:'Berlin',country:'DE',continent:'',radiusKm:0}]},
 {area:'marketplace',query:'Auto',department:'',places:[{city:'',country:'',continent:'002',radiusKm:0}]},
]});
test('repeating an already resolved unified search speaks once without waiting for a nonexistent launch marker',t=>{
 const f=fixture(t);f.update({routeKey:unifiedRoute});
 f.update({reply:{id:1,text:'Combined search',locale:'de',spoken:true,route:unifiedRoute,fromRoute:unifiedRoute}});
 assert.equal(f.calls.length,1);assert.equal(f.calls[0].text,'Combined search');
 f.update({routeKey:unifiedRoute});assert.equal(f.calls.length,1);
});
test('a unified search launched from a different page waits for its own complete plan URL',t=>{
 const f=fixture(t),fromRoute='/locations';f.update({routeKey:fromRoute});
 f.update({reply:{id:1,text:'Combined search',locale:'de',spoken:true,route:unifiedRoute,fromRoute}});
 assert.equal(f.calls.length,0);f.update({routeKey:'/search?smart=1&q=Model'});assert.equal(f.calls.length,0);
 f.update({routeKey:unifiedRoute});assert.equal(f.calls.length,1);
});
