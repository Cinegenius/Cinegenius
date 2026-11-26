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
  './NativeInboxPanel': {default:()=>null,__esModule:true},
  './NativeAppBackgroundPicker': {default:()=>React.createElement('div',{'data-background-picker-slot':true}),__esModule:true},
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
  assert.doesNotMatch(closed,/data-native-app-theme-toggle/);
  assert.ok(!closed.includes(p.appearance.lightLabel));
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

// Read the real module rules with Next's existing PostCSS dependency. This is a
// bounded CSS box/flex contract, not a browser measurement or a copy of a product
// sizing function. Unknown layout syntax/overrides fail rather than invent pixels.
const nextRequire = createRequire(require.resolve('next/package.json'));
const postcss = nextRequire('postcss');
const headerCSS = readFileSync(new URL('../components/app/NativeAppNavbar.module.css', import.meta.url), 'utf8');
function headerRules(source, selector) {
  const result = new Map();
  const geometry = /^(?:all|position|display|(?:min-|max-)?(?:width|height|inline-size|block-size)|left|right|inset(?:-.+)?|padding(?:-.+)?|margin(?:-.+)?|border(?:-width|-left-width|-right-width)?|box-sizing|flex(?:-.+)?|justify-content|align-self|gap|column-gap|transform|translate|scale|rotate)$/;
  postcss.parse(source).walkRules(rule => {
    if (!rule.selectors.some(value => value.includes(selector))) return;
    for (const declaration of rule.nodes) {
      if (declaration.type !== 'decl' || !geometry.test(declaration.prop)) continue;
      assert.equal(rule.parent.type, 'root', 'Conditional header geometry needs an explicit contract');
      assert.ok(rule.selectors.includes(selector), 'Compound header geometry needs an explicit contract');
      const previous = result.get(declaration.prop);
      if (!previous || declaration.important || !previous.important) result.set(declaration.prop, {value: declaration.value, important: declaration.important});
    }
  });
  assert.ok(result.size, `Missing actual ${selector} rules`);
  return Object.fromEntries([...result].map(([property, declaration]) => [property, declaration.value]));
}
function headerLength(value, viewport, basis, safe) {
  assert.equal(typeof value, 'string', 'A layout length must be explicitly declared');
  const numeric = /^(\d+(?:\.\d+)?|\.\d+)(px|vw|%)?$/.exec(value);
  if (numeric) {
    const number = Number(numeric[1]);
    assert.ok(numeric[2] || number === 0, 'Nonzero lengths require a unit');
    return number * (numeric[2] === 'vw' ? viewport / 100 : numeric[2] === '%' ? basis / 100 : 1);
  }
  const call = /^(min|max|env)\((.*)\)$/.exec(value);
  assert.ok(call, `Unsupported header length ${value}`);
  const args = postcss.list.comma(call[2]);
  if (call[1] === 'env') {
    assert.ok(args.length === 1 || args.length === 2);
    assert.ok(['safe-area-inset-left', 'safe-area-inset-right'].includes(args[0]));
    return Object.hasOwn(safe, args[0]) ? safe[args[0]] : headerLength(args[1], viewport, basis, safe);
  }
  assert.ok(args.length >= 1);
  const values = args.map(arg => headerLength(arg, viewport, basis, safe));
  return call[1] === 'min' ? Math.min(...values) : Math.max(...values);
}
function actualHeaderBox(source, input, count) {
  const header = headerRules(source, '.header'), bubble = headerRules(source, '.bubble'), action = headerRules(source, '.action');
  for (const styles of [header, bubble, action]) for (const property of Object.keys(styles)) {
    assert.ok(!/^(?:all|inset|(?:min-|max-)?(?:inline-size|block-size)|padding-|margin|border-|flex-|align-self|transform|translate|scale|rotate)/.test(property), `${property} needs an explicit header layout contract`);
  }
  assert.equal(header.position, 'fixed'); assert.equal(header.display, 'flex'); assert.equal(header['justify-content'], 'center');
  assert.equal(header.width, undefined); assert.equal(header.padding, undefined); assert.equal(header.border, undefined);
  assert.equal(bubble.display, 'flex'); assert.equal(bubble['box-sizing'], 'border-box');
  assert.equal(action.display, 'inline-flex'); assert.equal(action.position, 'relative');
  const safe = {'safe-area-inset-left': input.left, 'safe-area-inset-right': input.right};
  const length = (value, basis = input.viewport) => headerLength(value, input.viewport, basis, safe);
  const left = length(header.left), right = length(header.right), available = input.viewport - left - right;
  const padding = postcss.list.space(bubble.padding).map(value => length(value, available));
  assert.ok(padding.length >= 1 && padding.length <= 4);
  const horizontalPadding = padding.length === 1 ? padding[0] * 2 : padding.length === 2 || padding.length === 3 ? padding[1] * 2 : padding[1] + padding[3];
  const border = length(postcss.list.space(bubble.border)[0]);
  const targetWidth = Math.max(length(action.width), length(action['min-width']));
  const targetHeight = Math.max(length(action.height), length(action['min-height']));
  const gap = bubble['column-gap'] === undefined ? bubble.gap === undefined ? 0 : length(bubble.gap) : length(bubble['column-gap']);
  const intrinsic = count * targetWidth + (count - 1) * gap + horizontalPadding + 2 * border;
  const flex = postcss.list.space(bubble.flex); assert.equal(flex.length, 3);
  const grow = Number(flex[0]), shrink = Number(flex[1]); assert.ok(Number.isFinite(grow) && Number.isFinite(shrink) && grow >= 0 && shrink >= 0);
  let width = flex[2] === 'auto' ? bubble.width === undefined ? intrinsic : length(bubble.width, available) : length(flex[2], available);
  if (grow > 0 && width < available || shrink > 0 && width > available) width = available;
  width = Math.max(bubble['min-width'] === undefined ? intrinsic : length(bubble['min-width'], available), Math.min(width, bubble['max-width'] === undefined ? Infinity : length(bubble['max-width'], available)));
  return {width, center: left + available / 2, left: left + (available - width) / 2, right: left + (available + width) / 2, height: length(bubble.height), targetWidth, targetHeight, required: intrinsic};
}
function assertCompactHeader(source) {
  const markup = renderToStaticMarkup(React.createElement(Navbar, props()));
  const count = [...markup.matchAll(/data-native-app-action="([^"]+)"/g)].length;
  assert.equal(count, 4, 'Calculate fit for the actual four rendered actions');
  for (const input of [
    {viewport: 320, left: 0, right: 0, expectedWidth: 262.4},
    {viewport: 393, left: 0, right: 0, expectedWidth: 320},
    {viewport: 430, left: 0, right: 0, expectedWidth: 320},
    {viewport: 844, left: 59, right: 0, expectedWidth: 320},
    {viewport: 844, left: 0, right: 59, expectedWidth: 320},
    {viewport: 320, left: 44, right: 0, expectedWidth: 232},
    {viewport: 320, left: 0, right: 44, expectedWidth: 232},
  ]) {
    const box = actualHeaderBox(source, input, count);
    assert.ok(Math.abs(box.width - input.expectedWidth) < 0.01, `${input.viewport}px: actual CSS bubble ${box.width}px must be ${input.expectedWidth}px`);
    assert.ok(Math.abs(box.center - input.viewport / 2) < 0.01, `${input.viewport}px: asymmetric safe areas must not move the header off center`);
    assert.ok(box.left >= Math.max(14, input.left) && box.right <= input.viewport - Math.max(14, input.right), 'The centered bubble stays inside both safe edges');
    assert.equal(box.height, 56); assert.ok(box.targetWidth >= 44 && box.targetHeight >= 44);
    assert.ok(box.required <= box.width, 'All four actual actions fit without reducing their targets');
  }
}
test('actual header CSS matches native Work width and viewport center from 320px through asymmetric safe areas', () => assertCompactHeader(headerCSS));
test('causal wide/growing, off-center, small-target and later-important CSS regressions fail the same geometry contract', () => {
  for (const source of [
    headerCSS + '\n.bubble { width:100%; }',
    headerCSS + '\n.bubble { flex:1 1 auto; }',
    headerCSS + '\n.header { right:14px; }',
    headerCSS + '\n.action { width:40px; min-width:40px; height:40px; min-height:40px; }',
    headerCSS + '\n.action { display:none; }',
    headerCSS + '\n.bubble { column-gap:100px; }',
    headerCSS + '\n.bubble { width:100% !important; }',
  ]) assert.throws(() => assertCompactHeader(source));
});

