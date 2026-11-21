import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { translatorFor } from './i18n-test-fixture.mjs';
import { SUPPORTED_LOCALES } from './i18n/locales.ts';
import { NATIVE_APP_BACKGROUNDS, nativeAppBackgroundSnapshot, subscribeNativeAppBackground, selectNativeAppBackground, useNativeAppBackground } from './native-app-theme.ts';

const require = createRequire(import.meta.url);
function globals(t, values) {
  const previous = new Map(Object.keys(values).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(values)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  t.after(() => { for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } });
}
function documentFixture(t, extra = {}) {
  const attributes = { 'data-cg-native-community-appearance': 'app', 'data-cg-native-background-ready': 'v1', ...extra }, writes = [];
  const root = { getAttribute: key => attributes[key] ?? null, setAttribute: (key, value) => { writes.push([key, value]); attributes[key] = value; } };
  const forbidden = () => assert.fail('Background presentation must not read/write browser storage, cookies, accounts or a provider');
  const document = { documentElement: root }; Object.defineProperty(document, 'cookie', { get: forbidden, set: forbidden });
  globals(t, { document, fetch: forbidden, localStorage: new Proxy({}, { get: forbidden }), sessionStorage: new Proxy({}, { get: forbidden }) });
  return { root, attributes, writes };
}

test('SSR and absent background retain the installed default without initializing or persisting a color', t => {
  globals(t, { document: undefined });
  assert.equal(nativeAppBackgroundSnapshot(), null);
  assert.equal(selectNativeAppBackground('graphite'), false);
  assert.doesNotThrow(() => subscribeNativeAppBackground(() => {})());
  function Probe() { return React.createElement('span', null, String(useNativeAppBackground())); }
  assert.equal(renderToStaticMarkup(React.createElement(Probe)), '<span>null</span>');
  const f = documentFixture(t);
  assert.equal(nativeAppBackgroundSnapshot(), null); assert.deepEqual(f.writes, []);
});

test('only the seven exact approved IDs change the capable native presentation; theme and storage remain untouched', t => {
  const f = documentFixture(t, { 'data-cg-app-theme': 'pure' });
  assert.deepEqual(NATIVE_APP_BACKGROUNDS, ['graphite', 'midnight', 'sage', 'rose', 'sand', 'terracotta', 'black']);
  for (const value of NATIVE_APP_BACKGROUNDS) { assert.equal(selectNativeAppBackground(value), true); assert.equal(nativeAppBackgroundSnapshot(), value); }
  for (const invalid of ['mauve', 'BLACK', 'black ', '', 'url(secret)', null, undefined, {}, 1]) assert.equal(selectNativeAppBackground(invalid), false);
  assert.equal(f.attributes['data-cg-app-theme'], 'pure');
  assert.equal(f.writes.length, 7); assert.ok(f.writes.every(([key]) => key === 'data-cg-app-background'));
  for (const value of [null, 'APP', 'app ', 'true']) { f.attributes['data-cg-native-community-appearance'] = value; assert.equal(selectNativeAppBackground('rose'), false); assert.equal(nativeAppBackgroundSnapshot(), null); }
  f.attributes['data-cg-native-community-appearance'] = 'app';
  for (const value of [null, 'true', 'v2', 'v1 ']) { f.attributes['data-cg-native-background-ready'] = value; assert.equal(selectNativeAppBackground('sand'), false); assert.equal(nativeAppBackgroundSnapshot(), null); }
  assert.equal(f.writes.length, 7);
});

test('background observer tracks current capable presentation, deduplicates mutations and disconnects', t => {
  const f = documentFixture(t); let callback, observed, options, changes = 0, disconnected = 0;
  globals(t, { MutationObserver: class { constructor(fn) { callback = fn; } observe(node, config) { observed = node; options = config; } disconnect() { disconnected++; } } });
  const stop = subscribeNativeAppBackground(() => changes++);
  assert.equal(observed, f.root); assert.deepEqual(options.attributeFilter, ['data-cg-app-background', 'data-cg-native-background-ready', 'data-cg-native-community-appearance']);
  callback(); assert.equal(changes, 0);
  f.attributes['data-cg-app-background'] = 'midnight'; callback(); callback(); assert.equal(changes, 1);
  f.attributes['data-cg-native-background-ready'] = null; callback(); assert.equal(changes, 2);
  f.attributes['data-cg-app-background'] = 'rose'; callback(); assert.equal(changes, 2);
  f.attributes['data-cg-native-background-ready'] = 'v1'; callback(); assert.equal(changes, 3);
  stop(); assert.equal(disconnected, 1);
});

