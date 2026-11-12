import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createTranslator} from 'next-intl';
import ts from 'typescript';

const require=createRequire(import.meta.url);
const locales=['de','en','es','it','cs','hu','nl','nl-BE','sv'];
const dictionaries=Object.fromEntries(locales.map(locale=>[locale,JSON.parse(readFileSync(new URL(`../messages/${locale}.json`,import.meta.url),'utf8'))]));
const textHtml=value=>renderToStaticMarkup(React.createElement('span',null,value)).slice(6,-7);
const translate=(locale,namespace)=>createTranslator({locale,messages:dictionaries[locale],namespace});
const image=({src,alt})=>React.createElement('img',{src,alt});
const link=({href,children,...props})=>React.createElement('a',{href,...props},children);

function location(id,title,type,city,place,overrides={}){
 return {id,title,type,city,price:120,priceUnit:'/Tag',rating:0,reviews:0,image:'',tags:[],instantBook:false,verified:false,sqft:60,capacity:6,lat:0,lng:0,isReal:true,description:'Synthetic location description',metadata:{price_on_request:true},...place,...overrides};
}
const munich={place_country_code:'DE',place_region_id:'DE:geonames:2951839',place_city_id:'geonames:2867714',place_city_name:'München',place_region_name:'Bayern',place_status:'verified'};
const cologne={place_country_code:'DE',place_region_id:'DE:geonames:2861876',place_city_id:'geonames:2886242',place_city_name:'Köln',place_region_name:'Nordrhein-Westfalen',place_status:'verified'};
const fixtures=()=>[
 location('own-muc-home','Synthetic Munich apartment','Wohnen','München, Deutschland',munich),
 location('own-muc-studio','Synthetic Munich studio','Studio','München, DE',munich),
 location('own-muc-garden','Synthetic Munich garden','Natur','Munich, Germany',munich),
 location('own-cgn-home','Synthetic Cologne apartment','Wohnen','Köln, Deutschland',cologne),
 location('own-international','Synthetic international village','Wohnen','San Isidro de prueba, MX',{place_country_code:'MX',place_region_id:null,place_city_id:null,place_city_name:'San Isidro de prueba',place_region_name:'',place_status:'pending'}),
];

