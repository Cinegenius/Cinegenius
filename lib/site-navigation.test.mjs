import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import {translatorFor} from './i18n-test-fixture.mjs';
import * as navigation from './site-navigation.ts';
import {
  PRIMARY_NAV_ITEMS,
  BROWSE_NAV_ITEMS,
  ACCOUNT_NAV_ITEMS,
  activeNavigationId,
  hideMobileNavigation,
} from './site-navigation.ts';

const require = createRequire(import.meta.url);
const locales = ['de', 'en', 'es', 'it', 'cs', 'hu', 'nl', 'nl-BE', 'sv'];

// Real components, catalogues and handlers with controlled hooks; browser layout is verified separately.
function componentFixture(filename, {path = '/creators', locale = 'de', menuOpen = false, chatOpen = false, unread = 0, signedIn = true, adminUserId = null} = {}) {
  let opened = 0, closed = 0;
  const effects = [];
  let userId = signedIn ? 'fixture-navigation-owner' : null;
  let refCursor = 0;
  const refs = [];
  const icon = () => React.createElement('svg', {'aria-hidden': true});
  const hookMocks = {
    ...React,
    useState: initial => [typeof initial === 'boolean' ? chatOpen : typeof initial === 'function' ? initial() : initial, () => {}],
    useEffect: callback => effects.push(callback), useLayoutEffect() {},
    useCallback: callback => callback,
    useContext: () => adminUserId,
    useId: () => 'fixture-navigation-title',
    useRef(initial) {
      const index = refCursor++;
      if (!(index in refs)) refs[index] = {current: initial};
      return refs[index];
    },
    useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
  };
  const mocks = {
    react: hookMocks,
    'next/link': {default: ({children, prefetch, ...props}) => {void prefetch; return React.createElement('a', props, children);}},
    'next/navigation': {usePathname: () => path.split('?')[0], useSearchParams: () => new URL(path, 'https://fixture.invalid').searchParams},
    'next-intl': {useTranslations: namespace => translatorFor(locale, namespace)},
    '@clerk/nextjs': {useAuth: () => ({userId, isSignedIn: signedIn, isLoaded: true})},
    '@/lib/site-navigation': navigation,
    '@/components/NavigationIcon': {default: icon, NavigationIcon: icon},
    '@/lib/server-admin-context': {ServerAdminContext: React.createContext(null)},
    '@/lib/form-navigation-events': {BEFORE_FORM_NAVIGATION_EVENT: 'cinegenius:before-form-navigation'},
    '@/contexts/SiteNavigationContext': {useSiteNavigation: () => ({menuOpen, openMenu() {opened += 1;}, closeMenu() {closed += 1;}})},
    '@/lib/unread-count-store': {subscribeToUnreadCount: () => () => {}, getUnreadCountSnapshot: account => account === userId && userId ? unread : 0, getUnreadCountServerSnapshot: () => 0},
  };
  const source = ts.transpileModule(readFileSync(new URL(`../components/${filename}.tsx`, import.meta.url), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true},
  }).outputText;
  const mod = {exports: {}};
  new Function('require', 'module', 'exports', source)(name => {
    const value = mocks[name] ?? require(name);
    return 'default' in value ? {__esModule: true, ...value} : value;
  }, mod, mod.exports);
  let tree, html;
  function render() {
    refCursor = 0;
    effects.length = 0;
    tree = mod.exports.default();
    if (tree?.type === React.Suspense && typeof tree.props.children?.type === 'function') {
      tree = tree.props.children.type(tree.props.children.props);
    }
    html = renderToStaticMarkup(tree);
  }
  render();
  return {
    effects,
    get tree() {return tree;}, get html() {return html;},
    get opened() {return opened;}, get closed() {return closed;},
    rerender(next) {
      if ('path' in next) path = next.path;
      if ('userId' in next) {userId = next.userId; signedIn = !!userId;}
      render();
    },
  };
}

function nodes(value, predicate, found = []) {
  if (Array.isArray(value)) value.forEach(child => nodes(child, predicate, found));
  else if (value && typeof value === 'object' && value.props) {
    if (predicate(value)) found.push(value);
    nodes(value.props.children, predicate, found);
  }
  return found;
}

function nodeText(value) {
  if (Array.isArray(value)) return value.map(nodeText).join('');
  if (value === null || value === undefined || typeof value === 'boolean') return '';
  return typeof value === 'object' ? nodeText(value.props?.children) : String(value);
}

