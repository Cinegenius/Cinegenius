import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {setImmediate as nextTurn} from 'node:timers/promises';
import ts from 'typescript';
import {translatorFor} from './i18n-test-fixture.mjs';
import * as genie from './genie.ts';

const require=createRequire(import.meta.url),jsx=require('react/jsx-runtime');
const code=ts.transpileModule(readFileSync(new URL('../components/GenieWritingAssistant.tsx',import.meta.url),'utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX},
}).outputText;
function defer(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
function elements(value,predicate,result=[]){if(Array.isArray(value))for(const child of value)elements(child,predicate,result);else if(value&&typeof value==='object'&&value.props){if(predicate(value))result.push(value);elements(value.props.children,predicate,result);}return result;}
function text(value){if(value==null||typeof value==='boolean')return'';if(Array.isArray(value))return value.map(text).join(' ');return typeof value==='object'?text(value.props?.children):String(value);}

// Run the component's real handlers/effects with a controlled parent field.
// Requests and browser reads are explicit; no provider, form save or DOM layout
// is simulated. The wrapper's React remount key is checked separately below.
function fixture({locale='en',area='profile',value='PRIVATE_EXISTING_FIELD',maxLength=500,disabled=false,handler,sessionId='session-one',sessionLoaded=true,contextKey}={}){
 let cursor=0,dirty=false,tree,disposed=false,language=locale,timerId=0,writesAfterDispose=0;
 const slots=[],pendingEffects=[],calls=[],timers=new Map(),applied=[],unrelatedReads=[];
 let props={area,value,maxLength,disabled,contextKey,onApply(value){applied.push(value);props={...props,value};dirty=true;}};
 const same=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((value,index)=>Object.is(value,b[index]));
 const hooks={
  useState(initial){const index=cursor++;if(!slots[index]){slots[index]={value:typeof initial==='function'?initial():initial};slots[index].set=next=>{if(disposed)writesAfterDispose++;const value=typeof next==='function'?next(slots[index].value):next;if(!Object.is(value,slots[index].value)){slots[index].value=value;dirty=true;}};}return[slots[index].value,slots[index].set];},
  useRef(initial){const index=cursor++;slots[index]??={current:initial};return slots[index];},
  useId(){const index=cursor++;slots[index]??={value:`writing-fixture-${index}`};return slots[index].value;},
  useEffect(callback,deps){const index=cursor++;if(!same(slots[index]?.deps,deps)){const prior=slots[index];slots[index]={deps:deps&&[...deps],cleanup:prior?.cleanup};pendingEffects.push(()=>{prior?.cleanup?.();slots[index].cleanup=callback();});}},
 };
 const forbidden=surface=>new Proxy({},{get(_target,key){unrelatedReads.push(`${surface}.${String(key)}`);assert.fail(`Writing must not read ${surface}.${String(key)}`);}});
 const window=new Proxy({setTimeout(callback,delay){timers.set(++timerId,{callback,delay});return timerId;},clearTimeout(id){timers.delete(id);}},{get(target,key){if(Object.hasOwn(target,key))return target[key];unrelatedReads.push(`window.${String(key)}`);assert.fail(`Writing must not read window.${String(key)}`);}});
 const fetch=async(url,init={})=>{const call={url:String(url),init};calls.push(call);assert.equal(call.url,'/api/genie');return handler?handler(call,calls.length):Response.json({reply:'An editable suggestion.',links:[]});};
 const mocks={
  react:hooks,'react/jsx-runtime':jsx,
  '@clerk/nextjs':{useSession:()=>({isLoaded:sessionLoaded,session:sessionId?{id:sessionId}:null})},
  'next-intl':{useLocale:()=>language,useTranslations:namespace=>translatorFor(language,namespace)},
  'lucide-react':new Proxy({},{get:()=>()=>jsx.jsx('svg',{'aria-hidden':true})}),
  '@/lib/genie':genie,'./GenieWritingAssistant.module.css':{default:new Proxy({},{get:(_target,key)=>String(key)})},
 };
 const mod={exports:{}};
 new Function('require','module','exports','fetch','window','document','navigator',code)(name=>{
  assert.ok(Object.hasOwn(mocks,name),`Unexpected writing dependency ${name}`);return mocks[name];
 },mod,mod.exports,fetch,window,forbidden('document'),forbidden('navigator'));
 function render(){assert.equal(disposed,false);cursor=0;dirty=false;tree=mod.exports.GenieWritingContent(props);for(const effect of pendingEffects.splice(0))effect();return tree;}
 function node(predicate){const match=elements(tree,predicate)[0];assert.ok(match,'Expected writing control');return match;}
 const translation=key=>translatorFor(language,'GenieWriting')(key);
 function button(key){const label=translation(key);return node(item=>item.type==='button'&&(item.props['aria-label']===label||text(item).trim()===label));}
 function input(key){const label=node(item=>item.type==='label'&&text(item)===translation(key));return node(item=>item.type==='textarea'&&item.props.id===label.props.htmlFor);}
 return{
  calls,timers,applied,unrelatedReads,render,button,input,
  get tree(){return tree;},get text(){return text(tree);},get value(){return props.value;},get writesAfterDispose(){return writesAfterDispose;},
  click(key){const target=button(key);assert.notEqual(target.props.disabled,true,`${key} must be enabled`);target.props.onClick();render();},
  type(key,value){input(key).props.onChange({target:{value}});render();},
  setProps(next){props={...props,...next};render();},setLocale(next){language=next;render();},
  wrapper(next={}){if(Object.hasOwn(next,'sessionId'))sessionId=next.sessionId;if(Object.hasOwn(next,'sessionLoaded'))sessionLoaded=next.sessionLoaded;return mod.exports.default({...props,...next.props});},
  async settle(){for(let pass=0;pass<8;pass++){if(dirty&&!disposed)render();await nextTurn();}if(!disposed)assert.equal(dirty,false);},
  dispose(){if(disposed)return;disposed=true;for(const slot of slots)slot?.cleanup?.();},
 };
}

function checkPayload(call){
 assert.equal(call.init.method,'POST');assert.equal(call.init.credentials,'same-origin');assert.equal(call.init.cache,'no-store');assert.equal(call.init.referrerPolicy,'no-referrer');
 assert.deepEqual(call.init.headers,{'Content-Type':'application/json'});assert.ok(call.init.signal instanceof AbortSignal);
 const body=JSON.parse(call.init.body);
 assert.deepEqual(Object.keys(body).sort(),['area','locale','messages','writing']);
 assert.equal(body.messages.length,1);assert.deepEqual(Object.keys(body.messages[0]).sort(),['content','role']);assert.equal(body.messages[0].role,'user');
 assert.deepEqual(Object.keys(body.writing),['maxLength']);
 assert.equal(genie.validateGenieRequest(body).ok,true);
 return body;
}
function assertButtonsDoNotSubmit(f){
 assert.equal(elements(f.tree,item=>item.type==='form').length,0,'the helper must not nest or create a content form');
 for(const button of elements(f.tree,item=>item.type==='button'))assert.equal(button.props.type,'button','helper buttons inside a content form must never submit it');
}

test('opening, typing and closing are silent; generate sends only explicit notes and coarse context',async t=>{
 const f=fixture({value:'PRIVATE_EXISTING_FIELD',area:'company',locale:'en',maxLength:420});t.after(()=>f.dispose());f.render();assertButtonsDoNotSubmit(f);
 assert.equal(elements(f.tree,item=>item.type==='textarea').length,0);assert.equal(f.calls.length,0);
 f.click('open');assert.equal(f.input('notes').props.value,'');assert.equal(f.button('generate').props.disabled,true);
 f.type('notes','  Lighting rental\nDocumentary productions  ');f.setLocale('sv');await f.settle();assert.equal(f.calls.length,0);
 f.click('close');f.click('open');assert.equal(f.calls.length,0);assertButtonsDoNotSubmit(f);
 f.click('generate');await f.settle();
 assert.deepEqual(checkPayload(f.calls[0]),{area:'company',locale:'sv',messages:[{role:'user',content:'Lighting rental\nDocumentary productions'}],writing:{maxLength:420}});
 assert.ok(!f.calls[0].init.body.includes('PRIVATE_EXISTING_FIELD'));assert.deepEqual(f.unrelatedReads,[]);
 assert.equal(f.value,'PRIVATE_EXISTING_FIELD');assert.deepEqual(f.applied,[]);assertButtonsDoNotSubmit(f);
});

test('existing field content is sent only after explicit copying, with no silent truncation',async t=>{
 const f=fixture({value:'I supply camera equipment.'});t.after(()=>f.dispose());f.render();f.click('open');
 f.click('useCurrent');assert.equal(f.input('notes').props.value,'I supply camera equipment.');assert.equal(f.calls.length,0);
 f.click('generate');await f.settle();assert.equal(checkPayload(f.calls[0]).messages[0].content,'I supply camera equipment.');
 const long=fixture({value:'x'.repeat(2001)});t.after(()=>long.dispose());long.render();long.click('open');long.type('notes','Keep my own notes');long.click('useCurrent');
 assert.equal(long.input('notes').props.value,'Keep my own notes');assert.ok(long.text.includes(translatorFor('en','GenieWriting')('currentTooLong')));assert.equal(long.calls.length,0);
});

test('the suggestion remains an editable preview until explicit apply updates the parent field',async t=>{
 const f=fixture({maxLength:80});t.after(()=>f.dispose());f.render();f.click('open');f.type('notes','My factual notes');f.click('generate');await f.settle();
 assert.equal(f.value,'PRIVATE_EXISTING_FIELD');assert.deepEqual(f.applied,[]);assert.equal(f.input('preview').props.value,'An editable suggestion.');assert.equal(f.input('preview').props.maxLength,80);
 f.type('preview','  My reviewed description.  ');assert.equal(f.value,'PRIVATE_EXISTING_FIELD');assert.equal(f.calls.length,1);
 assertButtonsDoNotSubmit(f);f.click('apply');assert.deepEqual(f.applied,['My reviewed description.']);assert.equal(f.value,'My reviewed description.');
 assert.equal(elements(f.tree,item=>item.type==='textarea').length,1);assert.ok(f.text.includes(translatorFor('en','GenieWriting')('applied')));assert.equal(f.calls.length,1);
});

test('changing notes or copying current text removes the stale preview and its apply action',async t=>{
 for(const action of ['notes','useCurrent']){
  const f=fixture({value:'Current field facts',handler:(_call,index)=>Response.json({reply:index===1?'Old source suggestion.':'Updated source suggestion.',links:[]})});t.after(()=>f.dispose());
  f.render();f.click('open');f.type('notes','Original source notes');f.click('generate');await f.settle();
  assert.equal(f.input('preview').props.value,'Old source suggestion.');assert.equal(f.button('apply').props.disabled,false);
  if(action==='notes')f.type('notes','Changed source notes');else f.click('useCurrent');
  assert.equal(elements(f.tree,item=>item.type==='textarea').length,1,'source edits must remove the old preview');
  assert.equal(elements(f.tree,item=>item.type==='button'&&text(item).trim()===translatorFor('en','GenieWriting')('apply')).length,0,'a stale suggestion must have no apply action');
  assert.equal(f.value,'Current field facts');assert.deepEqual(f.applied,[]);assert.equal(f.calls.length,1,'changing sources must not automatically generate');
  const updatedNotes=action==='notes'?'Changed source notes':'Current field facts';
  assert.equal(f.input('notes').props.value,updatedNotes);f.click('generate');await f.settle();
  assert.equal(checkPayload(f.calls[1]).messages[0].content,updatedNotes);assert.equal(f.input('preview').props.value,'Updated source suggestion.');
  f.click('apply');assert.deepEqual(f.applied,['Updated source suggestion.']);
 }
});

test('apply preserves parent edits made while generating or reviewing, until a fresh suggestion is requested',async t=>{
 for(const duringRequest of [true,false]){
  const response=defer();const f=fixture({handler:(_call,index)=>index===1?response.promise:Response.json({reply:'Fresh suggestion.',links:[]})});t.after(()=>f.dispose());
  f.render();f.click('open');f.type('notes','Original notes');f.click('generate');
  if(duringRequest)f.setProps({value:'New manually edited field'});
  response.resolve(Response.json({reply:'Old suggestion.',links:[]}));await f.settle();
  if(!duringRequest)f.setProps({value:'New manually edited field'});
  f.click('apply');assert.equal(f.value,'New manually edited field');assert.deepEqual(f.applied,[]);assert.ok(f.text.includes(translatorFor('en','GenieWriting')('conflict')));
  assert.equal(f.input('preview').props.value,'Old suggestion.');f.type('notes','Updated notes');f.click('generate');await f.settle();f.click('apply');
  assert.deepEqual(f.applied,['Fresh suggestion.']);assert.equal(f.value,'Fresh suggestion.');
 }
});

test('synchronous double clicks trigger one request and every pending control remains non-submitting',async t=>{
 const response=defer();const f=fixture({handler:()=>response.promise});t.after(()=>f.dispose());f.render();f.click('open');f.type('notes','A short note');
 const generate=f.button('generate').props.onClick;generate();generate();f.render();
 assert.equal(f.calls.length,1);assert.equal(f.input('notes').props.disabled,true);assert.equal(f.button('generating').props.disabled,true);assertButtonsDoNotSubmit(f);
 assert.equal(f.timers.size,1);assert.equal([...f.timers.values()][0].delay,35_000);
 response.resolve(Response.json({reply:'Only one answer.',links:[]}));await f.settle();assert.equal(f.input('preview').props.value,'Only one answer.');assert.equal(f.timers.size,0);
});

test('close, cancel and disabling abort immediately and late responses cannot replace a newer preview',async t=>{
 for(const action of ['close','cancel','disabled']){
  const abandoned=defer(),current=defer();const f=fixture({handler:(_call,index)=>index===1?abandoned.promise:current.promise});t.after(()=>f.dispose());
  f.render();f.click('open');f.type('notes','Abandoned notes');f.click('generate');
  if(action==='disabled')f.setProps({disabled:true});else f.click(action);
  assert.equal(f.calls[0].init.signal.aborted,true);assert.equal(f.timers.size,0);
  if(action==='close')f.click('open');if(action==='disabled')f.setProps({disabled:false});
  f.type('notes','Current notes');f.click('generate');assert.equal(f.calls.length,2);
  current.resolve(Response.json({reply:'Current suggestion.',links:[]}));await f.settle();
  abandoned.resolve(Response.json({reply:'Stale suggestion must be ignored.',links:[]}));await f.settle();
  assert.equal(f.input('preview').props.value,'Current suggestion.');assert.equal(f.value,'PRIVATE_EXISTING_FIELD');assert.deepEqual(f.applied,[]);
 }
});

test('unmount and timeout cancel provider work without stale UI writes or applying anything',async t=>{
 const unmounted=defer();const f=fixture({handler:()=>unmounted.promise});f.render();f.click('open');f.type('notes','Unmount me');f.click('generate');f.dispose();
 assert.equal(f.calls[0].init.signal.aborted,true);assert.equal(f.timers.size,0);
 unmounted.resolve(Response.json({reply:'Too late.',links:[]}));await f.settle();assert.equal(f.writesAfterDispose,0);assert.deepEqual(f.applied,[]);
 const timed=defer();const timeout=fixture({handler:()=>timed.promise});t.after(()=>timeout.dispose());timeout.render();timeout.click('open');timeout.type('notes','Time out');timeout.click('generate');
 [...timeout.timers.values()][0].callback();await timeout.settle();assert.equal(timeout.calls[0].init.signal.aborted,true);assert.ok(timeout.text.includes(translatorFor('en','Genie')('errorTimeout')));
 timed.resolve(Response.json({reply:'Timed out reply.',links:[]}));await timeout.settle();assert.equal(elements(timeout.tree,item=>item.type==='textarea').length,1);assert.deepEqual(timeout.applied,[]);
});

test('invalid or overlong suggestions cannot be applied and the notes remain editable after errors',async t=>{
 for(const reply of ['', ' ', 'x'.repeat(31), 42]){
  const f=fixture({maxLength:30,handler:()=>Response.json({reply,links:[]})});t.after(()=>f.dispose());f.render();f.click('open');f.type('notes','Facts');f.click('generate');await f.settle();
  assert.equal(elements(f.tree,item=>item.type==='textarea').length,1);assert.ok(f.text.includes(translatorFor('en','Genie')('errorFailed')));assert.equal(f.input('notes').props.disabled,false);assert.deepEqual(f.applied,[]);
 }
 const f=fixture({maxLength:30});t.after(()=>f.dispose());f.render();f.click('open');f.type('notes','Facts');f.click('generate');await f.settle();
 f.type('preview','x'.repeat(31));assert.equal(f.button('apply').props.disabled,true);f.button('apply').props.onClick();assert.deepEqual(f.applied,[]);
 f.type('preview',' ');assert.equal(f.button('apply').props.disabled,true);f.button('apply').props.onClick();assert.deepEqual(f.applied,[]);
});

test('unexpected server error codes render a safe localized error without inherited-property lookups',async t=>{
 for(const error of ['unexpected','__proto__','constructor','toString']){
  const f=fixture({handler:()=>Response.json({error,detail:'PRIVATE_PROVIDER_DETAIL'},{status:502})});t.after(()=>f.dispose());
  f.render();f.click('open');f.type('notes','Keep these notes');f.click('generate');await f.settle();
  assert.ok(f.text.includes(translatorFor('en','Genie')('errorFailed')));assert.ok(!f.text.includes('PRIVATE_PROVIDER_DETAIL'));
  assert.equal(f.input('notes').props.value,'Keep these notes');assert.equal(f.input('notes').props.disabled,false);assert.deepEqual(f.applied,[]);
 }
});

test('the session wrapper hides unloaded state and changes its remount key with session or form context',()=>{
 const f=fixture({contextKey:'profile-one'});assert.equal(f.wrapper({sessionLoaded:false}),null);
 const first=f.wrapper({sessionLoaded:true}),second=f.wrapper({sessionId:'session-two'}),guest=f.wrapper({sessionId:null});
 assert.notEqual(first.key,second.key);assert.notEqual(second.key,guest.key);
 assert.notEqual(guest.key,f.wrapper({props:{contextKey:'profile-two'}}).key);
 assert.equal(first.props.value,'PRIVATE_EXISTING_FIELD');assert.equal(first.props.area,'profile');assert.equal(first.props.contextKey,'profile-one');
 f.dispose();
});