async function harness({locale='de',queryString='',state={},openFilters=false}={}){
 const observed={controls:null,empty:null,url:null,replacements:[]};
 const selected={...state},parameters=new URLSearchParams(queryString);
 const router={replace:(...args)=>observed.replacements.push(args),push(){}};
 const componentCache=new Map();
 async function load(file,extraMocks={}){
  if(componentCache.has(file)&&!Object.keys(extraMocks).length)return componentCache.get(file);
  const code=ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  const mocks={
   'leaflet/dist/leaflet.css':{},
   'next/link':link,
   'next-intl':{useLocale:()=>locale,useTranslations:namespace=>translate(locale,namespace)},
   'next/navigation':{useRouter:()=>router,usePathname:()=>'/locations',useSearchParams:()=>parameters},
   '@clerk/nextjs':{useUser:()=>({user:null,isLoaded:true}),useAuth:()=>({isSignedIn:false,isLoaded:true,userId:null})},
   'next/dynamic':()=>props=>{ observed.map=props; return React.createElement('div',{'data-location-map':props.locations.map(row=>row.id).join(',')}); },
   '@/components/MediaImage':image,
   '@/lib/use-view-url':{useViewUrl:url=>{observed.url=url;}},
   '@/lib/use-view-state':{useViewState:(key,initial)=>{
    if(!Object.hasOwn(selected,key))selected[key]=typeof initial==='function'?initial():initial;
    return [selected[key],next=>{selected[key]=typeof next==='function'?next(selected[key]):next;}];
   }},
   ...extraMocks,
  };
  for(const [,specifier]of code.matchAll(/require\("([^"]+)"\)/g)){
   if(Object.hasOwn(mocks,specifier))continue;
   if(specifier.startsWith('@/lib/'))mocks[specifier]=await import(new URL(`./${specifier.slice('@/lib/'.length)}.ts`,import.meta.url));
   else if(specifier.startsWith('@/components/'))mocks[specifier]=await load(`../${specifier.slice(2)}.tsx`);
  }
  const compiled={exports:{}};
  new Function('require','module','exports',code)(name=>Object.hasOwn(mocks,name)?mocks[name]:require(name),compiled,compiled.exports);
  componentCache.set(file,compiled.exports);return compiled.exports;
 }
 // Render the actual shared controls. Only their initial dialog-open state is
 // controlled, so filter choices can be exercised without a DOM/browser API.
 const mobile=await load('../components/MobileBrowseControls.tsx',openFilters?{'react':{...React,useState:initial=>React.useState(initial===false?true:initial)}}:{});
 const controls=props=>{observed.controls=props;return React.createElement(mobile.default,props);};
 const empty=await load('../components/EmptyState.tsx');
 const emptyState=props=>{observed.empty=props;return React.createElement(empty.default,props);};
 const {default:Locations}=await load('../app/locations/LocationsContent.tsx',{
  '@/components/MobileBrowseControls':{__esModule:true,...mobile,default:controls},
  '@/components/EmptyState':emptyState,
 });
 const listings=fixtures(),before=JSON.stringify(listings);
 const render=()=>{
  observed.empty=null;
  const html=renderToStaticMarkup(React.createElement(Locations,{serverListings:listings}));
  assert.equal(JSON.stringify(listings),before,'Location rendering/filtering must preserve original data and canonical IDs');
  return html;
 };
 return {observed,state:selected,listings,render};
}
function links(html){return [...html.matchAll(/href="\/locations\/([^"?]+)"/g)].map(match=>match[1]);}
function buttons(element){
 if(!React.isValidElement(element))return [];
 return [...(element.type==='button'?[element]:[]),...React.Children.toArray(element.props.children).flatMap(buttons)];
}
function visibleText(node){return typeof node==='string'?node:React.isValidElement(node)?React.Children.toArray(node.props.children).map(visibleText).join(''):'';}
function viewButton(observed,label){const button=buttons(observed.controls.viewControls).find(item=>visibleText(item)===label);assert.ok(button,`Missing view control ${label}`);return button;}

test('typing München shows all three equivalent Munich locations and keeps their source data intact',async()=>{
 const h=await harness();assert.equal(links(h.render()).length,5);
 h.observed.controls.onQueryChange('München');
 const html=h.render();
 assert.deepEqual(new Set(links(html)),new Set(['own-muc-home','own-muc-studio','own-muc-garden']));
 assert.equal(h.observed.controls.resultSummary,translate('de','locations')('results',{count:3}));
 assert.equal(h.state['locations.query'],'München');
 assert.equal(new URL(h.observed.url,'https://synthetic.invalid').searchParams.get('q'),'München');
});

test('a location type combines with canonical country, region and city filters rather than replacing them',async()=>{
 const h=await harness({openFilters:true,state:{'locations.placeFilters':{country:'DE',region:munich.place_region_id,city:munich.place_city_id}}});
 assert.equal(links(h.render()).length,3);
 h.observed.controls.onCategoryChange('Wohnen');
 const html=h.render();assert.deepEqual(links(html),['own-muc-home']);
 assert.equal(h.state['locations.activeType'],'Wohnen');
 const params=new URL(h.observed.url,'https://synthetic.invalid').searchParams;
 assert.equal(params.get('type'),'Wohnen');assert.equal(params.get('country'),'DE');assert.equal(params.get('region'),munich.place_region_id);assert.equal(params.get('city'),munich.place_city_id);
 assert.ok(html.includes('<option value="Wohnen" selected="">'));
 assert.ok(html.includes(`<option value="${munich.place_city_id}" selected="">`));
});

test('an unresolved manual international place stays discoverable in the unfiltered list and text search',async()=>{
 const h=await harness();assert.ok(links(h.render()).includes('own-international'));
 h.observed.controls.onQueryChange('San Isidro');
 const html=h.render();assert.deepEqual(links(html),['own-international']);assert.ok(html.includes('San Isidro de prueba, MX'));
 const original=h.listings.find(row=>row.id==='own-international');assert.equal(original.place_status,'pending');assert.equal(original.place_city_id,null);assert.equal(original.place_country_code,'MX');
});

test('an empty filtered result offers a reset that restores the list and clears query, type and place IDs',async()=>{
 const h=await harness({state:{'locations.query':'No matching synthetic place','locations.activeType':'Studio','locations.placeFilters':{country:'DE',region:munich.place_region_id,city:munich.place_city_id}}});
 const html=h.render();assert.deepEqual(links(html),[]);
 assert.ok(h.observed.empty?.action);assert.equal(h.observed.empty.action.label,translate('de','locations')('emptyActionReset'));
 h.observed.empty.action.onClick();
 assert.equal(links(h.render()).length,5);assert.equal(h.observed.empty,null);
 assert.equal(h.state['locations.query'],'');assert.equal(h.state['locations.activeType'],'All Types');assert.deepEqual(h.state['locations.placeFilters'],{country:'',region:'',city:''});
 assert.deepEqual(h.observed.replacements.at(-1),['/locations',{scroll:false}]);
});

for(const locale of locales)test(`${locale}: mobile list/map choices remain translated, explicit and independent of saved canonical filter IDs`,async()=>{
 const h=await harness({locale,state:{'locations.query':'München','locations.placeFilters':{country:'DE',region:munich.place_region_id,city:munich.place_city_id}}});
 const t=translate(locale,'locations');const html=h.render();
 const list=viewButton(h.observed,t('viewList')),map=viewButton(h.observed,t('viewMap'));
 assert.equal(list.props['aria-pressed'],true);assert.equal(map.props['aria-pressed'],false);
 assert.ok(html.includes(`aria-label="${textHtml(t('viewLabel'))}"`));assert.ok(html.includes('aria-pressed="true"'));
 assert.equal(h.observed.controls.categoryPlacement,'filters');
 assert.ok(!html.includes('<option value="Wohnen"'),'The closed mobile toolbar must not repeat all category options');
 map.props.onClick();const mapHtml=h.render();
 assert.equal(h.state['locations.viewMode'],'map');assert.equal(viewButton(h.observed,t('viewMap')).props['aria-pressed'],true);assert.equal(viewButton(h.observed,t('viewList')).props['aria-pressed'],false);
 assert.match(mapHtml,/data-location-map="own-muc-home,own-muc-studio,own-muc-garden"/);
 assert.deepEqual(h.state['locations.placeFilters'],{country:'DE',region:munich.place_region_id,city:munich.place_city_id});
 viewButton(h.observed,t('viewList')).props.onClick();assert.equal(links(h.render()).length,3);assert.equal(h.state['locations.viewMode'],'list');
});

for(const locale of locales)test(`${locale}: opening mobile filters exposes localized type choices while preserving their original selection values`,async()=>{
 const h=await harness({locale,openFilters:true});h.render();
 const option=h.observed.controls.categories.find(option=>option.value==='Wohnen');assert.ok(option);assert.ok(option.label.trim());
 if(locale!=='de')assert.notEqual(option.label,'Wohnen');
 assert.doesNotMatch(option.label,/^(menu|locations)\./);
 h.observed.controls.onCategoryChange(option.value);const html=h.render();
 assert.equal(h.state['locations.activeType'],'Wohnen');assert.ok(html.includes(`<option value="Wohnen" selected="">${textHtml(option.label)}</option>`));
 assert.deepEqual(new Set(links(html)),new Set(['own-muc-home','own-cgn-home','own-international']));
});

for(const locale of locales)test(`${locale}: area search applies to both views, combines with text and resets through a chip`,async()=>{
 const h=await harness({locale,state:{'locations.viewMode':'map'}});
 h.render();assert.equal(h.observed.map.locations.length,5);
 h.observed.map.onApplyBounds({south:-1,north:1,west:-1,east:1});h.render();
 assert.equal(h.observed.map.locations.length,5);
 h.observed.controls.onQueryChange('München');h.render();assert.equal(h.observed.map.locations.length,3);
 assert.equal(h.observed.controls.resultSummary,translate(locale,'locations')('results',{count:3}));
 h.observed.map.onApplyBounds({south:40,north:50,west:8,east:12});h.render();assert.equal(h.observed.map.locations.length,0);
 const chip=h.observed.controls.chips.find(chip=>chip.id==='map-area');assert.ok(chip);chip.onRemove();h.render();
 assert.equal(h.observed.map.locations.length,3);assert.equal(h.state['locations.query'],'München');
});
