import test from 'node:test';
import assert from 'node:assert/strict';
import {browsePlaceOptions,matchesPlace,legacyPlaceQuery,canonicalFilterValue} from './places/core.ts';
import {placeReadFields,placeWriteFields,placeFieldsForId} from './places/catalog.ts';
const locales=['de','en','es','it','cs','hu','nl','nl-BE','sv'];
for(const locale of locales)test(`${locale}: pending locations remain selectable without inventing countries or verified identities`,()=>{
 const raw=['München','Berlin','Johanniskirchen','Wien und Umgebung','Europaweit'].map(city=>({city,...placeWriteFields(city)}));
 const verified={city:'Klagenfurt am Wörthersee',...placeFieldsForId('geonames:2774326','Klagenfurt am Wörthersee, AT')};
 const rows=[...raw,verified].map(r=>({...r,...placeReadFields(r.city,r,locale)})),before=JSON.stringify(rows);
 const countries=browsePlaceOptions(rows,'country',locale).map(o=>o.value);
 assert.deepEqual(countries.sort(),['AT','unassigned']);
 const cities=browsePlaceOptions(rows,'city',locale,'unassigned');
 for(const row of raw){assert.ok(cities.some(o=>o.value==='legacy:'+row.city));assert.equal(rows.filter(r=>matchesPlace(r,'city','legacy:'+row.city)).length,1);}
 assert.equal(rows.filter(r=>matchesPlace(r,'country','unassigned')).length,5);
 assert.ok(!browsePlaceOptions(rows,'city',locale,'AT').some(o=>o.value.startsWith('legacy:')));
 assert.equal(canonicalFilterValue('legacy:München',rows,'city'),'legacy:München');
 assert.equal(JSON.stringify(rows),before);
});
test('legacy search aliases match across locales without changing canonical filters or treating symbols as patterns',()=>{
 const row={city:'München',...placeWriteFields('München')};
 assert.equal(matchesPlace(row,'city','legacy:Munich'),true);
 assert.equal(matchesPlace(row,'city','geonames:2867714'),false);
 assert.equal(matchesPlace(row,'city','legacy:'),false);
 assert.equal(legacyPlaceQuery('city','geonames:2867714'),null);
 assert.equal(legacyPlaceQuery('city','legacy:'+'x'.repeat(321)),'id.is.null');
 const expr=legacyPlaceQuery('city','legacy:Own*Place');assert.ok(expr.includes('.eq."Own*Place"'));assert.ok(!expr.includes('.ilike.'));
 const hostile='Own%,"),published.eq.false';
 const query=legacyPlaceQuery('city','legacy:'+hostile);
 assert.ok(query.includes(JSON.stringify(hostile.replace(/[\\%_]/g,'\\$&'))));
 assert.equal(legacyPlaceQuery('country','unassigned'),'place_country_code.is.null,place_country_code.eq.""');
});
