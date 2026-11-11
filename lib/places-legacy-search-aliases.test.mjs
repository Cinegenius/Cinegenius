import test from 'node:test';
import assert from 'node:assert/strict';
import {aliasOverrides,placeCitySearchAliases,placeSearchMatches,matchesPlace,placeOptions,canonicalFilterValue} from './places/core.ts';
import {resolvePlace,placeWriteFields,cityWriteFields,placeReadFields,placeFieldsForId} from './places/catalog.ts';

const groups=[
 ['Köln','Cologne','Colonia','Kolín nad Rýnem','Keulen','Koeln'],
 ['Frankfurt am Main','Fráncfort del Meno','Francoforte sul Meno','Frankfurt nad Mohanem','Frankfurt a.M.','Frankfurt a. M.','Frankfurt/Main'],
 ['München','Munich','Múnich','Monaco di Baviera','Mnichov'],
 ['Wien','Vienna','Viena','Vídeň','Bécs','Wenen'],
 ['Prag','Prague','Praga','Praha','Prága','Praag'],
 ['Zürich','Zurich','Zúrich','Zurigo','Curych'],
];
const pending=(label,overrides={})=>({place_country_code:null,place_region_id:null,place_city_id:null,place_city_name:label,place_region_name:'',place_status:'pending',city:label,place_search_terms:[''],...overrides});

test('the actual pending Munich projection matches all known names without inventing country, identity or verification',()=>{
 const row=pending('München'),before=structuredClone(row);
 for(const query of groups[2])assert.equal(placeSearchMatches(row,query),true,query);
 assert.deepEqual(row,before);assert.equal(row.place_country_code,null);assert.equal(row.place_region_id,null);assert.equal(row.place_city_id,null);assert.equal(row.place_status,'pending');
 assert.deepEqual(placeOptions([row],'city','en'),[]);assert.equal(canonicalFilterValue('Munich',[row],'city'),'Munich');
});

test('all six existing international name groups and reviewed spellings are symmetric search equivalents',()=>{
 for(const group of groups)for(const query of group)for(const label of group){
  assert.deepEqual(new Set(placeCitySearchAliases(query)),new Set(group),query);
  assert.equal(placeSearchMatches(Object.freeze(pending(label,{place_search_terms:Object.freeze([''])})),query),true,`${query} → ${label}`);
 }
});

test('unknown or partial queries do not expand into an inferred city group',()=>{
 for(const query of ['',' ','Mun','Muni','Münchenstein','Frankfurt','Ashford','London','Londres','Zuerich','constructor','__proto__','geonames:2867714'])assert.deepEqual(placeCitySearchAliases(query),[],query);
 assert.equal(placeSearchMatches(pending('München'),'Muni'),false);
 assert.equal(placeSearchMatches(pending('Londres'),'London'),false);
 assert.equal(placeSearchMatches(pending('München'),'Mün'),true,'ordinary direct substring search remains unchanged');
});

test('alias expansion cannot turn Munich into Münchenstein or another longer/different label',()=>{
 for(const [query,label] of [['Munich','Münchenstein'],['Vienna','Wiener Neustadt'],['Cologne','Koeln West'],['Prague','Pragburg'],['Curych','Zürichberg'],['Fráncfort del Meno','Frankfurt am Mainz'],['Frankfurt a.M.','Frankfurt (Oder)']])assert.equal(placeSearchMatches(pending(label),query),false,`${query} must not expand into ${label}`);
});

test('query lookup normalizes existing exact aliases but stored unknown spellings remain exact like SQL ILIKE',()=>{
 assert.ok(placeCitySearchAliases('  MÜNCHEN  ').includes('Munich'));
 assert.ok(placeCitySearchAliases('Frankfurt a. M.').includes('Frankfurt am Main'));
 assert.ok(placeCitySearchAliases('Koeln').includes('Cologne'));
 for(const label of ['Munchen',' München ','Mu\u0308nchen','München, DE'])assert.equal(placeSearchMatches(pending(label),'Monaco di Baviera'),false,label);
 assert.equal(placeSearchMatches(pending('MÜNCHEN'),'Monaco di Baviera'),true,'case-insensitive stored label comparison');
 assert.deepEqual(placeCitySearchAliases('München, DE'),[]);
});

test('exact raw city/location labels work but region/country search terms are not reclassified as cities',()=>{
 for(const row of [pending('',{city:'Wien'}),pending('',{city:'',location:'Wien'})]){const before=structuredClone(row);assert.equal(placeSearchMatches(row,'Bécs'),true);assert.deepEqual(row,before);}
 assert.equal(placeSearchMatches(pending('',{place_region_name:'Wien',place_search_terms:['Wien']}),'Bécs'),false);
 const row=pending('Wien',{place_country_code:'US'});assert.equal(placeSearchMatches(row,'Vienna'),true);assert.equal(row.place_country_code,'US');
});

test('country, region and city ID filters remain independent AND requirements',()=>{
 const row=pending('München');assert.equal(placeSearchMatches(row,'Munich'),true);
 for(const [kind,value] of [['country','DE'],['region','DE:geonames:2951839'],['city','geonames:2867714']])assert.equal(matchesPlace(row,kind,value)&&placeSearchMatches(row,'Munich'),false,kind);
 const known=pending('München',{place_country_code:'DE',place_region_id:'DE:geonames:2951839'});
 assert.equal(matchesPlace(known,'country','DE')&&matchesPlace(known,'region','DE:geonames:2951839')&&placeSearchMatches(known,'Munich'),true);
 assert.equal(matchesPlace(known,'country','AT')&&placeSearchMatches(known,'Munich'),false);
});

test('legacy alias fallback never overrides an existing canonical city ID',()=>{
 assert.equal(placeSearchMatches(pending('München',{place_city_id:'geonames:2950159'}),'Monaco di Baviera'),false);
 const known=placeFieldsForId('geonames:2867714','München, DE'),projected=placeReadFields('München, DE',known,'en');
 assert.equal(placeSearchMatches(projected,'Mnichov'),true);assert.equal(projected.place_city_id,'geonames:2867714');
});

test('returned alias arrays are independent copies and cannot mutate future searches',()=>{
 const expected=placeCitySearchAliases('Munich'),changed=placeCitySearchAliases('Munich');
 changed.splice(0,changed.length,'Not a city');assert.deepEqual(placeCitySearchAliases('Munich'),expected);
});

test('reviewed override content and conservative writes remain unchanged',()=>{
 assert.deepEqual(aliasOverrides,{'geonames:2925533':['Frankfurt a.M.','Frankfurt a. M.','Frankfurt/Main','Frankfurt am Main'],'geonames:2886242':['Köln','Cologne','Koeln']});
 for(const raw of ['Munich','München','Vienna','Bécs','Prague','Zürich']){const place=resolvePlace(raw);assert.equal(place.countryCode,'');assert.equal(place.cityId,null);assert.equal(place.regionId,null);assert.equal(place.status,'pending');assert.equal(place.city,raw);}
 for(const raw of ['Munich, DE','Vienna, AT','Prague, CZ','Zurich, CH'])assert.equal(placeWriteFields(raw).place_city_id,null,'search equivalence must not become writer normalization');
 for(const raw of ['Frankfurt a.M., DE','Frankfurt a. M., Deutschland','Frankfurt/Main, Germany'])assert.equal(cityWriteFields(raw).place_city_id,'geonames:2925533');
 for(const raw of ['Cologne, DE','Koeln, Deutschland'])assert.equal(cityWriteFields(raw).place_city_id,'geonames:2886242');
});
