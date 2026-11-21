import {intlClientFor, translatorFor} from './i18n-test-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import * as navigation from './site-navigation.ts';
import {SUPPORTED_LOCALES} from './i18n/locales.ts';
const require=createRequire(import.meta.url);
const sources=Object.fromEntries(['Navbar','PersonalAreaHome'].map(name=>[name,ts.transpileModule(readFileSync(new URL(`../components/${name}.tsx`,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText]));
function render(name,serverAdminId,activeId,{locale='de',loaded=true,signedIn=!!activeId,loadedUserId=activeId}={}){
 let stateIndex=0;const confirmed=[];
 const mocks={
  react:{...React,useContext:()=>serverAdminId,useState:initial=>{const index=stateIndex++;return [name==='Navbar'&&index===1?true:typeof initial==='function'?initial():initial,()=>{}]}},
  'next/link':{default:({children,href,prefetch:_prefetch,...props})=>React.createElement('a',{...props,href},children)},
  '@/lib/site-navigation':navigation,
  '@/lib/server-admin-context':{ServerAdminContext:React.createContext(null)},
  '@/contexts/SiteNavigationContext':{useSiteNavigation:()=>({menuOpen:false,openMenu(){},closeMenu(){}})},
  '@/components/MediaImage':{default:props=>React.createElement('img',props)},
  'next/navigation':{usePathname:()=>'/creators'},
  '@/lib/native-header-utility':{announceNativeHeaderAction(){},dismissNativeHeaderUtility(){},useNativeHeaderAction(){}},
  '@/lib/form-navigation-events':{BEFORE_FORM_NAVIGATION_EVENT:'cinegenius:before-form-navigation'},
  '@/components/app/NativeAppNavbar':{default:()=>{throw new Error('Native header must not render in the ordinary website fixture');}},
  '@/lib/use-native-app-appearance':{useNativeAppAppearance:()=>null},
  '@clerk/nextjs':{useAuth:()=>({isSignedIn:signedIn,isLoaded:loaded,userId:activeId}),useUser:()=>({user:loadedUserId?{id:loadedUserId,firstName:'Own test account'}:null}),useClerk:()=>({signOut:async()=>{}})},
  'next-intl':intlClientFor(locale),
  '@/components/Logo':{Logo:()=>React.createElement('span',null,'CineGenius')},
  '@/components/LanguageSwitcher':{default:()=>null},
  '@/components/NavigationIcon':{default:()=>null,NavigationIcon:()=>null},
  '@/contexts/FormDraftContext':{useFormNavigation:()=>({leave:action=>action()})},
  '@/contexts/ToastContext':{useToast:()=>({addToast:()=>{}})},
  '@/lib/use-authenticated-inbox':{useAuthenticatedInbox:()=>({status:'ready',count:0,notifications:[],refresh:async()=>{},markRead:async()=>true})},
  '@/lib/profile-update-events':{subscribeToProfileUpdated:()=>()=>{}},
  '@/lib/use-admin-support-unread':{useAdminSupportUnread:confirmedId=>{confirmed.push(confirmedId);return {status:'ready',count:confirmedId&&confirmedId===activeId?3:null};}},
 };
 const mod={exports:{}};
 new Function('require','module','exports',sources[name])(name=>Object.hasOwn(mocks,name)?mocks[name]:require(name),mod,mod.exports);
 const html=renderToStaticMarkup(React.createElement(mod.exports.default,{initialIsSignedIn:signedIn,initialAdminUserId:serverAdminId}));
 return {html,confirmed};
}

test('the compact header has no admin destination and retains support badges only for the confirmed active account',()=>{
 const admin=render('Navbar','admin-a','admin-a');
 assert.doesNotMatch(admin.html,/href="\/admin"/);
 assert.ok(admin.html.includes(translatorFor('de','SupportContact')('unreadLabel',{count:3})));
 assert.deepEqual(admin.confirmed,['admin-a']);
 for(const[,attributes,content]of admin.html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)){if(attributes.includes('aria-controls="site-navigation-menu"'))assert.ok(!content.includes(translatorFor('de','SupportContact')('unreadLabel',{count:3})),'support badges belong to the portrait, not public navigation');}
 assert.match(admin.html,/href="\/dashboard"/,'the compact menu leads to the personal area containing administration');
 for(const [serverId,activeId,options]of[['admin-a','member-b',{}],['admin-a',null,{}],[null,'admin-a',{}],['admin-a','admin-a',{loaded:false}],['admin-a','admin-a',{loadedUserId:'another-account'}]]){
  const result=render('Navbar',serverId,activeId,options);
  assert.deepEqual(result.confirmed,[null]);
  assert.doesNotMatch(result.html,/href="\/admin"/);
  assert.ok(!result.html.includes(translatorFor('de','SupportContact')('unreadLabel',{count:3})));
 }
});

for(const locale of SUPPORTED_LOCALES)test(`administration is reachable once in the personal area for the server-confirmed account: ${locale}`,()=>{
 const admin=render('PersonalAreaHome','admin-a','admin-a',{locale});
 assert.equal((admin.html.match(/href="\/admin"/g)||[]).length,1);
 assert.ok(admin.html.includes(translatorFor(locale,'nav')('adminArea')));
 assert.equal((admin.html.match(/href="\/mitgestalten"/g)||[]).length,1);
 assert.ok(admin.html.includes(translatorFor(locale,'Feedback')('link')));
 assert.ok(admin.html.indexOf('href="/mitgestalten"')<admin.html.indexOf('href="/dashboard?tab=settings"'));
 assert.deepEqual(admin.confirmed,['admin-a']);
 for(const [serverId,activeId,options]of[['admin-a','member-b',{}],['admin-a',null,{}],[null,'admin-a',{}],['admin-a','admin-a',{loaded:false}],['admin-a','admin-a',{signedIn:false}]]){
  const result=render('PersonalAreaHome',serverId,activeId,{locale,...options});
  assert.doesNotMatch(result.html,/href="\/admin"/);
  assert.equal((result.html.match(/href="\/mitgestalten"/g)||[]).length,1,'feedback entry does not depend on admin status');
  assert.deepEqual(result.confirmed,[null]);
 }
});
