import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { translatorFor } from './i18n-test-fixture.mjs';
import { SUPPORTED_LOCALES } from './i18n/locales.ts';

const require = createRequire(import.meta.url);
function load(path, mocks = {}) {
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    reportDiagnostics: true,
  });
  assert.equal(code.diagnostics?.length ?? 0, 0);
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', code.outputText)(name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), mod, mod.exports);
  return mod.exports;
}
const appearance = load('./use-native-app-appearance.ts');
const styles = new Proxy({}, { get: (_target, name) => String(name) });
let themeReady = true;
const Navbar = load('../components/app/NativeAppNavbar.tsx', {
  '@/lib/native-app-theme': { useNativeAppTheme: () => 'cinema', toggleNativeAppTheme: () => {} },
  '@/lib/use-native-capability': { useNativeCapability: () => themeReady },
  '@/lib/native-header-utility': { useNativeHeaderUtilityKind: () => null, announceNativeHeaderAction: () => true },
  'next/link': { __esModule: true, default: ({ prefetch: _prefetch, ...props }) => React.createElement('a', props) },
  '@/components/NavigationIcon': { __esModule: true, default: () => React.createElement('svg', { 'aria-hidden': true }) },
  './NativeAppNavbar.module.css': { default: styles, __esModule: true },
}).default;

function globals(t, values) {
  const previous = new Map(Object.keys(values).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(values)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  t.after(() => { for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } });
}

test('native appearance is exact, SSR starts with the ordinary website, and no browser globals are required', t => {
  globals(t, { document: undefined });
  assert.equal(appearance.nativeAppAppearanceSnapshot(), false);
  assert.equal(appearance.nativeAppAppearanceServerSnapshot(), false);
  assert.doesNotThrow(() => appearance.subscribeNativeAppAppearance(() => {})());
  globalThis.document = { documentElement: { getAttribute: () => 'app' } };
  assert.equal(appearance.nativeAppAppearanceSnapshot(), true);
  function ServerProbe() { return React.createElement('span', null, String(appearance.useNativeAppAppearance())); }
  assert.equal(renderToStaticMarkup(React.createElement(ServerProbe)), '<span>false</span>');
  for (const value of ['APP', 'true', 'ready', 'app ', null]) {
    document.documentElement.getAttribute = () => value;
    assert.equal(appearance.nativeAppAppearanceSnapshot(), false, String(value));
  }
});

test('native appearance observes only its presentation attribute, deduplicates snapshots and disconnects on unmount', t => {
  let value = null, callback, options, observed, disconnected = 0, changes = 0;
  const root = { getAttribute: () => value };
  globals(t, { document: { documentElement: root }, MutationObserver: class {
    constructor(fn) { callback = fn; }
    observe(node, config) { observed = node; options = config; }
    disconnect() { disconnected++; }
  } });
  const stop = appearance.subscribeNativeAppAppearance(() => changes++);
  assert.equal(observed, root);
  assert.deepEqual(options, { attributes: true, attributeFilter: ['data-cg-native-community-appearance'] });
  callback(); assert.equal(changes, 0);
  value = 'app'; callback(); callback(); assert.equal(changes, 1);
  value = 'ready'; callback(); assert.equal(changes, 2);
  stop(); assert.equal(disconnected, 1);
});

function props(locale = 'de') {
  const t = translatorFor(locale), nav = translatorFor(locale, 'nav');
  return {
    navigationLabel: t('NativeAppChrome.navigation'), signInLabel: nav('signIn'),
    appearance: {lightLabel:t('NativeAppChrome.lightMode'),darkLabel:t('NativeAppChrome.darkMode')},
    accountButtonRef: { current: null }, accountMenuRef: { current: null },
    account: {
      signedIn: true, ready: true, open: false, label: t('NativeAppChrome.profileMenu'), title: t('NativeAppChrome.profileMenuTitle'), loadingLabel: t('Contacts.loading'),
      displayName: 'Own fixture identity', email: 'fixture@example.invalid', avatar: React.createElement('span', { 'data-scoped-avatar': true }), supportBadge: null,
      links: [
        { id: 'profile', href: '/profile', label: nav('myProfile'), icon: 'profile' },
        { id: 'saved', href: '/favorites', label: nav('savedItems'), icon: 'saved' },
        { id: 'colleagues', href: '/messages?view=friends', label: t('NativeAppChrome.colleagues'), icon: 'contacts' },
        { id: 'homies', href: '/messages?view=friends&homies=1', label: t('Contacts.homies'), icon: 'contacts' },
        { id: 'settings', href: '/dashboard?tab=settings', label: t('PersonalArea.settings'), icon: 'settings' },
      ],
      onToggle() {}, onClose() {}, onSignOut() {}, signingOut: false, signOutLabel: nav('signOut'),
    },
    messages: { label: `${t('notifications.newMessages', { count: 2 })}; ${nav('notifications')} (1)`, count: 2, noticeCount: 1, failed: false, active: false },
    search: { label: t('Ui.text_9f6d74e0a12b67'), onClick() {} }, menu: { label: nav('openMenu'), open: false, controls: 'site-navigation-menu', onClick() {} },
  };
}

