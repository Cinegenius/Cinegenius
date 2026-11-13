import test from 'node:test';
import assert from 'node:assert/strict';
import { collectFacetRows, marketplaceBrowseDepartments } from './browse-facets.ts';
import { DEPARTMENTS } from './marketplaceCategories.ts';
import { placeOptions } from './places/core.ts';

test('facets include a country and category first appearing beyond page 1000', async () => {
  const source = Array.from({length: 1201}, (_, id) => ({id,category:id === 1200?'fahrrad':'oldtimer',type:'vehicle',place_country_code:id===1200?'AT':'DE'}));
  const reads=[];
  const rows=await collectFacetRows(async(from,to)=>{reads.push([from,to]);return {data:source.slice(from,to+1),error:null};});
  assert.equal(rows.length,1201);
  assert.deepEqual(reads,[[0,249],[250,499],[500,749],[750,999],[1000,1249]]);
  assert.deepEqual(new Set(placeOptions(rows,'country','de').map(o=>o.value)),new Set(['AT','DE']));
  assert.ok(marketplaceBrowseDepartments(DEPARTMENTS,rows).some(dept=>dept.id==='fahrzeuge'));
});
test('a failed later page is an error, never a deceptively complete facet list', async()=>{
  await assert.rejects(collectFacetRows(async(from)=>from?{data:null,error:new Error('network')}:{data:[1,2],error:null},2),/browse_facets_unavailable/);
});
test('absent departments and vehicle subcategories never become browse choices; creation catalogue stays complete',()=>{
  const vehicle=DEPARTMENTS.find(dept=>dept.id==='fahrzeuge');
  const productionVehicle=vehicle.groups.find(group=>group.id==='fahrzeuge-produktion');
  assert.ok(productionVehicle,'the creation catalogue contains production vehicles');
  const photo=DEPARTMENTS.find(dept=>dept.id==='kamera').groups[0];
  const choices=marketplaceBrowseDepartments(DEPARTMENTS,[{category:photo.id,type:'prop'}]);
  assert.deepEqual(choices.map(dept=>dept.id),['kamera']);
  assert.deepEqual(choices[0].groups.map(group=>group.id),[photo.id]);
  const withProductionVehicle=marketplaceBrowseDepartments(DEPARTMENTS,[{category:productionVehicle.id,type:'vehicle'}]);
  assert.deepEqual(withProductionVehicle.map(dept=>dept.id),['fahrzeuge']);
  assert.deepEqual(withProductionVehicle[0].groups.map(group=>group.id),[productionVehicle.id]);
  assert.equal(vehicle.groups.includes(productionVehicle),true);
});
test('legacy vehicle listings remain reachable without inventing a subcategory',()=>{
  const choices=marketplaceBrowseDepartments(DEPARTMENTS,[{category:'unclassified legacy vehicle',type:'vehicle'}]);
  assert.deepEqual(choices.map(dept=>dept.id),['fahrzeuge']);
  assert.equal(choices[0].groups.length,0);
});
