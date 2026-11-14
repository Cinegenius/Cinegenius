import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createTranslator} from 'next-intl';
import ts from 'typescript';
import * as facets from './browse-facets.ts';
import * as browse from './marketplace-browse.ts';
import * as categories from './marketplaceCategories.ts';
import * as places from './places/core.ts';
import * as placeCatalog from './places/catalog.ts';
import * as pricing from './listing-price.ts';
import * as offers from './marketplace-offer.ts';
import * as mapBounds from './location-map.ts';
import * as geography from './browse-geography.ts';
import {publicMapPoint} from './places/public-map-point.ts';
const require=createRequire(import.meta.url);
const locales=['de','en','es','it','cs','hu','nl','nl-BE','sv'];
const dictionaries=Object.fromEntries(locales.map(locale=>[locale,JSON.parse(readFileSync(new URL(`../messages/${locale}.json`,import.meta.url),'utf8'))]));
const code=ts.transpileModule(readFileSync(new URL('../app/props/PropsContent.tsx',import.meta.url),'utf8')+'\nexport {PropsInner, PropCard};',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
const row=(id,category='kamera-kameras',extra={})=>({id,type:'prop',title:`PUBLIC fixture ${id}`,category,city:'München',price:20,image_url:'',description:'Public fixture item',marketplace:{mode:'rent',rent_mode:'request',fulfilment:['pickup']},...extra});
const card=raw=>({...browse.marketplaceCardData(raw),vendor:'PUBLIC provider'});
const response=(data,status=200)=>({ok:status>=200&&status<300,status,json:async()=>data});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function deferred(){let resolve;return{promise:new Promise(done=>{resolve=done}),resolve:value=>resolve(value)}}
const Category=()=>React.createElement('section',{'data-category-navigation':true});
const Mobile=()=>React.createElement('section',{'data-mobile-controls':true});
const Empty=({title})=>React.createElement('div',{'data-empty-state':true},title);
const Filter=()=>null;
const Field=({children})=>React.createElement('div',null,children);
const Image=({src,alt,style})=>React.createElement('img',{src,alt,style});
const Link=({href,children,...props})=>React.createElement('a',{href,...props},children);
function fixture({locale='de',path='/marketplace',query='',rows=[row('camera'),row('light','licht-quellen')],signedIn=false,initialDepartment,serverError=false,request}={}){
 let currentLocale=locale,currentUser=signedIn?'member':null,hook=0,effectIndex=0,tree,timerId=0;
 const states=[],refs=[],effects=[],pendingEffects=[],timers=new Map(),view={},calls=[],urls=[];
 const translators=new Map();
 const translate=namespace=>{const key=currentLocale+':'+namespace;if(!translators.has(key))translators.set(key,createTranslator({locale:currentLocale,messages:dictionaries[currentLocale],namespace,onError(error){throw error}}));return translators.get(key)};
 const fetch=async(url,options={})=>{calls.push({url,options});if(request)return request(url,options);if(url.startsWith('/api/listings?'))return response({data:rows,count:rows.length});if(url.startsWith('/api/listing-ratings?'))return response({ratings:{},myRatings:{},eligible:[]});if(url.startsWith('/api/favorites?'))return response({favorited:[]});return response({isFavorited:true})};
 const customReact={...React,useState(initial){const index=hook++;if(!(index in states))states[index]=typeof initial==='function'?initial():initial;return[states[index],action=>{states[index]=typeof action==='function'?action(states[index]):action}]},useRef(initial){const index=hook++;return refs[index]??={current:initial}},useMemo:fn=>fn(),useEffect(fn,deps){const index=effectIndex++,previous=effects[index];if(!previous||deps.some((value,i)=>!Object.is(value,previous.deps[i]))){pendingEffects.push(()=>{previous?.cleanup?.();effects[index]={deps,cleanup:fn()}})}}};
 const deps={'react':customReact,'react/jsx-runtime':require('react/jsx-runtime'),'next/link':Link,'lucide-react':require('lucide-react'),'next-intl':{useLocale:()=>currentLocale,useTranslations:translate},'next/navigation':{usePathname:()=>path,useSearchParams:()=>new URLSearchParams(query)},'@clerk/nextjs':{useUser:()=>({user:currentUser?{id:currentUser}:null}),useAuth:()=>({isSignedIn:!!currentUser})},'@/lib/use-view-url':{useViewUrl:url=>urls.push(url)},'@/lib/use-view-state':{useViewState(key,initial){if(!Object.hasOwn(view,key))view[key]=typeof initial==='function'?initial():initial;return[view[key],action=>{view[key]=typeof action==='function'?action(view[key]):action}]}},'@/lib/places/core':places,'@/lib/marketplace-browse':browse,'@/lib/marketplaceCategories':categories,'@/lib/marketplace-offer':offers,'@/lib/listing-price':pricing,'@/components/MediaImage':Image,'@/components/ListingImage':Image,'@/components/MarketplaceCategoryNavigation':Category,'@/components/MobileBrowseControls':{__esModule:true,default:Mobile,MobileFilterField:Field,MobileFilterSelect:Filter},'@/components/PlaceFilters':{__esModule:true,default:Filter,EMPTY_PLACE_FILTERS:{country:'',region:'',city:''}},'@/components/EmptyState':Empty};
 const loadSource=path=>{
  const compiled=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  const loaded={exports:{}};new Function('require','module','exports',compiled)(name=>{assert.ok(Object.hasOwn(deps,name),`Uncontrolled dependency ${name}`);return deps[name]},loaded,loaded.exports);return loaded.exports;
 };
 deps['./use-view-state']=deps['@/lib/use-view-state'];deps['./location-map']=mapBounds;
 // Existing marketplace cases exercise the global order without an account place.
 deps['@/components/BrowseGeography']=()=>null;
 deps['@/lib/use-browse-geography']={useBrowseGeography:()=>({preferred:null,key:'global',setEnabled(){}})};
 deps['@/lib/browse-geography']=geography;deps['@/lib/browse-facets']=facets;
 deps['@/components/FloatingMapToggle']=loadSource('../components/FloatingMapToggle.tsx');
 deps['@/components/DirectoryViewControls']=loadSource('../components/DirectoryViewControls.tsx');
 deps['@/components/DirectoryMap']=()=>null;
 deps['@/lib/use-directory-map']=loadSource('./use-directory-map.ts');
 const loaded={exports:{}};const browser={setTimeout(fn,delay){assert.equal(delay,250);const id=++timerId;timers.set(id,fn);return id},clearTimeout:id=>timers.delete(id)};
 new Function('require','module','exports','fetch','window',code)(name=>{assert.ok(Object.hasOwn(deps,name),`Uncontrolled dependency ${name}`);return deps[name]},loaded,loaded.exports,fetch,browser);
 const walk=node=>!node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(walk):[node,...walk(node.props?.children)];
 const render=()=>{hook=0;effectIndex=0;tree=loaded.exports.PropsInner({facetRows:rows.map(card),serverListings:rows.map(card),initialDepartment,serverError});return tree};
 const nodes=()=>walk(tree),controls=()=>nodes().find(node=>node.type===Mobile).props;
 render();
 return{view,calls,urls,render,nodes,controls,t:namespace=>translate(namespace),category:()=>({key:[view['marketplace.selectedDept'],view['marketplace.subcategory']].join(':'),props:{department:controls().categoryValue||null,subcategory:view['marketplace.subcategory'],onChange(dept,sub){controls().onCategoryChange(dept||'');if(sub){render();nodes().find(node=>node.type===Filter&&node.props.options?.some(option=>option.value===sub)).props.onChange(sub)}}}}),cards:()=>nodes().filter(node=>node.type===loaded.exports.PropCard),cardTree:(index=0)=>loaded.exports.PropCard(nodes().filter(node=>node.type===loaded.exports.PropCard)[index].props),html:()=>renderToStaticMarkup(tree),effects(){while(pendingEffects.length)pendingEffects.shift()()},async timers(){const work=[...timers.values()];timers.clear();work.forEach(fn=>fn());await tick()},timerCount:()=>timers.size,setLocale(value){currentLocale=value;render()},setUser(value){currentUser=value;render()}};
}
for(const locale of locales)test(`${locale}: native category search, breadcrumb IDs, combined category reset and shared path survive locale changes`,()=>{
 const f=fixture({locale,query:'dept=kamera&sub=kamera-kameras&offer=kauf&sort=price-desc&view=list'});
 assert.equal(f.controls().categoryPlacement,'filters');assert.equal(f.category().props.department,'kamera');assert.equal(f.category().props.subcategory,'kamera-kameras');
 assert.equal(f.view['marketplace.rentalTypeFilter'],'kauf');assert.equal(f.view['marketplace.sortKey'],'price-desc');assert.equal(f.view['marketplace.viewMode'],'list');
 assert.ok(f.controls().chips.some(chip=>chip.id==='subcategory'));
 const url=new URL(f.urls.at(-1),'https://fixture.invalid');assert.equal(url.pathname,'/marketplace');assert.equal(url.searchParams.get('offer'),'kauf');assert.equal(url.searchParams.get('view'),'list');
 f.setLocale(locale==='de'?'sv':'de');assert.equal(f.category().props.subcategory,'kamera-kameras');
 f.controls().chips.find(chip=>chip.id==='subcategory').onRemove();f.render();assert.equal(f.category().props.department,null);assert.equal(f.category().props.subcategory,'');
 f.category().props.onChange('licht','licht-quellen');f.render();assert.equal(f.category().key,'licht:licht-quellen');f.controls().onReset();f.render();assert.equal(f.category().props.department,null);assert.equal(f.category().props.subcategory,'');
});
for(const locale of locales)test(`${locale}: local fallback understands native subcategory and department labels`,()=>{
 const f=fixture({locale,rows:[row('camera'),row('lens','kamera-objektive'),row('light','licht-quellen')]});
 f.controls().onQueryChange(f.t('MarketplaceCatalog')('subcategories.kamera-kameras'));f.render();assert.deepEqual(f.cards().map(node=>node.props.p.id),['camera']);
 f.controls().onQueryChange(f.t('MarketplaceCatalog')('categories.kamera'));f.render();assert.deepEqual(new Set(f.cards().map(node=>node.props.p.id)),new Set(['camera','lens']));
});
test('vehicles default is initial only; explicit URLs win and choosing All preserves the current route',()=>{
 const f=fixture({path:'/vehicles',initialDepartment:'fahrzeuge'});assert.equal(f.category().props.department,'fahrzeuge');f.category().props.onChange(null);f.render();assert.equal(f.category().props.department,null);assert.equal(new URL(f.urls.at(-1),'https://fixture.invalid').pathname,'/vehicles');
 const explicit=fixture({path:'/vehicles',initialDepartment:'fahrzeuge',query:'dept=licht&sub=licht-quellen'});assert.equal(explicit.category().props.department,'licht');
});
test('search controls precede category navigation, cards retain real labels and contain no nested buttons in links',()=>{
 const f=fixture({signedIn:true});const html=f.html();assert.ok(html.indexOf('data-mobile-controls')<html.indexOf('browse-card'));assert.ok(!html.includes('data-category-navigation'),'no duplicate category toolbar');
 for(const match of html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gu))assert.doesNotMatch(match[1],/<button\b/u);
 assert.doesNotMatch(html,/bg-gold[^>]*>Neu</u);assert.ok(html.includes(f.t('MarketplaceNavigation')('saveFavorite')));
});
test('ratings and favorites query only the visible first page, never the full 300-row fallback',async()=>{
 const f=fixture({signedIn:true,rows:Array.from({length:300},(_,i)=>row('visible-'+i))});f.effects();await tick();
 const batches=f.calls.filter(call=>call.url.startsWith('/api/listing-ratings?')||call.url.startsWith('/api/favorites?'));
 assert.equal(batches.length,2);for(const call of batches){const ids=new URL(call.url,'https://fixture.invalid').searchParams.get('ids').split(',');assert.equal(ids.length,browse.MARKETPLACE_PAGE_SIZE);assert.ok(!ids.includes('visible-299'));}
});
test('250ms debounce cancels prior searches and a late aborted response cannot replace newer results',async()=>{
 const old=deferred();const f=fixture({request:async(url)=>{if(!url.startsWith('/api/listings?'))return response({ratings:{},myRatings:{},eligible:[],favorited:[]});const q=new URL(url,'https://fixture.invalid').searchParams.get('q');return q==='old'?old.promise:response({data:[row('new')],count:1})}});
 f.effects();f.controls().onQueryChange('old');f.render();f.effects();assert.equal(f.timerCount(),1);await f.timers();
 f.controls().onQueryChange('new');f.render();f.effects();await f.timers();f.render();f.effects();assert.deepEqual(f.cards().map(node=>node.props.p.id),['new']);
 const previous=f.calls.find(call=>call.url.includes('q=old'));assert.ok(previous.options.signal.aborted);
 old.resolve(response({data:[row('old')],count:1}));await tick();f.render();assert.deepEqual(f.cards().map(node=>node.props.p.id),['new']);
 assert.equal(f.calls.filter(call=>call.url.startsWith('/api/listings?')).length,2);
});
test('an HTTP failure is a retryable error and never an empty-success message',async()=>{
 let failures=0;const f=fixture({rows:[],request:async(url)=>{if(!url.startsWith('/api/listings?'))return response({});return ++failures===1?response({error:'PRIVATE provider text'},503):response({data:[],count:0})}});
 f.effects();await f.timers();f.render();assert.equal(f.nodes().filter(node=>node.type===Empty).length,0);assert.match(f.html(),/role="alert"/);assert.ok(f.html().includes(f.t('MarketplaceNavigation')('filterError')));assert.doesNotMatch(f.html(),/PRIVATE provider/);
 const retry=f.nodes().find(node=>node.type==='button'&&node.props.children===f.t('MarketplaceNavigation')('retry'));assert.ok(retry);retry.props.onClick();f.render();f.effects();await f.timers();f.render();assert.equal(f.nodes().filter(node=>node.type===Empty).length,1);assert.equal(failures,2);
});
test('favorite POST HTTP failure rolls the optimistic heart back and does not expose provider errors',async()=>{
 const pending=deferred();const f=fixture({signedIn:true,request:async(url,options)=>options.method==='POST'?pending.promise:response({ratings:{},myRatings:{},eligible:[],favorited:[]})});f.effects();await tick();f.render();
 f.cards()[0].props.onFavorite({preventDefault(){},stopPropagation(){}});f.render();assert.equal(f.cards()[0].props.isFavorited,true);
 pending.resolve(response({error:'PRIVATE details'},500));await tick();f.render();assert.equal(f.cards()[0].props.isFavorited,false);assert.match(f.html(),/role="alert"/);assert.doesNotMatch(f.html(),/PRIVATE details/);
});
test('rating POST HTTP failure restores both the previous average/count and the member rating',async()=>{
 const pending=deferred();const f=fixture({signedIn:true,request:async(url,options)=>options.method==='POST'?pending.promise:response({ratings:{camera:{avg:4,count:2}},myRatings:{camera:4},eligible:['camera'],favorited:[]})});f.effects();await tick();f.render();assert.equal(f.cards()[0].props.canRate,true);
 const writing=f.cards()[0].props.onRate(5);f.render();assert.deepEqual(f.cards()[0].props.ratingData,{avg:4.5,count:2});assert.equal(f.cards()[0].props.myRating,5);
 pending.resolve(response({},403));await writing;f.render();assert.deepEqual(f.cards()[0].props.ratingData,{avg:4,count:2});assert.equal(f.cards()[0].props.myRating,4);
});
test('SSR and API card projection retain identical delivery, focal point and both-price metadata',async()=>{
 const raw=row('shared','kamera-kameras',{image_url:'/public-fixture.webp',price:90,condition:'PUBLIC condition',delivery:true,focal_point:{x:23,y:67},marketplace:{mode:'both',rent_mode:'request',sale_mode:'fixed',sale_price:150,fulfilment:['delivery']}});
 let columns='';const chain={select(value){columns=value;return chain},eq(){return chain},in(){return chain},order(){return chain},limit(){return chain},then(resolve){return Promise.resolve({data:[raw],error:null}).then(resolve)}};
 const Props=()=>null,Header=()=>null,translator=namespace=>createTranslator({locale:'de',messages:dictionaries.de,namespace});
 const dependencies={'@/lib/db':{db:{from:()=>chain}},'@/lib/marketplace-browse':browse,'@/lib/places/catalog':placeCatalog,'./PropsContent':Props,'@/components/PageHeader':Header,'next-intl/server':{getLocale:async()=> 'de',getTranslations:async namespace=>translator(namespace)}};
 dependencies['@/lib/places/public-map-point']={publicMapPoint};dependencies['@/lib/marketplace-facets']={marketplaceFacetRows:async()=>[card(raw)]};dependencies['@/components/DirectoryPage']=({children})=>children;
 const compiled=ts.transpileModule(readFileSync(new URL('../app/props/page.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const loaded={exports:{}};new Function('require','module','exports',compiled)(name=>name==='react/jsx-runtime'?require(name):dependencies[name],loaded,loaded.exports);
 const page=await loaded.exports.default(),projected=React.Children.toArray(page.props.children).find(node=>node.type===Props).props.serverListings[0],api=browse.marketplaceCardData(raw);
 for(const field of ['delivery','focalPoint','rentalType','meta'])assert.deepEqual(projected[field],api[field]);
 assert.equal(projected.rentalType,'beides');assert.equal(projected.delivery,true);assert.deepEqual(projected.focalPoint,{x:23,y:67});assert.ok(columns.includes('focal_point:metadata->focal_point'));assert.ok(!columns.split(',').includes('metadata'));assert.ok(!columns.split(',').includes('user_id'));
 const f=fixture({rows:[raw]});const html=f.html();assert.ok(html.includes('23% 67%'));assert.ok(html.includes(f.t('MarketplaceNavigation')('both')));assert.ok(html.includes(pricing.listingPriceLabel(api.dailyRate,api.meta,'/Tag','de',f.t('MarketplaceOffer'))));
});
test('load more appends distinct API pages and a category change restarts at page one',async()=>{
 const rows=Array.from({length:55},(_,i)=>row('paged-'+i));const f=fixture({rows,request:async(url)=>{
  if(!url.startsWith('/api/listings?'))return response({ratings:{},myRatings:{},eligible:[],favorited:[]});
  const params=new URL(url,'https://fixture.invalid').searchParams;if(params.get('dept')==='licht')return response({data:[],count:0});const page=Number(params.get('page'));return response({data:rows.slice((page-1)*24,page*24),count:55});
 }});
 f.effects();await f.timers();f.render();f.effects();assert.equal(f.cards().length,24);
 const more=()=>f.nodes().find(node=>node.type==='button'&&typeof node.props.children==='string'&&node.props.children===f.t('props')('loadMore',{count:55-f.cards().length}));
 more().props.onClick();f.render();f.effects();await f.timers();f.render();f.effects();assert.equal(f.cards().length,48);assert.equal(new Set(f.cards().map(node=>node.props.p.id)).size,48);
 more().props.onClick();f.render();f.effects();await f.timers();f.render();f.effects();assert.equal(f.cards().length,55);
 f.category().props.onChange('licht');f.render();f.effects();await f.timers();f.render();assert.equal(f.cards().length,0);
 const requests=f.calls.filter(call=>call.url.startsWith('/api/listings?')).map(call=>new URL(call.url,'https://fixture.invalid').searchParams);assert.deepEqual(requests.map(params=>params.get('page')),['1','2','3','1']);assert.equal(requests.at(-1).get('dept'),'licht');
});
test('grid card title, place and price live on the solid body below the photo, with real photo controls retained',()=>{
 const f=fixture({signedIn:true,rows:[row('white-photo','fahrzeuge-bild',{image_url:'/PUBLIC-white-photo.webp',title:'PUBLIC long two-line title',city:'PUBLIC city'})]});
 const tree=f.cardTree(),link=React.Children.toArray(tree.props.children).find(node=>node.type===Link),parts=React.Children.toArray(link.props.children),photo=parts[0],body=parts[1];
 const descendants=node=>!React.isValidElement(node)?[]:[node,...React.Children.toArray(node.props.children).flatMap(descendants)];
 assert.ok(descendants(photo).some(node=>node.type===Image));assert.equal(descendants(photo).filter(node=>node.type==='h3').length,0);
 const heading=descendants(body).find(node=>node.type==='h3');assert.equal(heading.props.children,'PUBLIC long two-line title');assert.ok(body.props.className.includes('bg-bg-secondary'));
 assert.ok(renderToStaticMarkup(body).includes('PUBLIC city'));const price=descendants(body).find(node=>node.type==='p'&&node.props.className.includes('font-bold')),p=f.cards()[0].props.p;assert.equal(price.props.children,pricing.listingPriceLabel(p.dailyRate,{...p.meta,rental_type:p.rentalType},'/Tag','de',f.t('MarketplaceOffer')));
 const favorite=React.Children.toArray(tree.props.children).find(node=>node.type==='button');assert.ok(favorite);assert.equal(favorite.props['aria-label'],f.t('MarketplaceNavigation')('saveFavorite'));
});
