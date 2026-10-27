import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const source=ts.transpileModule(readFileSync(new URL('../components/Navbar.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
function render(serverAdminId,activeId){
 let stateIndex=0;
 const mocks={
  react:{...React,useState:initial=>{const index=stateIndex++;return [index===0||index===2?true:typeof initial==='function'?initial():initial,()=>{}]}},
  'next/link':{default:({children,href,prefetch:_prefetch,...props})=>React.createElement('a',{...props,href},children)},
  'next/image':{default:props=>React.createElement('img',props)},
  'next/navigation':{usePathname:()=>'/creators'},
  '@clerk/nextjs':{useAuth:()=>({isSignedIn:!!activeId,isLoaded:true}),useUser:()=>({user:activeId?{id:activeId,firstName:'Own test account'}:null}),useClerk:()=>({signOut:async()=>{}})},
  'next-intl':{useTranslations:()=>key=>key},
  '@/components/NotificationCenter':{default:()=>null},
  '@/components/Logo':{Logo:()=>React.createElement('span',null,'CineGenius')},
  '@/components/LanguageSwitcher':{default:()=>null},
  '@/contexts/ToastContext':{useToast:()=>({addToast:()=>{}})},
  '@/lib/message-read-sync':{subscribeToMessageReads:()=>()=>{}},
  '@/lib/unread-count-store':{publishUnreadCount:()=>{}},
  '@/lib/profile-update-events':{subscribeToProfileUpdated:()=>()=>{}},
 };
 const mod={exports:{}};
 new Function('require','module','exports',source)(name=>Object.hasOwn(mocks,name)?mocks[name]:require(name),mod,mod.exports);
 return renderToStaticMarkup(React.createElement(mod.exports.default,{initialIsSignedIn:!!activeId,initialAdminUserId:serverAdminId}));
}
test('desktop and mobile admin links require the current server-confirmed account',()=>{
 const admin=render('admin-a','admin-a');
 assert.equal((admin.match(/href="\/admin"/g)||[]).length,2);
 for(const [serverId,activeId]of[['admin-a','member-b'],['admin-a',null],[null,'admin-a']])assert.doesNotMatch(render(serverId,activeId),/href="\/admin"/);
});
