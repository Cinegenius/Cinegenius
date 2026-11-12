import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {setImmediate as nextTurn} from 'node:timers/promises';
import React from 'react';
import ts from 'typescript';
import {intlClientFor, translatorFor} from './i18n-test-fixture.mjs';
import {navigateAdminSupportThread, backFromAdminSupportThread, ADMIN_SUPPORT_HISTORY_KEY} from './admin-support-navigation.ts';
import * as navigation from './admin-support-navigation.ts';
const require=createRequire(import.meta.url);
function browser(initial='https://fixture.invalid/admin') {
 const entries=[{url:'https://fixture.invalid/before',state:{}},{url:initial,state:{__NA:true,cinegeniusView:{path:'/admin',owner:'admin-a',fields:{'admin.activeTab':'support','admin.verificationsPage':2}}}}];let index=1;
 return {get location(){return new URL(entries[index].url)},get entries(){return entries},history:{get state(){return entries[index].state},pushState(state,_title,url){assert.equal(state.__NA,undefined);entries.splice(index+1);entries.push({url:new URL(url,entries[index].url).href,state});index++},replaceState(state,_title,url){assert.equal(state.__NA,undefined);entries[index]={url:new URL(url,entries[index].url).href,state}},back(){if(index)index--},forward(){if(index<entries.length-1)index++}}};
}
test('support Back/Forward preserves actual view steps and admin controls without copying message data',()=>{
 const b=browser();navigateAdminSupportThread(b,'admin-a','thread-a');navigateAdminSupportThread(b,'admin-a','thread-b');
 assert.equal(b.location.search,'?supportThread=thread-b');assert.equal(b.entries.length,4);
 assert.equal(navigateAdminSupportThread(b,'admin-a','thread-b'),false);
 assert.deepEqual(Object.keys(b.history.state[ADMIN_SUPPORT_HISTORY_KEY]).sort(),['current','owner','previous']);
 assert.equal(b.history.state.cinegeniusView.fields['admin.activeTab'],'support');assert.equal(b.history.state.cinegeniusView.fields['admin.verificationsPage'],2);
 backFromAdminSupportThread(b,'admin-a');assert.equal(b.location.search,'?supportThread=thread-a');backFromAdminSupportThread(b,'admin-a');assert.equal(b.location.search,'');
 b.history.forward();assert.equal(b.location.search,'?supportThread=thread-a');b.history.back();b.history.back();assert.equal(b.location.pathname,'/before');
});
test('direct support links close to inbox without leaving site or inventing a history sentinel',()=>{
 const b=browser('https://fixture.invalid/admin?filter=keep&supportThread=thread-a');backFromAdminSupportThread(b,'admin-a');assert.equal(b.location.search,'?filter=keep');assert.equal(b.entries.length,2);
 const other=browser();navigateAdminSupportThread(other,'admin-a','thread-a');backFromAdminSupportThread(other,'different-admin');assert.equal(other.location.search,'');assert.equal(other.entries.length,3);
 assert.equal(navigateAdminSupportThread(browser('https://fixture.invalid/profile'),'admin-a','thread-a'),false);
});
function nodes(value,predicate,found=[]){if(Array.isArray(value))value.forEach(v=>nodes(v,predicate,found));else if(value&&typeof value==='object'&&value.props){if(predicate(value))found.push(value);nodes(value.props.children,predicate,found);}return found;}
function text(value){if(Array.isArray(value))return value.map(text).join(' ');if(value==null||typeof value==='boolean')return '';if(typeof value==='string'||typeof value==='number')return String(value);return value.props?text(value.props.children):'';}
function deferred(){let resolve;const promise=new Promise(done=>resolve=done);return{promise,resolve};}
function thread(id){return{id,userName:id==='thread-a'?'Member A':'Member B',targetLabel:'Test offer',editUrl:'/profile',userId:'own-member',updatedAt:'2026-11-10T12:00:00Z',unreadCount:0,latest:{senderName:'Member',content:'Earlier message'}};}
function fixture(handle){
 const before=Object.fromEntries(['window','document','fetch'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));const slots=[],effects=[],listeners=new Map(),timers=new Map(),requests=[];let cursor=0,dirty=true,tree,timer=0;
 const same=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
 const hooks={...React,useContext:()=> 'admin-a',useState(initial){const i=cursor++;if(!slots[i]){const slot={value:typeof initial==='function'?initial():initial};slot.set=action=>{const next=typeof action==='function'?action(slot.value):action;if(!Object.is(next,slot.value)){slot.value=next;dirty=true;}};slots[i]=slot;}return[slots[i].value,slots[i].set];},useRef(initial){const i=cursor++;return slots[i]??={current:initial};},useCallback(callback,deps){const i=cursor++;if(!slots[i]||!same(slots[i].deps,deps))slots[i]={callback,deps};return slots[i].callback;},useMemo(create,deps){const i=cursor++;if(!slots[i]||!same(slots[i].deps,deps))slots[i]={value:create(),deps};return slots[i].value;},useEffect(create,deps){const i=cursor++,old=slots[i];if(!old||!same(old.deps,deps)){const slot={deps,cleanup:old?.cleanup};slots[i]=slot;effects.push(()=>{slot.cleanup?.();slot.cleanup=create();});}}};
 const b=browser();Object.assign(b,{innerHeight:800,addEventListener(type,cb){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(cb);},removeEventListener(type,cb){listeners.get(type)?.delete(cb);},dispatchEvent(event){for(const cb of listeners.get(event.type)??[])cb(event);return true;},setInterval(cb){timers.set(++timer,cb);return timer;},clearInterval(id){timers.delete(id);}});
 globalThis.window=b;globalThis.document={visibilityState:'visible'};
 globalThis.fetch=async(url,options={})=>{const request={url:String(url),method:options.method??'GET',options};requests.push(request);if(request.url==='/api/admin/support/templates')return Response.json({templates:[]});if(request.url.startsWith('/api/admin/support/threads?page='))return Response.json({threads:[thread('thread-a'),thread('thread-b')],total:2,unreadCount:5});return handle(request);};
 const mocks={react:hooks,'next-intl':intlClientFor(),'@clerk/nextjs':{useAuth:()=>({userId:'admin-a',isLoaded:true})},'@/lib/server-admin-context':{ServerAdminContext:{}},'@/lib/admin-support-navigation':navigation,'@/components/UnoptimizedImage':{default:'img'},'@/lib/ui-error-message':{uiErrorMessage:(error,fallback)=>error?.message??fallback}};
 const source=ts.transpileModule(readFileSync(new URL('../components/admin/AdminSupportCenter.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;const mod={exports:{}};new Function('require','module','exports',source)(name=>Object.hasOwn(mocks,name)?mocks[name]:require(name),mod,mod.exports);
 function render(){cursor=0;dirty=false;tree=mod.exports.AdminSupportCenter();for(const node of nodes(tree,node=>!!node.props.ref)){node.props.ref.current??={scrollTop:0,scrollHeight:500,clientHeight:300};}for(const effect of effects.splice(0))effect();}
 return{requests,b,get tree(){return tree;},get text(){return text(tree);},async settle(){for(let i=0;i<20;i++){if(dirty)render();await nextTurn();if(!dirty&&!effects.length)return;}assert.fail('fixture did not settle');},click(label){const item=nodes(tree,n=>n.type==='button'&&text(n).includes(label))[0];assert.ok(item,'button '+label);item.props.onClick();},input(value){const item=nodes(tree,n=>n.type==='textarea'&&n.props['aria-label'])[0];assert.ok(item);item.props.onChange({target:{value}});},get draft(){return nodes(tree,n=>n.type==='textarea'&&n.props['aria-label'])[0]?.props.value;},send(){const item=nodes(tree,n=>n.type==='button'&&n.props['aria-label']===translatorFor('de')('Ui.text_70e11be7ed62ea'))[0];assert.ok(item);return item.props.onClick();},tick(){for(const cb of [...timers.values()])cb();},back(){b.history.back();b.dispatchEvent(new Event('popstate'));},dispose(){for(const slot of slots)slot?.cleanup?.();for(const[key,descriptor]of Object.entries(before)){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}};
}
function detail(request){const id=request.url.split('/').pop();return Response.json({thread:thread(id),messages:[{id:'message-'+id,content:'Message '+id,senderName:'Member',createdAt:'2026-11-10T12:00:00Z',fromSupport:false,readAt:'2026-11-10T12:00:00Z'}]});}
test('late support send cannot switch the current thread or discard its draft, and Back stops hidden-thread polling',async t=>{
 const pending=deferred();const f=fixture(request=>request.method==='POST'?pending.promise:detail(request));t.after(()=>f.dispose());await f.settle();
 f.click('Member A');await f.settle();f.input('Answer for A');await f.settle();f.send();await f.settle();
 f.click('Member B');await f.settle();f.input('Draft for B');await f.settle();pending.resolve(Response.json({success:true,messageId:'stored-message'}));await f.settle();
 assert.equal(f.b.location.search,'?supportThread=thread-b');assert.equal(f.draft,'Draft for B');assert.ok(f.text.includes('Message thread-b'));assert.ok(!f.text.includes('Message thread-a'));
 f.back();await f.settle();assert.equal(f.b.location.search,'?supportThread=thread-a');assert.equal(f.draft,'');f.back();await f.settle();assert.equal(f.b.location.search,'');
 const oldReads=f.requests.filter(r=>r.url==='/api/admin/support/threads/thread-a').length;f.tick();await f.settle();assert.equal(f.requests.filter(r=>r.url==='/api/admin/support/threads/thread-a').length,oldReads);
});
test('new text typed while a send is pending survives its confirmed response',async t=>{
 const pending=deferred();const f=fixture(request=>request.method==='POST'?pending.promise:detail(request));t.after(()=>f.dispose());await f.settle();f.click('Member A');await f.settle();f.input('First answer');await f.settle();f.send();await f.settle();f.input('Next answer draft');await f.settle();pending.resolve(Response.json({success:true,messageId:'stored-message'}));await f.settle();assert.equal(f.draft,'Next answer draft');
});
test('failed or unconfirmed support send retains the draft and the retry key',async t=>{
 let attempt=0;const keys=[];const f=fixture(request=>{if(request.method!=='POST')return detail(request);keys.push(JSON.parse(request.options.body).idempotencyKey);return ++attempt===1?Response.json({success:true}):Response.json({success:true,messageId:'confirmed'});});t.after(()=>f.dispose());await f.settle();f.click('Member A');await f.settle();f.input('Keep this answer');await f.settle();f.send();await f.settle();assert.equal(f.draft,'Keep this answer');assert.ok(nodes(f.tree,n=>n.props.role==='alert').length);f.send();await f.settle();assert.equal(f.draft,'');assert.equal(keys.length,2);assert.equal(keys[0],keys[1]);
});
test('support composer uses native modal focus, cancellation and focus restoration without browser prompts',async t=>{
 const before=Object.fromEntries(['window','document','fetch','HTMLElement'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 const slots=[],effects=[];let cursor=0,dirty=true,tree,focused='',nativeDialog;
 class Element{isConnected=true;constructor(name){this.name=name;}focus(){focused=this.name;}}
 const previous=new Element('trigger');globalThis.HTMLElement=Element;
 const viewport=Object.assign(new EventTarget(),{height:700,offsetTop:0});
 globalThis.document={activeElement:previous,body:{style:{overflow:'auto'}}};globalThis.window={visualViewport:viewport,innerHeight:700,location:new URL('https://fixture.invalid/admin'),addEventListener(){},removeEventListener(){}};
 globalThis.fetch=async url=>Response.json(String(url).includes('/resolve?')?{target:{targetType:'profile',targetId:'member',targetLabel:'Profile',editUrl:'/profile',recipientUserId:'member',recipientName:'Member',recipientProfileUrl:'/profile/member',firstName:'Member',missingFields:[],isDraft:false},previousContacts:[]}:{templates:[{template_key:'check_in',label:'Check in',body:'Hello member',enabled:true}]});
 const same=(a,b)=>a?.length===b?.length&&a.every((v,i)=>Object.is(v,b[i]));
 const hooks={...React,useState(initial){const i=cursor++;if(!slots[i]){const slot={value:initial};slot.set=action=>{const next=typeof action==='function'?action(slot.value):action;if(!Object.is(next,slot.value)){slot.value=next;dirty=true;}};slots[i]=slot;}return[slots[i].value,slots[i].set];},useRef(initial){const i=cursor++;return slots[i]??={current:initial};},useEffect(create,deps){const i=cursor++,old=slots[i];if(!old||!same(old.deps,deps)){const slot={deps,cleanup:old?.cleanup};slots[i]=slot;effects.push(()=>{slot.cleanup?.();slot.cleanup=create();});}}};
 const mocks={react:hooks,'next-intl':intlClientFor(),'@/components/UnoptimizedImage':{default:'img'},'@/lib/support-identity':{SUPPORT_AVATAR_URL:'/support.png'},'@/lib/support-message-templates':{fillSupportTemplate:body=>body},'@/lib/support-setup-template':{SETUP_TEMPLATE_KEY:'setup'},'@/lib/support-started-offer-template':{STARTED_OFFER_TEMPLATE_KEY:'started'},'@/lib/ui-error-message':{uiErrorMessage:(error,fallback)=>error?.message??fallback}};
 const source=ts.transpileModule(readFileSync(new URL('../components/admin/SupportMessageAction.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;const mod={exports:{}};new Function('require','module','exports',source)(name=>Object.hasOwn(mocks,name)?mocks[name]:require(name),mod,mod.exports);
 function render(){cursor=0;dirty=false;tree=mod.exports.SupportMessageAction({targetType:'profile',targetId:'member'});for(const node of nodes(tree,n=>!!n.props.ref)){if(node.type==='dialog'){nativeDialog??={open:false,showModal(){this.open=true;},close(){this.open=false;}};node.props.ref.current=nativeDialog;}else node.props.ref.current??=new Element('close');}for(const effect of effects.splice(0))effect();}
 async function settle(){for(let i=0;i<20;i++){if(dirty)render();await nextTurn();if(!dirty&&!effects.length)return;}assert.fail('modal did not settle');}
 t.after(()=>{for(const slot of slots)slot?.cleanup?.();for(const[key,descriptor]of Object.entries(before)){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}});
 await settle();nodes(tree,n=>n.type==='button')[0].props.onClick();await settle();
 let dialog=nodes(tree,n=>n.type==='dialog')[0];assert.ok(dialog);assert.equal(nativeDialog.open,true);assert.equal(focused,'close');assert.equal(document.body.style.overflow,'hidden');assert.equal(dialog.props.style.maxHeight,'calc(676px - env(safe-area-inset-bottom, 0px))');assert.equal(dialog.props.style.height,'min(52rem, calc(676px - env(safe-area-inset-bottom, 0px)))','a definite height must allocate space to the scrollable composer body');
 viewport.height=360;viewport.dispatchEvent(new Event('resize'));await settle();dialog=nodes(tree,n=>n.type==='dialog')[0];assert.equal(dialog.props.style.height,'min(52rem, calc(336px - env(safe-area-inset-bottom, 0px)))');
 dialog.props.onCancel({preventDefault(){assert.fail('Escape should close an idle composer');}});await settle();assert.equal(nodes(tree,n=>n.type==='dialog').length,0);assert.equal(nativeDialog.open,false);assert.equal(document.body.style.overflow,'auto');assert.equal(focused,'trigger');
});
test('failed thread loading offers a usable retry and recovers the selected conversation',async t=>{
 let attempt=0;const f=fixture(request=>{if(++attempt===1)throw new Error('Temporary connection failure');return detail(request);});t.after(()=>f.dispose());await f.settle();f.click('Member A');await f.settle();assert.ok(nodes(f.tree,n=>n.props.role==='alert').length);assert.ok(f.text.includes('Temporary connection failure'));f.click(translatorFor('de')('FormDraft.reload'));await f.settle();assert.ok(f.text.includes('Message thread-a'));assert.equal(f.b.location.search,'?supportThread=thread-a');
});
test('an unfinished older-message request cannot apply its scroll position to another thread',async t=>{
 const pending=deferred();const f=fixture(request=>{if(request.url.includes('?before='))return pending.promise;if(request.url.endsWith('thread-a'))return Response.json({thread:thread('thread-a'),messages:[{id:'a',content:'A',senderName:'Member',createdAt:'2026-11-10T12:00:00Z',fromSupport:false,readAt:'2026-11-10T12:00:00Z'}],hasOlder:true,nextCursor:{before:'2026-11-10T12:00:00Z',before_id:'a'}});return detail(request);});t.after(()=>f.dispose());await f.settle();f.click('Member A');await f.settle();const viewport=nodes(f.tree,n=>Boolean(n.props.onScroll&&n.props.ref))[0].props.ref.current;viewport.scrollTop=70;f.click(translatorFor('de')('Ui.text_b15d7a15520819'));await f.settle();f.click('Member B');await f.settle();assert.equal(viewport.scrollTop,viewport.scrollHeight);pending.resolve(Response.json({thread:thread('thread-a'),messages:[],hasOlder:false}));await f.settle();assert.ok(f.text.includes('Message thread-b'));
});
