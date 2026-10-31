import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createTranslator} from 'next-intl';
import ts from 'typescript';

const require=createRequire(import.meta.url);
const primary=['/locations','/creators','/jobs','/props','/projects','/companies'];
function render(path,locale,filename,options={}){
 const links=[];
 const messages=JSON.parse(readFileSync(new URL(`../messages/${locale}.json`,import.meta.url),'utf8'));
 const deps={
  'next/link':{default:({href,prefetch,children,...props})=>{links.push({href,prefetch});return React.createElement('a',{href,...props},children)}},
  'next/navigation':{usePathname:()=>path.split('?')[0],useSearchParams:()=>new URL(path,'https://example.invalid').searchParams},
  'next-intl':{useTranslations:namespace=>createTranslator({locale,messages,namespace})},
  '@clerk/nextjs':{useAuth:()=>({isLoaded:true,isSignedIn:false}),useUser:()=>({user:null}),useClerk:()=>({signOut:async()=>{}})},
  '@/components/MediaImage':{default:()=>null},
  './Logo':{Logo:()=>null},'@/components/Logo':{Logo:()=>null},
  '@/components/LanguageSwitcher':{default:()=>null},'@/components/NotificationCenter':{default:()=>null},
  '@/contexts/FormDraftContext':{useFormNavigation:()=>({leave:()=>{}})},
  '@/contexts/ToastContext':{useToast:()=>({addToast:()=>{}})},
  '@/lib/use-authenticated-inbox':{useAuthenticatedInbox:()=>({status:'idle',count:null})},
  '@/lib/profile-update-events':{subscribeToProfileUpdated:()=>()=>{}},
  '@/lib/unread-count-store':{getUnreadCountServerSnapshot:()=>0,getUnreadCountSnapshot:()=>0,subscribeToUnreadCount:()=>()=>{}},
 };
 if(filename==='PersonalAreaNavigation'&&options.moreOpen!==undefined)deps.react={...React,useState:initial=>[typeof initial==='boolean'?options.moreOpen:initial,()=>{}]};
 const code=ts.transpileModule(readFileSync(new URL(`../components/${filename}.tsx`,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const mod={exports:{}};
 new Function('require','module','exports',code)(name=>{
  const dep=deps[name];
  return dep ? ('default' in dep ? {__esModule:true,...dep} : dep) : require(name);
 },mod,mod.exports);
 const html=renderToStaticMarkup(React.createElement(mod.exports.default));
 return {links,html};
}

for(const locale of ['de','en','es','it','cs','hu']){
 test(`footer preserves its links without starting speculative page fetches: ${locale}`,()=>{
  const {links,html}=render('/sign-in',locale,'Footer');
  assert.equal(links.length,19);
  assert.equal(new Set(links.map(l=>l.href)).size,19);
  for(const link of links)assert.equal(link.prefetch,false,link.href);
  for(const href of ['/inserat','/vehicles','/projects/alle','/impressum','/datenschutz','/agb','/ki-transparenz','/bildrechte'])assert.ok(html.includes(`href="${href}"`),href);
 });
 for(const path of ['/sign-in','/sign-in/verify','/sign-up']){
  test(`auth navigation avoids unrelated prefetch but keeps direct auth entry: ${locale} ${path}`,()=>{
   const {links}=render(path,locale,'Navbar');
   for(const href of primary){const link=links.find(l=>l.href===href);assert.ok(link,href);assert.equal(link.prefetch,false,href);}
   for(const href of ['/sign-in','/sign-up'])assert.ok(links.some(l=>l.href===href&&l.prefetch===true),href);
  });
 }
 test(`ordinary public navigation retains the existing framework prefetch behavior: ${locale}`,()=>{
  const {links}=render('/creators',locale,'Navbar');
  for(const href of primary)assert.equal(links.find(l=>l.href===href).prefetch,null,href);
 });
 for(const moreOpen of [false,true]){
  test(`personal navigation opens account pages on demand, including both menu layouts: ${locale} more=${moreOpen}`,()=>{
   const {links,html}=render('/dashboard?tab=listings',locale,'PersonalAreaNavigation',{moreOpen});
   assert.equal(links.length,moreOpen?17:8);
   for(const link of links)assert.equal(link.prefetch,false,link.href);
   for(const href of ['/dashboard','/profile','/messages','/dashboard?tab=listings']){
    assert.equal(links.filter(l=>l.href===href).length,2,href);
    assert.ok(html.includes(`href="${href}"`),href);
   }
   if(moreOpen)for(const href of ['/company-dashboard','/notifications','/profile?tab=security'])assert.ok(links.some(l=>l.href===href),href);
  });
 }
}
test('personal navigation does not appear on sign-in or public pages',()=>{
 for(const path of ['/sign-in','/sign-up','/creators'])assert.deepEqual(render(path,'de','PersonalAreaNavigation').links,[]);
});
