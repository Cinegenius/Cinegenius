import test from 'node:test';
import assert from 'node:assert/strict';
import { nativeSmartViewportGroups } from './native-smart-viewport.ts';
import { discoveryCount, emptyDiscoveryFilters, filterDiscoveryGroups } from './smart-discovery.ts';
import { smartMapEntries } from './smart-search-map.ts';
import { hasCoordinates, inMapBounds } from './location-map.ts';

const row=(id,mapPoint,departments=['licht'])=>({id,type:'profile',title:id,subtitle:'',price:0,image:null,available:null,mapPoint,facets:{departments}});
const group=results=>({area:'crew',wishIndex:0,label:'Crew',results,nextOffset:180,rankCursor:['protected-existing-cursor']});
test('native viewport partitions only public valid positions, retains duplicates for shared deduplication and never mutates sources or cursors',()=>{
 const inside=row('inside',{lat:0,lng:0}),outside=row('outside',{lat:50,lng:10}),missing=row('missing',null),invalid=row('invalid',{lat:999,lng:10});
 const source=[group([inside,outside,missing,invalid]),{...group([inside]),wishIndex:1}],before=JSON.stringify(source);
 const partition=nativeSmartViewportGroups(source,{south:-1,north:1,west:-1,east:1});
 assert.equal(discoveryCount(partition.visible),1);assert.equal(discoveryCount(partition.unmapped),2);
 assert.strictEqual(partition.visible[0].results[0],inside);assert.strictEqual(partition.unmapped[0].results[0],missing);
 for(const set of [partition.visible,partition.unmapped]){assert.equal(set[0].nextOffset,180);assert.strictEqual(set[0].rankCursor,source[0].rankCursor)}
 assert.equal(JSON.stringify(source),before);assert.equal(discoveryCount(nativeSmartViewportGroups(source,null).visible),2);
});
test('zooming out from zero results restores points and source/category filters remain authoritative',()=>{
 const source=[group([row('light',{lat:52,lng:13}),row('camera',{lat:48,lng:2},['kamera']),row('private-position-missing',undefined)])];
 const pool=filterDiscoveryGroups(source,{...emptyDiscoveryFilters(),departments:['licht']});
 const empty=nativeSmartViewportGroups(pool,{south:-10,north:-1,west:1,east:10});assert.equal(discoveryCount(empty.visible),0);assert.equal(discoveryCount(empty.unmapped),1);
 const broad=nativeSmartViewportGroups(pool,{south:-85,north:85,west:-180,east:180});assert.deepEqual(broad.visible[0].results.map(row=>row.id),['light']);
 assert.equal(broad.visible[0].nextOffset,180,'zero matches never consume or replace the server cursor');
});
test('native viewport keeps the date-line behavior and preserves unpositioned entries separately',()=>{
 const source=[group([row('east',{lat:0,lng:175}),row('west',{lat:0,lng:-175}),row('middle',{lat:0,lng:0}),row('unknown',null)])];
 const found=nativeSmartViewportGroups(source,{south:-10,north:10,west:170,east:190});
 assert.deepEqual(found.visible[0].results.map(row=>row.id),['east','west']);assert.deepEqual(found.unmapped[0].results.map(row=>row.id),['unknown']);
});
test('conflicting duplicate wishes partition by the same first canonical position as map markers',()=>{
 const bounds={south:52,north:53,west:13,east:14},inside={lat:52.52,lng:13.4},outside={lat:48.85,lng:2.35};
 for(const [first,later] of [[outside,inside],[inside,outside],[null,inside],[inside,null],[{lat:999,lng:13},inside]]){
  const firstRow=row('shared',first),laterRow={...row('shared',later),title:'Later source facts'};
  const source=[group([firstRow]),{...group([laterRow]),wishIndex:1}],before=JSON.stringify(source);
  const parts=nativeSmartViewportGroups(source,bounds);
  const markerCount=smartMapEntries(source).filter(({result})=>result.mapPoint&&hasCoordinates(result.mapPoint)&&inMapBounds(result.mapPoint,bounds)).length;
  assert.equal(discoveryCount(parts.visible),markerCount,'list and markers use the same canonical identity position');
  assert.equal(discoveryCount(parts.unmapped),first&&hasCoordinates(first)?0:1,'later coordinates cannot turn an unknown canonical location into a pin');
  const retained=parts.visible[1].results[0]??parts.unmapped[1].results[0];
  if(retained)assert.strictEqual(retained,laterRow,'classification never rewrites original result facts');
  assert.equal(JSON.stringify(source),before);assert.equal(parts.visible[0].nextOffset,180);
 }
});
