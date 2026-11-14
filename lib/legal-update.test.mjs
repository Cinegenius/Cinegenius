import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {intlServerFor, intlClientFor, messagesFor} from './i18n-test-fixture.mjs';
const require=createRequire(import.meta.url);
function load(file,mocks={}) {
 const code=ts.transpileModule(readFileSync(new URL(`../${file}`,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const mod={exports:{}};new Function('require','module','exports',code)(name=>mocks[name]??require(name),mod,mod.exports);return mod.exports;
}
const Link=({href,children,...props})=>React.createElement('a',{href,...props},children);
const textLinks=load('components/LegalTextLinks.tsx');
const locales=['de','en','es','it','cs','hu','nl','nl-BE','sv'];
for(const locale of locales) {
 for(const route of ['agb','datenschutz','impressum','bildrechte','ki-transparenz']) test(`legal original, language and contact links: ${route}, ${locale}`,async()=>{
  const mocks={'next-intl/server':intlServerFor(locale),'next/link':{default:Link},'@/components/LegalTextLinks':textLinks,'@/components/AnalyticsSettingsButton':{default:()=>React.createElement('button',{},'settings')},'@/components/PageHeader':{default:({title,description})=>React.createElement('header',{},React.createElement('h1',{},title),React.createElement('p',{},description))}};
  const mod=load(`app/${route}/page.tsx`,mocks);
  const html=renderToStaticMarkup(await mod.default());
  assert.match(html,/lang="de"/);assert.match(html,/mailto:cinegenius.co@gmail.com/);
  assert.doesNotMatch(html,/MISSING_MESSAGE|INVALID_MESSAGE|undefined|zeitlich unbeschränktes|gelten die neuen AGB als akzeptiert|vollständig aggregiert und anonymisiert/);
  const de=messagesFor('de');
  if(route==='agb'||route==='datenschutz'){
   const ns=route==='agb'?'LegalTerms':'LegalPrivacy';
   for(const [key,section] of Object.entries(de[ns])) if(/^s\d+$/.test(key)) {
    assert.ok(html.includes(section.title.replaceAll('&','&amp;')),`missing heading ${key}`);
   }
   assert.match(html,/Markus Müller/);assert.match(html,/Mathias Schmidt/);assert.match(html,/mailto:m.schmidt.d@hotmail.com/);if(route==='datenschutz')assert.match(html,/tel:\+491713866624/);
  }
  if(route==='datenschutz'){assert.match(html,/OpenAI/);assert.match(html,/store: false/);assert.match(html,/30 Tage/);assert.match(html,/keine Ende-zu-Ende-Verschlüsselung/);assert.match(html,/settings/);assert.match(html,/privacy.microsoft.com/);}
  if(route==='agb'){assert.match(html,/5 %/);assert.match(html,/1.000/);assert.match(html,/Schweigen gilt nicht/);assert.match(html,/keine allgemeine externe Werbung/);}
  if(route==='ki-transparenz')assert.match(html,/href="\/datenschutz#section-9"/);
 });
 test(`German original is explained in the visitor language: ${locale}`,()=>{
  const Notice=load('components/LegalLanguageNotice.tsx',{'next-intl':intlClientFor(locale),'next/navigation':{usePathname:()=>'/bildrechte'}}).default;
  const html=renderToStaticMarkup(React.createElement(Notice));
  if(locale==='de')assert.equal(html,'');else assert.ok(html.includes(messagesFor(locale).legalLanguage.original));
 });
}
function accountHarness({failAt=-1,rejectAt=-1,clerkFails=false,authFails=false}={}) {
 let calls=0,deletedAccount=false;const filters=[];
 const db={from:table=>({delete:()=>({eq:(field,value)=>run(table,field,value),or:filter=>run(table,'or',filter)})})};
 function run(table,field,value){const at=calls++;filters.push({table,field,value});return at===rejectAt?Promise.reject(new Error('private diagnostic')):Promise.resolve({error:at===failAt?{message:'private diagnostic'}:null});}
 const ResponseClass={json:(body,{status=200}={})=>new Response(JSON.stringify(body),{status})};
 class NextResponse extends Response{static json=ResponseClass.json;}
 const mod=load('app/api/account/route.ts',{'@/lib/db':{db},'@/lib/auth':{requireAuth:async()=>authFails?new NextResponse('',{status:401}):{userId:'user_current'}},'@clerk/nextjs/server':{clerkClient:async()=>({users:{deleteUser:async id=>{assert.equal(id,'user_current');if(clerkFails)throw new Error('private diagnostic');deletedAccount=true;}}})},'next/server':{NextResponse},'next-intl/server':intlServerFor('en')});
 return {run:mod.DELETE,state:()=>({calls,deletedAccount,filters})};
}
for(let index=0;index<12;index++)for(const failure of ['failAt','rejectAt'])test(`failed data erasure cannot destroy login or acknowledge success: ${failure}=${index}`,async()=>{
 const h=accountHarness({[failure]:index}),res=await h.run();assert.equal(res.status,503);const body=await res.json();assert.ok(body.error);assert.equal(body.success,undefined);assert.doesNotMatch(JSON.stringify(body),/private diagnostic/);assert.equal(h.state().deletedAccount,false);
});
test('successful current deletion steps delete only the authenticated Clerk account',async()=>{const h=accountHarness(),res=await h.run();assert.equal(res.status,200);assert.equal(h.state().deletedAccount,true);assert.equal(h.state().calls,12);for(const filter of h.state().filters)assert.ok(filter.value.includes('user_current'));});
test('Clerk failure is reported; signed-out calls perform no deletes',async()=>{const h=accountHarness({clerkFails:true});assert.equal((await h.run()).status,503);const signedOut=accountHarness({authFails:true});assert.equal((await signedOut.run()).status,401);assert.equal(signedOut.state().calls,0);});
test('legal body is not added to global client payload',()=>{
 const select=load('lib/i18n/client-messages.ts',{'./client-message-omissions.json':{default:JSON.parse(readFileSync(new URL('./i18n/client-message-omissions.json',import.meta.url),'utf8'))}}).clientMessages;
 for(const locale of locales){const selected=select(messagesFor(locale));assert.equal(selected.LegalTerms.s1,undefined);assert.equal(selected.LegalPrivacy.s9,undefined);assert.equal(selected.legalLanguage.original,messagesFor(locale).legalLanguage.original);}
});
test('no parallel Vercel browser analytics, while the consent-bound analyzer remains',()=>{
 const layout=readFileSync(new URL('../app/layout.tsx',import.meta.url),'utf8');assert.doesNotMatch(layout,/@vercel\/(?:analytics|speed-insights)/);assert.match(layout,/<ProductAnalytics/);assert.match(layout,/<CookieBanner/);
});
