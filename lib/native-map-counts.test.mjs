import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as jsx from 'react/jsx-runtime';
import {SUPPORTED_LOCALES} from './i18n/locales.ts';
import {intlClientFor,translatorFor} from './i18n-test-fixture.mjs';
import * as geometry from './location-map.ts';
import * as smartMap from './smart-search-map.ts';
import * as country from './browse-country.ts';
import * as places from './places/core.ts';
import * as orgFilters from './organization-directory-filters.ts';

const react={useMemo:fn=>fn(),useCallback:fn=>fn,useState:value=>[value,()=>{}],useRef:()=>({current:null}),useLayoutEffect:()=>{}};
function load(file,mocks){
 const module={exports:{}};
 const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 new Function('require','module','exports',code)(id=>{assert.ok(Object.hasOwn(mocks,id),'Unexpected dependency '+id);return mocks[id]},module,module.exports);
 return module.exports.default;
}
function nodes(tree,predicate,out=[]){
 if(Array.isArray(tree))tree.forEach(child=>nodes(child,predicate,out));
 else if(tree?.props){if(predicate(tree))out.push(tree);nodes(tree.props.children,predicate,out)}
 return out;
}

for(const locale of SUPPORTED_LOCALES)test(`${locale}: native count distinguishes total and loaded, including an unfinished count`,()=>{
 const Toolbar=load('components/app/NativeBrowseToolbar.tsx',{
  'react/jsx-runtime':jsx,react,'next-intl':intlClientFor(locale),'lucide-react':{},
  '@/components/BrowseResultCount':{default:'count'},'@/components/BrowseSelect':{default:'select'},
  './NativeBrowseToolbar.module.css':{default:{}},'@/lib/use-native-app-appearance':{useNativeAppAppearance:()=>true},
 });
 for(const countScope of ['total','loaded'])for(const count of [63,0,null]){
  const tree=Toolbar({count,countScope,countLabel:'fixture accessible description'});
  assert.equal(nodes(tree,n=>n.type==='count')[0].props.count,count);
  assert.equal(nodes(tree,n=>n.props['data-count-scope']===countScope)[0].props.children,translatorFor(locale,'NativeBrowseCounts')(countScope));
 }
 assert.equal(nodes(Toolbar({count:63,countLabel:'existing counter'}),n=>n.props['data-count-scope']).length,0);
});

const europe={south:35,north:70,west:-15,east:40};
const rows=[...Array.from({length:33},(_,i)=>({id:'synthetic-eu-'+i,mapPoint:{lat:48,lng:11}})),{id:'synthetic-mx',mapPoint:{lat:20.58,lng:-100.39}},...Array.from({length:29},(_,i)=>({id:'synthetic-unmapped-'+i,mapPoint:null}))]
 .map(row=>({...row,type:'company',title:row.id,subtitle:'Synthetic test data',price:0,image:null}));
const groups=[{area:'companies',wishIndex:0,results:rows,nextOffset:null}];

for(const native of [false,true])test(`Smart map counts actual points and keeps its existing web boundary: native=${native}`,()=>{
 const Component=load('components/SmartSearchMap.tsx',{
  'react/jsx-runtime':jsx,react,'next/dynamic':{default:()=> 'map'},'next-intl':intlClientFor('de'),'lucide-react':{Info:'info'},
  '@/lib/location-map':geometry,'@/lib/smart-search-map':smartMap,
  '@/lib/use-native-app-appearance':{useNativeAppAppearance:()=>native},
  './SearchResultCard':{default:'card',SearchResultTitle:'title'},'./MapResultSummary':{default:'map-result-summary'},
 });
 let opened=0;
 const tree=Component({groups:[...groups,...groups],bounds:europe,onApplyBounds:()=>{},onShowAll:()=>opened++});
 const map=nodes(tree,n=>n.type==='map')[0].props;
 assert.equal(map.locations.length,34,'Only unique valid points reach the map');
 assert.equal(map.visibleCount,native?33:34,'Native badge counts the active bounds; web default is preserved');
 const summaries=nodes(tree,n=>n.type==='map-result-summary');
 assert.equal(summaries.length,native?1:0);
 if(native){assert.deepEqual(summaries[0].props.counts,{total:63,mapped:34,visible:33,outside:1,unmapped:29});summaries[0].props.onShowAll();assert.equal(opened,1)}
 const empty=Component({groups:[],bounds:europe,onApplyBounds:()=>{}});
 assert.equal(nodes(empty,n=>n.type==='map')[0].props.visibleCount,0);
});

for(const pending of [false,true])test(`organizations separate total, loaded page and map; pending=${pending}`,()=>{
 const Component=load('components/app/NativeOrganizations.tsx',{
  'react/jsx-runtime':jsx,react:{...react,useTransition:()=>[pending,fn=>fn()]},'next/dynamic':{default:()=> 'map'},
  'next/link':{default:'link'},'next/navigation':{useRouter:()=>({push:()=>{}})},'next-intl':intlClientFor('de'),
  'lucide-react':{Building2:'building',Search:'search'},'@/components/MediaImage':{default:'image'},
  '@/components/DirectoryPage':{default:'page'},'@/components/DirectoryViewControls':{default:'views'},
  './NativeBrowseToolbar':{default:'toolbar',NativeBrowseQuickFilter:'filter'},'./NativeCountrySelect':{default:'country'},
  './NativeNewsSections':{default:'sections'},'@/lib/use-native-app-appearance':{useNativeAppAppearance:()=>true},
  '@/lib/use-view-state':{useViewState:()=>['map',()=>{}]},'@/lib/browse-country':country,'@/lib/places/core':places,
  '@/lib/location-map':geometry,'@/lib/organization-directory-filters':orgFilters,'./NativeOrganizations.module.css':{default:{}},
 });
 const organizations=[{id:'one',slug:'one',name:'Synthetic mapped',country:'DE',city:'Fixture',lat:48,lng:11},
  {id:'two',slug:'two',name:'Synthetic unmapped',country:'DE',city:'',lat:null,lng:null}];
 const tree=Component({data:{organizations,count:63,hasMore:true,cities:[],filters:{country:'',city:'',q:'',page:1}},children:null});
 const toolbar=nodes(tree,n=>n.type==='toolbar')[0].props,map=nodes(tree,n=>n.type==='map')[0].props;
 assert.equal(toolbar.count,pending?null:63);assert.equal(toolbar.countScope,'total');
 assert.equal(map.visibleCount,1);assert.equal(map.countPending,pending);
 assert.equal(map.locations.length,2,'Unmapped page entries must not disappear');
 assert.equal(nodes(tree,n=>n.props.href==='/organizations/two').length,1);
 map.onBoundsChange(europe);
 assert.equal(nodes(tree,n=>n.props.href==='/organizations/two').length,1,'Moving the organization map never narrows the page');
 if(pending)assert.equal(map.labels.results,translatorFor('de','common')('loading'));
});
