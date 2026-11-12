import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import {intlServerFor,intlClientFor,translatorFor} from './i18n-test-fixture.mjs';
import {placeFieldsForId,placeWriteFields,placeReadFields} from './places/catalog.ts';

const require=createRequire(import.meta.url),root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const locales=['de','en','es','it','cs','hu','nl','nl-BE','sv'],compiled=new Map();
const cities={munich:placeFieldsForId('geonames:2867714','München, DE'),cologne:placeFieldsForId('geonames:2886242','Köln, DE'),manual:placeWriteFields('San Isidro de prueba, MX')};
const nativeMunich={de:'München',en:'Munich',es:'Múnich',it:'Monaco di Baviera',cs:'Mnichov',hu:'München',nl:'München','nl-BE':'München',sv:'München'};
const source=file=>readFileSync(resolve(root,file),'utf8');
function code(file){if(!compiled.has(file))compiled.set(file,ts.transpileModule(source(file),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText);return compiled.get(file);}
function nodes(tree,predicate,out=[]){if(!tree||typeof tree!=='object')return out;if(predicate(tree))out.push(tree);for(const child of React.Children.toArray(tree.props?.children))nodes(child,predicate,out);return out;}

function heroDestination(locale,tab,cityText,query='match'){
 let index=0;const values=[],destinations=[];
 const react={...React,useState(initial){const slot=index++;if(!(slot in values))values[slot]=initial;return [values[slot],value=>{values[slot]=value}];}};
 const mocks={'react':react,'next-intl':intlClientFor(locale),'next/navigation':{useRouter:()=>({push:value=>destinations.push(value)})}};
 const module={exports:{}};new Function('require','module','exports',code('components/HeroSearch.tsx'))(name=>mocks[name]??require(name),module,module.exports);
 const render=()=>{index=0;return module.exports.default();};
 let tree=render();nodes(tree,node=>node.type==='button'&&node.props.children===translatorFor(locale)(tab))[0].props.onClick();tree=render();
 nodes(tree,node=>node.type==='input'&&node.props.name==='q')[0].props.onChange({target:{value:query}});
 nodes(tree,node=>node.type==='input'&&node.props.name==='cityText')[0].props.onChange({target:{value:cityText}});tree=render();
 const form=nodes(tree,node=>node.type==='form')[0];assert.equal(form.props.method,'get');
 const fallback=new URL(form.props.action,'https://www.cinegenius.co');
 for(const input of nodes(tree,node=>node.type==='input'))fallback.searchParams.set(input.props.name,input.props.value);
 form.props.onSubmit({preventDefault(){}});
 const url=new URL(destinations.at(-1),'https://www.cinegenius.co');
 assert.equal(url.pathname,fallback.pathname);assert.equal(url.searchParams.get('cityText'),fallback.searchParams.get('cityText')?.trim());
 assert.equal(url.searchParams.get('q'),query.trim());assert.equal(url.searchParams.has('city'),false);
 url.fallback=fallback;
 return url;
}

function fixtureRows(){
 const listings=[],profiles=[];
 for(const [city,place] of Object.entries(cities))for(const kind of ['location','prop','job'])listings.push({
  id:`own-${kind}-${city}`,user_id:'own-public-owner',title:`PUBLIC match ${kind} ${city}`,type:kind,published:true,category:kind==='location'?'Studio':'Requisiten',city:city==='manual'?'San Isidro de prueba, MX':city==='munich'?'München, Bayern, Deutschland':'Köln, Deutschland',price:50,image_url:null,description:'',metadata:{},created_at:'2026-11-10T12:00:00Z',...place,
 });
 for(const [city,place] of Object.entries(cities))profiles.push({user_id:`own-crew-${city}`,display_name:`PUBLIC match crew ${city}`,location:city==='manual'?'San Isidro de prueba, MX':city==='munich'?'München, Deutschland':'Köln, Deutschland',profile_type:'lighting',profile_types:['lighting'],positions:[],skills:[],languages:[],crew:null,bio:'',role:null,avatar_url:null,portfolio_images:[],physical:null,availability_config:null,available:true,verified:false,tagline:null,...place});
 listings.push({...listings[0],id:'own-unpublished-canary',published:false});
 profiles.push({...profiles[0],user_id:'own-private-canary',display_name:'PUBLIC match PRIVATE CANARY'});
 return {listings,profiles};
}

async function browse(url,locale){
 const rows=fixtureRows(),original=JSON.stringify(rows),selected={},observed={url:null,controls:null,places:null,filters:[],replacements:[]},cache=new Map();
 const db={from(table){const filters=[];const q={select(){return q},eq(key,value){filters.push([key,value]);observed.filters.push([key,value]);return q},in(key,values){filters.push([key,values]);return q},not(){return q},neq(){return q},order(){return q},limit(){return q},then(done,fail){const data=(rows[table]??[]).filter(row=>filters.every(([key,value])=>Array.isArray(value)?value.includes(row[key]):row[key]===value));return Promise.resolve({data,error:null}).then(done,fail)}};return q}};
 const mocks={
  'next-intl':intlClientFor(locale),'next-intl/server':intlServerFor(locale),
  'next/cache':{unstable_cache:fn=>fn},'@clerk/nextjs/server':{auth:async()=>({userId:null})},
  '@clerk/nextjs':{useUser:()=>({user:null,isLoaded:true}),useAuth:()=>({userId:null,isSignedIn:false,isLoaded:true})},
  'next/navigation':{useRouter:()=>({push(){},refresh(){},replace:(...args)=>observed.replacements.push(args)}),useSearchParams:()=>url.searchParams,usePathname:()=>url.pathname},
  'next/link':({href,children,...props})=>React.createElement('a',{...props,href},children),'next/dynamic':()=>()=>null,
  '@/lib/db':{db},'@/lib/places/catalog':{placeReadFields},'@/lib/ratings':{fetchRatings:async()=>({})},'@/lib/trust':{getPrivateProfileIds:async()=>new Set(['own-private-canary'])},
  '@/lib/use-view-url':{useViewUrl:value=>{observed.url=value}},
  '@/lib/use-view-state':{useViewState:(key,initial)=>{if(!Object.hasOwn(selected,key))selected[key]=typeof initial==='function'?initial():initial;return [selected[key],next=>{selected[key]=typeof next==='function'?next(selected[key]):next}]}},
  '@/lib/profile-update-events':{subscribeToProfileUpdated:()=>()=>{}},
  '@/components/MediaImage':()=>null,'@/components/ProfileCardPhoto':()=>null,'@/components/PageHeader':()=>null,
  '@/components/EmptyState':({title})=>React.createElement('p',null,title),
  '@/components/PlaceFilters':{__esModule:true,EMPTY_PLACE_FILTERS:{country:'',region:'',city:''},default:props=>{observed.places=props;return null}},
  '@/components/MobileBrowseControls':{__esModule:true,default:props=>{observed.controls=props;return React.createElement('div',null,props.children,...props.chips.map(chip=>React.createElement('span',{key:chip.id},chip.label)))},MobileFilterField:({children})=>React.createElement('div',null,children),MobileFilterSelect:()=>null},
 };
 async function load(file){
  if(cache.has(file))return cache.get(file);
  const dependencies={...mocks};
  for(const [,name] of code(file).matchAll(/require\("([^"]+)"\)/g)){
   if(Object.hasOwn(dependencies,name))continue;
   if(name==='@/lib/use-nearby-location')dependencies[name]=await load('lib/use-nearby-location.ts');
   else if(name.startsWith('@/lib/'))dependencies[name]=await import(new URL(`./${name.slice(6)}.ts`,import.meta.url));
   else if(name.startsWith('@/components/'))dependencies[name]=({children})=>React.createElement(React.Fragment,null,children);
   else if(name.startsWith('.')){let target=resolve(root,dirname(file),name);if(!target.endsWith('.tsx'))target+='.tsx';dependencies[name]=await load(target.slice(root.length+1));}
  }
  const module={exports:{}};new Function('require','module','exports',code(file))(name=>dependencies[name]??require(name),module,module.exports);cache.set(file,module.exports);return module.exports;
 }
 const route=await load(`app${url.pathname}/page.tsx`),previousFetch=globalThis.fetch;
 globalThis.fetch=async target=>{assert.ok(String(target).startsWith('https://nominatim.openstreetmap.org/search?'),'only existing geocoding is simulated');return Response.json([])};
 let page;try{page=await route.default({searchParams:Promise.resolve(Object.fromEntries(url.searchParams))});}finally{globalThis.fetch=previousFetch;}
 const render=()=>{const html=renderToStaticMarkup(page);assert.equal(JSON.stringify(rows),original,'no member/fixture value or canonical ID may be rewritten');assert.ok(!html.includes('PRIVATE CANARY'));return html;};
 return {render,observed,selected};
}

const cityTextState=(h,key)=>key==='locations.landing.filters'?h.selected[key]?.cityText:h.selected[key];
const targets=[['nav.locations','/locations','location','locations.landing.filters'],['nav.crew','/creators','crew','crew.cityText'],['companies.groupAusstattung','/props','prop','props.cityText'],['nav.jobs','/jobs','job','jobs.cityText']];
for(const locale of locales)test(`${locale}: all four real homepage search destinations consume native city text, preserve canonical IDs and clear text without losing q`,{timeout:30000},async()=>{
 for(const [tab,path,kind,stateKey] of targets){
  const url=heroDestination(locale,tab,nativeMunich[locale]);assert.equal(url.pathname,path);
  const h=await browse(url,locale),html=h.render();
  assert.ok(html.includes(`/`+(kind==='crew'?'profile':kind==='prop'?'props':kind==='job'?'jobs':'locations')+`/own-${kind}-munich`),`${locale} ${path} returns Munich`);
  assert.ok(!html.includes(`own-${kind}-cologne`));assert.ok(!html.includes(`own-${kind}-manual`));
  assert.equal(cityTextState(h,stateKey),nativeMunich[locale]);assert.ok(h.observed.filters.every(([column])=>column!=='place_city_id'),'text was not sent as a canonical database city ID');
  assert.equal(h.observed.places.value.city,'');
  const chip=h.observed.controls.chips.find(chip=>chip.id==='city-text');assert.ok(chip);assert.ok(chip.label.includes(nativeMunich[locale]));
  assert.equal(new URL(h.observed.url,'https://www.cinegenius.co').searchParams.get('cityText'),nativeMunich[locale]);
  h.observed.controls.onSortChange(h.observed.controls.sortOptions.at(-1).value);h.render();
  assert.equal(new URL(h.observed.url,'https://www.cinegenius.co').searchParams.get('cityText'),nativeMunich[locale],'sorting retains the text constraint');
  h.observed.places.onChange({country:'AT',region:'',city:''});assert.ok(!h.render().includes(`own-${kind}-munich`),'canonical country filters still constrain the text search');
  h.observed.places.onChange({country:'DE',region:cities.munich.place_region_id,city:''});assert.ok(h.render().includes(`own-${kind}-munich`));
  h.observed.places.onChange({country:'',region:'',city:''});h.render();
  chip.onRemove();const cleared=h.render();assert.equal(cityTextState(h,stateKey),'');assert.ok(cleared.includes(`own-${kind}-cologne`));
  assert.equal(new URL(h.observed.url,'https://www.cinegenius.co').searchParams.has('cityText'),false);
  assert.equal(h.observed.controls.query,'match');
  h.observed.controls.onReset();h.render();assert.equal(cityTextState(h,stateKey),'');
 }
});

test('actual GET fallback processes preserved query/city input and harmless surrounding whitespace on all four destination pages',async()=>{
 for(const [tab,,kind] of targets){
  const destination=heroDestination('de',tab,' Munich ',' match ');
  const h=await browse(destination.fallback,'de'),html=h.render();
  assert.ok(html.includes(`own-${kind}-munich`));assert.ok(!html.includes(`own-${kind}-cologne`));
  assert.equal(h.observed.places.value.city,'');
 }
});

test('reloading a real Crew URL retains country/region/city IDs and cityText without widening or rewriting the selection',async()=>{
 for(const locale of locales){
  const url=new URL('https://www.cinegenius.co/creators');
  for(const [key,value] of Object.entries({q:'match',country:'DE',region:cities.munich.place_region_id,city:cities.munich.place_city_id,cityText:nativeMunich[locale],sort:'reviews'}))url.searchParams.set(key,value);
  const h=await browse(url,locale),html=h.render();assert.ok(html.includes('own-crew-munich'));assert.ok(!html.includes('own-crew-cologne'));
  assert.deepEqual(h.observed.places.value,{country:'DE',region:cities.munich.place_region_id,city:cities.munich.place_city_id});
  const synced=new URL(h.observed.url,'https://www.cinegenius.co');
  for(const key of ['q','country','region','city','cityText','sort'])assert.equal(synced.searchParams.get(key),url.searchParams.get(key));
  assert.equal(h.observed.controls.sortValue,'reviews');
 }
});

test('free international text stays searchable and an explicit canonical city replaces text without rewriting it',async()=>{
 for(const [tab,,kind,stateKey] of targets){
  const manual=await browse(heroDestination('de',tab,'San Isidro'), 'de');assert.ok(manual.render().includes(`own-${kind}-manual`));
  assert.equal(manual.observed.places.value.city,'');assert.equal(cityTextState(manual,stateKey),'San Isidro');
  manual.observed.places.onChange({country:'DE',region:cities.cologne.place_region_id,city:cities.cologne.place_city_id});
  const canonical=manual.render();assert.equal(cityTextState(manual,stateKey),'');assert.ok(canonical.includes(`own-${kind}-cologne`));assert.ok(!canonical.includes(`own-${kind}-manual`));
 }
});
