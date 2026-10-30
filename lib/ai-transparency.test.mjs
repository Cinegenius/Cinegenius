import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createTranslator} from 'next-intl';
import ts from 'typescript';
import * as provenance from './site-image-provenance.ts';
const require=createRequire(import.meta.url);
const locales=['de','en','es','it','cs','hu'];
const dictionaries=Object.fromEntries(locales.map(locale=>[locale,JSON.parse(readFileSync(new URL('../messages/'+locale+'.json',import.meta.url),'utf8'))]));
function load(file,locale='de',pathname='/'){
 const link=({children,...props})=>React.createElement('a',props,children);
 const t=namespace=>createTranslator({locale,messages:dictionaries[locale],namespace});
 const mocks={'next/link':link,'next/navigation':{usePathname:()=>pathname},'next-intl':{useTranslations:t},'next-intl/server':{getTranslations:async namespace=>t(namespace)},'./Logo':{Logo:()=>React.createElement('span',null,'CineGenius')},'@/lib/site-image-provenance':provenance,'@/components/PageHeader':({title,description})=>React.createElement('header',null,React.createElement('h1',null,title),React.createElement('p',null,description))};
 const source=ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const mod={exports:{}};new Function('require','module','exports',source)(name=>Object.hasOwn(mocks,name)?mocks[name]:require(name),mod,mod.exports);return mod.exports;
}
test('only the owner-confirmed site asset receives AI provenance; member and unrelated site images stay unclassified',()=>{
 assert.equal(provenance.isAiGeneratedSiteImage('/hero-bg.jpg'),true);
 for(const source of ['/api/media/user_own/abcdef.webp','https://storage.invalid/hero-bg.jpg','/some-other-photo.jpg','/hero-bg.jpg?unknown','/uploads/hero-bg.jpg',null,undefined,{src:'/hero-bg.jpg'}])assert.equal(provenance.isAiGeneratedSiteImage(source),false);
});
for(const locale of locales){
 test(`${locale}: visible image badge and accessible description use the existing locale and link to image-specific explanation`,()=>{
  const Badge=load('../components/AiDisclosureBadge.tsx',locale).default;
  const html=renderToStaticMarkup(React.createElement(Badge,{source:'/hero-bg.jpg'}));
  assert.ok(html.includes(dictionaries[locale].AiTransparency.imageLabel));assert.ok(html.includes(dictionaries[locale].AiTransparency.imageLabelAccessible));assert.match(html,/href="\/ki-transparenz#bilder"/);
  assert.equal(renderToStaticMarkup(React.createElement(Badge,{source:'/api/media/user_own/photo.webp'})),'');
 });
 test(`${locale}: footer explains AI assistance separately from user content and preserves existing legal links`,()=>{
  const Footer=load('../components/Footer.tsx',locale).default;
  const html=renderToStaticMarkup(React.createElement(Footer));
  assert.match(html,/href="\/ki-transparenz"/);assert.ok(html.includes(dictionaries[locale].AiTransparency.footerNote));
  for(const path of ['/agb','/datenschutz','/impressum'])assert.ok(html.includes(`href="${path}"`));
  assert.equal(renderToStaticMarkup(React.createElement(load('../components/Footer.tsx',locale,'/dashboard').default)),'');
 });
 test(`${locale}: public explanation renders localized content and the actual contact without fake recipient details`,async()=>{
  const page=load('../app/ki-transparenz/page.tsx',locale);
  const html=renderToStaticMarkup(await page.default());
  assert.ok(html.includes(dictionaries[locale].AiTransparency.membersBody));assert.ok(html.includes(dictionaries[locale].AiTransparency.developmentTitle));assert.match(html,/id="bilder"/);assert.match(html,/mailto:cinegenius.co@gmail.com/);assert.match(html,/href="\/"/);
  const metadata=await page.generateMetadata();assert.equal(metadata.description,dictionaries[locale].AiTransparency.description);
  assert.doesNotMatch(html,/AiTransparency\.|undefined|\{\{/);
 });
}
test('both existing uses of the confirmed hero asset render the same label, without changing member upload/image components',()=>{
 for(const file of ['../app/page.tsx','../app/community/page.tsx'])assert.match(readFileSync(new URL(file,import.meta.url),'utf8'),/<AiDisclosureBadge source="\/hero-bg\.jpg"/);
 const media=readFileSync(new URL('../components/MediaImage.tsx',import.meta.url),'utf8');assert.doesNotMatch(media,/AiDisclosure|isAiGenerated/);
});
