import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createTranslator} from 'next-intl';
import ts from 'typescript';
import {SUPPORTED_LOCALES} from './i18n/locales.ts';

const require=createRequire(import.meta.url);
const navigation=await import('./site-navigation.ts');
const primary=['/creators','/locations','/props','/jobs','/companies','/news'];
function render(path,locale,filename,options={}){
 const links=[];
 const messages=JSON.parse(readFileSync(new URL(`../messages/${locale}.json`,import.meta.url),'utf8'));
 const deps={
  '@/components/AnalyticsSettingsButton':{default:()=>React.createElement('button',{type:'button'},messages.AnalyticsPrivacy.settings)},
  '@/components/NewsletterSignup':{NewsletterSignup:()=>null},
  'next/link':{default:({href,prefetch,children,...props})=>{links.push({href,prefetch});return React.createElement('a',{href,...props},children)}},
  'next/navigation':{usePathname:()=>path.split('?')[0],useSearchParams:()=>new URL(path,'https://example.invalid').searchParams},
  'next-intl':{useTranslations:namespace=>createTranslator({locale,messages,namespace})},
  '@clerk/nextjs':{useAuth:()=>({isLoaded:true,isSignedIn:!!options.signedIn,userId:options.signedIn?'own-test-account':null}),useUser:()=>({user:options.signedIn?{id:'own-test-account',firstName:'Test account'}:null}),useClerk:()=>({signOut:async()=>{}})},
  '@/components/MediaImage':{default:()=>null},
  './Logo':{Logo:()=>null},'@/components/Logo':{Logo:()=>null},
  '@/components/LanguageSwitcher':{default:()=>null},'@/components/NotificationCenter':{default:()=>null},
  '@/components/NavigationIcon':{default:()=>null,NavigationIcon:()=>null},
  '@/contexts/FormDraftContext':{useFormNavigation:()=>({leave:()=>{}})},
  '@/contexts/ToastContext':{useToast:()=>({addToast:()=>{}})},
  '@/lib/site-navigation':navigation,
  '@/lib/server-admin-context':{ServerAdminContext:React.createContext(null)},
  '@/contexts/SiteNavigationContext':{useSiteNavigation:()=>({menuOpen:options.moreOpen??false,openMenu(){},closeMenu(){}})},
  '@/lib/use-authenticated-inbox':{useAuthenticatedInbox:()=>({status:'idle',count:null})},
  '@/lib/use-admin-support-unread':{useAdminSupportUnread:()=>({status:'idle',count:null,refresh:async()=>{}})},
  '@/lib/profile-update-events':{subscribeToProfileUpdated:()=>()=>{}},
  '@/lib/unread-count-store':{getUnreadCountServerSnapshot:()=>0,getUnreadCountSnapshot:()=>0,subscribeToUnreadCount:()=>()=>{}},
 };
 const code=ts.transpileModule(readFileSync(new URL(`../components/${filename}.tsx`,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const mod={exports:{}};
 new Function('require','module','exports',code)(name=>{
  const dep=deps[name];
  return dep ? ('default' in dep ? {__esModule:true,...dep} : dep) : require(name);
 },mod,mod.exports);
 const html=renderToStaticMarkup(React.createElement(mod.exports.default));
 return {links,html};
}

for(const locale of SUPPORTED_LOCALES){
 test(`footer preserves its links without starting speculative page fetches: ${locale}`,()=>{
  const {links,html}=render('/sign-in',locale,'Footer');
  assert.equal(links.length,21);
  assert.equal(new Set(links.map(l=>l.href)).size,21);
  for(const link of links)assert.equal(link.prefetch,false,link.href);
  for(const href of ['/inserat','/vehicles','/projects/alle','/impressum','/datenschutz','/agb','/ki-transparenz','/bildrechte','/melden','/news'])assert.ok(html.includes(`href="${href}"`),href);
 });
 for(const path of ['/sign-in','/sign-in/verify','/sign-up']){
  test(`auth navigation avoids unrelated prefetch but keeps direct auth entry: ${locale} ${path}`,()=>{
   const {links}=render(path,locale,'Navbar');
   assert.match(render(path,locale,'Navbar').html,/aria-controls="site-navigation-menu"/);
   for(const href of primary){const link=links.find(l=>l.href===href);assert.ok(link,href);assert.equal(link.prefetch,false,href);}
   for(const href of ['/sign-in','/sign-up'])assert.ok(links.some(l=>l.href===href&&l.prefetch===true),href);
  });
 }
 test(`ordinary public navigation retains the existing framework prefetch behavior: ${locale}`,()=>{
  const {links}=render('/creators',locale,'Navbar');
  for(const href of primary)assert.equal(links.find(l=>l.href===href).prefetch,null,href);
 });
 test(`personal management opens canonical pages on demand without an additional navigation bar: ${locale}`,()=>{
  const {links,html}=render('/dashboard',locale,'PersonalAreaHome',{signedIn:true});
  assert.equal(links.length,8);
  assert.equal((html.match(/<nav\b/g)??[]).length,0);
  assert.doesNotMatch(html,/site-navigation-menu|fixed inset-x-0 bottom-0/);
  assert.deepEqual(links.map(link=>link.href),[...navigation.PERSONAL_CONTENT_ITEMS,...navigation.PERSONAL_ACTIVITY_ITEMS].map(item=>item.href).concat('/dashboard?tab=settings'));
  for(const link of links)assert.equal(link.prefetch,false,link.href);
 });
}

for(const locale of SUPPORTED_LOCALES){
 for(const signedIn of [false,true]){
  test(`header search keeps the same footprint from home to every directory: ${locale} signedIn=${signedIn}`,()=>{
   const messages=JSON.parse(readFileSync(new URL(`../messages/${locale}.json`,import.meta.url),'utf8'));
   const attribute=renderToStaticMarkup(React.createElement('button',{'aria-label':messages.Ui.text_9f6d74e0a12b67})).match(/aria-label="[^"]*"/)[0];
   const searchControls=path=>{
    const {html}=render(path,locale,'Navbar',{signedIn});
    const header=html.match(/<header\b[\s\S]*?<\/header>/)[0];
    return [...header.matchAll(/<button\b[^>]*>/g)].map(match=>match[0]).filter(button=>button.includes(attribute));
   };
   const homepage=searchControls('/');
   assert.equal(homepage.length,2,'desktop and compact layouts each expose a direct global search');
   for(const path of primary)assert.deepEqual(searchControls(path),homepage,path+' must not insert or resize a search control');
  });
 }
}

for(const locale of SUPPORTED_LOCALES)test(`desktop exposes six direct public destinations and More while compact layouts share its menu: ${locale}`,()=>{
 const {html}=render('/',locale,'Navbar');
 const desktop=html.match(/<nav\b[^>]*class="[^"]*site-header-primary[^"]*"[^>]*>([\s\S]*?)<\/nav>/)?.[1];assert.ok(desktop);
 const ordered=[...desktop.matchAll(/<a\b[^>]*href="([^"]*)"|<button\b[^>]*aria-controls="site-navigation-menu"/g)].map(match=>match[1]??'more');
 assert.deepEqual(ordered,[...primary,'more']);
 assert.equal((html.match(/aria-controls="site-navigation-menu"/g)??[]).length,2,'desktop More and mobile hamburger share one menu');
 assert.doesNotMatch(html,/translate-x-full|h-\[calc\(100%-4rem\)\]|w-80 bg-bg-secondary border-l/,'the obsolete independent mobile panel is absent');
 for(const href of ['/sign-in','/sign-up'])assert.ok(html.includes(`href="${href}"`));
});
