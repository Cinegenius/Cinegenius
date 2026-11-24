import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';
import * as tasks from './auth-session-tasks.ts';

const compile = path => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const helper = { exports: {} };
new Function('require', 'module', 'exports', compile('./native-app-boot-readiness.ts'))(
  name => { assert.equal(name, './auth-session-tasks'); return tasks; }, helper, helper.exports,
);

function fixture() {
  const state = { auth: { isLoaded: true, isSignedIn: true, userId: 'account-a', sessionId: 'session-a', orgId: null },
    session: { id: 'session-a', status: 'active', user: { id: 'account-a' }, currentTask: null, lastActiveOrganizationId: null }, loaded: true, bridge: false };
  const attributes = new Map(), history = [];
  const root = { getAttribute: name => attributes.get(name) ?? null,
    setAttribute(name, value) { attributes.set(name, value); history.push([name, value]); },
    removeAttribute(name) { attributes.delete(name); history.push([name, null]); } };
  const window = { crypto: webcrypto }; window.self = window.top = window;
  const authContext = { exports: {} };
  new Function('module', 'exports', 'document', 'window', 'location', compile('./native-app-auth-context.ts'))(
    authContext, authContext.exports, { documentElement: root }, window, { protocol: 'https:' },
  );
  const calls = [], effects = []; let cursor = 0, changes = [];
  const mocks = {
    react: { useLayoutEffect(effect, next) {
      const index = cursor++, previous = effects[index];
      if (previous && next.length === previous.dependencies.length && next.every((value, i) => Object.is(value, previous.dependencies[i]))) return;
      changes.push({ index, effect, dependencies: next });
    } },
    '@clerk/nextjs': { useAuth: () => state.auth, useSession: () => ({ session: state.session, isLoaded: state.loaded }) },
    './use-native-capability': { useNativeCapability(capability) { assert.equal(capability, 'workspace'); return state.bridge; } },
    './native-app-boot-readiness': { nativeBootSession: helper.exports.nativeBootSession,
      installNativeAppBootReadiness(options) { const call = { ...options, closed: false }; calls.push(call); return () => { call.closed = true; }; } },
    './native-app-auth-context': authContext.exports,
  };
  const module = { exports: {} };
  new Function('require', 'module', 'exports', compile('./use-native-app-boot-readiness.ts'))(
    name => { assert.ok(name in mocks, name); return mocks[name]; }, module, module.exports,
  );
  return { state, calls, history, nonce: () => root.getAttribute('data-native-app-auth-context'),
    render(native = false, pathname = '/dashboard') {
      cursor = 0; changes = []; module.exports.useNativeAppBootReadiness(native, pathname);
      // React performs all layout-effect cleanups before the new layout effects.
      for (const { index } of changes) effects[index]?.cleanup?.();
      for (const change of changes) effects[change.index] = { ...change, cleanup: change.effect() };
    },
    cleanup() { for (const effect of effects) effect.cleanup?.(); effects.length = 0; },
  };
}

test('ordinary website installs no native readiness observer; installed bridge enables actual guest auth pages', () => {
  const f = fixture(); f.render(); assert.deepEqual(f.calls, []);
  f.state.bridge = true; f.state.auth = { isLoaded: true, isSignedIn: false, userId: null, sessionId: null }; f.state.session = null;
  f.render(false, '/sign-in'); assert.equal(f.calls.at(-1).session, 'guest'); assert.equal(f.calls.at(-1).pathname, '/sign-in');
  f.cleanup(); assert.ok(f.calls.at(-1).closed);
});

test('auth context is stable across route/layout-equivalent renders and native presentation capability changes', () => {
  const f = fixture(); f.render(); assert.equal(f.nonce(), null);
  f.render(true); const nonce = f.nonce(); assert.match(nonce, /^[0-9a-f]{32}$/);
  f.render(true, '/projects'); assert.equal(f.nonce(), nonce); assert.equal(f.calls[0].closed, true);
  f.state.auth = { ...f.state.auth }; f.state.session = { ...f.state.session, user: { ...f.state.session.user } };
  f.render(true); assert.equal(f.nonce(), nonce);
  f.state.bridge = true; f.render(false); assert.equal(f.nonce(), nonce, 'One remaining native capability preserves the same scope');
  f.state.bridge = false; f.render(false); assert.equal(f.nonce(), null);
  f.cleanup();
});

test('guest, masked pending and member are distinct resolved contexts, never exports of account data', () => {
  const f = fixture();
  f.state.auth = { isLoaded: true, isSignedIn: false, userId: null, sessionId: null, orgId: null }; f.state.session = null;
  f.render(true, '/sign-in'); const guest = f.nonce(); assert.match(guest, /^[0-9a-f]{32}$/); assert.equal(f.calls.at(-1).session, 'guest');
  f.state.session = { id: 'pending-a', status: 'pending', user: { id: 'account-a' }, currentTask: { key: 'choose-organization' }, lastActiveOrganizationId: 'org-a' };
  f.render(true, '/sign-in/tasks/choose-organization'); const pending = f.nonce();
  assert.match(pending, /^[0-9a-f]{32}$/); assert.notEqual(pending, guest); assert.equal(f.calls.at(-1).session, 'pending');
  f.state.session.currentTask = { key: 'setup-mfa' }; f.render(true, '/sign-in/tasks/setup-mfa'); const task = f.nonce(); assert.notEqual(task, pending);
  f.state.auth = { isLoaded: true, isSignedIn: true, userId: 'account-a', sessionId: 'pending-a', orgId: 'org-a' };
  f.state.session = { ...f.state.session, status: 'active', currentTask: null }; f.render(true);
  assert.match(f.nonce(), /^[0-9a-f]{32}$/); assert.notEqual(f.nonce(), task); assert.equal(f.calls.at(-1).session, 'member');
  assert.ok(f.history.every(([key, value]) => key === 'data-native-app-auth-context' && (value === null || /^[0-9a-f]{32}$/.test(value))));
  f.cleanup(); assert.equal(f.nonce(), null);
});