function nodes(tree, predicate, out = []) { if (Array.isArray(tree)) tree.forEach(child => nodes(child, predicate, out)); else if (tree?.props) { if (predicate(tree)) out.push(tree); nodes(tree.props.children, predicate, out); } return out; }
function fixture({ locale = 'de', native = true, ready = true, selected = null } = {}) {
  const choices = [], mod = { exports: {} };
  const source = ts.transpileModule(readFileSync(new URL('../components/app/NativeAppBackgroundPicker.tsx', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const mocks = {
    react: { ...React, useId: () => 'fixture-background' },
    'next-intl': { useTranslations: namespace => translatorFor(locale, namespace) },
    '@/lib/native-app-theme': { NATIVE_APP_BACKGROUNDS, useNativeAppBackground: () => selected, selectNativeAppBackground: value => choices.push(value) },
    '@/lib/use-native-capability': { useNativeCapability: capability => { assert.equal(capability, 'background-picker'); return ready; } },
    '@/lib/use-native-app-appearance': { useNativeAppAppearance: () => native },
    './NativeAppBackgroundPicker.module.css': { default: new Proxy({}, { get: (_target, name) => String(name) }), __esModule: true },
  };
  new Function('require', 'module', 'exports', source)(name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), mod, mod.exports);
  return { tree: mod.exports.default(), choices };
}

for (const locale of SUPPORTED_LOCALES) test(`${locale}: seven named colors have current selection and preserve keyboard and pointer choices`, () => {
  const f = fixture({ locale, selected: 'sand' }), buttons = nodes(f.tree, n => n.type === 'button');
  assert.deepEqual(buttons.map(n => n.props['data-native-app-background-option']), NATIVE_APP_BACKGROUNDS);
  assert.equal(buttons.filter(n => n.props['aria-pressed']).length, 1);
  assert.equal(buttons.find(n => n.props['aria-pressed']).props['data-native-app-background-option'], 'sand');
  const html = renderToStaticMarkup(f.tree), t = translatorFor(locale, 'NativeAppChrome');
  assert.ok(html.includes(t('background'))); for (const id of NATIVE_APP_BACKGROUNDS) assert.ok(html.includes(t(`backgrounds.${id}`)), id);
  assert.doesNotMatch(html, /MISSING_MESSAGE|NativeAppChrome\.|gender|mauve/i);
  buttons[0].props.onClick({ defaultPrevented: false, nativeEvent: { isTrusted: true } });
  buttons[1].props.onClick({ defaultPrevented: true, nativeEvent: { isTrusted: true } });
  buttons[2].props.onClick({ defaultPrevented: false, nativeEvent: { isTrusted: false } });
  assert.deepEqual(f.choices, ['graphite']);
});

test('ordinary website and older app never render the picker; no selection appears for an untouched default', () => {
  for (const values of [{ native: false }, { ready: false }, { native: false, ready: false }]) assert.equal(fixture(values).tree, null);
  assert.equal(nodes(fixture().tree, n => n.type === 'button' && n.props['aria-pressed']).length, 0);
});

test('Escape closes only the open color chooser and returns focus to its summary', () => {
  const { tree } = fixture(); let prevented = 0, stopped = 0, focused = 0;
  const detail = { open: true, querySelector: value => { assert.equal(value, 'summary'); return { focus: options => { assert.equal(options.preventScroll, true); focused++; } }; } };
  const event = key => ({ key, currentTarget: detail, preventDefault: () => prevented++, stopPropagation: () => stopped++ });
  tree.props.onKeyDown(event('ArrowDown')); assert.equal(detail.open, true);
  tree.props.onKeyDown(event('Escape')); assert.equal(detail.open, false); assert.equal(focused, 1); assert.equal(prevented, 1); assert.equal(stopped, 1);
  tree.props.onKeyDown(event('Escape')); assert.equal(prevented, 1, 'closed chooser delegates Escape to the existing profile menu');
});

test('palette has no global selectors, keeps readable wrapping and 44px targets inside the scrollable profile menu', () => {
  const css = readFileSync(new URL('../components/app/NativeAppBackgroundPicker.module.css', import.meta.url), 'utf8');
  assert.match(css, /\.choice\s*\{[^}]*min-height:\s*44px;/s); assert.match(css, /\.summary\s*\{[^}]*min-height:\s*44px;/s);
  assert.match(css, /repeat\(2, minmax\(0, 1fr\)\)/); assert.match(css, /overflow-wrap:\s*anywhere/);
  assert.doesNotMatch(css, /:global|body\s*\{|html\s*\{|text-overflow:\s*ellipsis/);
  const capability = readFileSync(new URL('./use-native-capability.ts', import.meta.url), 'utf8');
  assert.match(capability, /"background-picker":\s*"data-cg-native-background-ready"/);
});
