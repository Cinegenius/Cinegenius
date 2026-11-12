import {intlClientFor} from './i18n-test-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const navigation=await import('./site-navigation.ts');
const source=ts.transpileModule(readFileSync(new URL('../components/Navbar.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
function render(serverAdminId,activeId){
 let stateIndex=0;
 const mocks={
  react:{...React,useState:initial=>{const index=stateIndex++;return [index===1?true:typeof initial==='function'?initial():initial,()=>{}]}},
  'next/link':{default:({children,href,prefetch:_prefetch,...props})=>React.createElement('a',{...props,href},children)},
  '@/lib/site-navigation':navigation,
  '@/contexts/SiteNavigationContext':{useSiteNavigation:()=>({menuOpen:false,openMenu(){},closeMenu(){}})},
  '@/components/MediaImage':{default:props=>React.createElement('img',props)},
  'next/navigation':{usePathname:()=>'/creators'},
  '@clerk/nextjs':{useAuth:()=>({isSignedIn:!!activeId,isLoaded:true}),useUser:()=>({user:activeId?{id:activeId,firstName:'Own test account'}:null}),useClerk:()=>({signOut:async()=>{}})},
  'next-intl':intlClientFor(),
  '@/components/NotificationCenter':{default:()=>null},
  '@/components/Logo':{Logo:()=>React.createElement('span',null,'CineGenius')},
  '@/components/LanguageSwitcher':{default:()=>null},
  '@/components/NavigationIcon':{default:()=>null,NavigationIcon:()=>null},
  '@/contexts/FormDraftContext':{useFormNavigation:()=>({leave:action=>action()})},
  '@/contexts/ToastContext':{useToast:()=>({addToast:()=>{}})},
  '@/lib/use-authenticated-inbox':{useAuthenticatedInbox:()=>({status:'ready',count:0,notifications:[],refresh:async()=>{},markRead:async()=>true})},
  '@/lib/unread-count-store':{publishUnreadCount:()=>{}},
  '@/lib/profile-update-events':{subscribeToProfileUpdated:()=>()=>{}},
  '@/lib/use-admin-support-unread':{useAdminSupportUnread:confirmedId=>({status:'ready',count:confirmedId && confirmedId===activeId?3:null})},
 };
 const mod={exports:{}};
 new Function('require','module','exports',source)(name=>Object.hasOwn(mocks,name)?mocks[name]:require(name),mod,mod.exports);
 return renderToStaticMarkup(React.createElement(mod.exports.default,{initialIsSignedIn:!!activeId,initialAdminUserId:serverAdminId}));
}
test('the header admin shortcut and badges require the current server-confirmed account',()=>{
 const admin=render('admin-a','admin-a');
 assert.equal((admin.match(/href="\/admin"/g)||[]).length,1);
 assert.match(admin,/3 ungelesene Support/);
 assert.match(admin,/aria-controls="site-navigation-menu"/,'the compact menu retains access to the account and admin destinations');
 for(const [serverId,activeId]of[['admin-a','member-b'],['admin-a',null],[null,'admin-a']])assert.doesNotMatch(render(serverId,activeId),/href="\/admin"/);
});
