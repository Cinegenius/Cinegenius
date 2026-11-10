import {translatorFor} from './i18n-test-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {setImmediate as nextTurn} from 'node:timers/promises';

// The override permits running the same regression tests against a clean baseline.
const projectRoot = process.env.CINEGENIUS_TEST_ROOT ?? fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(join(projectRoot, 'package.json'));
const ts = require('typescript');
const React = require('react');
const jsxRuntime = require('react/jsx-runtime');
const readerText = translatorFor('de');
const chatA = '20000000-0000-4000-8000-000000000001';
const chatB = '20000000-0000-4000-8000-000000000002';
const ownerA = 'fixture_owner_a';
const ownerB = 'fixture_owner_b';

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return {promise, resolve, reject};
}

function conversation(id, owner = ownerA) {
  return {id, kind: 'direct', sender_id: owner, receiver_id: 'fixture_peer', updated_at: '2026-11-10T08:00:00Z', messages: [], otherName: id === chatA ? 'Conversation A' : 'Conversation B'};
}

function message(id, content, owner = ownerA) {
  return {id, sender_id: owner, content, created_at: '2026-11-10T08:00:00Z', read_at: null};
}

function nodes(value, predicate, found = []) {
  if (Array.isArray(value)) value.forEach(child => nodes(child, predicate, found));
  else if (value && typeof value === 'object' && value.props) {
    if (predicate(value)) found.push(value);
    nodes(value.props.children, predicate, found);
  }
  return found;
}

function text(value) {
  if (Array.isArray(value)) return value.map(text).join(' ');
  if (value === null || value === undefined || typeof value === 'boolean') return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return value.props ? text(value.props.children) : '';
}

