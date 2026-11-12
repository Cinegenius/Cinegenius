import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import ts from 'typescript';
import { createTranslator } from 'next-intl';
import { hasCoordinates, inMapBounds } from './location-map.ts';
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
async function harness() {
 let cursor=0, slots=[], effects=[], tree, props, instance, markers=[], observers=0;
 const hooks={...React,
  useState(initial){const i=cursor++;if(!slots[i])slots[i]={value:initial};return [slots[i].value,v=>{slots[i].value=typeof v==='function'?v(slots[i].value):v;}];},
  useRef(initial){const i=cursor++;if(!slots[i])slots[i]={current:initial===null?{}:initial};return slots[i];},
  useEffect(fn,deps){const i=cursor++;const old=slots[i];if(!old||deps.some((v,j)=>v!==old.deps[j]))effects.push(()=>{old?.cleanup?.();slots[i]={deps,cleanup:fn()};});},
 };
 const listeners=new Map();
 const emit=name=>{for(const fn of [...(listeners.get(name)??[])])fn();};
 const bounds={getSouth:()=>50,getNorth:()=>54,getWest:()=>10,getEast:()=>15};
 const map={zoom:6,fits:0,removed:false,
  on(name,fn){const set=listeners.get(name)??new Set();set.add(fn);listeners.set(name,set);return this;},
  off(name,fn){listeners.get(name)?.delete(fn);return this;},
  fitBounds(_b,options){this.fits++;this.zoom=options?.maxZoom??this.zoom;emit('moveend');emit('zoomend');return this;},
  getBounds:()=>bounds,getZoom(){return this.zoom;},invalidateSize(){},remove(){this.removed=true;},
  eachLayer(fn){markers.forEach(fn);},latLngToLayerPoint:()=>({distanceTo:()=>0}),
 };
 const leaflet={map:()=>{instance=map;return map;},tileLayer:()=>({addTo(){}}),control:{zoom:()=>({addTo(){}})},latLngBounds:v=>v,
  layerGroup:()=>{const own=[];return {addTo(){return this;},clearLayers(){markers=markers.filter(m=>!own.includes(m));own.length=0;},remove(){this.clearLayers();},own};},
  circle:()=>({addTo(){return this;},remove(){}}),
  divIcon:v=>v,marker:(coords,options)=>{const events={};const marker={coords,options,events,on(n,f){events[n]=f;return this;},addTo(group){group.own.push(this);markers.push(this);return this;},getElement:()=>({classList:{toggle(){}}}),getLatLng:()=>({equals:()=>false})};return marker;},
 };
 globalThis.ResizeObserver=class {constructor(){observers++;}observe(){}disconnect(){observers--;}};
 globalThis.document={getElementById:()=>true};
 const mocks={'leaflet/dist/leaflet.css':{},react:hooks,'next-intl':{useLocale:()=> 'de',useTranslations:translate},'next/link':'a','@/components/MediaImage':'img',leaflet};
 const source=ts.transpileModule(readFileSync(new URL('../components/LocationMap.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 for(const [,name] of source.matchAll(/require\("([^"]+)"\)/g))if(name.startsWith('@/lib/'))mocks[name]=await import(new URL(`./${name.slice(6)}.ts`,import.meta.url));
 const mod={exports:{}};new Function('require','module','exports',source)(n=>Object.hasOwn(mocks,n)?mocks[n]:require(n),mod,mod.exports);
 let hovered=null,applied=null;
 props={locations:fixtures(),activeId:null,onHover:id=>hovered=id,userLocation:null,radiusKm:50,appliedBounds:null,onApplyBounds:b=>applied=b};
 async function render(next={}){props={...props,...next};for(let i=0;i<4;i++){cursor=0;tree=mod.exports.default(props);const pending=effects;effects=[];pending.forEach(fn=>fn());await Promise.resolve();await Promise.resolve();}return tree;}
 await render();
 return {render,get markers(){return markers;},map,emit,get hovered(){return hovered;},get applied(){return applied;},nodes:()=>walk(tree),text:()=>content(tree),button(label){const n=walk(tree).find(n=>n.type==='button'&&(n.props['aria-label']===label||content(n)===label));assert.ok(n,`Missing button ${label}`);return n;},cleanup(){slots.forEach(s=>s?.cleanup?.());assert.equal(observers,0);assert.equal(instance.removed,true);assert.equal(markers.length,0);}};
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
 h.emit('moveend');await h.render();assert.equal(h.applied,null);
 h.button(translate('locationMap')('searchArea')).props.onClick();await h.render();assert.deepEqual(h.applied,{south:50,north:54,west:10,east:15});
 const fits=h.map.fits;await h.render({appliedBounds:h.applied,locations:[fixtures()[0]]});assert.equal(h.map.fits,fits);
 h.button(translate('locationMap')('resetArea')).props.onClick();assert.equal(h.applied,null);await h.render({appliedBounds:null});assert.ok(h.map.fits>fits);h.cleanup();
});

test('500m areas render their public circle and preview label using only the approximate center',async()=>{
 const h=await harness();const row={...fixtures()[0],metadata:{location_area:{lat:52,lng:13,radius_meters:500}}};await h.render({locations:[row]});h.markers[0].events.click();await h.render();assert.match(h.text(),/500 m Radius/);h.cleanup();
});

test('individual markers show the same formatted price used in their preview',async()=>{
 const h=await harness();await h.render({locations:[fixtures()[0]]});assert.match(h.markers[0].options.icon.html,/location-map-marker__price/);assert.match(h.markers[0].options.icon.html,/125.*€/);assert.deepEqual(h.markers[0].options.icon.iconSize,[132,44]);h.cleanup();
});
