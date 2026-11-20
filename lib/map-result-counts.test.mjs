import test from 'node:test';
import assert from 'node:assert/strict';
import { mapResultCounts } from './location-map.ts';
const europe = { south: 35, north: 72, west: -15, east: 40 };
const point = (lat, lng) => ({ lat, lng });
const rows = [...Array.from({length:33}, () => point(48, 11)), point(20.588, -100.388), ...Array.from({length:29}, () => point(null, null))];

test('63 public results remain 63 while the map shows 33 in Europe, 1 outside and 29 without a point', () => {
  const before = structuredClone(rows);
  assert.deepEqual(mapResultCounts(rows, europe), {total:63,mapped:34,visible:33,outside:1,unmapped:29});
  assert.deepEqual(rows,before);
});
test('moving to Mexico changes only viewport counts, not the overall result set', () => {
  assert.deepEqual(mapResultCounts(rows, {south:10,north:30,west:-120,east:-80}),{total:63,mapped:34,visible:1,outside:33,unmapped:29});
});
test('reset includes all mapped results but never counts unlocated entries as markers', () => {
  assert.deepEqual(mapResultCounts(rows, null),{total:63,mapped:34,visible:34,outside:0,unmapped:29});
});
test('applies to the supplied filtered and privacy-projected set, does not resurrect hidden entries', () => {
  assert.deepEqual(mapResultCounts(rows.slice(32,36), europe),{total:4,mapped:2,visible:1,outside:1,unmapped:2});
});
test('no results and no coordinates are distinct; invalid points never count outside', () => {
  assert.deepEqual(mapResultCounts([], europe),{total:0,mapped:0,visible:0,outside:0,unmapped:0});
  const invalid=[{},point(null,1),point(NaN,1),point(91,1),point(1,Infinity),point(1,181)];
  assert.deepEqual(mapResultCounts(invalid,europe),{total:6,mapped:0,visible:0,outside:0,unmapped:6});
});
test('date-line crossing, repeated world view and viewport boundary points remain consistent', () => {
  const points=[point(0,175),point(0,-175),point(0,0),point(null,null)];
  assert.deepEqual(mapResultCounts(points,{south:-10,north:10,west:170,east:190}),{total:4,mapped:3,visible:2,outside:1,unmapped:1});
  assert.equal(mapResultCounts(points,{south:-90,north:90,west:-540,east:540}).visible,3);
  assert.equal(mapResultCounts([point(35,-15),point(72,40)],europe).visible,2);
});