test('shared primary navigation has the six stable public and personal positions', () => {
  assert.deepEqual(PRIMARY_NAV_ITEMS.map(({id, kind, href}) => [id, kind, href ?? null]), [
    ['crew', 'link', '/creators'],
    ['marketplace', 'link', '/props'],
    ['messages', 'link', '/messages'],
    ['news', 'link', '/news'],
    ['account', 'link', '/dashboard'],
    ['more', 'menu', null],
  ]);
  assert.equal(new Set(PRIMARY_NAV_ITEMS.map(item => item.id)).size, PRIMARY_NAV_ITEMS.length);
});

test('moving public areas and account actions into More preserves their destinations', () => {
  const browse = new Set(BROWSE_NAV_ITEMS.map(item => item.href));
  for (const href of ['/', '/creators', '/locations', '/props', '/jobs', '/companies', '/projects', '/news', '/organizations']) {
    assert.ok(browse.has(href), href);
  }
  const account = new Set(ACCOUNT_NAV_ITEMS.map(item => item.href));
  for (const href of ['/profile', '/dashboard?tab=listings', '/dashboard?tab=favorites', '/dashboard?tab=friends', '/dashboard?tab=bookings', '/company-dashboard', '/notifications', '/dashboard?tab=settings', '/dashboard?tab=analytics', '/profile?tab=security']) {
    assert.ok(account.has(href), href);
  }
  for (const items of [BROWSE_NAV_ITEMS, ACCOUNT_NAV_ITEMS]) {
    assert.equal(new Set(items.map(item => item.href)).size, items.length, 'each menu section has unique destinations');
    assert.ok(items.every(item => item.href.startsWith('/')), 'menu destinations stay on the current host');
  }
});

test('primary selection follows complete route boundaries across public and personal pages', () => {
  for (const [path, expected] of [
    ['/creators', 'crew'], ['/creators/example', 'crew'],
    ['/props', 'marketplace'], ['/props/example', 'marketplace'],
    ['/messages', 'messages'], ['/news', 'news'], ['/news/example', 'news'],
    ['/locations', 'more'], ['/locations/example', 'more'], ['/dashboard', 'account'], ['/profile', 'account'],
    ['/projects', 'more'], ['/companies', 'more'],
    ['/creatorship', 'more'], ['/locations-other', 'more'], ['/messages-archive', 'more'],
  ]) {
    assert.equal(activeNavigationId(path), expected, path);
  }
});

test('only direct authentication, guided setup and an open chat hide the mobile bar', () => {
  for (const path of ['/sign-in', '/sign-in/verify', '/sign-up', '/sign-up/verify', '/profile-setup']) {
    assert.equal(hideMobileNavigation(path, false), true, path);
  }
  assert.equal(hideMobileNavigation('/messages', false), false);
  assert.equal(hideMobileNavigation('/messages', true), true);
  for (const path of ['/', '/creators', '/locations', '/projects', '/dashboard', '/profile', '/notifications', '/sign-in-help']) {
    assert.equal(hideMobileNavigation(path, true), false, path);
  }
});