for (const locale of SUPPORTED_LOCALES) test(`native four-action header and canonical profile menu resolve their actual labels: ${locale}`, () => {
  const p = props(locale), closed = renderToStaticMarkup(React.createElement(Navbar, p));
  assert.deepEqual([...closed.matchAll(/data-native-app-action="([^"]+)"/g)].map(match => match[1]), ['profile', 'messages', 'search', 'menu']);
  assert.match(closed,/data-native-app-theme-toggle="v1"/);
  assert.ok(closed.includes(p.appearance.lightLabel));
  assert.doesNotMatch(closed, /fixture@example|Own fixture identity|<img|CineGenius<|header-account-menu" class=/);
  assert.match(closed, /data-native-unread="messages"[^>]*>2</);
  assert.match(closed, /data-native-unread="notices"/);
  p.account.open = true;
  const open = renderToStaticMarkup(React.createElement(Navbar, p));
  assert.match(open, /role="dialog" aria-labelledby="native-profile-menu-title"/);
  assert.deepEqual([...open.matchAll(/href="([^"]+)"/g)].map(match => match[1]), ['/messages', '/dashboard', '/profile', '/favorites', '/messages?view=friends', '/messages?view=friends&amp;homies=1', '/dashboard?tab=settings']);
  assert.match(open, /Own fixture identity/);
  assert.ok(open.includes(p.account.signOutLabel));
  assert.doesNotMatch(open, /NativeAppChrome\.|MISSING_MESSAGE/);
});

test('guest and pending-account presentation never expose identity links; sign-in remains a real destination', () => {
  const p = props(); p.account.signedIn = false; p.account.ready = false; p.account.open = true;
  const guest = renderToStaticMarkup(React.createElement(Navbar, p));
  assert.match(guest, /href="\/sign-in"/);
  assert.doesNotMatch(guest, /fixture@example|Own fixture identity|data-native-profile-link/);
  p.account.signedIn = true;
  const pending = renderToStaticMarkup(React.createElement(Navbar, p));
  assert.match(pending, /disabled="" aria-busy="true"/);
  assert.doesNotMatch(pending, /fixture@example|Own fixture identity|data-native-profile-link/);
});

test('older native clients without the theme capability keep the four actions and never receive a broken quick toggle',()=>{
 themeReady=false;
 try{const html=renderToStaticMarkup(React.createElement(Navbar,props()));assert.doesNotMatch(html,/data-native-app-theme-toggle/);assert.equal((html.match(/data-native-app-action=/g)??[]).length,4)}finally{themeReady=true}
});

test('native styles retain 44px actions, safe-area offsets, token fallbacks and a scrollable short-screen menu', () => {
  const css = readFileSync(new URL('../components/app/NativeAppNavbar.module.css', import.meta.url), 'utf8');
  assert.match(css, /\.action\s*\{[^}]*min-width:\s*44px;[^}]*min-height:\s*44px;/s);
  assert.match(css, /env\(safe-area-inset-top, 0px\)/);
  assert.match(css, /\.profileMenu\s*\{[^}]*max-height:[^}]*100dvh[^}]*overflow-y:\s*auto;/s);
  assert.match(css, /var\(--cg-app-ink, #f4f4f6\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.doesNotMatch(css, /:global|body\s*\{|html\s*\{/);
});