test('the actual embedded Work team host omits duplicate web chrome while normal routes retain the same four-action header', () => {
  let pathname = '/work/teams', container = true;
  const empty = {default: () => null, __esModule: true};
  const Chrome = load('../components/AppChrome.tsx', {
    react: {...React, useSyncExternalStore: (_subscribe, _read, serverRead) => serverRead()},
    'next/navigation': {usePathname: () => pathname},
    '@/lib/use-native-app-appearance': {useNativeAppAppearance: () => true},
    '@/lib/native-work-team-container': {nativeWorkTeamContainerSubscribe: () => () => {}, nativeWorkTeamContainerAvailable: () => container, nativeWorkTeamContainerServer: () => container},
    '@/lib/use-native-app-content-region': {useNativeAppContentRegion: () => {}},
    '@/lib/use-native-app-boot-readiness': {useNativeAppBootReadiness: () => {}},
    '@/lib/server-admin-context': {ServerAdminContext: React.createContext(null)},
    '@/contexts/SiteNavigationContext': {SiteNavigationProvider: React.Fragment},
    '@/components/Navbar': {default: () => React.createElement(Navbar, props()), __esModule: true},
    '@/components/app/NativeAppSurface.module.css': {default: styles, __esModule: true},
    ...Object.fromEntries(['LegalLanguageNotice', 'NavigationRestoration', 'BottomNav', 'Footer', 'SiteNavigationMenu'].map(name => ['@/components/' + name, empty])),
  }).default;
  const render = () => renderToStaticMarkup(React.createElement(Chrome, {initialIsSignedIn: true}, React.createElement('p', null, 'Actual page child')));
  const embedded = render(); assert.match(embedded, /data-native-work-team-container="v1"/); assert.doesNotMatch(embedded, /data-native-app-navbar=/);
  pathname = '/vehicles/fixture'; const detail = render(); assert.equal((detail.match(/data-native-app-navbar="v1"/g) ?? []).length, 1); assert.equal((detail.match(/data-native-app-action=/g) ?? []).length, 4);
  pathname = '/work/teams'; container = false; assert.equal((render().match(/data-native-app-navbar="v1"/g) ?? []).length, 1, 'A normal browser route is not mistaken for the embedded host');
});