for (const locale of locales) {
  test(`${locale}: dynamic navigation model labels resolve through the real catalog`, () => {
    const translate = translatorFor(locale, 'nav');
    for (const {key} of [...PRIMARY_NAV_ITEMS, ...BROWSE_NAV_ITEMS, ...ACCOUNT_NAV_ITEMS]) {
      const label = translate(key);
      assert.ok(label.trim(), key);
      assert.notEqual(label, `nav.${key}`, key);
    }
    for (const key of ['allAreas', 'discover', 'helpAndInfo', 'help', 'support']) assert.ok(translate(key).trim());
  });

  test(`${locale}: the actual bottom navigation keeps the same six slots across areas`, () => {
    const translate = translatorFor(locale, 'nav');
    for (const path of ['/', '/creators', '/locations', '/projects', '/props', '/dashboard', '/profile', '/messages', '/notifications']) {
      const f = componentFixture('BottomNav', {path, locale});
      const links = nodes(f.tree, node => typeof node.props.href === 'string');
      assert.deepEqual(links.map(node => node.props.href), ['/creators', '/props', '/messages', '/news', '/dashboard'], path);
      const more = nodes(f.tree, node => node.type === 'button' && node.props['aria-controls'] === 'site-navigation-menu');
      assert.equal(more.length, 1, path);
      assert.equal(more[0].props['aria-haspopup'], 'dialog');
      let focused = 0;
      more[0].props.onClick({currentTarget: {focus(options) {
        assert.deepEqual(options, {preventScroll: true});
        assert.equal(f.opened, 0, 'Safari trigger focus is established before opening the native menu');
        focused += 1;
      }}});
      assert.equal(focused, 1, path);
      assert.equal(f.opened, 1, path);
      assert.ok(f.html.includes('aria-label="' + translate('allAreas') + '"'), path);
      const activeLink = links.find(node => node.props['aria-current'] === 'page');
      const expected = PRIMARY_NAV_ITEMS.find(item => item.id === activeNavigationId(path));
      assert.equal(activeLink?.props.href, expected?.href, path);
    }
  });

  test(`${locale}: the actual shared menu preserves destinations and closes after a choice`, () => {
    const f = componentFixture('SiteNavigationMenu', {locale, menuOpen: true});
    const searchLabel = translatorFor(locale)('Ui.text_9f6d74e0a12b67');
    assert.equal(nodes(f.tree, node => node.type === 'button' && nodeText(node) === searchLabel).length, 1, 'menu search uses the active language catalog');
    assert.equal(f.tree.type, 'dialog');
    assert.equal(f.tree.props.id, 'site-navigation-menu');
    assert.equal(f.tree.props['aria-labelledby'], 'site-navigation-title');
    assert.equal(f.tree.props.open, undefined, 'native showModal controls visibility after hydration');
    const links = nodes(f.tree, node => typeof node.props.href === 'string');
    for (const {href} of [...BROWSE_NAV_ITEMS, ...ACCOUNT_NAV_ITEMS]) assert.ok(links.some(link => link.props.href === href), href);
    for (const href of ['/help', '/support']) assert.ok(links.some(link => link.props.href === href), href);
    for (const link of links) {
      assert.equal(link.props.prefetch, false, link.props.href);
      const previous = f.closed;
      link.props.onClick();
      assert.equal(f.closed, previous + 1, link.props.href);
    }
  });
}

test('the actual bottom bar hides for direct account entry and open chat, with no guest unread badge', () => {
  for (const path of ['/sign-in', '/sign-up', '/profile-setup']) {
    assert.equal(componentFixture('BottomNav', {path}).html, '', path);
  }
  assert.equal(componentFixture('BottomNav', {path: '/messages', chatOpen: true}).html, '');
  const own = componentFixture('BottomNav', {path: '/creators', unread: 14, menuOpen: true});
  assert.ok(own.html.includes('9+'));
  const more = nodes(own.tree, node => node.type === 'button' && node.props['aria-controls'] === 'site-navigation-menu')[0];
  assert.equal(more.props['aria-expanded'], true);
  assert.ok(!componentFixture('BottomNav', {signedIn: false, unread: 14}).html.includes('9+'));
});

test('the menu keeps guest entry direct and restricts the admin destination to the matching session', () => {
  const guest = componentFixture('SiteNavigationMenu', {signedIn: false});
  const links = nodes(guest.tree, node => typeof node.props.href === 'string');
  for (const href of ['/sign-in', '/sign-up']) assert.ok(links.some(link => link.props.href === href && link.props.prefetch === true), href);
  assert.ok(!links.some(link => link.props.href === '/profile'));
  assert.ok(!links.some(link => link.props.href === '/admin'));
  const adminLinks = adminUserId => nodes(componentFixture('SiteNavigationMenu', {adminUserId}).tree, node => node.props.href === '/admin');
  assert.equal(adminLinks('fixture-navigation-owner').length, 1);
  assert.equal(adminLinks('another-account').length, 0);
});

test('menu selection follows dashboard query tabs and native dismissal handles Escape and the backdrop', () => {
  const f = componentFixture('SiteNavigationMenu', {path: '/dashboard?tab=friends', menuOpen: true});
  const current = nodes(f.tree, node => node.props['aria-current'] === 'page');
  assert.deepEqual(current.map(node => node.props.href), ['/dashboard?tab=friends']);
  let prevented = false;
  f.tree.props.onCancel({preventDefault() {prevented = true;}});
  assert.equal(prevented, true);
  assert.equal(f.closed, 1);
  const dialog = {getBoundingClientRect: () => ({left: 0, top: 100, right: 320, bottom: 740})};
  f.tree.props.onClick({target: dialog, currentTarget: dialog, clientX: 100, clientY: 200});
  assert.equal(f.closed, 1, 'clicking the panel itself does not dismiss it');
  f.tree.props.onClick({target: dialog, currentTarget: dialog, clientX: 100, clientY: 50});
  assert.equal(f.closed, 2, 'clicking the native backdrop dismisses it');
});

