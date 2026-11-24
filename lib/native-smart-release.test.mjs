import * as mapOrder from './discovery-map-order.ts';
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
import * as browse from './browse-filter-controls.ts';
import * as nativeColors from './native-smart-colors.ts';
import * as nativeViewport from './native-smart-viewport.ts';
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
const groups=plan.searches.map((wish,wishIndex)=>({area:wish.area,wishIndex,label:wish.query,nextOffset:null,results:Array.from({length:wish.area==='crew'?5:1},(_,index)=>({id:wish.area+index,type:wish.area==='crew'?'profile':wish.area==='marketplace'?'prop':wish.area==='companies'?'company':wish.area==='locations'?'location':wish.area==='projects'?'project':'job',title:wish.area+index,subtitle:'',price:0,image:null,available:null,mapPoint:{lat:52.52,lng:13.4},
 ...(wish.area==='crew'?{facets:{departments:[index===1?'kamera':'licht']}}:wish.area==='marketplace'?{facets:{marketplace:'licht'}}:{})}))}));

function explorer({native=false,view='map',hidden=[],departments=[],marketplace=[],inputGroups=groups,browseFilters,hiddenWishes=[],inputPlan=plan}={}){
 const records=[];
 const Areas=load('components/app/NativeSmartAreas.tsx',{'next-intl':intl,'@/lib/native-smart-colors':nativeColors,'@/lib/native-smart-controls':controls,'@/lib/use-native-segment-drag':{useNativeSegmentDrag:()=>({})},'./NativeSmartAreas.module.css':{default:styles}}).default;
 const Explorer=load('components/SmartSearchExplorer.tsx',{
  '@/components/ContentTranslation':{ContentTranslationNotice:()=>React.createElement('div',{'data-translation-choice':'true'})},
  'next/dynamic':{default:()=>()=>null},'next-intl':intl,
  '@/lib/use-native-app-appearance':{useNativeAppAppearance:()=>native},'@/lib/native-smart-controls':controls,
  '@/lib/native-smart-colors':nativeColors,
  '@/lib/native-smart-viewport':nativeViewport,
  '@/lib/browse-filter-controls':browse,
  './app/NativeSmartFilters':{default:props=>{records.push({kind:'toolbar',...props});return React.createElement('div',{'data-native-browse-toolbar':'v1'},props.views)}},
  './app/NativeSmartAreas':{default:Areas},'./app/NativeSmartAreas.module.css':{default:styles},
  './SmartSearchResults.module.css':{default:styles},
  './SmartSearchMapInfo':{default:()=>null},
  './app/NativeBrowseToolbar':{
   default:props=>{records.push({kind:'toolbar',...props});return React.createElement('div',{'data-native-browse-toolbar':'v1'},props.filters,props.moreAction,props.viewControls)},
   NativeBrowseQuickFilter:props=>{records.push({...props,filterKind:props.kind,kind:'quick'});return React.createElement('button',{'data-native-quick':props.label},props.label)},
  },
  './BrowseResultCount':{default:({count})=>React.createElement('span',{'data-count':count})},
  './BrowseSelect':{default:()=>React.createElement('div',{'data-web-area-select':'true'})},
  './DirectoryViewControls':{default:props=>{records.push({kind:'views',...props});return React.createElement('div',{'data-views':props.views.join(',')})}},
  './SearchResultCard':{default:props=>{records.push({kind:'card',...props});return React.createElement('a',{'data-result-id':props.result.id,href:'/fixture/'+props.result.id},props.result.title)}},
  '@/lib/discovery-map-order': mapOrder, '@/lib/unified-search':unified,'@/lib/smart-search-map':{SMART_MAP_COLORS:{},NATIVE_SMART_MAP_COLORS:{}},'@/lib/unified-search-areas':{searchQueryTitle:()=>''},'@/lib/smart-discovery':discovery,
 }).default;
 let stored={scope:JSON.stringify(inputPlan),filters:{...discovery.emptyDiscoveryFilters(),hiddenAreas:hidden,departments,marketplace,browse:browseFilters,hiddenWishes},mapOpen:view==='map',view,limits:{}};
 const html=renderToStaticMarkup(React.createElement(Explorer,{plan:inputPlan,initialGroups:inputGroups,initialMapGroups:inputGroups,onUnavailable(){},stored,setStored(action){stored=typeof action==='function'?action(stored):action}}));
 return{html,records,get stored(){return stored}};
}

