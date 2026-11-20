import test from 'node:test';
import assert from 'node:assert/strict';
import { preserveDiscoveryMapOrder } from './discovery-map-order.ts';

const result = (id, type = 'profile', extra = {}) => ({ id, type, title: id, subtitle: '', price: 0, image: null, available: null, ...extra });
const group = (area, wishIndex, results, extra = {}) => ({ area, wishIndex, label: area, results, nextOffset: null, ...extra });
function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

test('a fresh map keeps the loaded department-focused order and appends new rows in response order', () => {
  const previous = [group('crew', 0, [result('light'), result('camera')])];
  const fresh = [group('crew', 0, [result('camera'), result('new-b'), result('light'), result('new-a')])];
  const ordered = preserveDiscoveryMapOrder(previous, fresh);
  assert.deepEqual(ordered[0].results.map(row => row.id), ['light', 'camera', 'new-b', 'new-a']);
  assert.deepEqual(new Set(ordered[0].results), new Set(fresh[0].results));
});

test('refresh drops revoked rows and uses only fresh field values without mutating either input', () => {
  const previous = freeze([group('crew', 0, [result('revoked'), result('kept', 'profile', {
    title: 'Old name', image: '/old-image', subtitle: 'Old location', mapPoint: { lat: 52.52, lng: 13.4 },
  })], { label: 'Old label', nextOffset: 12 })]);
  const fresh = freeze([group('crew', 0, [result('new'), result('kept', 'profile', {
    title: 'Fresh name', image: null, subtitle: '', mapPoint: null,
  })], { label: 'Fresh label', nextOffset: 180, discoveryCursor: { key: 'a'.repeat(64), id: 'new' } })]);
  const beforePrevious = JSON.stringify(previous), beforeFresh = JSON.stringify(fresh);
  const ordered = preserveDiscoveryMapOrder(previous, fresh);
  assert.deepEqual(ordered[0].results.map(row => row.id), ['kept', 'new']);
  assert.strictEqual(ordered[0].results[0], fresh[0].results[1]);
  assert.deepEqual({ ...ordered[0], results: null }, { ...fresh[0], results: null });
  assert.strictEqual(ordered[0].discoveryCursor, fresh[0].discoveryCursor);
  assert.equal(JSON.stringify(previous), beforePrevious);
  assert.equal(JSON.stringify(fresh), beforeFresh);
});

test('group matching includes area, wish index and segment; result matching includes type', () => {
  const previous = [
    group('crew', 0, [result('b'), result('a')], { segment: 'licht' }),
    group('crew', 1, [result('a'), result('b')], { segment: 'licht' }),
    group('crew', 0, [result('a'), result('b')], { segment: 'kamera' }),
    group('marketplace', 0, [result('b'), result('a')], { segment: 'licht' }),
    group('crew', 2, [result('same', 'profile'), result('same', 'creator')]),
    group('jobs', 4, [result('previous-only')]),
  ];
  const fresh = [
    group('crew', 2, [result('same', 'creator'), result('same', 'profile')]),
    group('crew', 0, [result('a'), result('b')], { segment: 'licht', nextOffset: 24 }),
    group('crew', 1, [result('b'), result('a')], { segment: 'licht' }),
    group('crew', 0, [result('b'), result('a')], { segment: 'kamera' }),
    group('locations', 0, [result('b'), result('a')], { segment: 'licht' }),
  ];
  const ordered = preserveDiscoveryMapOrder(previous, fresh);
  assert.deepEqual(ordered.map(({ area, wishIndex, segment }) => ({ area, wishIndex, segment })), fresh.map(({ area, wishIndex, segment }) => ({ area, wishIndex, segment })));
  assert.deepEqual(ordered.map(item => item.results.map(row => `${row.type}:${row.id}`)), [
    ['profile:same', 'creator:same'], ['profile:b', 'profile:a'], ['profile:a', 'profile:b'], ['profile:a', 'profile:b'], ['profile:b', 'profile:a'],
  ]);
  assert.equal(ordered[1].nextOffset, 24);
});

test('fresh duplicate occurrences are preserved; previous duplicates cannot add rows', () => {
  const previous = [group('crew', 0, [result('a'), result('a'), result('b')])];
  const fresh = [group('crew', 0, [result('new'), result('b'), result('a'), result('b', 'profile', { title: 'Second fresh occurrence' })])];
  const ordered = preserveDiscoveryMapOrder(previous, fresh);
  assert.deepEqual(ordered[0].results.map(row => row.id), ['a', 'b', 'b', 'new']);
  assert.equal(ordered[0].results.length, fresh[0].results.length);
  assert.strictEqual(ordered[0].results[2], fresh[0].results[3]);
  assert.deepEqual(preserveDiscoveryMapOrder(previous, []), []);
});