function fixture(handle, {query = '', owner = ownerA} = {}) {
  const before = Object.fromEntries(['window', 'document', 'fetch'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const slots = [];
  const effects = [];
  const translations = new Map();
  const moduleCache = new Map();
  const listeners = new Map();
  const calls = [];
  let user = {id: owner};
  let url = new URL(`https://fixture.invalid/messages${query}`);
  let params = new URLSearchParams(url.search);
  let cursor = 0, dirty = true, tree, navigationCount = 0, timerId = 0, disposed = false;
  const same = (left, right) => Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((value, index) => Object.is(value, right[index]));

  const hooks = {
    ...React,
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) {
        const slot = {value: typeof initial === 'function' ? initial() : initial};
        slot.set = value => {
          const next = typeof value === 'function' ? value(slot.value) : value;
          if (!Object.is(next, slot.value)) { slot.value = next; dirty = true; }
        };
        slots[index] = slot;
      }
      return [slots[index].value, slots[index].set];
    },
    useRef(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = {current: initial};
      return slots[index];
    },
    useCallback(callback, dependencies) {
      const index = cursor++;
      if (!slots[index] || !same(slots[index].dependencies, dependencies)) slots[index] = {callback, dependencies};
      return slots[index].callback;
    },
    useEffect(create, dependencies) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || !same(previous.dependencies, dependencies)) {
        const slot = {dependencies, cleanup: previous?.cleanup};
        slots[index] = slot;
        effects.push(() => { slot.cleanup?.(); slot.cleanup = create(); });
      }
    },
  };

  function compile(relative, dependency) {
    const code = ts.transpileModule(readFileSync(join(projectRoot, relative), 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX}}).outputText;
    const loaded = {exports: {}};
    new Function('require', 'module', 'exports', code)(dependency, loaded, loaded.exports);
    return loaded.exports;
  }

  function local(relative) {
    if (!moduleCache.has(relative)) moduleCache.set(relative, compile(relative, name => {
      if (name === './conversation-logic') return local('lib/conversation-logic.ts');
      throw new Error(`Unexpected fixture dependency in ${relative}: ${name}`);
    }));
    return moduleCache.get(relative);
  }

  const safeHelpers = {
    '@/lib/ui-error-message': local('lib/ui-error-message.ts'),
    '@/lib/message-read-state': local('lib/message-read-state.ts'),
    '@/lib/conversation-logic': local('lib/conversation-logic.ts'),
    '@/lib/support-identity': local('lib/support-identity.ts'),
    '@/lib/message-refresh-policy': local('lib/message-refresh-policy.ts'),
    '@/lib/message-actions': local('lib/message-actions.ts'),
    '@/lib/message-navigation': local('lib/message-navigation.ts'),
  };
  const mocks = {
    ...safeHelpers,
    react: hooks,
    'react/jsx-runtime': jsxRuntime,
    '@/components/UnoptimizedImage': {default: 'img'},
    'next/link': {default: 'a'},
    'next/navigation': {useSearchParams: () => params},
    '@clerk/nextjs': {useUser: () => ({user})},
    'lucide-react': new Proxy({}, {get: (_target, key) => `fixture-icon-${String(key)}`}),
    'next-intl': {useLocale: () => 'de', useTranslations: namespace => {
      if (!translations.has(namespace)) translations.set(namespace, translatorFor('de', namespace));
      return translations.get(namespace);
    }},
    '@/lib/message-read-sync': {notifyMessagesRead() {}, subscribeToMessageReads: () => () => {}},
  };
  // Export only for this in-memory test compilation; repository source is untouched.
  const componentCode = ts.transpileModule(readFileSync(join(projectRoot, 'app/messages/page.tsx'), 'utf8') + '\nexport {MessagesContent as FixtureMessagesContent};', {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX}}).outputText;
  const componentModule = {exports: {}};
  new Function('require', 'module', 'exports', componentCode)(name => {
    assert.ok(Object.hasOwn(mocks, name), `Unexpected MessagesContent dependency: ${name}`);
    return mocks[name];
  }, componentModule, componentModule.exports);
  const Component = componentModule.exports.FixtureMessagesContent;
  assert.equal(typeof Component, 'function');

  const browser = {
    innerHeight: 800,
    get location() { return {href: url.href, pathname: url.pathname}; },
    history: {
      state: null,
      pushState(state, _title, href) { this.state = state; navigationCount++; url = new URL(href, url); params = new URLSearchParams(url.search); dirty = true; },
      replaceState(state, _title, href) { this.pushState(state, _title, href); },
      back() { navigationCount++; },
    },
    addEventListener(name, handler) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(handler); },
    removeEventListener(name, handler) { listeners.get(name)?.delete(handler); },
    dispatchEvent(event) { for (const handler of listeners.get(event.type) ?? []) handler(event); return true; },
    setInterval() { return ++timerId; }, clearInterval() {},
    setTimeout() { return ++timerId; }, clearTimeout() {},
  };
  globalThis.window = browser;
  globalThis.document = {body: {dataset: {}}, visibilityState: 'visible'};
  globalThis.fetch = async (input, options = {}) => {
    const request = {url: String(input), method: options.method ?? 'GET', owner: user?.id, options};
    calls.push(request);
    if (request.url === '/api/friendships') return Response.json({incoming: [], friends: []});
    return handle(request);
  };

  function render() {
    cursor = 0; dirty = false;
    tree = Component();
    for (const effect of effects.splice(0)) effect();
  }

  return {
    calls,
    get text() { return text(tree); },
    get alerts() { return nodes(tree, node => node.props.role === 'alert').map(text); },
    get navigationCount() { return navigationCount; },
    async settle() {
      for (let step = 0; step < 16; step++) { if (dirty) render(); await nextTurn(); }
      assert.equal(dirty, false, 'MessagesContent should settle without an effect/render loop');
    },
    retry(errorText) {
      const alert = nodes(tree, node => node.props.role === 'alert' && text(node).includes(errorText))[0];
      assert.ok(alert, `Expected visible alert ${errorText}`);
      const buttons = nodes(tree, node => node.type === 'button' && text(node).includes(readerText('messagesNavigation.retry')));
      assert.equal(buttons.length, 1, 'This single failed operation should expose one unambiguous retry action');
      const [button] = buttons;
      assert.equal(Boolean(button.props.disabled), false);
      button.props.onClick();
    },
    click(label) {
      const button = nodes(tree, node => node.type === 'button' && text(node).includes(label))[0];
      assert.ok(button, `Expected a button containing ${label}`);
      assert.equal(Boolean(button.props.disabled), false);
      button.props.onClick();
    },
    focus() { browser.dispatchEvent(new Event('focus')); },
    navigate(search) { url = new URL(`https://fixture.invalid/messages${search}`); params = new URLSearchParams(url.search); dirty = true; },
    changeOwner(id) { user = {id}; dirty = true; },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const slot of slots) slot?.cleanup?.();
      for (const [key, descriptor] of Object.entries(before)) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete globalThis[key];
      }
    },
  };
}

