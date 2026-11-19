import test from 'node:test';
import assert from 'node:assert/strict';
import { toggleNativeSmartArea, nativeSmartView, NATIVE_SMART_PRIMARY } from './native-smart-controls.ts';
import { filterDiscoveryGroups, emptyDiscoveryFilters, discoveryCount } from './smart-discovery.ts';
import { smartMapEntries } from './smart-search-map.ts';

const areas=Object.freeze(['crew','marketplace','locations','companies','jobs']);
const groups=areas.map(area=>({area,wishIndex:0,label:area,nextOffset:null,results:[{id:area,type:area==='crew'?'profile':area==='locations'?'location':area==='companies'?'company':'prop',title:area,subtitle:'',price:0,image:null,available:null,mapPoint:area==='companies'?null:{lat:52,lng:13}}]}));
test('first selection isolates one area, further selections combine, and the final deselection restores Smart',()=>{
 let hidden=toggleNativeSmartArea(areas,[],'crew');
 assert.deepEqual(hidden,['marketplace','locations','companies','jobs']);
 hidden=toggleNativeSmartArea(areas,hidden,'companies');
 assert.deepEqual(hidden,['marketplace','locations','jobs']);
 hidden=toggleNativeSmartArea(areas,hidden,'crew');
 assert.deepEqual(hidden,['crew','marketplace','locations','jobs']);
 assert.deepEqual(toggleNativeSmartArea(areas,hidden,'companies'),[]);
});
test('unreturned areas cannot be manufactured by choosing a primary button',()=>{
 const hidden=Object.freeze(['locations']);
 assert.equal(toggleNativeSmartArea(areas,hidden,'animals'),hidden);
 assert.deepEqual(areas,['crew','marketplace','locations','companies','jobs']);
 assert.deepEqual(hidden,['locations']);
});
test('multi-selection gives grid, list and map the same identities and preserves unmapped companies in the list',()=>{
 const hidden=toggleNativeSmartArea(areas,toggleNativeSmartArea(areas,[],'crew'),'companies');
 const visible=filterDiscoveryGroups(groups,{...emptyDiscoveryFilters(),hiddenAreas:hidden});
 assert.equal(discoveryCount(visible),2);
 assert.deepEqual(visible.flatMap(group=>group.results.map(row=>row.id)),['crew','companies']);
 assert.deepEqual(smartMapEntries(visible).map(row=>row.result.id),['crew','companies']);
 assert.equal(visible.find(group=>group.area==='companies').results[0].mapPoint,null);
 assert.equal(discoveryCount(groups),5);
});
test('legacy map choice remains authoritative; cards and list are distinct when map is closed',()=>{
 assert.equal(nativeSmartView(true,'grid'),'map');
 assert.equal(nativeSmartView(false,'grid'),'grid');
 assert.equal(nativeSmartView(false,'map'),'list');
 assert.equal(nativeSmartView(false),'list');
 assert.equal(NATIVE_SMART_PRIMARY[2],'smart');
});
