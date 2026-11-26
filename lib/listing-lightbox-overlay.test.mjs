import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import React from 'react';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const nextRequire = createRequire(require.resolve('next/package.json'));
const postcss = nextRequire('postcss');
const read = relative => readFileSync(new URL(relative, import.meta.url), 'utf8');
const compile = source => ts.transpileModule(source, {compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
}}).outputText;
const lightboxCode = compile(read('../components/Lightbox.tsx'));
const hookCode = compile(read('./use-native-app-content-region.ts'));
const cssURL = new URL('../components/Lightbox.module.css', import.meta.url);
const css = existsSync(cssURL) ? readFileSync(cssURL, 'utf8') : '';
const styles = Object.fromEntries(['nativeDialog', 'nativeClose', 'nativeCounter', 'nativePrevious', 'nativeNext', 'nativeImage', 'nativeThumbnails'].map(name => [name, name]));
const walk = node => node == null || typeof node !== 'object' ? []
  : Array.isArray(node) ? node.flatMap(walk) : [node, ...walk(node.props?.children)];

function fixture(native = true, {server = false} = {}) {
  const effects = [], layoutEffects = [], installs = [], listeners = new Map();
  const state = {closed: 0, restored: 0};
  const stores = [];
  const body = {style: {overflow: 'auto'}};
  const document = {body, addEventListener: (type, fn) => listeners.set(type, fn), removeEventListener: type => listeners.delete(type)};
  const hooks = {...React, useCallback: value => value, useRef: current => ({current}),
    useSyncExternalStore: (subscribe, snapshot, serverSnapshot) => { stores.push({subscribe, snapshot, serverSnapshot}); return server ? serverSnapshot() : snapshot(); },
    useState: initial => [typeof initial === 'function' ? initial() : typeof initial === 'boolean' ? true : initial, () => {}],
    useEffect: fn => effects.push(fn), useLayoutEffect: fn => layoutEffects.push(fn)};
  function load(code, mocks) {
    const module = {exports: {}};
    new Function('require', 'module', 'exports', 'document', 'window', code)(
      name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), module, module.exports,
      document, {setTimeout() {}});
    return module.exports;
  }
  // Execute the real hook; its existing DOM installer is the boundary mock.
  const modalHooks = load(hookCode, {react: hooks, '@/lib/native-app-content-region': {
    installNativeAppModalLock: (surface, dismiss) => {
      installs.push({surface, dismiss}); return () => { state.restored++; };
    }, installNativeAppContentRegion: () => { throw new Error('Lightbox must not install a page region'); },
  }});
  const Lightbox = load(lightboxCode, {
    react: hooks, 'react-dom': {createPortal: (children, container) => ({type: 'test-portal', props: {children}, container})},
    'next-intl': {useTranslations: () => key => key},
    '@/components/MediaImage': props => React.createElement('test-image', props),
    '@/lib/use-native-app-appearance': {useNativeAppAppearance: () => native},
    '@/lib/use-native-app-content-region': modalHooks, './Lightbox.module.css': styles,
  }).default;
  const tree = Lightbox({images: ['/api/media/owner/one.webp', '/api/media/owner/two.webp'], activeIndex: 0,
    onClose: () => { state.closed++; }, onPrev() {}, onNext() {}, alt: 'Original caption'});
  const dialog = walk(tree).find(node => node.props?.role === 'dialog');
  const surface = {name: 'actual dialog DOM ref'};
  if (dialog?.props.ref) dialog.props.ref.current = surface;
  const cleanups = [];
  const activate = () => {
    for (const effect of layoutEffects) effect();
    for (const effect of effects) { const cleanup = effect(); if (typeof cleanup === 'function') cleanups.push(cleanup); }
  };
  return {tree, dialog, body, surface, installs, state, stores, listeners, activate,
    cleanup: () => { for (const fn of cleanups.reverse()) fn(); }};
}

test('listing lightbox escapes fixed app-main through a body portal with its own overlay and dialog', () => {
  const f = fixture();
  assert.equal(f.tree.type, 'test-portal', 'a high z-index inside fixed main cannot cover sibling app chrome');
  assert.equal(f.tree.container, f.body);
  assert.equal(f.stores.length, 1);
  assert.equal(f.stores[0].snapshot(), true);
  assert.equal(f.stores[0].serverSnapshot(), false);
  assert.equal(typeof f.stores[0].subscribe(() => {}), 'function');
  assert.equal(fixture(true, {server: true}).tree, null, 'server/hydration snapshot must not access a portal body');
  const overlay = f.tree.props.children;
  assert.equal(overlay.props['data-listing-lightbox-overlay'], 'v1');
  assert.equal(overlay.props.children, f.dialog, 'the modal hook positions the direct overlay parent');
  assert.equal(f.dialog.props['aria-modal'], 'true');
});

test('real shared modal hook receives the dialog ref, delegates dismiss, and releases its lock on unmount', () => {
  const f = fixture(); f.activate();
  assert.equal(f.installs.length, 1);
  assert.equal(f.installs[0].surface, f.surface);
  f.installs[0].dismiss(); assert.equal(f.state.closed, 1);
  f.cleanup(); assert.equal(f.state.restored, 1);
  const web = fixture(false); web.activate();
  assert.equal(web.installs.length, 0, 'ordinary website must not install app-only modal geometry');
  assert.equal(web.body.style.overflow, 'hidden');
  web.cleanup(); assert.equal(web.body.style.overflow, 'auto');
});

test('listing gallery native close and thumbnail controls reserve system safe areas and44px targets locally', () => {
  const rules = new Map();
  postcss.parse(css).walkRules(rule => {
    assert.ok(rule.selector.startsWith('.nativeDialog'), 'gallery fix must not hide or reposition global chrome');
    rules.set(rule.selector, Object.fromEntries(rule.nodes.filter(node => node.type === 'decl').map(node => [node.prop, node.value])));
  });
  assert.match(rules.get('.nativeDialog .nativeClose')?.top ?? '', /--cg-app-safe-top|safe-area-inset-top/);
  assert.match(rules.get('.nativeDialog .nativeThumbnails')?.bottom ?? '', /--mobile-safe-area-height|safe-area-inset-bottom/);
  const thumb = rules.get('.nativeDialog .nativeThumbnails > button');
  assert.ok(Number.parseFloat(thumb?.height) >= 44); assert.ok(Number.parseFloat(thumb?.['min-width']) >= 44);
  const close = walk(fixture().tree).find(node => node.type === 'button' && node.props['aria-label'] === 'close');
  assert.match(close.props.className, /h-11 w-11/);
});

test('already handled Escape does not close listing gallery twice', () => {
  const f = fixture(); f.activate(); const key = f.listeners.get('keydown'); assert.equal(typeof key, 'function');
  let prevented = false;
  const event = {key: 'Escape', get defaultPrevented() { return prevented; }, preventDefault() { prevented = true; }};
  key(event); assert.equal(f.state.closed, 1); assert.equal(prevented, true);
  key(event); assert.equal(f.state.closed, 1);
  f.cleanup();
});

test('one listing gallery X tap cannot bubble into another backdrop close', () => {
  const f = fixture(), close = walk(f.tree).find(node => node.type === 'button' && node.props['aria-label'] === 'close');
  let stopped = false;
  const event = {stopPropagation() { stopped = true; }};
  close.props.onClick(event);
  const overlay = f.tree.type === 'test-portal' ? f.tree.props.children : f.tree;
  if (!stopped) overlay.props.onClick(event);
  assert.equal(stopped, true); assert.equal(f.state.closed, 1);
});
