import * as mapOrder from './discovery-map-order.ts';
import test from 'node:test';
import * as nativeColors from './native-smart-colors.ts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { setImmediate as tick } from 'node:timers/promises';
import React from 'react';
import ts from 'typescript';
import { translatorFor } from './i18n-test-fixture.mjs';
import * as discovery from './smart-discovery.ts';
import * as unified from './unified-search.ts';
import * as nativeControls from './native-smart-controls.ts';
import * as nativeViewport from './native-smart-viewport.ts';

const require = createRequire(import.meta.url);
const compiled = ts.transpileModule(readFileSync('components/SmartSearchExplorer.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;
const plan = { version: 1, searches: [{ area: 'crew', query: 'crew', department: '', places: [] }] };
const row = (id, mapped = false) => ({ id, type: 'profile', title: id, subtitle: '', price: 0, image: null, available: null, ...(mapped ? { mapPoint: { lat: 52.52, lng: 13.4 } } : {}) });
const page = (results, nextOffset, rankCursor) => ({ area: 'crew', wishIndex: 0, label: 'crew', results, nextOffset, rankCursor });
const initial = page(Array.from({ length: 12 }, (_, i) => row(`person-${i}`)), 12, ['list-cursor']);
const mapped = page(Array.from({ length: 18 }, (_, i) => row(`person-${i}`, true)), 180, ['map-cursor']);
const lateList = page([row('person-0'), row('person-12')], 24, ['older-list-cursor']);
const response = (groups, status = 200) => ({ ok: status === 200, status, json: async () => ({ groups }) });
const same = (a, b) => a?.length === b?.length && a.every((value, index) => Object.is(value, b[index]));
function nodes(value, predicate, out = []) {
  if (Array.isArray(value)) value.forEach(child => nodes(child, predicate, out));
  else if (value?.props) { if (predicate(value)) out.push(value); nodes(value.props.children, predicate, out); }
  return out;
}

function fixture({ honorAbort = true, discoverySeed, initialGroups, initialMapGroups, initialView = 'grid' } = {}) {
  const initialGroup = discoverySeed ? { ...initial, rankCursor: undefined, discoveryCursor: { key: "a".repeat(64), id: "person-11" } } : initial;
  let cursor = 0, dirty = true, tree, denied = 0, timerId = 0, aborts = 0;
  const slots = [], effects = [], timers = new Map(), calls = [];
  let stored = { scope: JSON.stringify(plan), filters: discovery.emptyDiscoveryFilters(), mapOpen: initialView === 'map', view: initialView, limits: { crew: 18 } };
  const effect = (create, deps) => {
    const index = cursor++, prior = slots[index];
    if (!prior || !same(prior.deps, deps)) {
      const slot = { deps, cleanup: prior?.cleanup }; slots[index] = slot;
      effects.push(() => { slot.cleanup?.(); slot.cleanup = create(); });
    }
  };
  const hooks = { ...React,
    useId: () => 'fixture-filters', useEffect: effect, useLayoutEffect: effect,
    useMemo(create, deps) { const index=cursor++;if(!slots[index]||!same(slots[index].deps,deps))slots[index]={deps,value:create()};return slots[index].value; },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useState(initial) {
      const index = cursor++; if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, action => { const next = typeof action === 'function' ? action(slots[index].value) : action; if (!Object.is(next, slots[index].value)) { slots[index].value = next; dirty = true; } }];
    },
    useCallback(callback, deps) { const index = cursor++; if (!slots[index] || !same(slots[index].deps, deps)) slots[index] = { deps, callback }; return slots[index].callback; },
  };
  class Controller extends AbortController {
    abort() { aborts++; if (honorAbort) super.abort(); }
  }
  const mocks = {
    '@/components/ContentTranslation': { ContentTranslationNotice: () => null },
    react: hooks, 'react/jsx-runtime': require('react/jsx-runtime'),
    'next/dynamic': { default: () => 'fixture-map' },
    'next-intl': { useTranslations: namespace => translatorFor('en', namespace) },
    '@/lib/use-native-app-appearance': { useNativeAppAppearance: () => true },
    '@/lib/native-smart-controls': nativeControls,
    './app/NativeSmartAreas': { default: 'fixture-areas' },
    './app/NativeBrowseToolbar': { default: 'fixture-toolbar', NativeBrowseQuickFilter: 'fixture-quick-filter' },
    './app/NativeSmartAreas.module.css': { default: {} },
    './SmartSearchResults.module.css': { default: {} },
    './SmartSearchMapInfo': { default: () => null },
    './BrowseResultCount': { default: 'fixture-count' }, './BrowseSelect': { default: 'fixture-select' },
    './DirectoryViewControls': { default: 'fixture-views' }, './SearchResultCard': { default: 'fixture-card' },
    '@/lib/discovery-map-order': mapOrder, '@/lib/unified-search': unified, '@/lib/smart-search-map': { SMART_MAP_COLORS: {} }, '@/lib/native-smart-colors': nativeColors,
    '@/lib/unified-search-areas': { searchQueryTitle: () => '' }, '@/lib/smart-discovery': discovery,
    '@/lib/native-smart-viewport': nativeViewport,
  };
  const loaded = { exports: {} };
  const fetch = (_url, init) => new Promise((resolve, reject) => { calls.push({ body: JSON.parse(init.body), signal: init.signal, resolve, reject }); });
  const window = { setTimeout(callback) { timers.set(++timerId, callback); return timerId; }, clearTimeout(id) { timers.delete(id); } };
  new Function('require', 'module', 'exports', 'fetch', 'window', 'document', 'AbortController', compiled)(id => {
    const value = Object.hasOwn(mocks, id) ? mocks[id] : require(id);
    return value && 'default' in value ? { __esModule: true, ...value } : value;
  }, loaded, loaded.exports, fetch, window, { addEventListener() {}, removeEventListener() {} }, Controller);
  const render = () => { cursor = 0; dirty = false; tree = loaded.exports.default({ plan, discoverySeed, initialGroups: initialGroups ?? [initialGroup], initialMapGroups, onUnavailable() { denied++; }, stored, setStored(action) { stored = typeof action === 'function' ? action(stored) : action; dirty = true; } }); effects.splice(0).forEach(run => run()); };
  const area = () => nodes(tree, value => value.type?.name === 'ResultArea')[0].props;
  return {
    calls, area, get aborts() { return aborts; }, get denied() { return denied; },
    map: () => nodes(tree, node => node.type === 'fixture-map')[0].props,
    toolbar: () => nodes(tree, node => node.type === 'fixture-toolbar')[0].props,
    mapRows: () => nodes(tree, node => node.type?.name === 'ResultArea' && node.props.autoLoad !== undefined).flatMap(node => discovery.discoveryResults(node.props.groups)),
    unmappedRows: () => nodes(tree, node => node.type?.name === 'ResultArea' && node.props.autoLoad === undefined).flatMap(node => discovery.discoveryResults(node.props.groups)),
    cards() { const element = nodes(tree, node => node.type?.name === 'ResultArea')[0]; return nodes(element.type(element.props), node => node.type === 'fixture-card').map(node => node.props.result); },
    view(value) { const toolbar = nodes(tree, node => node.type === 'fixture-toolbar')[0]; toolbar.props.viewControls.props.onChange(value); },
    more() { area().more(area().groups[0]); },
    async settle() { for (let count = 0; count < 12; count++) { if (dirty) render(); const ready = [...timers.values()]; timers.clear(); ready.forEach(run => run()); await tick(); } assert.equal(dirty, false); },
    dispose() { for (const slot of slots) slot?.cleanup?.(); },
  };
}

for (const honorAbort of [true, false]) test(`list-to-map transition retires old pages and retains map points/cursors when cancellation is ${honorAbort ? 'observed' : 'ignored'}`, async t => {
  const f = fixture({ honorAbort }); t.after(() => f.dispose()); await f.settle();
  assert.equal(f.calls.length, 0, 'initial grid never starts the map request');
  f.more(); await f.settle(); assert.equal(f.calls[0].body.view, 'list'); assert.equal(f.calls[0].body.cursor.offset, 12);
  f.view('map'); await f.settle(); assert.equal(f.aborts, 1, 'map replacement attempts to cancel its prior list page');
  assert.equal(f.calls[1].body.view, 'map'); assert.equal(f.calls[1].body.cursor, undefined);
  f.more(); await f.settle(); assert.equal(f.calls.length, 2, 'page requests wait for the replacing map pool');
  f.calls[1].resolve(response([mapped])); await f.settle();
  f.view('grid'); await f.settle(); f.more(); await f.settle();
  assert.equal(f.calls[2].body.view, 'map', 'a loaded map pool retains its shape during later grid pagination');
  assert.equal(f.calls[2].body.cursor.offset, 180); assert.deepEqual(f.calls[2].body.cursor.rank, ['map-cursor']);
  f.calls[0].resolve(response([lateList])); await f.settle();
  const group = f.area().groups[0];
  assert.equal(group.results.length, 18); assert.ok(group.results.every(result => result.mapPoint));
  assert.equal(group.nextOffset, 180); assert.deepEqual(group.rankCursor, ['map-cursor']);
  assert.ok(f.area().pending.includes(unified.searchGroupKey(group)), 'late old cleanup cannot remove the new same-key page request');
  f.more(); await f.settle(); assert.equal(f.calls.length, 3, 'the new same-key page remains deduplicated');
  f.calls[2].resolve(response([page([row('person-18', true)], null, undefined)])); await f.settle();
  assert.equal(f.area().groups[0].results.length, 19); assert.ok(f.area().groups[0].results.every(result => result.mapPoint));
  assert.equal(f.area().groups[0].nextOffset, null); assert.equal(f.area().pending.length, 0); assert.equal(f.denied, 0);
});

test('native viewport zoom, pan, empty area, zoom-out and map reentry use the unclipped stable pool without requests',async t=>{
 const berlin={...row('berlin',true),mapPoint:{lat:52.52,lng:13.4}},paris={...row('paris',true),mapPoint:{lat:48.85,lng:2.35}},unknown=row('unknown');
 const vienna={...row('vienna',true),type:'location',mapPoint:{lat:48.2,lng:16.37}};
 const source=[page([berlin,paris,unknown],180,['unchanged-crew-cursor']),{...page([vienna],null),area:'locations',wishIndex:1}];
 const before=JSON.stringify(source),f=fixture({initialGroups:source,initialMapGroups:source,initialView:'map'});t.after(()=>f.dispose());await f.settle();
 const pool=f.map().groups;
 assert.deepEqual(f.mapRows().map(row=>row.id),['berlin','paris','vienna']);assert.deepEqual(f.unmappedRows().map(row=>row.id),['unknown']);
 assert.equal(f.toolbar().count,3,'unpositioned rows do not count as viewport matches');
 const show=async bounds=>{f.map().onApplyBounds(bounds);await f.settle();assert.strictEqual(f.map().groups,pool,'pan and zoom retain the entire stable map input');};
 await show({south:52,north:53,west:13,east:14});assert.deepEqual(f.mapRows().map(row=>row.id),['berlin']);assert.equal(f.toolbar().count,1);
 await show({south:48,north:49,west:2,east:3});assert.deepEqual(f.mapRows().map(row=>row.id),['paris'],'panning restores a point outside the preceding viewport');
 await show({south:-10,north:-5,west:-35,east:-25});assert.deepEqual(f.mapRows(),[]);assert.equal(f.toolbar().count,0);assert.deepEqual(f.unmappedRows().map(row=>row.id),['unknown']);
 assert.equal(f.calls.length,0,'an empty viewport never scans result pages automatically');
 await show({south:-85,north:85,west:-180,east:180});assert.deepEqual(f.mapRows().map(row=>row.id),['berlin','paris','vienna'],'zoom-out recovers all positions from the stable pool');
 f.view('list');await f.settle();f.view('map');await f.settle();assert.strictEqual(f.map().groups,pool);assert.equal(f.toolbar().count,3);
 assert.equal(f.calls.length,0);assert.equal(JSON.stringify(source),before,'viewport changes preserve source facts and cursors');
});

for (const failure of ['unauthorized', 'network']) test(`late retired ${failure} failure cannot invalidate a successfully loaded map`, async t => {
  const f = fixture({ honorAbort: false }); t.after(() => f.dispose()); await f.settle();
  f.more(); await f.settle(); f.view('map'); await f.settle();
  f.calls[1].resolve(response([mapped])); await f.settle();
  if (failure === 'unauthorized') f.calls[0].resolve(response([], 401)); else f.calls[0].reject(new Error('delayed transport failure'));
  await f.settle(); assert.equal(f.denied, 0); assert.equal(f.area().errors.length, 0);
  assert.equal(f.area().groups[0].nextOffset, 180); assert.ok(f.area().groups[0].results.every(result => result.mapPoint));
});

test('a list body already decoding before the map transition cannot replace the newer map pool', async t => {
  const f = fixture({ honorAbort: false }); t.after(() => f.dispose()); await f.settle();
  f.more(); await f.settle();
  let finishBody;
  const body = new Promise(resolve => { finishBody = resolve; });
  f.calls[0].resolve({ ok: true, status: 200, json: () => body }); await f.settle();
  f.view('map'); await f.settle(); f.calls[1].resolve(response([mapped])); await f.settle();
  finishBody({ groups: [lateList] }); await f.settle();
  assert.equal(f.area().groups[0].nextOffset, 180);
  assert.equal(f.area().groups[0].results.length, 18);
  assert.ok(f.area().groups[0].results.every(result => result.mapPoint));
});


test('native discovery forwards its stable seed and independent shuffle cursor through actual list and map requests', async t => {
  const seed='0123456789abcdef0123456789abcdef';const f=fixture({discoverySeed:seed});t.after(()=>f.dispose());
  await f.settle();f.more();await f.settle();
  assert.equal(f.calls[0].body.discoverySeed,seed);assert.equal(f.calls[0].body.view,'list');
  assert.deepEqual(f.calls[0].body.cursor.discovery,{key:'a'.repeat(64),id:'person-11'});assert.equal(f.calls[0].body.cursor.rank,undefined);
  f.view('map');await f.settle();assert.equal(f.calls[1].body.discoverySeed,seed);assert.equal(f.calls[1].body.view,'map');assert.equal(f.calls[1].body.cursor,undefined);
});

test('native map refresh keeps focused card order using fresh facts and the response pagination cursor', async t => {
  const seed = '0123456789abcdef0123456789abcdef';
  // This is the initial server page after its soft department focus ordering.
  const focused = { ...page([
    { ...row('light'), facets: { departments: ['licht'] }, title: 'Old light', image: '/old-light', subtitle: 'Old location' },
    { ...row('revoked'), facets: { departments: ['licht'] } },
    { ...row('camera'), facets: { departments: ['kamera'] } },
  ], 12), discoveryCursor: { key: 'a'.repeat(64), id: 'camera' } };
  const f = fixture({ discoverySeed: seed, initialGroups: [focused] }); t.after(() => f.dispose());
  await f.settle(); assert.deepEqual(f.cards().map(card => card.id), ['light', 'revoked', 'camera']);
  const fresh = { ...page([
    { ...row('camera', true), title: 'Fresh camera' },
    row('new-b', true),
    { ...row('light'), title: 'Fresh light', image: null, subtitle: '', mapPoint: null },
    row('new-a', true),
  ], 180), label: 'Fresh crew', discoveryCursor: { key: 'b'.repeat(64), id: 'new-a' } };
  const beforeFocused = JSON.stringify(focused), beforeFresh = JSON.stringify(fresh);
  f.view('map'); await f.settle();
  assert.equal(f.calls[0].body.view, 'map'); assert.equal(f.calls[0].body.cursor, undefined);
  f.calls[0].resolve(response([fresh])); await f.settle();
  // Grid still exposes the full refreshed pool; the map list now deliberately
  // keeps the unpositioned member in its separate accessible disclosure.
  f.view('grid');await f.settle();
  const cards = f.cards(), group = f.area().groups[0];
  assert.deepEqual(cards.map(card => card.id), ['light', 'camera', 'new-b', 'new-a']);
  assert.strictEqual(cards[0], fresh.results[2]); assert.strictEqual(cards[1], fresh.results[0]);
  assert.equal(cards[0].mapPoint, null); assert.equal(cards[0].image, null); assert.equal(cards[0].subtitle, '');
  assert.equal(group.label, fresh.label); assert.equal(group.nextOffset, fresh.nextOffset);
  assert.deepEqual(group.discoveryCursor, fresh.discoveryCursor);
  assert.equal(JSON.stringify(focused), beforeFocused); assert.equal(JSON.stringify(fresh), beforeFresh);
  f.view('grid'); await f.settle();
  assert.deepEqual(f.cards().map(card => card.id), ['light', 'camera', 'new-b', 'new-a']);
  f.more(); await f.settle();
  assert.equal(f.calls[1].body.cursor.offset, 180);
  assert.deepEqual(f.calls[1].body.cursor.discovery, fresh.discoveryCursor);
  assert.equal(f.calls[1].body.cursor.rank, undefined);
  f.calls[1].resolve(response([{ ...page([], null), discoveryCursor: undefined }])); await f.settle();
  assert.deepEqual(f.cards().map(card => card.id), ['light', 'camera', 'new-b', 'new-a']);
  assert.equal(f.denied, 0);
});
