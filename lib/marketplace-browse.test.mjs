import test from 'node:test';
import assert from 'node:assert/strict';
import { marketplaceCategorySelection, readMarketplaceBrowseState, marketplaceCardData } from './marketplace-browse.ts';

test('old category links and independent child links resolve to visible canonical paths', () => {
  assert.deepEqual(marketplaceCategorySelection('Kameraequipment', null), { department: 'kamera', subcategory: '' });
  assert.deepEqual(marketplaceCategorySelection(null, 'licht-signal'), { department: 'licht', subcategory: 'licht-signal' });
  assert.deepEqual(marketplaceCategorySelection('licht', 'kostuem-staender'), { department: 'licht', subcategory: '' });
  assert.deepEqual(marketplaceCategorySelection(null, null), { department: null, subcategory: '' });
  assert.deepEqual(marketplaceCategorySelection('unrecognized-old-value', null), { department: null, subcategory: '' });
});

test('shared URLs retain buying, sort and view instead of silently using defaults', () => {
  const selected = readMarketplaceBrowseState(new URLSearchParams('q=Sony&dept=kamera&sub=kamera-kameras&offer=kauf&sort=price-desc&view=list'));
  assert.deepEqual(selected, { department: 'kamera', subcategory: 'kamera-kameras', query: 'Sony', offer: 'kauf', sort: 'price-desc', view: 'list' });
  const invalid = readMarketplaceBrowseState(new URLSearchParams('dept=missing&offer=unexpected&sort=unknown&view=unknown'));
  assert.equal(invalid.department, null); assert.equal(invalid.offer, 'alle'); assert.equal(invalid.sort, 'featured'); assert.equal(invalid.view, 'grid');
});

test('SSR and public projections retain the same actual price modes, focal point and delivery', () => {
  const marketplace = { mode: 'both', rent_mode: 'negotiable', rent_price: null, sale_mode: 'fixed', sale_price: 500, unit: 'week', fulfilment: ['delivery'] };
  const metadata = { marketplace, rental_type: 'beides', price_on_request: false, price_negotiable: true, condition: 'Gut', focal_point: { x: 32, y: 74 } };
  const base = { id: 'own-example', title: 'Example', type: 'prop', category: 'kamera-kameras', city: 'Berlin', price: 0, image_url: '/api/media/example' };
  const before = structuredClone(metadata);
  const initial = marketplaceCardData({ ...base, metadata });
  const remote = marketplaceCardData({ ...base, ...metadata });
  for (const key of ['rentalType', 'dailyRate', 'focalPoint', 'condition', 'delivery', 'meta']) assert.deepEqual(initial[key], remote[key]);
  assert.deepEqual(metadata, before, 'mapping must not rewrite stored category/metadata');
  assert.equal(remote.rentalType, 'beides'); assert.equal(remote.delivery, true);
});

test('missing metadata never invents a good condition or changes an unknown international offer', () => {
  const result = marketplaceCardData({ id: 'old', title: 'International item', type: 'vehicle', category: 'Original category', city: 'Antwerpen', price: 0, marketplace: null });
  assert.equal(result.condition, ''); assert.equal(result.category, 'Original category'); assert.equal(result.location, 'Antwerpen');
  for (const metadata of [null, true, [], {}, { marketplace: true }, { marketplace: { mode: 'sale' } }]) assert.doesNotThrow(() => marketplaceCardData({ id: 'test', metadata }));
});