test('ordinary website retains its two-view toolbar, original result order and three compact rows per area',()=>{
 const {html,records}=explorer({native:false,view:'grid',hidden:['companies']});
 assert.match(html,/data-translation-choice="true"/);assert.match(html,/data-web-area-select="true"/);assert.doesNotMatch(html,/data-smart-domain/);
 assert.deepEqual(records.find(row=>row.kind==='views').views,['list','map']);
 assert.equal(records.find(row=>row.kind==='views').value,'map');
 const cards=records.filter(row=>row.kind==='card');assert.deepEqual(cards.filter(row=>row.result.type==='profile').map(row=>row.result.id),['crew0','crew1','crew2']);
 assert.ok(cards.every(row=>row.compact===true&&row.row===true));
 assert.ok(cards.some(row=>row.result.id==='companies0'),'app-only hidden areas cannot alter website filters');
 assert.doesNotMatch(html,/data-native-browse-toolbar/);assert.equal(records.some(row=>row.kind==='toolbar'),false);
 assert.doesNotMatch(html,/data-native-smart-result-area/);
});

test('approved native area layout has one container per real area, with no duplicate wishes or empty/hidden blocks',()=>{
 const repeated=[...groups,{...groups[0],segment:'licht',results:[groups[0].results[0]]}];
 const before=JSON.stringify(repeated);
 for(const view of ['grid','list','map']){
  const {html,records}=explorer({native:true,view,inputGroups:repeated});
  const blocks=[...html.matchAll(/data-native-smart-result-area="([^"]+)"/g)].map(match=>match[1]);
  assert.deepEqual(blocks,['crew','marketplace','locations','companies','jobs']);
  assert.ok(records.find(row=>row.kind==='toolbar').groups.every(group=>group.area!=='projects'),'project facets cannot influence native filters');
  assert.equal(new Set(blocks).size,blocks.length);
  const ids=records.filter(row=>row.kind==='card').map(row=>row.result.id);assert.equal(new Set(ids).size,ids.length);
  assert.equal(JSON.stringify(repeated),before,'presentation cannot mutate projected facts or group cursors');
 }
 const hidden=explorer({native:true,hidden:['crew','companies']});
 assert.doesNotMatch(hidden.html,/data-native-smart-result-area="(?:crew|companies)"/);
 const empty=explorer({native:true,inputGroups:groups.map(group=>group.area==='companies'?{...group,results:[]}:group)});
 assert.doesNotMatch(empty.html,/data-native-smart-result-area="companies"/);
});

test('native cards, list and map expose one shared permission-projected result pool and one compact filter row',()=>{
 for(const view of ['grid','list','map']){
  const {html,records}=explorer({native:true,view,hidden:['companies']});
  assert.doesNotMatch(html,/data-web-area-select/);
  assert.equal((html.match(/data-native-browse-toolbar="v1"/g)??[]).length,1);
  const toolbar=records.find(row=>row.kind==='toolbar');assert.equal(toolbar.count,8);
  assert.deepEqual(toolbar.filters.hiddenAreas,['companies']);
  assert.doesNotMatch(html,/data-smart-domain|smart-filter-panel/,'No duplicate area strip or generic wishes panel in native appearance');
  const chooser=records.find(row=>row.kind==='views');assert.deepEqual(chooser.views,['grid','list','map']);assert.equal(chooser.value,view);
  const cards=records.filter(row=>row.kind==='card');assert.ok(!cards.some(row=>row.result.id==='companies0'));
  assert.equal(cards.filter(row=>row.result.type==='profile').length,view==='grid'?5:3);
  assert.ok(cards.every(row=>view==='grid'?row.compact===undefined:row.compact===true));
  assert.match(html,new RegExp('data-map-open="'+(view==='map')+'"'));
 }
});

