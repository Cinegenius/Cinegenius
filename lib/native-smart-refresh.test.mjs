import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { setImmediate as tick } from 'node:timers/promises';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { translatorFor } from './i18n-test-fixture.mjs';
import * as discovery from './native-smart-discovery.ts';
import * as seed from './discovery-seed.ts';
import { emptyDiscoveryFilters } from './smart-discovery.ts';
import * as browseControls from './browse-filter-controls.ts';
import * as smartView from './native-smart-controls.ts';
import * as discoveryRequest from './native-smart-discovery-request.ts';

const require = createRequire(import.meta.url);
const compiled = ts.transpileModule(readFileSync(process.env.CINEGENIUS_SMART_RESUME_SOURCE ?? 'components/app/NativeSmartLanding.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;
const stableSeed = '0123456789abcdef0123456789abcdef';
const same = (a, b) => a?.length === b?.length && a.every((value, index) => Object.is(value, b[index]));
function nodes(value, predicate, out = []) {
  if (Array.isArray(value)) value.forEach(child => nodes(child, predicate, out));
  else if (value?.props) { if (predicate(value)) out.push(value); nodes(value.props.children, predicate, out); }
  return out;
}
function response(ids, { accountId = 'own-test', status = 200, expectedSeed = stableSeed } = {}) {
  const plan = discovery.nativeDiscoveryPlan();
  return { ok: status === 200, status, json: async () => ({
    contract: discovery.NATIVE_DISCOVERY_CONTRACT, accountId, serverNow: '2026-11-22T12:00:00Z', seed: expectedSeed,
    focus: { mode: 'profile', departments: [], city: null }, plan,
    groups: plan.searches.map((wish, wishIndex) => ({ area: wish.area, wishIndex, label: wish.query, nextOffset: null,
      results: wishIndex === 0 ? ids.map(id => ({ id, type: 'profile', title: id, subtitle: '', price: 0, image: null, available: null })) : [] })),
  }) };
}

/** Exercise the real component's effects with delayed responses and no network. */
function fixture({ honorAbort = true } = {}) {
  let cursor = 0, dirty = true, tree, timerId = 0, now = 1000, denied = 0, locale = 'en';
  let frameHeight = 2400, frameConnected = true;
  let props = { accountId: 'own-test', sessionId: 'session-a', loaded: true, allowed: true, authenticated: true, onUnavailable() { denied++; } };
  const slots = [], effects = [], timers = new Map(), fields = new Map(), calls = [];
  const listeners = () => {
    const events = new Map();
    return {
      addEventListener(name, callback) { if (!events.has(name)) events.set(name, new Set()); events.get(name).add(callback); },
      removeEventListener(name, callback) { events.get(name)?.delete(callback); },
      dispatch(name) { for (const callback of [...events.get(name) ?? []]) callback(); },
    };
  };
  const window = { ...listeners(), setTimeout(callback) { timers.set(++timerId, callback); return timerId; }, clearTimeout(id) { timers.delete(id); } };
  const document = { ...listeners(), visibilityState: 'visible' };
  const effect = (create, deps) => {
    const index = cursor++, prior = slots[index];
    if (!prior || !same(prior.deps, deps)) {
      const slot = { deps, cleanup: prior?.cleanup }; slots[index] = slot;
      effects.push(() => { slot.cleanup?.(); slot.cleanup = create(); });
    }
  };
  const hooks = { ...React, useEffect: effect, useLayoutEffect: effect,
    useState(initial) {
      const index = cursor++; if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, action => { const next = typeof action === 'function' ? action(slots[index].value) : action; if (!Object.is(next, slots[index].value)) { slots[index].value = next; dirty = true; } }];
    },
    useMemo(create,deps){const index=cursor++;if(!slots[index]||!same(slots[index].deps,deps))slots[index]={deps,value:create()};return slots[index].value;},
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useCallback(callback, deps) { const index = cursor++; if (!slots[index] || !same(slots[index].deps, deps)) slots[index] = { deps, callback }; return slots[index].callback; },
  };
  class Controller extends AbortController { abort() { if (honorAbort) super.abort(); } }
  class Clock extends Date { static now() { return now; } }
  const mocks = {
    react: hooks, 'react/jsx-runtime': require('react/jsx-runtime'),
    '@clerk/nextjs': { useAuth: () => assert.fail('The session wrapper is covered by native-smart-landing.test.mjs'), useSession: () => assert.fail('No real session access') },
    'next-intl': { useLocale: () => locale, useTranslations: namespace => translatorFor(locale, namespace) },
    '@/components/DirectoryPage': { default: 'fixture-directory' },
    '@/components/ContentTranslation':{ContentTranslationNotice:()=>null},
    '@/components/SmartSearchPreview': { default: 'fixture-preview' },
    '@/components/SmartSearchExplorer': { default: 'fixture-explorer' },
    '@/lib/use-native-segment-drag': { useNativeSegmentDrag: () => ({}) },
    './NativeCreateMenu': { default: 'fixture-create' },
    '@/lib/smart-discovery': { emptyDiscoveryFilters },
    '@/lib/browse-filter-controls':browseControls, '@/lib/native-smart-controls':smartView, '@/lib/native-smart-discovery-request':discoveryRequest,
    '@/lib/use-view-state': { useViewState(key, initial) {
      const state = hooks.useState(key === 'native.smart.seed' ? stableSeed : initial); fields.set(key, state); return state;
    } },
    '@/lib/use-form-router': { useFormRouter: () => ({ push: () => assert.fail('No refresh may navigate') }) },
    '@/lib/native-smart-discovery': discovery, '@/lib/discovery-seed': seed,
    './NativeSmartLanding.module.css': { default: new Proxy({}, { get: (_target, key) => String(key) }) },
  };
  const loaded = { exports: {} };
  const fetch = (url, init) => new Promise((resolve, reject) => calls.push({ url, init, resolve, reject }));
  new Function('require', 'module', 'exports', 'fetch', 'window', 'document', 'AbortController', 'Date', compiled + '\nmodule.exports.accountLanding = AccountNativeSmartLanding;')(
    id => { const value = mocks[id] ?? require(id); return value && 'default' in value ? { __esModule: true, ...value } : value; },
    loaded, loaded.exports, fetch, window, document, Controller, Clock,
  );
  const render = () => {
    for (let count = 0; dirty && count < 8; count++) { cursor = 0; dirty = false; tree = loaded.exports.accountLanding(props); }
    assert.equal(dirty, false, 'Render-time invalidation must settle');
    const frame = nodes(tree, node => node.props['data-native-smart-result-frame'] === 'v1')[0];
    if (frame?.props.ref) frame.props.ref.current = {
      get isConnected() { return frameConnected; },
      getAttribute: name => frame.props[name] ?? null,
      getBoundingClientRect: () => ({ height: frameHeight }),
    };
    effects.splice(0).forEach(run => run());
  };
  const explorer = () => nodes(tree, node => node.type === 'fixture-explorer')[0];
  return {
    calls, explorer, get denied() { return denied; },
    rows: () => explorer()?.props.initialGroups.flatMap(group => group.results.map(row => row.id)) ?? [],
    statuses: () => nodes(tree, node => node.props.role === 'status'),
    alerts: () => nodes(tree, node => node.props.role === 'alert'),
    placeholder: () => nodes(tree, node => node.props['data-native-smart-placeholder'] === 'v1')[0],
    ready: () => nodes(tree, node => Object.hasOwn(node.props, 'data-native-smart-landing'))[0]?.props['data-native-route-ready'],
    measure(height, connected = true) { frameHeight = height; frameConnected = connected; },
    refresh(name = 'focus') { now += 1000; (name === 'visibilitychange' ? document : window).dispatch(name); },
    suspend(name = 'blur') { window.dispatch(name); },
    update(next) { props = { ...props, ...next }; dirty = true; render(); },
    field(key, next) { fields.get(key)[1](next); render(); },
    locale(next) { locale = next; dirty = true; render(); },
    async settle() {
      for (let count = 0; count < 8; count++) {
        if (dirty) render();
        const ready = [...timers.values()]; timers.clear(); ready.forEach(run => run()); await tick();
      }
      assert.equal(dirty, false);
    },
    dispose() { for (const slot of slots) slot?.cleanup?.(); timers.clear(); },
  };
}

test('a delayed foreground refresh keeps the mounted, authorized rows until fresh rows replace them together', async t => {
  const f = fixture(); t.after(() => f.dispose()); await f.settle();
  assert.equal(f.calls.length, 1);
  f.calls[0].resolve(response(['retained', 'now-revoked'])); await f.settle();
  const original = f.explorer();
  assert.deepEqual(f.rows(), ['retained', 'now-revoked']);
  f.refresh(); await f.settle();
  assert.equal(f.calls.length, 2); assert.deepEqual(f.rows(), ['retained', 'now-revoked']);
  assert.equal(f.explorer().key, original.key, 'The existing explorer remains mounted while the API is pending');
  assert.equal(f.statuses().length, 1); assert.ok(f.statuses()[0].props.children);
  assert.equal(f.calls[1].init.cache, 'no-store'); assert.equal(f.calls[1].init.credentials, 'same-origin');
  assert.equal(f.calls[1].init.headers['X-Native-Account'], 'own-test');
  f.refresh('cinegenius:app-resume'); await f.settle(); f.refresh('pageshow'); await f.settle();
  assert.equal(f.calls.length, 2, 'Separated foreground signals share the same still-running permission check');
  assert.equal(f.explorer().key, original.key);
  f.calls[1].resolve(response(['retained', 'fresh'])); await f.settle();
  assert.deepEqual(f.rows(), ['retained', 'fresh']);
  assert.notEqual(f.explorer().key, original.key, 'A fresh response remounts the explorer, which reads its initial rows only at mount');
  assert.equal(f.statuses()[0].props.children, false);
});

test('access/account failures during refresh clear retained results instead of treating them as a temporary network error', async t => {
  for (const status of [401, 403, 409]) {
    const f = fixture(); t.after(() => f.dispose()); await f.settle();
    f.calls[0].resolve(response(['private-row'])); await f.settle();
    f.refresh('visibilitychange'); await f.settle(); assert.deepEqual(f.rows(), ['private-row']);
    f.calls[1].resolve(response([], { status })); await f.settle();
    assert.equal(f.denied, 1); assert.deepEqual(f.rows(), []); assert.equal(f.statuses()[0].props.children, false);
  }
});

test('account, session, permission, focus, seed and locale changes invalidate prior rows before a replacement response', async t => {
  for (const change of [
    f => f.update({ accountId: 'other-account' }), f => f.update({ sessionId: 'session-b' }),
    f => f.update({ allowed: false }), f => f.update({ authenticated: false }), f => f.update({ loaded: false }),
    f => f.field('native.smart.focus', 'neutral'), f => f.field('native.smart.seed', 'a'.repeat(32)), f => f.locale('de'),
  ]) {
    const f = fixture(); t.after(() => f.dispose()); await f.settle();
    f.calls[0].resolve(response(['private-row'])); await f.settle();
    change(f); assert.deepEqual(f.rows(), []);
  }
  const f = fixture(); t.after(() => f.dispose()); await f.settle();
  f.calls[0].resolve(response(['previously-authorized'])); await f.settle();
  f.update({ allowed: false }); f.update({ allowed: true });
  assert.deepEqual(f.rows(), [], 'Restoring the same scope never resurrects an earlier authorization snapshot');
});

for (const honorAbort of [true, false]) test(`pre-suspension responses cannot replace a new visit when abort is ${honorAbort ? 'observed' : 'ignored'}`, async t => {
  const f = fixture({ honorAbort }); t.after(() => f.dispose()); await f.settle();
  f.calls[0].resolve(response(['initial'])); await f.settle();
  f.refresh(); await f.settle(); f.suspend(); await f.settle(); assert.deepEqual(f.rows(), []);
  f.refresh(); await f.settle(); assert.equal(f.calls.length, 3);
  f.calls[2].resolve(response(['latest'])); await f.settle();
  const freshKey = f.explorer().key;
  f.calls[1].resolve(response(['stale'])); await f.settle();
  assert.deepEqual(f.rows(), ['latest']); assert.equal(f.explorer().key, freshKey);
});

test('a temporary refresh failure leaves current rows visible with a retry, while explorer access denial cancels pending refresh', async t => {
  const f = fixture(); t.after(() => f.dispose()); await f.settle();
  f.calls[0].resolve(response(['retained'])); await f.settle();
  const originalKey = f.explorer().key;
  f.refresh(); await f.settle(); f.calls[1].resolve(response([], { status: 503 })); await f.settle();
  assert.deepEqual(f.rows(), ['retained']); assert.equal(f.explorer().key, originalKey); assert.equal(f.alerts().length, 1);
  f.refresh(); await f.settle(); f.explorer().props.onUnavailable(); await f.settle();
  assert.deepEqual(f.rows(), []); assert.equal(f.denied, 1);
  f.calls[2].resolve(response(['late'])); await f.settle(); assert.deepEqual(f.rows(), []);
});

test('a session change while a refresh body is decoding cannot restore the old session rows', async t => {
  const f = fixture(); t.after(() => f.dispose()); await f.settle();
  f.calls[0].resolve(response(['old-session'])); await f.settle();
  f.refresh(); await f.settle();
  const body = Promise.withResolvers(), delayed = response(['late-old-session']);
  f.calls[1].resolve({ ...delayed, json: () => body.promise }); await f.settle();
  assert.deepEqual(f.rows(), ['old-session'], 'The existing same-session view survives the delayed decode');
  f.update({ sessionId: 'session-b' }); assert.deepEqual(f.rows(), []);
  body.resolve(await delayed.json()); await f.settle(); assert.deepEqual(f.rows(), []);
});

test('numeric reservation keeps the old result height after suspension without retaining private output', async t => {
  const f = fixture(); t.after(() => f.dispose()); await f.settle();
  f.calls[0].resolve(response(['PRIVATE_PERSON_AND_PROFILE_ID'])); await f.settle();
  f.measure(4800.25); f.suspend(); await f.settle();
  assert.ok(f.placeholder(), 'Suspension must reserve anonymous geometry while private rows are absent');
  assert.deepEqual(f.rows(), []); assert.equal(f.placeholder().props.style.height, 4801); assert.equal(f.ready(), undefined);
  const placeholder = renderToStaticMarkup(f.placeholder());
  assert.match(placeholder, /height:4801px/); assert.match(placeholder, /aria-hidden="true"/);
  assert.doesNotMatch(placeholder, /PRIVATE_PERSON|own-test|session-a|<img|<a\b|<button/);
  f.suspend('cinegenius:native-workspace-presented'); await f.settle();
  assert.equal(f.placeholder().props.style.height, 4801, 'A duplicate suspension keeps only the same anonymous reservation');
  f.refresh(); await f.settle(); assert.equal(f.placeholder().props.style.height, 4801); assert.equal(f.ready(), undefined);
  f.calls[1].resolve(response(['fresh-authorized'])); await f.settle();
  assert.equal(f.placeholder(), undefined); assert.deepEqual(f.rows(), ['fresh-authorized']); assert.equal(f.ready(), 'v1');
});

test('placeholder height is discarded on semantic changes, denial and a settled refresh error', async t => {
  for (const change of [
    f => f.update({ accountId: 'other-account' }), f => f.update({ sessionId: 'session-b' }),
    f => f.update({ allowed: false }), f => f.update({ authenticated: false }), f => f.update({ loaded: false }),
    f => f.field('native.smart.focus', 'neutral'), f => f.field('native.smart.seed', 'a'.repeat(32)), f => f.locale('de'),
    f => f.field('smart.controls', controls => ({ ...controls, filters: { ...controls.filters, departments: ['licht'] } })),
    f => f.field('smart.controls', controls => ({ ...controls, view: 'list' })),
  ]) {
    const f = fixture(); t.after(() => f.dispose()); await f.settle();
    f.calls[0].resolve(response(['private-row'])); await f.settle(); f.suspend(); await f.settle();
    assert.ok(f.placeholder()); change(f); assert.equal(f.placeholder(), undefined); assert.deepEqual(f.rows(), []);
  }
  for (const status of [401, 403, 409, 503]) {
    const f = fixture(); t.after(() => f.dispose()); await f.settle();
    f.calls[0].resolve(response(['private-row'])); await f.settle(); f.suspend(); await f.settle();
    f.refresh(); await f.settle(); assert.ok(f.placeholder());
    f.calls[1].resolve(response([], { status })); await f.settle();
    assert.equal(f.placeholder(), undefined); assert.deepEqual(f.rows(), []);
    if (status !== 503) { assert.equal(f.denied, 1); f.update({ allowed: false }); }
    assert.equal(f.ready(), 'v1', 'Only the resolved public fallback or completed error is ready without fresh rows');
  }
});

test('height capture accepts only a connected current result and a finite positive bounded number', async t => {
  for (const [height, connected, expected] of [[NaN, true, 0], [Infinity, true, 0], [-20, true, 0], [0, true, 0], [2000, false, 0], [1000000, true, 100000]]) {
    const f = fixture(); t.after(() => f.dispose()); await f.settle();
    f.calls[0].resolve(response(['private-row'])); await f.settle(); f.measure(height, connected); f.suspend(); await f.settle();
    assert.equal(f.placeholder()?.props.style.height ?? 0, expected); assert.deepEqual(f.rows(), []);
  }
});

test('route readiness is absent for pending authentication/results and present for fresh data or a resolved public fallback', async t => {
  const f = fixture(); t.after(() => f.dispose()); await f.settle(); assert.equal(f.ready(), undefined);
  f.calls[0].resolve(response(['authorized'])); await f.settle(); assert.equal(f.ready(), 'v1');
  f.refresh(); await f.settle(); assert.equal(f.ready(), 'v1', 'Same-foreground verified rows stay available during revalidation');
  f.suspend(); await f.settle(); assert.equal(f.ready(), undefined);
  f.update({ loaded: false }); assert.equal(f.ready(), undefined);
  f.update({ loaded: true, allowed: false }); assert.equal(f.ready(), 'v1');
});
