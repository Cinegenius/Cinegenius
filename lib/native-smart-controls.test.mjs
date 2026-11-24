import test from 'node:test';
import assert from 'node:assert/strict';
import { toggleNativeSmartArea, nativeSmartView, NATIVE_SMART_PRIMARY, nativeSmartHiddenAreas, nativeSmartResultAreas, nativeSmartBrowseFilters } from './native-smart-controls.ts';
import { filterDiscoveryGroups, emptyDiscoveryFilters, discoveryCount } from './smart-discovery.ts';
import { smartMapEntries } from './smart-search-map.ts';

const areas=Object.freeze(['crew','marketplace','locations','companies','jobs']);
const groups=areas.map(area=>({area,wishIndex:0,label:area,nextOffset:null,results:[{id:area,type:area==='crew'?'profile':area==='locations'?'location':area==='companies'?'company':'prop',title:area,subtitle:'',price:0,image:null,available:null,mapPoint:area==='companies'?null:{lat:52,lng:13}}]}));
test('each source toggles independently, including all off and back on',()=>{
 let hidden=[];
 for(const area of areas) hidden=toggleNativeSmartArea(areas,hidden,area);
 assert.deepEqual(hidden,areas);
 hidden=toggleNativeSmartArea(areas,hidden,'crew');
 assert.deepEqual(areas.filter(a=>!hidden.includes(a)),['crew']);
 hidden=toggleNativeSmartArea(areas,hidden,'companies');
 assert.deepEqual(areas.filter(a=>!hidden.includes(a)),['crew','companies']);
 hidden=toggleNativeSmartArea(areas,hidden,'crew');
 hidden=toggleNativeSmartArea(areas,hidden,'companies');
 assert.deepEqual(hidden,areas);
});
test('all32 visible combinations survive normalization and two toggles without automatic expansion',()=>{
 for(let bits=0;bits<32;bits++){
  const hidden=areas.filter((_,i)=>(bits&(1<<i))!==0);
  assert.deepEqual(nativeSmartHiddenAreas([...hidden,'projects','news','smart',...hidden]),hidden);
  for(const area of areas)assert.deepEqual(toggleNativeSmartArea(areas,toggleNativeSmartArea(areas,hidden,area),area),hidden);
 }
 assert.deepEqual(nativeSmartHiddenAreas(null),[]);
 assert.deepEqual(nativeSmartResultAreas(['projects','crew','jobs','news']),['crew','jobs']);
});
test('unreturned areas cannot be manufactured by choosing a primary button',()=>{
 const hidden=Object.freeze(['locations']);
 assert.equal(toggleNativeSmartArea(areas,hidden,'animals'),hidden);
 assert.deepEqual(areas,['crew','marketplace','locations','companies','jobs']);
 assert.deepEqual(hidden,['locations']);
});
test('multi-selection gives grid, list and map the same identities and preserves unmapped companies in the list',()=>{
 const hidden=toggleNativeSmartArea(areas,toggleNativeSmartArea(areas,[...areas],'crew'),'companies');
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
 assert.deepEqual(NATIVE_SMART_PRIMARY,areas);
});

test('legacy project filters are inert in native queries without mutating saved preferences',()=>{
 const legacy={version:1,projectTypes:['Serie'],country:'MX',departments:['kamera']};
 const snapshot=JSON.stringify(legacy);
 assert.deepEqual(nativeSmartBrowseFilters(legacy),{version:1,country:'MX',departments:['kamera']});
 assert.deepEqual(nativeSmartBrowseFilters({version:1,projectTypes:['Serie']}),{version:1});
 assert.equal(JSON.stringify(legacy),snapshot);
});
