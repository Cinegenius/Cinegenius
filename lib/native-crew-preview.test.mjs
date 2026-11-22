import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import {SUPPORTED_LOCALES} from './i18n/locales.ts';
import {translatorFor} from './i18n-test-fixture.mjs';
import {taxonomyLabel} from './departments.ts';
import * as nativeColors from './native-smart-colors.ts';

const require=createRequire(import.meta.url);
const styles=new Proxy({},{get:(_target,key)=>String(key)});
const result={id:'synthetic-public-member',type:'profile',title:'Alex Musterperson',subtitle:'First occupation · Second occupation · Third occupation · Munich, Germany',image:null,price:0,available:true,evidence:'role',nearby:{distanceKm:4,origin:'Munich'}};
function render(locale,native,props={}){
 const source=readFileSync(new URL('../components/SearchResultCard.tsx',import.meta.url),'utf8');
 const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const mocks={
  'next-intl':{useLocale:()=>locale,useTranslations:namespace=>translatorFor(locale,namespace)},
  'next/link':{default:({children,...attributes})=>React.createElement('a',attributes,children)},
  '@/lib/use-native-app-appearance':{useNativeAppAppearance:()=>native},
  '@/lib/native-smart-colors':nativeColors,
  '@/components/ContentTranslation':{TranslatedText:({children})=>children},
  '@/components/MediaImage':{default:'fixture-image'},'@/components/ListingImage':{default:'fixture-image'},
  '@/components/ProfileCardPhoto':{default:({src,name})=>React.createElement('fixture-profile-photo',{'data-src':src,'aria-label':name})},
  '@/components/CompanyLogo':{default:({src,name})=>React.createElement('fixture-company-logo',{'data-src':src,'aria-label':name})},
  './SearchResultCard.module.css':{default:styles},
 };
 const mod={exports:{}};
 new Function('require','module','exports',output)(id=>{const value=Object.hasOwn(mocks,id)?mocks[id]:require(id);return value&&'default'in value?{__esModule:true,...value}:value},mod,mod.exports);
 return renderToStaticMarkup(React.createElement(mod.exports.default,{result,showEvidence:true,...props}));
}

for(const locale of SUPPORTED_LOCALES)test(`${locale}: native crew grid, list and map-list show only identity, first occupation and public place`,()=>{
 const first=taxonomyLabel('Gaffer (Oberbeleuchter)',translatorFor(locale),'feminine');
 const row={...result,crewPreview:{occupation:first,place:'München, Deutschland'}};
 const before=JSON.stringify(row);
 for(const view of [{},{compact:true,row:true},{compact:true}]){
  const html=render(locale,true,{result:row,...view});
  assert.match(html,/data-native-crew-preview="true"/);
  assert.match(html,/data-result-title/);assert.match(html,/Alex Musterperson/);
  assert.match(html,/data-result-occupation/);assert.match(html,/data-result-place\b/);
  assert.ok(html.includes(first.replaceAll('&','&amp;')));
  assert.doesNotMatch(html,/Second occupation|Third occupation|data-result-subtitle|bg-success|role="img"/);
  assert.doesNotMatch(html,/nearbyDistance|4 km|UnifiedSearch\.discovery\.evidence|absolute top-2.5/);
  assert.equal(JSON.stringify(row),before,'presentation never rewrites the result or profile');
 }
 const web=render(locale,false,{result:row});
 assert.match(web,/Second occupation/);assert.match(web,/Third occupation/);
 assert.doesNotMatch(web,/data-native-crew-preview|data-result-occupation|data-result-place\b/);
 assert.match(web,/bg-success/);
});

test('hidden/unknown profile facts stay empty; free-text separators are not reinterpreted',()=>{
 const html=render('en',true,{result:{...result,crewPreview:{occupation:'Camera · bespoke title',place:''}}});
 assert.match(html,/Camera · bespoke title/);assert.doesNotMatch(html,/data-result-place\b|Munich|Second occupation/);
 const empty=render('en',true,{result:{...result,crewPreview:{occupation:'',place:''}}});
 assert.doesNotMatch(empty,/data-result-occupation|data-result-place\b|data-result-subtitle/);
});

test('non-crew cards retain their labels, prices and location details in the app',()=>{
 const html=render('en',true,{result:{...result,type:'prop',title:'Synthetic lamp',subtitle:'Berlin',price:85,priceLabel:'85 €/Tag',crewPreview:undefined}});
 assert.match(html,/data-result-subtitle/);assert.match(html,/Berlin/);assert.match(html,/data-result-price/);
 assert.doesNotMatch(html,/data-native-crew-preview/);
});


test('native company grid and list keep the full logo component and ordinary website markup remains separate',()=>{
 const company={...result,type:'company',title:'Public company',subtitle:'Berlin',image:'/controlled-company-logo.svg',crewPreview:undefined,nearby:undefined,evidence:undefined};
 for(const view of [{},{compact:true,row:true}]){const html=render('en',true,{result:company,...view});assert.match(html,/fixture-company-logo/);assert.match(html,/controlled-company-logo.svg/);assert.match(html,/Public company/);assert.match(html,/Berlin/);assert.doesNotMatch(html,/data-native-crew-preview/)}
 const web=render('en',false,{result:company});assert.doesNotMatch(web,/fixture-company-logo|data-native-browse-row/);assert.match(web,/fixture-image/);
});