test('native shared filter handoff retains view, hidden areas and other existing facets',()=>{
 const f=explorer({native:true,departments:['licht','kamera'],marketplace:['licht'],hidden:['companies']});
 const row=f.records.find(row=>row.kind==='toolbar');
 assert.deepEqual(row.filters.departments,['licht','kamera']);
 row.onChange({...row.filters,browse:{...row.filters.browse,locationTypes:['Studio'],companyCategories:['kameraverleih']}});
 assert.deepEqual(f.stored.filters.browse,{version:1,departments:['kamera','licht'],marketplace:['licht'],locationTypes:['Studio'],companyCategories:['kameraverleih']});
 assert.deepEqual(f.stored.filters.departments,[]);assert.deepEqual(f.stored.filters.marketplace,[]);assert.deepEqual(f.stored.filters.hiddenAreas,['companies']);
 assert.equal(f.stored.view,'map');assert.doesNotMatch(f.html,/smart-filter-panel|smart-filter-trigger|data-smart-domain/);
});

test('native source projection normalizes legacy history without altering stored details or public results',()=>{
 const available=['crew','marketplace','locations','companies','jobs','projects'];
 let hidden=controls.toggleNativeSmartArea(available,[...controls.NATIVE_SMART_PRIMARY],'crew');
 hidden=controls.toggleNativeSmartArea(available,hidden,'companies');
 assert.deepEqual(controls.nativeSmartResultAreas(available).filter(area=>!hidden.includes(area)),['crew','companies']);
 const f=explorer({native:true,hidden:['projects','crew','crew','news']});
 const row=f.records.find(row=>row.kind==='toolbar');
 assert.deepEqual(row.filters.hiddenAreas,['crew']);
 assert.deepEqual(f.stored.filters.hiddenAreas,['projects','crew','crew','news'],'read normalization must not erase history');
 assert.doesNotMatch(f.html,/data-native-smart-result-area="(?:crew|projects|news)"/);
 row.onChange({...row.filters,hiddenAreas:[...controls.NATIVE_SMART_PRIMARY]});
 assert.deepEqual(f.stored.filters.hiddenAreas,controls.NATIVE_SMART_PRIMARY);
 assert.equal(f.stored.mapOpen,true);
 const none=explorer({native:true,hidden:[...controls.NATIVE_SMART_PRIMARY,'projects']});
 assert.match(none.html,/Select at least one area above/);
 assert.equal(none.records.filter(row=>row.kind==='card').length,0);
 assert.match(none.html,/data-map-open="true"/,'selection does not change the saved view');
 const onlyProject=explorer({native:true,inputGroups:groups.filter(g=>g.area==='projects')});
 assert.equal(onlyProject.records.filter(row=>row.kind==='card').length,0);
 assert.ok(explorer().records.some(row=>row.kind==='card'&&row.result.type==='project'),'public projects remain');
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

test('project-only legacy detail/wish filters never create a visible filter status, while all-area wishes do',()=>{
 const t=translatorFor('en','UnifiedSearch');
 const projectIndex=plan.searches.findIndex(wish=>wish.area==='projects');assert.ok(projectIndex>=0);
 const legacy=explorer({native:true,inputGroups:[],browseFilters:{version:1,projectTypes:['Serie']},hiddenWishes:[projectIndex]});
 assert.ok(legacy.html.includes(t('emptyGroup')));assert.ok(!legacy.html.includes(t('discovery.emptyFilters')));
 assert.deepEqual(legacy.stored.filters.browse,{version:1,projectTypes:['Serie']});
 assert.deepEqual(legacy.stored.filters.hiddenWishes,[projectIndex]);
 const allWish=explorer({native:true,inputGroups:[],hiddenWishes:[0],inputPlan:{version:1,searches:[{area:'all',query:'all',department:'',places:[]}]}});
 assert.ok(allWish.html.includes(t('discovery.emptyFilters')));
});