for (const failure of [401, 500, 'network']) {
  test(`conversation list ${failure} failure is visible and retry can recover without navigation`, async t => {
    let attempts = 0;
    const f = fixture(request => {
      assert.equal(request.url, '/api/conversations');
      if (++attempts > 1) return Response.json({data: []});
      if (failure === 'network') throw new TypeError('Fixture network unavailable');
      return Response.json({error: 'Fixture denied'}, {status: failure});
    });
    t.after(() => f.dispose());
    await f.settle();
    assert.ok(f.alerts.some(value => value.includes(readerText('messagesNavigation.loadError'))));
    assert.equal(f.text.includes('Keine Nachrichten'), false, 'A failed request is not a confirmed empty inbox');
    f.retry(readerText('messagesNavigation.loadError'));
    await f.settle();
    assert.equal(attempts, 2);
    assert.deepEqual(f.alerts, []);
    assert.ok(f.text.includes('Keine Nachrichten'));
    assert.equal(f.navigationCount, 0);
  });
}

test('a valid empty conversation result remains an actual empty state without an error', async t => {
  const f = fixture(request => {
    assert.equal(request.url, '/api/conversations');
    return Response.json({data: []});
  });
  t.after(() => f.dispose());
  await f.settle();
  assert.deepEqual(f.alerts, []);
  assert.ok(f.text.includes('Keine Nachrichten'));
});

test('a conversation load failure has a separate visible retry for the currently selected chat', async t => {
  let detailAttempts = 0;
  const f = fixture(request => {
    if (request.url === '/api/conversations') return Response.json({data: [conversation(chatA)]});
    assert.equal(request.url, `/api/conversations/${chatA}`);
    if (++detailAttempts === 1) return Response.json({error: 'Fixture unavailable'}, {status: 500});
    return Response.json({messages: [message('fixture_message_a', 'Recovered conversation message')], hasOlder: false});
  }, {query: `?conv=${chatA}`});
  t.after(() => f.dispose());
  await f.settle();
  assert.ok(f.alerts.some(value => value.includes(readerText('messagesNavigation.messageLoadError'))));
  f.retry(readerText('messagesNavigation.messageLoadError'));
  await f.settle();
  assert.equal(detailAttempts, 2);
  assert.deepEqual(f.alerts, []);
  assert.ok(f.text.includes('Recovered conversation message'));
  assert.equal(f.navigationCount, 0);
});

for (const oldResult of ['failure', 'success']) {
  test(`a late ${oldResult} from an old chat cannot replace the selected chat or its error state`, async t => {
    const pendingA = deferred();
    const f = fixture(request => {
      if (request.url === '/api/conversations') return Response.json({data: [conversation(chatA), conversation(chatB)]});
      if (request.url === `/api/conversations/${chatA}`) return pendingA.promise;
      assert.equal(request.url, `/api/conversations/${chatB}`);
      return Response.json({messages: [message('fixture_message_b', 'Selected B content')], hasOlder: false});
    }, {query: `?conv=${chatA}`});
    t.after(() => f.dispose());
    await f.settle();
    f.navigate(`?conv=${chatB}`);
    await f.settle();
    assert.ok(f.text.includes('Selected B content'));
    pendingA.resolve(oldResult === 'failure'
      ? Response.json({error: 'Late fixture error'}, {status: 500})
      : Response.json({messages: [message('fixture_message_a', 'Stale A content')], hasOlder: false}));
    await f.settle();
    assert.ok(f.text.includes('Selected B content'));
    assert.equal(f.text.includes('Stale A content'), false);
    assert.deepEqual(f.alerts, []);
  });
}

for (const oldResult of ['failure', 'success']) {
  test(`a late conversation-list ${oldResult} cannot overwrite the new account's inbox`, async t => {
    const pendingOwnerA = deferred();
    const f = fixture(request => {
      assert.equal(request.url, '/api/conversations');
      if (request.owner === ownerA) return pendingOwnerA.promise;
      return Response.json({data: [conversation(chatB, ownerB)]});
    });
    t.after(() => f.dispose());
    await f.settle();
    f.changeOwner(ownerB);
    await f.settle();
    assert.ok(f.text.includes('Conversation B'));
    pendingOwnerA.resolve(oldResult === 'failure'
      ? Response.json({error: 'Late old-account error'}, {status: 401})
      : Response.json({data: [conversation(chatA)]}));
    await f.settle();
    assert.ok(f.text.includes('Conversation B'));
    assert.equal(f.text.includes('Conversation A'), false);
    assert.deepEqual(f.alerts, []);
  });
}

