import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import {Users} from 'lucide-react';
import {intlClientFor,translatorFor} from './i18n-test-fixture.mjs';
import {SUPPORTED_LOCALES} from './i18n/locales.ts';
const require=createRequire(import.meta.url);
function load(locale){const source=ts.transpileModule(readFileSync(new URL('../components/admin/AdminNavigation.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;const mod={exports:{}};new Function('require','module','exports',source)(name=>name==='next-intl'?intlClientFor(locale):require(name),mod,mod.exports);return mod.exports;}
const tabs=['reviews','overview','reports','verifications','users','accounts','started-offers','companies','organizations','listings','projects','bookings','media','support','newsletter','audit'];
test('every existing admin tab remains in exactly one group',()=>{const {ADMIN_NAV_GROUPS}=load('de');const grouped=ADMIN_NAV_GROUPS.flatMap(g=>g.tabs);assert.deepEqual([...grouped].sort(),[...tabs].sort());assert.equal(new Set(grouped).size,tabs.length);});
for(const locale of SUPPORTED_LOCALES)test('both admin navigation layouts retain destinations and support state: '+locale,()=>{
 const {AdminNavigation}=load(locale),t=translatorFor(locale,'AdminClarity');
 for(const mobile of [false,true]){
  const html=renderToStaticMarkup(React.createElement(AdminNavigation,{items:tabs.map(id=>({id,label:id,icon:Users,badge:id==='support'?3:0,badgeLabel:id==='support'?'3 unread':undefined,errorLabel:id==='support'?'Unavailable':undefined})),links:[{href:'/admin/places',label:'Places',group:'review'},{href:'/admin/listing-freshness',label:'Freshness',group:'content'},{href:'/mitgestalten/koordination',label:t('countryFeedback'),group:'review'}],activeTab:'accounts',onSelect(){},mobile}));
  assert.equal((html.match(/<button/g)||[]).length,16);assert.equal((html.match(/aria-current="page"/g)||[]).length,1);assert.match(html,/aria-label="3 unread"/);assert.match(html,/aria-label="Unavailable"/);
  for(const href of ['/admin/places','/admin/listing-freshness','/mitgestalten/koordination'])assert.equal(html.split('href="'+href+'"').length-1,1);
  assert.equal(html.includes('<summary'),mobile);assert.ok(html.includes(t('groups.people').replaceAll('&','&amp;')));assert.ok(html.includes(t('groups.review').replaceAll('&','&amp;')));
 }
});
