import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { createTranslator } from 'next-intl';
import { hasCoordinates, inMapBounds } from './location-map.ts';
import { compactCount } from './compact-count.ts';
const require = createRequire(import.meta.url);
const messages = JSON.parse(readFileSync(new URL('../messages/de.json', import.meta.url)));
const translate = namespace => createTranslator({ locale:'de', messages, namespace });
const fixtures = () => [
 {id:'a',title:'Synthetic studio',type:'Studio',city:'Berlin',price:125,image:'/api/media/synthetic',lat:52,lng:13},
 {id:'b',title:'Synthetic loft',type:'Wohnen',city:'Berlin',price:0,image:'',lat:52,lng:13,metadata:{price_on_request:true}},
 {id:'unknown',title:'Unknown city',lat:null,lng:null},
 {id:'bad',title:'Invalid coordinates',lat:999,lng:13},
];
function walk(node) { return !React.isValidElement(node) ? [] : [node,...React.Children.toArray(node.props.children).flatMap(walk)]; }
function content(node) { return typeof node==='string' || typeof node==='number' ? String(node) : React.isValidElement(node) ? React.Children.toArray(node.props.children).map(content).join('') : ''; }
async function harness(locale = 'de', initialProps = {}, options = {}) {
 const localeMessages = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url)));
 const translators = new Map();
 const mapTranslate = namespace => { if(!translators.has(namespace))translators.set(namespace,createTranslator({locale, messages:localeMessages, namespace}));return translators.get(namespace); };
 let cursor=0, slots=[], effects=[], tree, props, instance, markers=[], observers=0;
 const surface={clientWidth:320,clientHeight:240},resizeCallbacks=new Set();
 const hooks={...React,
  useState(initial){const i=cursor++;if(!slots[i])slots[i]={value:initial};return [slots[i].value,v=>{slots[i].value=typeof v==='function'?v(slots[i].value):v;}];},
  useRef(initial){const i=cursor++;if(!slots[i])slots[i]={current:initial};return slots[i];},
  useEffect(fn,deps){const i=cursor++;const old=slots[i];if(!old||deps.some((v,j)=>v!==old.deps[j]))effects.push(()=>{old?.cleanup?.();slots[i]={deps,cleanup:fn()};});},
 };
 const listeners=new Map(),basemapListeners=new Map();
 const emit=name=>{for(const fn of [...(listeners.get(name)??[])])fn();};
 const viewport={south:50,north:54,west:10,east:15};
 const bounds={getSouth:()=>viewport.south,getNorth:()=>viewport.north,getWest:()=>viewport.west,getEast:()=>viewport.east};
 const map={attributionControl:{setPrefix(){}},zoom:6,fits:0,removed:false,viewport,projections:0,
  on(name,fn){const set=listeners.get(name)??new Set();set.add(fn);listeners.set(name,set);return this;},
  off(name,fn){listeners.get(name)?.delete(fn);return this;},
  fitBounds(b,options){this.fits++;this.lastFit=b;this.zoom=options?.maxZoom??this.zoom;emit('moveend');emit('zoomend');return this;},
  getBounds:()=>bounds,getZoom(){return this.zoom;},invalidations:0,invalidateSize(){this.invalidations++;},remove(){this.removed=true;},
  eachLayer(fn){markers.forEach(fn);},latLngToLayerPoint([lat,lng]){this.projections++;return {lat,lng,distanceTo:other=>Math.hypot(lat-other.lat,lng-other.lng)*100};},
 };
 const leaflet={map:(_container,options)=>{instance=map;map.options=options;return map;},tileLayer:()=>({addTo(){}}),control:{zoom:()=>({addTo(){}})},latLngBounds:v=>v,
  layerGroup:()=>{const own=[];return {addTo(){return this;},clearLayers(){markers=markers.filter(m=>!own.includes(m));own.length=0;},remove(){this.clearLayers();},own};},
  circle:()=>({addTo(){return this;},remove(){}}),
  divIcon:v=>v,marker:(coords,options)=>{const events={};const marker={coords,options,events,on(n,f){events[n]=f;return this;},addTo(group){group.own.push(this);markers.push(this);return this;},getElement:()=>({classList:{toggle(){}}}),getLatLng:()=>({equals:()=>false})};return marker;},
 };
 globalThis.ResizeObserver=class {constructor(callback){observers++;this.callback=callback;resizeCallbacks.add(callback);}observe(){}disconnect(){observers--;resizeCallbacks.delete(this.callback);}};
 globalThis.document={getElementById:()=>true};
 const mocks={'./LocationMap.module.css':{__esModule:true,default:{nativeActions:'native-actions',applyButton:'apply-button',nativeCopy:'native-copy',webCopy:'web-copy',resetButton:'reset-button',emptyState:'empty-state',errorState:'error-state'}},'leaflet/dist/leaflet.css':{},'maplibre-gl/dist/maplibre-gl.css':{},'@/lib/map-basemap':{createBasemap:()=>({addTo(){return this;},getMaplibreMap:()=>({on(name,callback){basemapListeners.set(name,callback);if(name==='load'&&options.autoLoad!==false)queueMicrotask(callback);},getStyle:()=>({layers:[]})})})},react:hooks,'next-intl':{useLocale:()=> locale,useTranslations:mapTranslate},'next/link':'a','@/components/MediaImage':'img','@/components/ListingImage':'img',leaflet};
 mocks['@/components/ContentTranslation']={TranslatedText:({children})=>children};
 const counterSource=ts.transpileModule(readFileSync(new URL('../components/BrowseResultCount.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const counter={exports:{}};new Function('require','module','exports',counterSource)(name=>name==='@/lib/compact-count'?{compactCount}:Object.hasOwn(mocks,name)?mocks[name]:require(name),counter,counter.exports);
 mocks['@/components/BrowseResultCount']=counter.exports;
 const source=ts.transpileModule(readFileSync(new URL('../components/LocationMap.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 for(const [,name] of source.matchAll(/require\("([^"]+)"\)/g))if(name.startsWith('@/lib/')&&!Object.hasOwn(mocks,name))mocks[name]=await import(new URL(`./${name.slice(6)}.ts`,import.meta.url));
 const mod={exports:{}};new Function('require','module','exports',source)(n=>Object.hasOwn(mocks,n)?mocks[n]:require(n),mod,mod.exports);
 let hovered=null,applied=null;
 props={locations:fixtures(),activeId:null,onHover:id=>hovered=id,userLocation:null,radiusKm:50,appliedBounds:null,onApplyBounds:b=>applied=b,...initialProps};
 async function render(next={}){props={...props,...next};for(let i=0;i<4;i++){cursor=0;tree=mod.exports.default(props);for(const node of walk(tree))if(node.type==='div'&&node.props.ref&&node.props.ref.current===null)node.props.ref.current=surface;const pending=effects;effects=[];pending.forEach(fn=>fn());await Promise.resolve();await Promise.resolve();}return tree;}
 await render();
 return {render,get markers(){return markers;},map,emit,emitBasemap(name){basemapListeners.get(name)?.();},size(width,height){surface.clientWidth=width;surface.clientHeight=height;},resize(){for(const callback of resizeCallbacks)callback();},get hovered(){return hovered;},get applied(){return applied;},nodes:()=>walk(tree),text:()=>renderToStaticMarkup(tree),button(label){const n=walk(tree).find(n=>n.type==='button'&&(n.props['aria-label']===label||content(n)===label));assert.ok(n,`Missing button ${label}`);return n;},cleanup(){slots.forEach(s=>s?.cleanup?.());assert.equal(observers,0);assert.equal(instance.removed,true);assert.equal(markers.length,0);}};
}
test('coordinates accept zero, reject missing/nonfinite/out-of-range values and handle the dateline',()=>{
 assert.ok(hasCoordinates({lat:0,lng:0}));for(const lat of [null,undefined,NaN,Infinity,91])assert.equal(hasCoordinates({lat,lng:0}),false);
 const b={south:-10,north:10,west:170,east:190};assert.ok(inMapBounds({lat:0,lng:-175},b));assert.ok(inMapBounds({lat:0,lng:175},b));assert.equal(inMapBounds({lat:0,lng:0},b),false);assert.equal(inMapBounds({lat:null,lng:null},b),false);
});
test('coincident city markers zoom, offer selection, open protected-media preview and close without changing results',async()=>{
 const h=await harness();assert.equal(h.markers.length,1);assert.equal(h.markers[0].options.icon.iconSize[0],44);assert.match(h.text(),/keinen bekannten Kartenstandort/);
 const initialFits=h.map.fits;h.markers[0].events.click();await h.render();assert.ok(h.map.fits>initialFits);
 h.map.zoom=18;h.emit('zoomend');h.markers[0].events.click();await h.render();
 h.button('Synthetic studio').props.onClick();await h.render();assert.equal(h.hovered,'a');
 assert.ok(h.nodes().some(n=>n.props.src==='/api/media/synthetic'));assert.match(h.text(),/125.*€/);assert.ok(h.nodes().some(n=>n.props.href==='/locations/a'));
 h.markers[0].events.mouseout();await h.render();assert.ok(h.nodes().some(n=>n.props.href==='/locations/a'));
 h.button(translate('locationMap')('closePreview')).props.onClick();await h.render();assert.equal(h.nodes().some(n=>n.props.href==='/locations/a'),false);h.cleanup();
});
test('individual tap opens preview; filter removal hides it and layer listeners clean up',async()=>{
 const h=await harness();await h.render({locations:[fixtures()[0]]});assert.equal(h.markers.length,1);
 h.markers[0].events.click();await h.render();assert.ok(h.nodes().some(n=>n.props.href==='/locations/a'));
 await h.render({locations:[]});assert.equal(h.nodes().some(n=>n.props.href==='/locations/a'),false);assert.equal(h.markers.length,0);await h.render({locations:[fixtures()[0]]});assert.equal(h.nodes().some(n=>n.props.href==='/locations/a'),false);h.cleanup();
});
test('moving only offers area search; explicit apply passes bounds and suppresses automatic fitting until reset',async()=>{
 const h=await harness();assert.equal(h.applied,null);assert.equal(h.nodes().some(n=>content(n)===translate('locationMap')('searchArea')),false);
 assert.equal(h.map.options.trackResize,true,'ordinary website keeps Leaflet window resize handling');
 h.emit('moveend');await h.render();assert.equal(h.applied,null);
 h.button(translate('locationMap')('searchArea')).props.onClick();await h.render();assert.deepEqual(h.applied,{south:50,north:54,west:10,east:15});
 const fits=h.map.fits;await h.render({appliedBounds:h.applied,locations:[fixtures()[0]]});assert.equal(h.map.fits,fits);
 h.button(translate('locationMap')('resetArea')).props.onClick();assert.equal(h.applied,null);await h.render({appliedBounds:null});assert.ok(h.map.fits>fits);h.cleanup();
});

test('500m areas render their public circle and preview label using only the approximate center',async()=>{
 const h=await harness();const row={...fixtures()[0],metadata:{location_area:{lat:52,lng:13,radius_meters:500}}};await h.render({locations:[row]});h.markers[0].events.click();await h.render();assert.match(h.text(),/500 m Radius/);h.cleanup();
});

for (const locale of ['de','en','es','it','cs','hu','nl','nl-BE','sv']) {
 test(`${locale}: map markers contain only points or counts for every pricing mode`,async()=>{
  const h=await harness(locale);
  for(const row of [fixtures()[0],fixtures()[1],{...fixtures()[0],metadata:{price_negotiable:true}}]) {
   await h.render({locations:[row]});
   assert.deepEqual(h.markers[0].options.icon.iconSize,[44,44]);
   assert.equal(h.markers[0].options.icon.html,'<span class="location-map-marker__dot"></span>');
   h.markers[0].events.click();await h.render();
   assert.ok(h.nodes().some(n=>n.props.href===`/locations/${row.id}`),'marker still opens its location');
  }
  await h.render({locations:fixtures()});
  assert.equal(h.markers[0].options.icon.html,'<span class="location-map-marker__dot location-map-marker__cluster">2</span>');
  h.cleanup();
 });
}

test('automatic viewport mode publishes pan, zoom and resize bounds immediately and keeps the search button hidden',async()=>{
 const h=await harness(),published=[];await h.render({onBoundsChange:bounds=>published.push(bounds),visibleCount:2});
 assert.ok(published.length>0);assert.deepEqual(published.at(-1),{south:50,north:54,west:10,east:15});
 for(const event of ['moveend','zoomend','resize']){const before=published.length;h.map.viewport.north+=0.1;h.emit(event);await h.render();assert.ok(published.length>before,event);}
 assert.equal(h.nodes().some(node=>node.type==='button'&&content(node)===translate('locationMap')('searchArea')),false);
 const fits=h.map.fits;await h.render({appliedBounds:published.at(-1),visibleCount:1});assert.equal(h.map.fits,fits,'updating the list must not reset the zoom');
 await h.render({locations:[{...fixtures()[0],lat:10,lng:10}],visibleCount:0});assert.equal(h.markers.length,0,'offscreen positions cannot inflate edge cluster counts');
 h.cleanup();const before=published.length;h.emit('moveend');h.emit('zoomend');h.emit('resize');assert.equal(published.length,before,'all viewport listeners are removed on unmount');
});

test('directory presentation opens the selected profile or offer without location-specific links or copy',async()=>{
 const h=await harness();
 for(const href of ['/profile/member-a','/props/offer-a','/vehicles/vehicle-a']) {
  await h.render({locations:[fixtures()[0]],labels:{label:'Directory',results:'One mapped result',empty:'No mapped results',unknownCoordinates:''},renderPreview:row=>React.createElement('a',{href},row.title)});
  h.markers[0].events.click();await h.render();
  assert.ok(h.nodes().some(node=>node.props.href===href));
  assert.equal(h.nodes().some(node=>node.props.href==='/locations/a'),false);
  assert.match(h.text(),/One mapped result/);
 }
 await h.render({locations:[],visibleCount:0});assert.match(h.text(),/No mapped results/);h.cleanup();
});

test('automatic map focus panning keeps a visible tapped preview open and closes it only after the point leaves the viewport',async()=>{
 const published=[],row=fixtures()[0];
 const h=await harness('de',{locations:[row],onBoundsChange:bounds=>published.push(bounds)});
 h.markers[0].events.click();await h.render();
 const isOpen=()=>h.nodes().some(node=>node.props.href==='/locations/a');
 assert.ok(isOpen());
 // Focusing an edge marker can make Leaflet pan after its click event.
 h.map.viewport.west-=0.1;h.emit('moveend');await h.render();
 assert.ok(isOpen(),'focus auto-pan must not immediately discard the selected result');
 for(const event of ['zoomend','resize']){h.map.viewport.north+=0.1;h.emit(event);await h.render();assert.ok(isOpen(),event);}
 assert.equal(published.at(-1).west,9.9,'the results still receive the changed viewport');
 h.map.viewport.east=12;h.emit('moveend');await h.render();
 assert.equal(isOpen(),false,'offscreen results must not retain a floating preview');
 h.map.viewport.east=15;h.emit('moveend');await h.render();assert.equal(isOpen(),false,'returning to an area does not reopen a closed preview');
 h.markers[0].events.click();await h.render();assert.ok(isOpen());
 // The same ID may receive corrected coordinates without changing the selection scope.
 await h.render({locations:[{...row,lat:45}]});
 h.map.viewport.north+=0.1;h.emit('moveend');await h.render();assert.equal(isOpen(),false,'selection visibility uses current coordinates');
 h.cleanup();
});

test('automatic viewport changes still dismiss cluster choices',async()=>{
 const h=await harness('de',{onBoundsChange:()=>{}});
 h.map.zoom=18;h.emit('zoomend');h.markers[0].events.click();await h.render();
 assert.ok(h.button('Synthetic studio'));
 h.map.viewport.north+=0.1;h.emit('moveend');await h.render();
 assert.equal(h.nodes().some(node=>node.type==='button'&&content(node)==='Synthetic studio'),false);
 h.cleanup();
});

test('an initially empty automatic map waits for paginated results before committing its viewport', async () => {
 const published=[];
 const h=await harness('de',{locations:[],onBoundsChange:bounds=>published.push(bounds)});
 h.emit('resize');h.emit('moveend');await h.render();
 assert.deepEqual(published,[],'the default Germany viewport must not exclude a late-loaded profile');
 assert.equal(h.map.fits,0);
 await h.render({locations:[{...fixtures()[0],lat:52.52,lng:13.405}]});
 assert.ok(h.map.fits>0,'the first arriving profile is fitted while bounds are still unset');
 assert.ok(published.length>0);
 h.cleanup();
});

test('a completed zoom projects each result once and duplicate end events publish no extra viewport', async () => {
 const published=[],h=await harness('de',{onBoundsChange:bounds=>published.push(bounds)});
 const rows=Array.from({length:120},(_,i)=>({...fixtures()[0],id:`point-${i}`,lat:50.2+(i%10)*0.3,lng:10.2+Math.floor(i/10)*0.3}));
 await h.render({locations:rows});
 const before=h.map.projections,updates=published.length;
 h.map.zoom++;h.map.viewport.north+=0.1;h.emit('zoomend');h.emit('moveend');h.emit('resize');await h.render();
 assert.equal(h.map.projections-before,rows.length,'screen positions are calculated once per point, not per pair or per end event');
 assert.equal(published.length-updates,1);
 h.cleanup();assert.equal(h.map._animatingZoom,false,'late Leaflet timers cannot continue a removed zoom');
});

test('Smart keeps a chosen viewport while filtering and explicitly refits when the applied area is reset',async()=>{
 const h=await harness('de',{preserveViewport:true,labels:{label:'Smart',results:'3',empty:'Empty',unknownCoordinates:'',applyArea:'Limit this selection'}});
 const fits=h.map.fits;
 await h.render({locations:[fixtures()[0]]});assert.equal(h.map.fits,fits);
 h.emit('moveend');await h.render();
 h.button('Limit this selection').props.onClick();await h.render({appliedBounds:h.applied});
 assert.deepEqual(h.applied,{south:50,north:54,west:10,east:15});assert.equal(h.map.fits,fits);
 h.button(translate('locationMap')('resetArea')).props.onClick();await h.render({appliedBounds:null});
 assert.ok(h.map.fits>fits);h.cleanup();
});

for (const locale of ['de','en','es','it','cs','hu','nl','nl-BE','sv','fr','pl','pt-PT','zh-Hans','ja','ko','ru','uk']) test(`${locale}: compact native Smart map action retains its full meaning and exact explicit bounds/reset behavior`, async () => {
 const copy=JSON.parse(readFileSync(new URL(`../messages/${locale}.json`,import.meta.url)));
 const full=copy.UnifiedSearch.discovery.applyMapArea,short=copy.UnifiedSearch.discovery.searchHere;
 assert.ok(short.trim());assert.ok(short.length<full.length,locale+' has a concise visible label');
 const h=await harness(locale,{preserveViewport:true,labels:{label:'Smart',results:'3',empty:'Empty',unknownCoordinates:'',applyArea:full,nativeApplyArea:short}});
 h.emit('moveend');await h.render();assert.equal(h.applied,null,'panning still does not apply a hidden filter');
 const button=h.nodes().find(node=>node.type==='button'&&node.props.className?.includes('apply-button'));assert.ok(button);assert.equal(button.props['aria-label'],undefined);assert.match(button.props.className,/apply-button/);
 const spans=walk(button).filter(node=>node.type==='span');
 assert.equal(spans.find(node=>node.props.className==='native-copy').props['aria-hidden'],undefined,'visible short words remain part of the accessible name');
 assert.equal(content(spans.find(node=>node.props.className==='native-copy')),short);
 assert.equal(content(spans.find(node=>node.props.className==='web-copy')),full,'ordinary website copy remains present');
 button.props.onClick();await h.render({appliedBounds:h.applied});
 assert.deepEqual(h.applied,{south:50,north:54,west:10,east:15});
 const reset=h.button(copy.locationMap.resetArea);assert.equal(reset.props['aria-label'],copy.locationMap.resetArea);reset.props.onClick();assert.equal(h.applied,null);h.cleanup();
});


test('incomplete directory data does not advertise a partial map total or a false empty state',async()=>{
 const h=await harness('de',{locations:[],visibleCount:0,countPending:true});
 assert.match(h.text(),/—/);assert.doesNotMatch(h.text(),/Keine Locations für diese Filter/);
 await h.render({locations:fixtures(),visibleCount:2,countPending:false});
 const counter=h.nodes().find(n=>typeof n.type==='function'&&n.props.count===2);
 assert.ok(counter);h.cleanup();
});

test('actual map distinguishes loading, complete zero, incomplete count, positive results and a basemap failure with retry',async()=>{
 const copy=translate('directoryMap')('empty'),h=await harness('de',{locations:[],visibleCount:0,labels:{label:'Synthetic map',results:'Zero mapped results',empty:copy,unknownCoordinates:''}},{autoLoad:false});
 const empty=()=>h.nodes().filter(n=>n.type==='p'&&n.props.className?.includes('empty-state'));
 assert.equal(empty().length,0,'a map still loading cannot announce an empty result');
 h.emitBasemap('load');await h.render();assert.equal(empty().length,1);assert.equal(empty()[0].props.role,'status');assert.equal(content(empty()[0]),copy);
 assert.ok(h.nodes().some(n=>typeof n.type==='function'&&n.props.count===0),'the existing visible count retains the real zero');
 await h.render({countPending:true});assert.equal(empty().length,0);
 await h.render({locations:[fixtures()[0]],visibleCount:1,countPending:false});assert.equal(empty().length,0);assert.equal(h.markers.length,1);
 await h.render({locations:[],visibleCount:0});h.emitBasemap('error');await h.render();assert.equal(empty().length,0,'a basemap failure is not a successful empty result');
 assert.ok(h.nodes().some(n=>n.props.role==='alert'));h.button(translate('notifications')('retry')).props.onClick();await h.render();assert.equal(empty().length,0);assert.equal(h.nodes().some(n=>n.props.role==='alert'),false);
 h.emitBasemap('load');await h.render();assert.equal(empty().length,1);h.cleanup();
});

test('the actual empty-message CSS is visually hidden only in app mode, remains accessible, and leaves zoom/attribution rules untouched',()=>{
 const postcss=createRequire(require.resolve('next/package.json'))('postcss');
 const source=readFileSync(new URL('../components/LocationMap.module.css',import.meta.url),'utf8');
 const selector=':global(html[data-cg-native-community-appearance="app"]) .emptyState';
 function contract(css){const rules=[];postcss.parse(css).walkRules(rule=>{if(rule.selector.includes('.emptyState'))rules.push(rule)});assert.equal(rules.length,1);assert.equal(rules[0].selector,selector);
  const values=Object.fromEntries(rules[0].nodes.filter(n=>n.type==='decl').map(n=>[n.prop,n.value]));
  assert.equal(values.position,'absolute');assert.equal(values.width,'1px');assert.equal(values.height,'1px');assert.equal(values.padding,'0');assert.equal(values.border,'0');assert.equal(values.overflow,'hidden');assert.equal(values['clip-path'],'inset(50%)');assert.equal(values.display,undefined);assert.equal(values.visibility,undefined);
 }
 contract(source);
 const errors=[];postcss.parse(source).walkRules(rule=>{if(rule.selector.includes('.errorState'))errors.push(rule)});
 assert.equal(errors.length,2);assert.ok(errors.every(rule=>rule.selector.startsWith(':global(html[data-cg-native-community-appearance="app"])')));
 const error=Object.fromEntries(errors[0].nodes.filter(n=>n.type==='decl').map(n=>[n.prop,n.value]));assert.equal(error.right,'60px');assert.equal(error['max-height'],'calc(100% - 120px)');assert.equal(error.overflow,'auto');assert.equal(error['align-items'],'flex-start');
 const retry=Object.fromEntries(errors[1].nodes.filter(n=>n.type==='decl').map(n=>[n.prop,n.value]));assert.equal(retry['min-width'],'44px');assert.equal(retry['flex-shrink'],'0');
 assert.throws(()=>contract(source.replace(selector,'.emptyState')),'ordinary website must not inherit this presentation change');
 assert.throws(()=>contract(source.replaceAll('clip-path:inset(50%)','clip-path:none')),'restoring an opaque text rectangle fails the regression contract');
 assert.throws(()=>contract(source.replaceAll('width:1px; height:1px; padding:0','width:100%; height:auto; padding:16px')),'the original wide panel fails the regression contract');
 const component=readFileSync(new URL('../components/LocationMap.tsx',import.meta.url),'utf8'),globals=readFileSync(new URL('../app/globals.css',import.meta.url),'utf8');
 assert.ok(component.includes('zoom.current = L.control.zoom'));assert.ok(component.includes('instance.attributionControl.setPrefix(false)'));
 assert.match(globals,/\.location-map \.leaflet-control-zoom a \{[^}]*width: 44px; height: 44px; min-width: 44px; min-height: 44px/);
 assert.ok(globals.includes('.leaflet-control-attribution a { display: inline-flex; align-items: center; min-height: 44px;'));
});

test('native hidden and zero-size map cannot invalidate or publish bounds; reset fitting waits for a visible positive surface',async()=>{
 const published=[],h=await harness('de',{preserveViewport:true,viewportActive:true,onBoundsChange:bounds=>published.push(bounds)});
 assert.equal(h.map.options.trackResize,false,'only native Smart uses the guarded size observer instead of an independent hidden window resize');
 assert.ok(h.map.fits>0);await h.render({appliedBounds:published.at(-1)});
 const fits=h.map.fits,invalidations=h.map.invalidations,updates=published.length;
 h.size(0,0);await h.render({viewportActive:false});h.resize();h.emit('resize');h.emit('moveend');h.emit('zoomend');await h.render();
 assert.equal(h.map.invalidations,invalidations);assert.equal(published.length,updates);
 await h.render({appliedBounds:null});h.resize();assert.equal(h.map.fits,fits,'a reset cannot fit against zero pixels');assert.equal(published.length,updates);
 h.size(320,240);await h.render({viewportActive:true});
 assert.equal(h.map.fits,fits+1,'the pending native reset fits once on reentry');assert.ok(published.length>updates);
 const readyFits=h.map.fits,readyUpdates=published.length;await h.render({appliedBounds:published.at(-1)});h.resize();await h.render();
 assert.equal(h.map.fits,readyFits);assert.equal(published.length,readyUpdates,'reentry settles without a fit/publish loop');h.cleanup();
});
test('native map created hidden defers its saved bounds restore until the retained surface becomes visible',async()=>{
 const published=[],saved={south:50,north:54,west:10,east:15};
 const h=await harness('de',{preserveViewport:true,viewportActive:false,appliedBounds:saved,onBoundsChange:bounds=>published.push(bounds)});
 h.resize();h.emit('moveend');assert.equal(h.map.fits,0);assert.deepEqual(published,[]);
 await h.render({viewportActive:true});assert.equal(h.map.fits,1);assert.deepEqual(h.map.lastFit,[[50,10],[54,15]]);assert.ok(published.length>0);h.cleanup();
});
