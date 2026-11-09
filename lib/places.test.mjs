import test from 'node:test';
import assert from 'node:assert/strict';
import {resolvePlace,placeWriteFields,placeReadFields,cityWriteFields,placeCatalog,placeFieldsForId,cityDistrictName} from './places/catalog.ts';
import {countryCode,countryName,placeOptions,matchesPlace,placeDisplay,placeInputValue} from './places/core.ts';
test('country codes, German and English labels share one canonical country',()=>{
 for(const value of ['DE','Deutschland','Germany','Alemania','Germania','Německo','Németország'])assert.equal(countryCode(value),'DE');
 assert.equal(countryName('DE','de'),'Deutschland');
});
test('Cologne and Koeln share the Cologne identity and German label',()=>{
 for(const value of ['Cologne, DE','Köln, Deutschland','Koeln, Germany'])assert.equal(resolvePlace(value).cityId,'geonames:2886242');
 assert.equal(placeReadFields('Cologne, Germany').place_city_name,'Köln');
 assert.equal(placeReadFields('Köln, DE',undefined,'en').place_city_name,'Cologne');
});
test('Bavaria is a region and never a city filter option',()=>{
 const p=resolvePlace('Bayern, DE');assert.equal(p.cityId,null);assert.equal(p.city,'');assert.equal(p.regionId,'DE:geonames:2951839');
 assert.equal(cityWriteFields('Bayern, DE').city,'');
 assert.equal(placeOptions([placeWriteFields('Bayern, DE')],'city','de').length,0);
 assert.equal(placeInputValue(placeWriteFields('Bayern, DE'),'Bayern, DE'),', Bavaria, DE');
 assert.equal(placeInputValue(placeWriteFields('Germany'),'Germany'),', , DE');
});
test('Frankfurt variants merge; ambiguous bare Frankfurt and missing country remain pending',()=>{
 for(const name of ['Frankfurt a.M.','Frankfurt a. M.','Frankfurt am Main','Frankfurt/Main'])assert.equal(resolvePlace(`${name}, DE`).cityId,'geonames:2925533');
 for(const value of ['Frankfurt, DE','Frankfurt','Berlin','Köln, Bayern, DE','Berlin, Unknown Region, DE'])assert.equal(resolvePlace(value).status,'pending',value);
});
test('unknown international places retain exact original text without generating filter identities',()=>{
 const original='Small village not in catalogue, CH',p=placeWriteFields(original);assert.equal(p.place_original,original);assert.equal(p.place_status,'pending');assert.equal(p.place_city_id,null);assert.equal(p.place_country_code,'CH');
});
test('international suggestions retain country/region identity and all supported locale labels',()=>{
 for(const [value,id] of [['Tokyo, JP','geonames:1850147'],['Wien, AT','geonames:2761369'],['Zürich, CH','geonames:2657896'],['Prague, CZ','geonames:3067696'],['São Paulo, BR','geonames:3448439'],['Budapest, HU','geonames:3054643']])assert.equal(resolvePlace(value,id).status,'verified',value);
 assert.ok(placeCatalog.countries.includes('NZ'));assert.ok(placeCatalog.countries.includes('ZA'));
 for(const locale of ['de','en','es','it','cs','hu'])assert.ok(placeReadFields('Cologne, DE',undefined,locale).place_city_name);
});
test('sort order follows locale, IDs survive label changes, equivalent filters match',()=>{
 const rows=[placeWriteFields('Cologne, DE'),placeWriteFields('Köln, Deutschland'),placeWriteFields('Zürich, CH','geonames:2657896'),placeWriteFields('Berlin, DE','geonames:2950159')];
 const de=placeOptions(rows,'city','de'),en=placeOptions(rows,'city','en');
 assert.equal(de.length,3);assert.deepEqual(new Set(de.map(o=>o.value)),new Set(en.map(o=>o.value)));
 assert.deepEqual(de.map(o=>o.label),de.map(o=>o.label).sort(new Intl.Collator('de',{sensitivity:'base'}).compare));
 assert.equal(matchesPlace(rows[0],'city','geonames:2886242'),true);
 assert.equal(matchesPlace(rows[1],'country','DE'),true);
 assert.equal(placeDisplay(rows[0],'Cologne, DE','de'),'Köln, Deutschland');
});

test('a region-only legacy value never becomes a city, and an explicit reviewer ID cannot cross countries',()=>{
 const region=resolvePlace('Bayern');assert.equal(region.city,'');assert.equal(region.countryCode,'');assert.equal(region.status,'pending');
 assert.equal(placeFieldsForId('geonames:2886242','Köln, DE').place_city_id,'geonames:2886242');
 assert.equal(placeFieldsForId('geonames:2886242','Köln, FR'),null);
 assert.equal(placeFieldsForId('geonames:2886242','Paris, DE'),null);
 assert.equal(placeFieldsForId('geonames:2886242','Köln, Bayern, DE'),null);
});

test('an incomplete catalogue cannot prove that a legacy name has no smaller namesake',()=>{
 for(const value of ['Mühlhausen, DE','Essen, DE','Mühlhausen, Thüringen, DE','Tokyo, JP']) {
  const fields=placeWriteFields(value);assert.equal(fields.place_status,'pending',value);assert.equal(fields.place_city_id,null);assert.equal(fields.place_original,value);
 }
 assert.equal(placeWriteFields('Mühlhausen, Thüringen, DE','geonames:2867996').place_city_id,'geonames:2867996');
});

test('members can explicitly select homonyms within one region and see their district',()=>{
 const first=placeCatalog.cities.find(city=>city.id==='geonames:2656954');
 const second=placeCatalog.cities.find(city=>city.id==='geonames:2656955');
 assert.equal(first.region,second.region);
 assert.notEqual(cityDistrictName(first,'en'),cityDistrictName(second,'en'));
 for(const city of [first,second])assert.equal(placeWriteFields('Ashford, England, GB',city.id).place_city_id,city.id);
 assert.equal(placeWriteFields('Ashford, England, GB').place_status,'pending');
 assert.equal(placeWriteFields('Ashford, England, DE',first.id).place_status,'pending');
});
