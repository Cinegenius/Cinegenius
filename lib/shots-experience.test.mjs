import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import {translatorFor,messagesFor} from './i18n-test-fixture.mjs';
import {SUPPORTED_LOCALES} from './i18n/locales.ts';
import * as shotsClient from './shots-client.ts';
import * as shotsPhoto from './shots-photo.ts';

const require=createRequire(import.meta.url);
function fixture(locale='de',auth={isLoaded:true,isSignedIn:true,userId:'own-test',sessionId:'session-a'},session={id:'session-a',status:'active',user:{id:'own-test'}}){
 const mocks={
  'next/link':{default:({prefetch:_prefetch,...props})=>React.createElement('a',props)},
  '@clerk/nextjs':{useAuth:()=>auth,useSession:()=>({isLoaded:true,session})},
  'next-intl':{useTranslations:namespace=>translatorFor(locale,namespace),useLocale:()=>locale},
  '@/components/MediaImage':{default:({unoptimized:_unoptimized,...props})=>React.createElement('img',props)},
  '@/components/messaging/MessagingDialog':{default:()=>null},
  '@/lib/native-dialog':{confirmDialog:()=>assert.fail('no server-rendered mutation'),dismissNativeDialog(){}},
  '@/contexts/FormDraftContext':{useFormNavigation:()=>({register:()=>()=>{},notify(){},leave(){assert.fail('no render-time navigation');}})},
  '@/lib/shots-client':shotsClient,'@/lib/shots-photo':shotsPhoto,
  './ShotsExperience.module.css':{default:new Proxy({},{get:(_target,key)=>String(key)})},
  '@/lib/use-native-segment-drag':{useNativeSegmentDrag:()=>({})},
 };
 const audience=ts.transpileModule(readFileSync(new URL('../components/app/ShotsAudienceControl.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}});
 const audienceModule={exports:{}};new Function('require','module','exports',audience.outputText)(name=>{const value=mocks[name]??require(name);return 'default' in value?{__esModule:true,...value}:value;},audienceModule,audienceModule.exports);
 mocks['./ShotsAudienceControl']=audienceModule.exports;
 const code=ts.transpileModule(readFileSync(new URL('../components/app/ShotsExperience.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},reportDiagnostics:true});assert.equal(code.diagnostics.length,0);
 const mod={exports:{}};new Function('require','module','exports',code.outputText)(name=>{const value=mocks[name]??require(name);return 'default' in value?{__esModule:true,...value}:value;},mod,mod.exports);
 return renderToStaticMarkup(React.createElement(mod.exports.default));
}

for(const locale of SUPPORTED_LOCALES)test(`Shots uses complete local copy and a truthful empty loading shell without fixture media: ${locale}`,()=>{
 const html=fixture(locale);assert.match(html,/data-shots-root="v1"/);assert.match(html,/aria-pressed="true"/);assert.match(html,/disabled=""/);assert.doesNotMatch(html,/<img|blob:|example|gallery|PRIVATE_|MISSING_MESSAGE/);
 const copy=messagesFor(locale).AppShots;assert.equal(Object.keys(copy).length,48);const t=translatorFor(locale,'AppShots');for(const key of Object.keys(copy)){const value=key==='expires'?t(key,{date:'Own synthetic date'}):t(key);assert.ok(value.trim());assert.notEqual(value,`AppShots.${key}`);}
 assert.ok(translatorFor(locale,'NativeAppChrome')('openWorkspace').trim());assert.ok(translatorFor(locale,'NativeAppChrome')('workspaceNativeOnly').trim());
});

test('Clerk loading, account mismatch, expired session and sign-out never render a prior account feed',()=>{
 assert.doesNotMatch(fixture('en',{isLoaded:false}),/data-shots-root|<img/);
 for(const session of [null,{id:'other-session',status:'active',user:{id:'own-test'}},{id:'session-a',status:'active',user:{id:'other-account'}},{id:'session-a',status:'ended',user:{id:'own-test'}}]){
  const html=fixture('en',undefined,session);assert.match(html,/href="\/sign-in\?redirect_url=%2Fapp%2Fshots"/);assert.doesNotMatch(html,/data-shots-root|<img/);
 }
});
