import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {setImmediate as tick} from 'node:timers/promises';
import ts from 'typescript';
import {translatorFor} from './i18n-test-fixture.mjs';
import {uiErrorMessage} from './ui-error-message.ts';
const require=createRequire(import.meta.url),jsx=require('react/jsx-runtime');
const source=readFileSync(new URL('../components/messaging/InboxFriends.tsx',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const friend={friendship_id:'friend-1',user_id:'peer',display_name:'Confirmed Person',role:'Camera',avatar_url:null};
const response=(body,status=200)=>Response.json(body,{status});
const defer=()=>{let resolve;const promise=new Promise(done=>{resolve=done});return {promise,resolve}};
function elements(value,match,out=[]){if(Array.isArray(value))for(const child of value)elements(child,match,out);else if(value?.props){if(match(value))out.push(value);elements(value.props.children,match,out)}return out}
function fixture(handler,locale='de'){
 let cursor=0,dirty=true,tree,auth={userId:'owner',sessionId:'session'};const slots=[],effects=[],calls=[];
 const same=(a,b)=>a?.length===b?.length&&a.every((value,i)=>Object.is(value,b[i]));
 const effect=(callback,deps)=>{const i=cursor++,old=slots[i];if(!old||!same(old.deps,deps)){slots[i]={deps,cleanup:old?.cleanup};effects.push(()=>{old?.cleanup?.();slots[i].cleanup=callback()})}};
 const hooks={useEffect:effect,useLayoutEffect:effect,useRef(initial){const i=cursor++;return slots[i]??=( {current:initial})},useState(initial){const i=cursor++;if(!slots[i])slots[i]={value:typeof initial==='function'?initial():initial};return [slots[i].value,next=>{const value=typeof next==='function'?next(slots[i].value):next;if(!Object.is(value,slots[i].value)){slots[i].value=value;dirty=true}}]},useCallback(callback,deps){const i=cursor++;if(!slots[i]||!same(slots[i].deps,deps))slots[i]={deps,value:callback};return slots[i].value}};
 const mocks={react:hooks,'react/jsx-runtime':jsx,'@clerk/nextjs':{useAuth:()=>auth},'next-intl':{useLocale:()=>locale,useTranslations:namespace=>translatorFor(locale,namespace)},'lucide-react':{Search:'search-icon',Users:'users-icon'},'@/components/ContactCard':{default:'contact-card'},'@/contexts/FormDraftContext':{useFormNavigation:()=>({leave:fn=>fn()})},'@/lib/message-navigation':{navigateMessageView:()=>{}},'@/lib/ui-error-message':{uiErrorMessage}};
 const mod={exports:{}};new Function('require','module','exports','fetch','window',compiled)(name=>{assert.ok(name in mocks,name);return mocks[name]},mod,mod.exports,async(url,init={})=>{calls.push({url,init});return handler(url,init,calls.length)}, {addEventListener(){},removeEventListener(){}});
 const render=()=>{cursor=0;dirty=false;tree=mod.exports.default();effects.splice(0).forEach(fn=>fn());return tree};
 return {calls,render,async settle(){for(let n=0;n<15;n++){if(dirty)render();await tick()}assert.equal(dirty,false)},cards:()=>elements(tree,n=>n.type==='contact-card'),alerts:()=>elements(tree,n=>n.props.role==='alert'),owner(id){auth={userId:id,sessionId:id+'-session'};render()},reload(){const retry=elements(tree,n=>n.type==='button')[0];assert.ok(retry);retry.props.onClick()},dispose(){for(const s of slots)s?.cleanup?.()}};
}
for(const locale of ['de','en','es','it','cs','hu','nl','nl-BE','sv'])test(`${locale}: friends contains only accepted connections, no incoming or sent views`,async t=>{
 const f=fixture(async()=>response({friends:[friend],incoming:[{...friend,display_name:'Pending incoming'}],outgoing:[{...friend,display_name:'Pending outgoing'}]}),locale);t.after(()=>f.dispose());await f.settle();assert.equal(f.cards().length,1);assert.equal(f.cards()[0].props.contact.display_name,'Confirmed Person');assert.match(f.cards()[0].props.messageHref,/view=friends&to=peer/);assert.ok(f.calls.every(c=>(c.init.method??'GET')==='GET'));
});
test('failed removal retains contact; duplicate removal waits for the same server decision',async t=>{
 const decision=defer();const f=fixture(async(_url,init)=>init.method==='DELETE'?decision.promise:response({friends:[friend]}));t.after(()=>f.dispose());await f.settle();const first=f.cards()[0].props.onRemove('friend-1');assert.equal(await f.cards()[0].props.onRemove('friend-1'),false);assert.equal(f.calls.filter(c=>c.init.method==='DELETE').length,1);decision.resolve(response({error:'Rejected fixture removal'},503));assert.equal(await first,false);await f.settle();assert.equal(f.cards().length,1);assert.equal(f.alerts().length,1);
});
test('only an explicit success acknowledgement removes the selected connection',async t=>{
 const f=fixture(async(_url,init)=>init.method==='DELETE'?response({success:true}):response({friends:[friend]}));t.after(()=>f.dispose());await f.settle();assert.equal(await f.cards()[0].props.onRemove('friend-1'),true);await f.settle();assert.equal(f.cards().length,0);assert.equal(f.calls.at(-1).init.headers['X-Contact-Account'],'owner');
});
test('account change immediately hides previous contacts and late responses cannot restore them',async t=>{
 const old=defer();const f=fixture(async(_u,_i,n)=>n===1?old.promise:response({friends:[{...friend,display_name:'New account contact'}]}));t.after(()=>f.dispose());await f.settle();f.owner('different');assert.equal(f.cards().length,0);await f.settle();old.resolve(response({friends:[friend]}));await f.settle();assert.equal(f.cards()[0].props.contact.display_name,'New account contact');
});
test('late removal cannot alter the next account or claim success there',async t=>{
 const decision=defer();const f=fixture(async(_url,init)=>init.method==='DELETE'?decision.promise:response({friends:[friend]}));t.after(()=>f.dispose());await f.settle();const operation=f.cards()[0].props.onRemove('friend-1');f.owner('different');await f.settle();decision.resolve(response({success:true}));assert.equal(await operation,false);await f.settle();assert.equal(f.cards().length,1);
});
test('initial failure offers retry without claiming the list is empty',async t=>{
 const f=fixture(async(_u,_i,n)=>n===1?response({},503):response({friends:[friend]}));t.after(()=>f.dispose());await f.settle();assert.equal(f.cards().length,0);assert.equal(f.alerts().length,1);f.reload();await f.settle();assert.equal(f.alerts().length,0);assert.equal(f.cards().length,1);
});