test('the mounted menu dismisses for navigation, account changes, search, sign-out and draft guards without writing browser history', () => {
  const previous = Object.fromEntries(['window', 'document'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const browser = new EventTarget();
  browser.history = {pushState() {assert.fail('opening or dismissing navigation must not insert history');}, replaceState() {assert.fail('navigation must preserve the current history entry');}};
  const document = Object.assign(new EventTarget(), {body: {style: {overflow: 'scroll'}}});
  Object.defineProperty(globalThis, 'window', {value: browser, writable: true, configurable: true});
  Object.defineProperty(globalThis, 'document', {value: document, writable: true, configurable: true});
  try {
    for (const eventName of ['popstate', 'cinegenius:before-form-navigation']) {
      let focused = 0, nativeClosed = 0;
      const f = componentFixture('SiteNavigationMenu', {menuOpen: true});
      const dialog = {
        open: false,
        showModal() {this.open = true;},
        close() {if (this.open) nativeClosed += 1; this.open = false;},
        querySelector: () => ({focus() {focused += 1;}}),
      };
      f.tree.props.ref.current = dialog;
      const cleanups = f.effects.map(effect => effect());
      assert.equal(dialog.open, true);
      assert.equal(focused, 1);
      assert.equal(document.body.style.overflow, 'hidden');
      browser.dispatchEvent(new Event(eventName));
      assert.equal(dialog.open, false);
      assert.equal(f.closed, 1, eventName);
      assert.equal(nativeClosed, 1);
      assert.equal(document.body.style.overflow, 'scroll');
      cleanups.forEach(cleanup => cleanup?.());
      browser.dispatchEvent(new Event(eventName));
      assert.equal(f.closed, 1, 'unmounted listeners are removed');
    }
    for (const change of [{path: '/news'}, {path: '/dashboard?tab=settings'}, {userId: 'another-navigation-account'}]) {
      const f = componentFixture('SiteNavigationMenu', {path: '/dashboard?tab=favorites', menuOpen: true});
      const dialog = {open: false, showModal() {this.open = true;}, close() {this.open = false;}, querySelector: () => ({focus() {}})};
      f.tree.props.ref.current = dialog;
      const cleanups = f.effects.map(effect => effect());
      f.rerender(change);
      f.effects.at(-1)();
      assert.equal(f.closed, 1, JSON.stringify(change));
      assert.equal(dialog.open, false);
      assert.equal(document.body.style.overflow, 'scroll');
      cleanups.forEach(cleanup => cleanup?.());
    }
    const signOut = componentFixture('SiteNavigationMenu', {menuOpen: true});
    const dialog = {open: false, showModal() {this.open = true;}, close() {this.open = false;}, querySelector: () => ({focus() {}})};
    signOut.tree.props.ref.current = dialog;
    const cleanups = signOut.effects.map(effect => effect());
    let signOutRequests = 0;
    document.addEventListener(navigation.SITE_NAV_SIGN_OUT_EVENT, () => {
      assert.equal(dialog.open, false, 'the native top layer closes before the existing sign-out guard runs');
      assert.equal(document.body.style.overflow, 'scroll');
      signOutRequests += 1;
    }, {once: true});
    nodes(signOut.tree, node => node.type === 'button' && nodeText(node) === translatorFor('de', 'nav')('signOut'))[0].props.onClick();
    assert.equal(signOutRequests, 1, 'the menu reuses the shared sign-out request instead of starting a second sign-out flow');
    assert.equal(signOut.closed, 1);
    cleanups.forEach(cleanup => cleanup?.());
    const search = componentFixture('SiteNavigationMenu', {menuOpen: true, signedIn: false});
    const searchDialog = {open: false, showModal() {this.open = true;}, close() {this.open = false;}, querySelector: () => ({focus() {}})};
    search.tree.props.ref.current = searchDialog;
    const searchCleanups = search.effects.map(effect => effect());
    let searchRequests = 0;
    document.addEventListener('cg:opensearch', () => {
      assert.equal(searchDialog.open, false, 'the native menu closes before the existing global search opens');
      assert.equal(document.body.style.overflow, 'scroll');
      assert.equal(search.closed, 1);
      searchRequests += 1;
    }, {once: true});
    const searchLabel = translatorFor('de')('Ui.text_9f6d74e0a12b67');
    nodes(search.tree, node => node.type === 'button' && nodeText(node) === searchLabel)[0].props.onClick();
    assert.equal(searchRequests, 1, 'guest menu search reuses the existing global search action');
    searchCleanups.forEach(cleanup => cleanup?.());
  } finally {
    for (const [key, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
