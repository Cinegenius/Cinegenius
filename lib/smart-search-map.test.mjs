import test from 'node:test';
import assert from 'node:assert/strict';
import {mapMarkerStyle,smartMapEntries,SMART_MAP_COLORS} from './smart-search-map.ts';
test('Smart map distinguishes areas, deduplicates repeated wishes and retains identical IDs in different types',()=>{
 const person={id:'same',type:'profile',title:'Crew'},boat={id:'same',type:'vehicle',title:'Boat'};
 const entries=smartMapEntries([{area:'crew',results:[person]},{area:'crew',results:[person]},{area:'marketplace',results:[boat]}]);
 assert.equal(entries.length,2);assert.equal(entries[0].area,'crew');assert.equal(entries[1].area,'marketplace');
 assert.equal(SMART_MAP_COLORS.crew,'#c2f135');assert.notEqual(SMART_MAP_COLORS.locations,SMART_MAP_COLORS.marketplace);
 assert.equal(new Set(Object.values(SMART_MAP_COLORS)).size,9);
});
test('marker styles preserve existing directories and mixed cluster colours use only safe constants',()=>{
 assert.equal(mapMarkerStyle([undefined,undefined],true),'');
 assert.equal(mapMarkerStyle([SMART_MAP_COLORS.locations],false),'--map-marker-color:#f3a45e');
 const mixed=mapMarkerStyle([SMART_MAP_COLORS.crew,SMART_MAP_COLORS.locations],true);assert.match(mixed,/conic-gradient/);assert.match(mixed,/#c2f135 0% 50%/);assert.match(mixed,/#f3a45e 50% 100%/);
 const unsafe=mapMarkerStyle(['"><img onerror=alert(1)>'],false);assert.doesNotMatch(unsafe,/[<>"()]|onerror/);assert.equal(unsafe,'--map-marker-color:#c2f135');
});