test('unresolved, mismatched, unloaded, revoked and unsupported-task states revoke and rekey on recovery', () => {
  const changes = [
    state => { state.auth.isLoaded = false; }, state => { state.loaded = false; },
    state => { state.auth.isSignedIn = undefined; }, state => { state.auth.userId = 'other'; },
    state => { state.auth.sessionId = 'other'; }, state => { state.session = null; },
    state => { state.session.user = undefined; }, state => { state.session.status = 'revoked'; },
    state => { state.session.currentTask = { key: 'setup-mfa' }; },
    state => { state.auth.isSignedIn = false; state.session.status = 'pending'; state.session.currentTask = { key: 'unknown-task' }; },
  ];
  for (const change of changes) {
    const f = fixture(), original = structuredClone(f.state); f.render(true); const old = f.nonce();
    change(f.state); f.render(true); assert.equal(f.nonce(), null);
    Object.assign(f.state, original); f.render(true); assert.match(f.nonce(), /^[0-9a-f]{32}$/); assert.notEqual(f.nonce(), old);
    f.cleanup();
  }
});

test('both org observations rotate independently without reinterpreting Clerk classification or restarting legacy readiness', () => {
  const f = fixture(); f.render(true); let previous = f.nonce();
  for (const [source, key, value] of [[f.state.auth, 'orgId', 'org-a'], [f.state.session, 'lastActiveOrganizationId', 'org-a'],
    [f.state.auth, 'orgId', null], [f.state.session, 'lastActiveOrganizationId', null]]) {
    source[key] = value; f.render(true); assert.match(f.nonce(), /^[0-9a-f]{32}$/); assert.notEqual(f.nonce(), previous); previous = f.nonce();
  }
  assert.equal(f.calls.length, 1, 'Legacy boot-ready contract unchanged by the additive scope marker'); f.cleanup();
});

test('direct account/session replacement, logout and StrictMode remount never retain the previous nonce', () => {
  const f = fixture(); f.render(true); let previous = f.nonce();
  for (const replacement of [{ user: 'account-a', session: 'session-b' }, { user: 'account-b', session: 'session-c' }]) {
    f.state.auth.userId = replacement.user; f.state.auth.sessionId = replacement.session;
    f.state.session.id = replacement.session; f.state.session.user.id = replacement.user;
    f.render(true); assert.notEqual(f.nonce(), previous); assert.match(f.nonce(), /^[0-9a-f]{32}$/); previous = f.nonce();
  }
  f.state.auth = { isLoaded: true, isSignedIn: false, userId: null, sessionId: null, orgId: null }; f.state.session = null;
  f.render(true, '/sign-in'); assert.notEqual(f.nonce(), previous); const guest = f.nonce();
  f.cleanup(); assert.equal(f.nonce(), null); f.render(true, '/sign-in'); assert.match(f.nonce(), /^[0-9a-f]{32}$/); assert.notEqual(f.nonce(), guest);
  f.cleanup(); assert.equal(f.nonce(), null);
});

test('account/session/task/path changes dispose the prior proof before arming the current matching SDK state', () => {
  const f = fixture(); f.render(true); assert.equal(f.calls.at(-1).session, 'member');
  f.render(true); assert.equal(f.calls.length, 1, 'Equivalent renders do not restart current proof');
  f.state.auth = { ...f.state.auth, userId: 'account-b', sessionId: 'session-b' }; f.render(true);
  assert.ok(f.calls[0].closed); assert.equal(f.calls.at(-1).session, 'unresolved', 'Old useSession cannot authorize the new useAuth account');
  f.state.session = { id: 'session-b', status: 'active', user: { id: 'account-b' }, currentTask: null }; f.render(true);
  assert.ok(f.calls[1].closed); assert.equal(f.calls.at(-1).session, 'member');
  f.state.session = { id: 'session-b', status: 'active' }; f.render(true); assert.equal(f.calls.at(-1).session, 'unresolved', 'Matching session IDs without current user still fail closed');
  f.state.auth = { isLoaded: true, isSignedIn: false, userId: null, sessionId: null }; f.state.session = { id: 'pending', status: 'pending', currentTask: { key: 'setup-mfa' } };
  f.render(true, '/sign-in/tasks/setup-mfa'); assert.equal(f.calls.at(-1).session, 'pending'); assert.equal(f.calls.at(-1).task, 'setup-mfa');
  assert.ok(f.calls.slice(0, -1).every(call => call.closed)); f.cleanup();
});
