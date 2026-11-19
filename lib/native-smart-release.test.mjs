import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import {translatorFor} from './i18n-test-fixture.mjs';
import * as controls from './native-smart-controls.ts';
import * as discovery from './smart-discovery.ts';
import * as unified from './unified-search.ts';
import {nativeDiscoveryPlan} from './native-smart-discovery.ts';

const require=createRequire(import.meta.url);
const styles=new Proxy({},{get:(_target,key)=>String(key)});
function load(file,mocks){
 const output=ts.transpileModule(readFileSync(new URL('../'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const mod={exports:{}};
 new Function('require','module','exports',output)(id=>{
  const value=Object.hasOwn(mocks,id)?mocks[id]:require(id);
  return value&&'default'in value?{__esModule:true,...value}:value;
 },mod,mod.exports);
 return mod.exports;
}
const intl={useLocale:()=> 'en',useTranslations:namespace=>translatorFor('en',namespace)};
const plan=nativeDiscoveryPlan();
const groups=plan.searches.map((wish,wishIndex)=>({area:wish.area,wishIndex,label:wish.query,nextOffset:null,results:Array.from({length:wish.area==='crew'?5:1},(_,index)=>({id:wish.area+index,type:wish.area==='crew'?'profile':wish.area==='marketplace'?'prop':wish.area==='companies'?'company':wish.area==='locations'?'location':wish.area==='projects'?'project':'job',title:wish.area+index,subtitle:'',price:0,image:null,available:null}))}));

function explorer({native=false,view='map',hidden=[]}={}){
 const records=[];
 const Areas=load('components/app/NativeSmartAreas.tsx',{'next-intl':intl,'@/lib/native-smart-controls':controls,'./NativeSmartAreas.module.css':{default:styles}}).default;
 const Explorer=load('components/SmartSearchExplorer.tsx',{
  'next/dynamic':{default:()=>()=>null},'next-intl':intl,
  '@/lib/use-native-app-appearance':{useNativeAppAppearance:()=>native},'@/lib/native-smart-controls':controls,
  './app/NativeSmartAreas':{default:Areas},'./app/NativeSmartAreas.module.css':{default:styles},
  './BrowseResultCount':{default:({count})=>React.createElement('span',{'data-count':count})},
  './BrowseSelect':{default:()=>React.createElement('div',{'data-web-area-select':'true'})},
  './DirectoryViewControls':{default:props=>{records.push({kind:'views',...props});return React.createElement('div',{'data-views':props.views.join(',')})}},
  './SearchResultCard':{default:props=>{records.push({kind:'card',...props});return React.createElement('a',{'data-result-id':props.result.id,href:'/fixture/'+props.result.id},props.result.title)}},
  '@/lib/unified-search':unified,'@/lib/smart-search-map':{SMART_MAP_COLORS:{}},'@/lib/unified-search-areas':{searchQueryTitle:()=>''},'@/lib/smart-discovery':discovery,
 }).default;
 const stored={scope:JSON.stringify(plan),filters:{...discovery.emptyDiscoveryFilters(),hiddenAreas:hidden},mapOpen:view==='map',view,limits:{}};
 const html=renderToStaticMarkup(React.createElement(Explorer,{plan,initialGroups:groups,initialMapGroups:groups,onUnavailable(){},stored,setStored(){}}));
 return{html,records};
}

test('ordinary website retains its two-view toolbar, original result order and three compact rows per area',()=>{
 const {html,records}=explorer({native:false,view:'grid',hidden:['companies']});
 assert.match(html,/data-web-area-select="true"/);assert.doesNotMatch(html,/data-smart-domain/);
 assert.deepEqual(records.find(row=>row.kind==='views').views,['list','map']);
 assert.equal(records.find(row=>row.kind==='views').value,'map');
 const cards=records.filter(row=>row.kind==='card');assert.deepEqual(cards.filter(row=>row.result.type==='profile').map(row=>row.result.id),['crew0','crew1','crew2']);
 assert.ok(cards.every(row=>row.compact===true&&row.row===true));
 assert.ok(cards.some(row=>row.result.id==='companies0'),'app-only hidden areas cannot alter website filters');
});

test('native cards, list and map expose one shared permission-projected result pool and compact multi-area strip',()=>{
 for(const view of ['grid','list','map']){
  const {html,records}=explorer({native:true,view,hidden:['companies']});
  assert.doesNotMatch(html,/data-web-area-select/);
  assert.deepEqual([...html.matchAll(/data-smart-domain="([^"]+)"/g)].map(match=>match[1]),['crew','marketplace','smart','locations','companies']);
  const chooser=records.find(row=>row.kind==='views');assert.deepEqual(chooser.views,['grid','list','map']);assert.equal(chooser.value,view);
  const cards=records.filter(row=>row.kind==='card');assert.ok(!cards.some(row=>row.result.id==='companies0'));
  assert.equal(cards.filter(row=>row.result.type==='profile').length,view==='grid'?4:3);
  assert.ok(cards.every(row=>view==='grid'?row.compact===undefined:row.compact===true));
  assert.match(html,new RegExp('data-map-open="'+(view==='map')+'"'));
 }
});

test('actual native area controls compose selections without inventing areas or losing Smart center position',()=>{
 const available=['crew','marketplace','locations','companies','jobs','projects'];
 let hidden=controls.toggleNativeSmartArea(available,[],'crew');
 hidden=controls.toggleNativeSmartArea(available,hidden,'companies');
 assert.deepEqual(available.filter(area=>!hidden.includes(area)),['crew','companies']);
 assert.equal(controls.NATIVE_SMART_PRIMARY[2],'smart');
 assert.deepEqual(controls.toggleNativeSmartArea(['crew'],[],'companies'),[]);
 assert.deepEqual(controls.nativeSmartResultAreas(['crew','locations','marketplace','companies','projects','jobs']),['crew','marketplace','locations','companies','projects','jobs']);
});

test('native empty entry is the only new outer branch; website and planned/text searches retain current controller and admin gate',()=>{
 const Landing=()=>null;
 function entry(native,query='',userId='own-admin',serverAdmin='own-admin'){
  const params=new URLSearchParams(query);
  const Component=load('components/UnifiedSearchResults.tsx',{
   react:{...React,useContext:()=>serverAdmin,useState:value=>[value,()=>{}],useCallback:fn=>fn},
   '@/lib/use-native-app-appearance':{useNativeAppAppearance:()=>native},'@/components/app/NativeSmartLanding':{default:Landing},
   '@clerk/nextjs':{useAuth:()=>({isLoaded:true,userId})},'next-intl':intl,'next/navigation':{useSearchParams:()=>params},
   '@/lib/server-admin-context':{ServerAdminContext:{}},'next/link':{default:()=>null},'@/lib/use-form-router':{},
   '@/components/DirectoryPage':{default:()=>null},'@/components/SmartSearchPreview':{default:()=>null},'@/components/SmartSearchExplorer':{default:()=>null},
   '@/components/SmartSearchExamples':{default:()=>null},'@/components/SmartSearchClarification':{default:()=>null},'@/components/SmartSearchWishes':{default:()=>null},
   '@/lib/use-view-state':{},'@/lib/smart-discovery':discovery,'@/lib/unified-search':unified,'@/lib/unified-search-areas':{},
  }).default;
  return Component();
 }
 assert.equal(entry(true).type,Landing);assert.equal(entry(true).props.allowed,true);
 assert.equal(entry(true,'','member').props.allowed,false);
 assert.notEqual(entry(false).type,Landing);
 for(const query of ['q=camera','plan=serialized','context=existing'])assert.notEqual(entry(true,query).type,Landing);
});
