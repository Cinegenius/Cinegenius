import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { publicMapPoint } from './places/public-map-point.ts';
import { hasCoordinates } from './location-map.ts';
import { readMarketplaceBrowseState } from './marketplace-browse.ts';

const catalog = JSON.parse(readFileSync(new URL('./places/catalog.json', import.meta.url)));
const points = JSON.parse(readFileSync(new URL('./places/city-coordinates.json', import.meta.url)));

test('public map coordinates match every existing canonical city ID and country', () => {
  assert.equal(Object.keys(points).length, catalog.cities.length);
  for (const city of catalog.cities) {
    const point = publicMapPoint({ place_status: 'verified', place_city_id: city.id, place_country_code: city.country });
    assert.ok(hasCoordinates(point), city.id);
    assert.equal(points[city.id][0], city.country);
    assert.deepEqual(point, { lat: points[city.id][1], lng: points[city.id][2] });
  }
});

test('unknown, ambiguous and mismatched places never invent a map point', () => {
  const empty = { lat: null, lng: null };
  for (const row of [{}, { place_status: 'pending', place_city_name: 'Berlin' },
    { place_status: 'verified', place_city_id: 'missing', place_country_code: 'DE' },
    { place_status: 'verified', place_city_id: 'geonames:2950159', place_country_code: 'US' },
    { place_status: 'verified', place_city_id: '__proto__', place_country_code: 'DE' },
    { place_status: 'verified', place_country_code: 'DE', place_city_name: 'Berlin' }]) {
    assert.deepEqual(publicMapPoint(row), empty);
  }
});

test('city projection ignores exact private coordinates and never changes the source', () => {
  const row = { place_status: 'verified', place_city_id: 'geonames:2950159', place_country_code: 'DE', lat: 1, lng: 2,
    private_address: 'Synthetic private address', metadata: { location_area: { lat: 3, lng: 4 }, address: 'Private' } };
  const before = structuredClone(row), point = publicMapPoint(row);
  assert.deepEqual(Object.keys(point), ['lat', 'lng']);
  assert.notEqual(point.lat, row.lat); assert.notEqual(point.lng, row.lng);
  assert.deepEqual(row, before);
});

test('marketplace map links preserve the real filter parameters and selected map view', () => {
  assert.deepEqual(readMarketplaceBrowseState(new URLSearchParams('dept=kamera&offer=kauf&q=Sony&view=map')), {
    department: 'kamera', subcategory: '', query: 'Sony', offer: 'kauf', sort: 'featured', view: 'map',
  });
});

test('older public Munich spellings map to the same city without requiring a place migration', () => {
  const expected = { lat: points['geonames:2867714'][1], lng: points['geonames:2867714'][2] };
  for (const location of ['München, Deutschland', 'München, Germany', 'München, DE', 'München, , DE', 'Munich, Bavaria, DE', 'München', 'Munich', 'Mnichov']) {
    const row = { location, place_status: 'pending', place_city_id: null, place_country_code: null };
    const before = structuredClone(row);
    assert.deepEqual(publicMapPoint(row), expected, location);
    assert.deepEqual(row, before, 'an approximate map point never changes the stored identity or verification');
    assert.deepEqual(Object.keys(publicMapPoint(row)), ['lat', 'lng']);
  }
});

test('the same legacy projection serves public crew and marketplace cities in other countries', () => {
  for (const [label, country, id] of [['Berlin, Deutschland', 'DE', 'geonames:2950159'], ['Wien, Österreich', 'AT', 'geonames:2761369'], ['Prague, CZ', 'CZ', 'geonames:3067696'], ['Zürich, Kanton Zürich, CH', 'CH', 'geonames:2657896']]) {
    for (const field of ['location', 'city']) {
      assert.deepEqual(publicMapPoint({ [field]: label, place_status: 'pending', place_country_code: country }), { lat: points[id][1], lng: points[id][2] }, `${field}: ${label}`);
    }
  }
});

test('multiple places, ambiguous names, regions, conflicting fields and addresses stay unmapped', () => {
  const cases = [
    { location: 'München, düsseldorf, dresden, Deutschland' },
    { location: 'München // Konstanz, Deutschland' },
    { location: 'Ashford, England, GB' }, { location: 'London' }, { location: 'Berlin' },
    { location: 'Bayern, Deutschland' }, { location: 'Rhein-Main-Region, Deutschland' },
    { location: 'Münchenstein, DE' }, { location: 'Unknown Village, DE' },
    { location: 'München, Deutschland', place_country_code: 'US' },
    { location: 'München', place_country_code: 'US' },
    { location: 'München', place_country_code: 'made-up' },
    { location: 'München, DE', place_region_id: 'DE:geonames:2950157' },
    { location: 'München, DE', place_region_name: 'Berlin' },
    { location: 'München, DE', place_city_id: 'missing' },
    { location: 'München, DE', place_city_id: 'geonames:2867714', place_status: 'pending' },
    { location: 'München, DE', place_status: 'empty' },
    { location: 'Private street 12, München, DE' },
    { place_city_name: 'München', private_address: 'München, DE', lat: 48, lng: 11 },
  ];
  for (const row of cases) assert.deepEqual(publicMapPoint(row), { lat: null, lng: null }, JSON.stringify(row));
});
