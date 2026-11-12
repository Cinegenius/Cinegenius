import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';import {setImmediate as nextTurn} from 'node:timers/promises';import React from 'react';import ts from 'typescript';import {intlClientFor,translatorFor} from './i18n-test-fixture.mjs';import * as navigation from './site-navigation.ts';
const require=createRequire(import.meta.url);
function nodes(value,predicate,out=[]){if(Array.isArray(value))value.forEach(child=>nodes(child,predicate,out));else if(value&&typeof value==='object'&&value.props){if(predicate(value))out.push(value);nodes(value.props.children,predicate,out);}return out;}
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
function fixture(t){
 const before=Object.fromEntries(['window','document','localStorage','fetch'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 let cursor=0,dirty=true,tree,locale='de',focused='',guard=null,profileListener;const slots=[],effects=[],calls=[],toasts=[],timers=new Map();let timer=0;
 const response=deferred();let signOut=options=>{calls.push({action:'signOut',options});return response.promise;};
 globalThis.window=Object.assign(new EventTarget(),{scrollY:0,setTimeout:callback=>{timers.set(++timer,callback);return timer;},clearTimeout:id=>timers.delete(id)});
 globalThis.document=Object.assign(new EventTarget(),{body:{style:{overflow:'auto'}}});globalThis.localStorage={removeItem(){}};
 globalThis.fetch=()=>{assert.fail('header controls must not fetch profile photos or private profile data');};
 const same=(a,b)=>a?.length===b?.length&&a?.every((value,index)=>Object.is(value,b[index]));
 function effect(create,deps){const index=cursor++,previous=slots[index];if(!previous||!same(previous.deps,deps)){const slot={deps,cleanup:previous?.cleanup};slots[index]=slot;effects.push(()=>{slot.cleanup?.();slot.cleanup=create();});}}
 const hooks={...React,useState(initial){const index=cursor++;if(!slots[index]){const slot={value:initial};slot.set=action=>{const value=typeof action==='function'?action(slot.value):action;if(!Object.is(value,slot.value)){slot.value=value;dirty=true;}};slots[index]=slot;}return[slots[index].value,slots[index].set];},useRef(initial){const index=cursor++;return slots[index]??={current:initial};},useEffect:effect,useLayoutEffect:effect};
 const shared={menuOpen:false,openMenu(){calls.push({action:'openMenu'});this.menuOpen=true;dirty=true;},closeMenu(){calls.push({action:'closeMenu'});this.menuOpen=false;dirty=true;}};
 // Bind just as the real context callbacks are independent of their receiver.
 shared.openMenu=shared.openMenu.bind(shared);shared.closeMenu=shared.closeMenu.bind(shared);
 const mocks={react:hooks,'next/link':{default:'a'},'next/navigation':{usePathname:()=>'/creators'},'@clerk/nextjs':{useAuth:()=>({isLoaded:true,isSignedIn:true}),useUser:()=>({user:{id:'own-account',firstName:'Own account',imageUrl:'PRIVATE_PHOTO_CANARY',primaryEmailAddress:{emailAddress:'fixture@example.invalid'}}}),useClerk:()=>({signOut})},'next-intl':{useTranslations:namespace=>intlClientFor(locale).useTranslations(namespace)},'@/lib/site-navigation':navigation,'@/contexts/SiteNavigationContext':{useSiteNavigation:()=>shared},'@/contexts/FormDraftContext':{useFormNavigation:()=>({leave:action=>{if(guard)return;calls.push({action:'guard'});guard=action;}})},'@/contexts/ToastContext':{useToast:()=>({addToast:(text,kind)=>toasts.push({text,kind})})},'@/lib/use-authenticated-inbox':{useAuthenticatedInbox:()=>({status:'ready',count:2})},'@/lib/use-admin-support-unread':{useAdminSupportUnread:()=>({status:'idle',count:null})},'@/lib/profile-update-events':{subscribeToProfileUpdated:listener=>{profileListener=listener;return()=>{profileListener=null;};}},'@/components/NotificationCenter':{default:()=>null},'@/components/Logo':{Logo:()=>null},'@/components/LanguageSwitcher':{default:()=>null}};
 mocks['@/components/NavigationIcon']={default:()=>null,NavigationIcon:()=>null};
 const compiled=ts.transpileModule(readFileSync(new URL('../components/Navbar.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;const mod={exports:{}};new Function('require','module','exports',compiled)(name=>Object.hasOwn(mocks,name)?mocks[name]:require(name),mod,mod.exports);
 function render(){cursor=0;dirty=false;tree=mod.exports.default({initialIsSignedIn:true});for(const node of nodes(tree,node=>!!node.props.ref))node.props.ref.current??=node.type==='button'?{focus(){focused='account';}}:{contains(){return false;}};for(const create of effects.splice(0))create();}
 function dispose(){for(const slot of slots)slot?.cleanup?.();for(const[key,descriptor]of Object.entries(before)){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}
 t.after(dispose);
 return{calls,toasts,response,get tree(){return tree;},get focused(){return focused;},async settle(){for(let n=0;n<16;n++){if(dirty)render();await nextTurn();if(!dirty&&!effects.length)return;}assert.fail('header did not settle');},approve(){const action=guard;guard=null;action?.();},request(){document.dispatchEvent(new Event('cinegenius:request-sign-out'));},setSignOut(next){signOut=next;dirty=true;},setLocale(next){locale=next;dirty=true;},profile(detail){profileListener?.(detail);}};
}
test('desktop More and mobile hamburger open the same shared menu without changing document scroll',async t=>{
 const f=fixture(t);await f.settle();const controls=nodes(f.tree,node=>node.type==='button'&&node.props['aria-controls']==='site-navigation-menu');assert.equal(controls.length,2);controls[0].props.onClick({currentTarget:{focus(options){assert.deepEqual(options,{preventScroll:true});f.calls.push({action:"focusMore"});}}});await f.settle();controls[1].props.onClick({currentTarget:{focus(options){assert.deepEqual(options,{preventScroll:true});f.calls.push({action:"focusMore"});}}});await f.settle();assert.equal(f.calls.filter(call=>call.action==='openMenu').length,2);assert.deepEqual(f.calls.map(call=>call.action),['focusMore','openMenu','focusMore','openMenu']);assert.equal(document.body.style.overflow,'auto');assert.equal(nodes(f.tree,node=>node.type==='img').length,0);f.profile({userId:'own-account',displayName:'Updated name',avatarUrl:'PRIVATE_PHOTO_CANARY'});await f.settle();assert.equal(nodes(f.tree,node=>node.type==='img').length,0);
});
test('the shared sign-out request respects the private-form guard and pending requests cannot sign out twice',async t=>{
 const f=fixture(t);await f.settle();f.request();f.request();assert.equal(f.calls.filter(call=>call.action==='signOut').length,0);assert.equal(f.calls.filter(call=>call.action==='guard').length,1);f.approve();await f.settle();assert.deepEqual(f.calls.filter(call=>call.action==='signOut'),[{action:'signOut',options:{redirectUrl:'/'}}]);f.request();await f.settle();assert.equal(f.calls.filter(call=>call.action==='guard').length,1);f.response.resolve();await f.settle();
});
test('the stable event listener uses the latest sign-out binding and allows retry after a failure',async t=>{
 const f=fixture(t);await f.settle();f.setLocale('en');f.setSignOut(()=>Promise.reject(new Error('Synthetic failure')));await f.settle();f.request();f.approve();await f.settle();assert.equal(f.toasts.at(-1).text,translatorFor('en','nav')('signOutError'));let latestCalls=0;f.setSignOut(async()=>{latestCalls++;});await f.settle();f.request();f.approve();await f.settle();assert.equal(latestCalls,1);
});
test('Escape closes the account dropdown and returns focus to its labelled account control',async t=>{
 const f=fixture(t);await f.settle();const button=nodes(f.tree,node=>node.type==='button'&&node.props['aria-controls']==='header-account-menu')[0];assert.equal(button.props['aria-label'],translatorFor('de','nav')('personalArea'));button.props.onClick();await f.settle();const escape=Object.assign(new Event('keydown',{cancelable:true}),{key:'Escape'});document.dispatchEvent(escape);await f.settle();assert.equal(f.focused,'account');assert.equal(nodes(f.tree,node=>node.props.id==='header-account-menu').length,0);
});
test('messages have one labelled header shortcut with an unread count and do not repeat in the account menu',async t=>{
 const f=fixture(t);await f.settle();
 const desktop=()=>nodes(f.tree,node=>node.props.className?.split(/\s+/).includes('site-header-actions'))[0];
 const messageLinks=()=>nodes(desktop(),node=>node.type==='a'&&node.props.href==='/messages');
 assert.equal(messageLinks().length,1);
 const translate=translatorFor('de');
 assert.equal(messageLinks()[0].props['aria-label'],`${translate('nav.messages')}, ${translate('notifications.newMessages',{count:2})}`);
 assert.match(messageLinks()[0].props.className,/\bh-11\b/);
 assert.match(messageLinks()[0].props.className,/\bw-11\b/);
 nodes(f.tree,node=>node.type==='button'&&node.props['aria-controls']==='header-account-menu')[0].props.onClick();await f.settle();
 assert.equal(messageLinks().length,1,'opening the account menu does not add a duplicate message link');
 const menu=nodes(f.tree,node=>node.props.id==='header-account-menu')[0];
 const accountLinks=nodes(menu,node=>node.type==='a');
 for(const {href}of navigation.ACCOUNT_NAV_ITEMS)assert.ok(accountLinks.some(link=>link.props.href===href),href);
 for(const item of navigation.PRIMARY_NAV_ITEMS.filter(item=>item.kind==='link'))assert.ok(!accountLinks.some(link=>link.props.href===item.href),'account menu does not repeat '+item.href);
 assert.match(menu.props.className,/\boverflow-y-auto\b/,'long account menus stay scrollable within the viewport');
});
test('compact signed-in controls put messages in the header and account access in the shared menu',async t=>{
 const f=fixture(t);await f.settle();
 assert.equal(nodes(f.tree,node=>node.type==='a'&&node.props.href==='/dashboard'&&node.props.className?.includes('rounded-full')).length,0,'compact account access uses the shared menu');
 const search=nodes(f.tree,node=>node.type==='button'&&node.props['aria-label']===translatorFor('de')('Ui.text_9f6d74e0a12b67'));
 assert.equal(search.length,1,'only the desktop search is rendered outside the shared menu');
 const messageLinks=nodes(f.tree,node=>node.type==='a'&&node.props.href==='/messages');
 assert.equal(messageLinks.length,2,'desktop and compact layouts each have a direct message control');
 for(const link of messageLinks){assert.match(link.props.className,/\bh-11\b/);assert.match(link.props.className,/\bw-11\b/);}
 const hamburger=nodes(f.tree,node=>node.type==='button'&&node.props['aria-label']===translatorFor('de','nav')('openMenu'))[0];
 assert.ok(hamburger);assert.equal(hamburger.props['aria-controls'],navigation.SITE_NAV_MENU_ID);assert.match(hamburger.props.className,/w-11 h-11/);
});
