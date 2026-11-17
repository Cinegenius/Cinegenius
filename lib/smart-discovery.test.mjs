import test from 'node:test';
import assert from 'node:assert/strict';
import { discoveryAreas, discoveryResults, discoveryCount, discoveryFacets, emptyDiscoveryFilters, filterDiscoveryGroups, mergeDiscoveryPage, sortDiscoveryGroups } from './smart-discovery.ts';
import { smartMapEntries } from './smart-search-map.ts';

const point={lat:52.52,lng:13.4};
const result=(id,type='profile',extra={})=>({id,type,title:id,subtitle:'',price:0,image:null,available:null,mapPoint:point,...extra});
const group=(area,wishIndex,results,extra={})=>({area,wishIndex,label:area,results,nextOffset:null,...extra});
const crew=group('crew',0,[result('camera','profile',{facets:{departments:['kamera']}}),result('light','profile',{facets:{departments:['licht']}})]);
const boats=group('marketplace',1,[result('boat','vehicle',{facets:{marketplace:'fahrzeuge'}})]);
const catering=group('companies',2,[result('food','company')]);

test('area/wish filters compose identically for map and list, without altering source results',()=>{
 const input=[crew,boats,catering],before=JSON.stringify(input);
 let visible=filterDiscoveryGroups(input,{...emptyDiscoveryFilters(),hiddenAreas:['crew']});
 assert.deepEqual(smartMapEntries(visible).map(v=>v.result.id),['boat','food']);
 visible=filterDiscoveryGroups(input,{...emptyDiscoveryFilters(),hiddenWishes:[1],hiddenAreas:['companies']});
 assert.deepEqual(smartMapEntries(visible).map(v=>v.result.id),['camera','light']);
 assert.equal(JSON.stringify(input),before);
 assert.equal(discoveryCount(filterDiscoveryGroups(input,emptyDiscoveryFilters())),4);
});

test('facets filter only their own area and selected values are OR within that area',()=>{
 const input=[crew,boats,catering];
 const filtered=filterDiscoveryGroups(input,{...emptyDiscoveryFilters(),departments:['licht']});
 assert.deepEqual(filtered.map(g=>g.results.map(r=>r.id)),[['light'],['boat'],['food']]);
 assert.equal(filterDiscoveryGroups(input,{...emptyDiscoveryFilters(),departments:['licht','kamera']})[0].results.length,2);
 assert.equal(filterDiscoveryGroups(input,{...emptyDiscoveryFilters(),marketplace:['kamera']})[1].results.length,0);
 assert.deepEqual(discoveryFacets(input),{departments:['kamera','licht'],marketplace:['fahrzeuge']});
});

test('a full production respects department group membership without recategorizing people',()=>{
 const shared=result('multi','profile',{facets:{departments:['licht','kamera']}});
 const rows=[group('crew',0,[shared],{segment:'kamera'}),group('crew',0,[shared],{segment:'licht'})];
 const visible=filterDiscoveryGroups(rows,{...emptyDiscoveryFilters(),departments:['licht']});
 assert.deepEqual(visible.map(g=>g.segment),['licht']);
 assert.equal(discoveryCount(rows),1);
 assert.equal(smartMapEntries(rows).length,1);
});

test('explicit geographic selection uses only public map positions and preserves unmapped list entries',()=>{
 const hidden=result('unmapped','profile',{mapPoint:null});
 const hamburg=result('hamburg','profile',{mapPoint:{lat:53.55,lng:10}});
 const input=[group('crew',0,[...crew.results,hidden,hamburg])];
 const visible=filterDiscoveryGroups(input,{...emptyDiscoveryFilters(),bounds:{south:52,north:53,west:13,east:14}});
 assert.deepEqual(visible[0].results.map(r=>r.id),['camera','light','unmapped']);
 assert.equal(visible[0].results.at(-1).mapPoint,null);
 assert.equal(filterDiscoveryGroups(input,emptyDiscoveryFilters())[0].results.length,4);
});

test('nearby pages cannot be mixed with refreshed local matches and duplicates do not inflate counts',()=>{
 const first={...boats,nearby:true,nextOffset:180,nearbyCursor:{id:'boat',distanceKm:200}};
 const repeated=mergeDiscoveryPage([first],{...first,results:[first.results[0],result('next','vehicle')],nextOffset:null});
 assert.equal(repeated[0].results.length,2);
 const local=mergeDiscoveryPage(repeated,{...boats,results:[result('local','vehicle')]});
 assert.deepEqual(local[0].results.map(r=>r.id),['local']);
 assert.equal(local[0].nearby,undefined);
});

test('explicit wishes precede recommendations; local groups precede alternatives without reranking members',()=>{
 const plan={version:2,searches:[{recommended:true},{recommended:false},{recommended:false}]};
 const rows=[{...crew,nearby:true},{...boats,results:[result('b','vehicle'),result('a','vehicle')]},{...catering}];
 const sorted=sortDiscoveryGroups(rows,plan);
 assert.deepEqual(sorted.map(g=>g.wishIndex),[1,2,0]);
 assert.deepEqual(sorted[0].results.map(r=>r.id),['b','a']);
});


test('visible areas need actual rows, not requested wishes or unread pagination',()=>{
 const input=[crew,group('locations',3,[],{nextOffset:180}),group('jobs',4,[])];
 assert.deepEqual(discoveryAreas(input),['crew']);
 const filtered=filterDiscoveryGroups(input,{...emptyDiscoveryFilters(),departments:['kostuem']});
 assert.deepEqual(discoveryAreas(filtered),[]);
 assert.equal(filtered.find(g=>g.area==='locations').nextOffset,180,'hidden empty area does not discard its retry/page cursor');
});

test('compact area rows deduplicate overlapping wishes and preserve first result facts and server order',()=>{
 const source=[crew,group('crew',1,[{...crew.results[0],title:'Later match'},result('next')]),group('crew',2,[result('camera','creator')])];
 const rows=discoveryResults(source);
 assert.deepEqual(rows.map(r=>r.type+':'+r.id),['profile:camera','profile:light','profile:next','creator:camera']);
 assert.equal(rows[0].title,'camera');
 assert.deepEqual(rows,smartMapEntries(source).map(entry=>entry.result));
 assert.equal(rows.length,discoveryCount(source));
});
