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
