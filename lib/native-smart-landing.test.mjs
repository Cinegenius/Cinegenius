import * as seed from './discovery-seed.ts';
import * as browseControls from './browse-filter-controls.ts';
import * as nativeControls from './native-smart-controls.ts';
import * as discoveryRequest from './native-smart-discovery-request.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import {SUPPORTED_LOCALES} from './i18n/locales.ts';
import {translatorFor,messagesFor} from './i18n-test-fixture.mjs';
import * as discovery from './native-smart-discovery.ts';
import {emptyDiscoveryFilters} from './smart-discovery.ts';
const require=createRequire(import.meta.url);
function fixture(locale='de',options={}){
 const auth=options.auth??{isLoaded:true,isSignedIn:true,userId:'own-test',sessionId:'session-a'};
 const session=options.session===undefined?{id:'session-a',status:'active',user:{id:'own-test'}}:options.session;
 const mocks={
  '@/lib/browse-filter-controls':browseControls,
  '@/lib/native-smart-controls':nativeControls,
  '@/lib/native-smart-discovery-request':discoveryRequest,
  '@clerk/nextjs':{useAuth:()=>auth,useSession:()=>({isLoaded:true,session})},
  'next-intl':{useLocale:()=>locale,useTranslations:namespace=>translatorFor(locale,namespace)},
  'next/link':{default:({prefetch:_prefetch,...props})=>React.createElement('a',props)},
  '@/components/DirectoryPage':{default:({children})=>React.createElement('div',null,children)},
  '@/components/SmartSearchPreview':{default:()=>React.createElement('span',{'data-smart-preview':'illustrative'})},
  '@/components/SmartSearchExplorer':{default:()=>assert.fail('SSR must not render fetched results')},
  '@/lib/use-native-segment-drag':{useNativeSegmentDrag:()=>({})},
  './NativeCreateMenu':{default:({disabled})=>React.createElement('button',{'data-native-create-trigger':'v1',disabled})},
  '@/lib/smart-discovery':{emptyDiscoveryFilters},
  '@/lib/use-view-state':{useViewState:(_key,initial)=>React.useState(initial)},
  '@/lib/use-form-router':{useFormRouter:()=>({push:()=>assert.fail('no render-time navigation')})},
  '@/lib/native-smart-discovery':discovery,'@/lib/discovery-seed':seed,
  './NativeSmartLanding.module.css':{default:new Proxy({},{get:(_t,key)=>String(key)})},
 };
 const output=ts.transpileModule(readFileSync('components/app/NativeSmartLanding.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const mod={exports:{}};new Function('require','module','exports',output)(id=>{const value=mocks[id]??require(id);return 'default'in value?{__esModule:true,...value}:value},mod,mod.exports);
 return renderToStaticMarkup(React.createElement(mod.exports.default,{accountId:'own-test',loaded:true,allowed:options.allowed??true,onUnavailable(){}}));
}
for(const locale of SUPPORTED_LOCALES)test(`native Smart entry and accessible directory fallback use actual17-locale catalogue: ${locale}`,()=>{
 const allowed=fixture(locale),denied=fixture(locale,{allowed:false});assert.match(allowed,/data-native-smart-landing/);assert.match(allowed,/maxLength="2000"/i);assert.match(allowed,/href="\/profile"/);assert.doesNotMatch(allowed,/data-smart-preview|<img|<svg[^>]+map/);
 for(const href of['/creators','/props','/locations','/companies'])assert.ok(denied.includes(`href="${href}"`));assert.match(denied,/data-smart-preview="illustrative"/);assert.doesNotMatch(denied,/aria-pressed/);for(const [key,value] of Object.entries(messagesFor(locale).NativeSmartDiscovery)){if(typeof value==='string')assert.ok(translatorFor(locale,'NativeSmartDiscovery')(key).trim());else for(const child of Object.keys(value))assert.ok(translatorFor(locale,'NativeSmartDiscovery')(`${key}.${child}`).trim())}
});
test('session/account mismatch, ended session and sign-out never render discovery controls or prior-account results',()=>{
 for(const options of[{session:null},{session:{id:'session-b',status:'active',user:{id:'own-test'}}},{session:{id:'session-a',status:'ended',user:{id:'own-test'}}},{session:{id:'session-a',status:'active',user:{id:'other'}}},{auth:{isLoaded:true,isSignedIn:false,userId:null,sessionId:null}}]){const html=fixture('en',options);assert.doesNotMatch(html,/aria-pressed|href="\/profile"/);assert.ok(html.includes('href="/creators"'))}
});
