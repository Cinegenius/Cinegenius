import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import {translatorFor} from './i18n-test-fixture.mjs';
import {NATIVE_SMART_DOMAIN_COLORS,NATIVE_SMART_MAP_COLORS,NATIVE_SMART_PURE_COLORS,nativeSmartAreaForType,nativeSmartColorStyle} from './native-smart-colors.ts';
import {SMART_MAP_COLORS,smartMapEntries,mapMarkerStyle} from './smart-search-map.ts';

const require=createRequire(import.meta.url);
const legacy={crew:'#c2f135',locations:'#f3a45e',marketplace:'#b69ae8',companies:'#85b9ec',jobs:'#e6c675',animals:'#70cdb0',projects:'#e99eb2',news:'#a9bdcd',organizations:'#a5a4df'};
const entries=[['crew','profile'],['marketplace','prop'],['marketplace','vehicle'],['locations','location'],['companies','company'],['jobs','job'],['projects','project'],['animals','animal'],['news','news'],['organizations','organization']].map(([area,type],index)=>({area,wishIndex:index,label:area,nextOffset:null,results:[{id:'public-'+index,title:'Synthetic public '+type,type,subtitle:'Public city',price:0,image:null,available:null,mapPoint:{lat:52,lng:13}}]}));

test('native Smart uses one fixed domain palette; ordinary website map colours stay unchanged',()=>{
 assert.deepEqual(SMART_MAP_COLORS,legacy);
 assert.equal(NATIVE_SMART_MAP_COLORS.locations,'#82c6ef');
 assert.equal(NATIVE_SMART_MAP_COLORS.marketplace,'#e3b75c');
 assert.equal(NATIVE_SMART_MAP_COLORS.companies,'#c3a2ed');
 assert.equal(NATIVE_SMART_MAP_COLORS.crew,'#ffab98');
 for(const[area,colors]of Object.entries(NATIVE_SMART_DOMAIN_COLORS)){
  assert.match(colors.cinema,/^#[\da-f]{6}$/);assert.match(colors.pure,/^#[\da-f]{6}$/);
  assert.deepEqual(nativeSmartColorStyle(area),{'--native-domain-cinema':colors.cinema,'--native-domain-pure':colors.pure});
  if(area!=='smart'){assert.equal(NATIVE_SMART_MAP_COLORS[area],colors.cinema);assert.equal(NATIVE_SMART_PURE_COLORS[area],colors.pure)}
 }
 for(const area of ['jobs','animals','projects','news','organizations'])assert.equal(NATIVE_SMART_MAP_COLORS[area],legacy[area]);
 for(const[type,area]of [['profile','crew'],['creator','crew'],['prop','marketplace'],['vehicle','marketplace'],['location','locations'],['company','companies']])assert.equal(nativeSmartAreaForType(type),area);
 for(const type of ['__proto__','constructor','toString','unknown','Location','" onclick="'])assert.equal(nativeSmartAreaForType(type),null);
});

for(const native of [false,true])for(const theme of ['cinema','pure'])test(`${native?'native':'web'} ${theme}: actual Smart map pins, previews and existing public facts retain their domain`,()=>{
 let mapProps;
 const mocks={
  'next-intl':{useTranslations:namespace=>translatorFor('de',namespace)},
  'next/dynamic':{default:()=>props=>{mapProps=props;return React.createElement('div',{'data-map-fixture':true})}},
  '@/lib/location-map':{hasCoordinates:()=>true},
  '@/lib/smart-search-map':{SMART_MAP_COLORS,smartMapEntries},
  '@/lib/native-smart-colors':{NATIVE_SMART_MAP_COLORS,NATIVE_SMART_PURE_COLORS},
  '@/lib/use-native-app-appearance':{useNativeAppAppearance:()=>native},
  '@/lib/native-app-theme':{useNativeAppTheme:()=>theme},
  './SearchResultCard':{default:({result})=>React.createElement('a',{href:'/fixture/'+result.id},result.title),SearchResultTitle:({result})=>result.title},
 };
 const output=ts.transpileModule(readFileSync(new URL('../components/SmartSearchMap.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const mod={exports:{}};new Function('require','module','exports',output)(id=>{const v=Object.hasOwn(mocks,id)?mocks[id]:require(id);return v&&'default'in v?{__esModule:true,...v}:v},mod,mod.exports);
 const before=JSON.stringify(entries);renderToStaticMarkup(React.createElement(mod.exports.default,{groups:entries,bounds:null,onApplyBounds:()=>assert.fail('Opening a map cannot alter filters')}));
 const colors=native?NATIVE_SMART_MAP_COLORS:SMART_MAP_COLORS,labelColors=native&&theme==='pure'?NATIVE_SMART_PURE_COLORS:colors;
 assert.equal(mapProps.locations.length,entries.length);
 assert.equal(mapProps.onBoundsChange,native?mapProps.onApplyBounds:undefined,'only the native map automatically synchronizes its viewport');
 assert.equal(mapProps.viewportActive,native?true:undefined,'ordinary website does not enable the native hidden-map lifecycle');
 for(const[index,group]of entries.entries()){
  const location=mapProps.locations[index];assert.equal(location.markerColor,colors[group.area]);assert.equal(location.lat,52);assert.equal(location.lng,13);
  const preview=renderToStaticMarkup(mapProps.renderPreview({id:location.id}));assert.ok(preview.includes('color:'+labelColors[group.area]),preview);assert.ok(preview.includes('public-'+index));
  assert.ok(mapMarkerStyle([location.markerColor],false).includes(colors[group.area]));
 }
 assert.equal(JSON.stringify(entries),before);
});