test('a successful HTTP response without a conversation array is a load error, not an empty inbox', async t => {
  const f = fixture(request => {
    assert.equal(request.url, '/api/conversations');
    return Response.json({data: null});
  });
  t.after(() => f.dispose());
  await f.settle();
  assert.ok(f.alerts.some(value => value.includes(readerText('messagesNavigation.loadError'))));
  assert.equal(f.text.includes('Keine Nachrichten'), false);
});

test('a successful HTTP response without a message array is a conversation load error', async t => {
  const f = fixture(request => request.url === '/api/conversations'
    ? Response.json({data: [conversation(chatA)]})
    : Response.json({messages: null}), {query: `?conv=${chatA}`});
  t.after(() => f.dispose());
  await f.settle();
  assert.ok(f.alerts.some(value => value.includes(readerText('messagesNavigation.messageLoadError'))));
});

test('a failed read acknowledgement does not claim that already displayed messages failed to load', async t => {
  const f = fixture(request => {
    if (request.url === '/api/conversations') return Response.json({data: [conversation(chatA)]});
    if (request.url === `/api/conversations/${chatA}/read`) throw new TypeError('Fixture acknowledgement unavailable');
    assert.equal(request.url, `/api/conversations/${chatA}`);
    return Response.json({messages: [message('fixture_incoming', 'Loaded despite read acknowledgement failure', 'fixture_peer')], hasOlder: false});
  }, {query: `?conv=${chatA}`});
  t.after(() => f.dispose());
  await f.settle();
  assert.ok(f.text.includes('Loaded despite read acknowledgement failure'));
  assert.deepEqual(f.alerts, []);
  assert.equal(f.calls.filter(call => call.url.endsWith('/read') && call.method === 'POST').length, 1);
});

test('a failed refresh preserves existing messages and exposes a recovery action', async t => {
  let attempts = 0;
  const f = fixture(request => {
    if (request.url === '/api/conversations') return Response.json({data: [conversation(chatA)]});
    assert.equal(request.url, `/api/conversations/${chatA}`);
    return ++attempts === 1
      ? Response.json({messages: [message('fixture_saved', 'Previously loaded message')], hasOlder: false})
      : Response.json({error: 'Fixture refresh unavailable'}, {status: 500});
  }, {query: `?conv=${chatA}`});
  t.after(() => f.dispose());
  await f.settle();
  assert.ok(f.text.includes('Previously loaded message'));
  f.focus();
  await f.settle();
  assert.equal(attempts, 2);
  assert.ok(f.text.includes('Previously loaded message'));
  assert.ok(f.alerts.some(value => value.includes(readerText('messagesNavigation.messageLoadError'))));
});

test('retry after an older-page failure retries that cursor and preserves already loaded history', async t => {
  const olderRequests = [];
  const latest = message('fixture_latest', 'Latest loaded message');
  const older = {...message('fixture_older', 'Older recovered message'), created_at: '2026-11-09T08:00:00Z'};
  const f = fixture(request => {
    if (request.url === '/api/conversations') return Response.json({data: [conversation(chatA)]});
    const url = new URL(request.url, 'https://fixture.invalid');
    assert.equal(url.pathname, `/api/conversations/${chatA}`);
    if (!url.search) return Response.json({messages: [latest], hasOlder: true});
    olderRequests.push(url.search);
    return olderRequests.length === 1
      ? Response.json({error: 'Fixture older page unavailable'}, {status: 500})
      : Response.json({messages: [older], hasOlder: false});
  }, {query: `?conv=${chatA}`});
  t.after(() => f.dispose());
  await f.settle();
  f.click('Ältere Nachrichten laden');
  await f.settle();
  assert.ok(f.text.includes('Latest loaded message'));
  assert.ok(f.alerts.some(value => value.includes(readerText('messagesNavigation.messageLoadError'))));
  f.retry(readerText('messagesNavigation.messageLoadError'));
  await f.settle();
  assert.equal(olderRequests.length, 2);
  assert.equal(olderRequests[0], olderRequests[1]);
  assert.equal(new URLSearchParams(olderRequests[1]).get('before_id'), latest.id);
  assert.ok(f.text.includes('Latest loaded message'));
  assert.ok(f.text.includes('Older recovered message'));
  assert.deepEqual(f.alerts, []);
});
