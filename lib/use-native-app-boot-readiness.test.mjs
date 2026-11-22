import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
  const state = { auth: { isLoaded: true, isSignedIn: true, userId: 'account-a', sessionId: 'session-a' },
    session: { id: 'session-a', status: 'active', user: { id: 'account-a' }, currentTask: null }, loaded: true, bridge: false };
  const calls = []; let dependencies, cleanup;
  const mocks = {
    react: { useLayoutEffect(effect, next) {
      if (dependencies && next.every((value, index) => Object.is(value, dependencies[index]))) return;
      cleanup?.(); dependencies = next; cleanup = effect();
    } },
    '@clerk/nextjs': { useAuth: () => state.auth, useSession: () => ({ session: state.session, isLoaded: state.loaded }) },
    './use-native-capability': { useNativeCapability(capability) { assert.equal(capability, 'workspace'); return state.bridge; } },
    './native-app-boot-readiness': { nativeBootSession: helper.exports.nativeBootSession,
      installNativeAppBootReadiness(options) { const call = { ...options, closed: false }; calls.push(call); return () => { call.closed = true; }; } },
  };
  const module = { exports: {} };
  new Function('require', 'module', 'exports', compile('./use-native-app-boot-readiness.ts'))(
    name => { assert.ok(name in mocks, name); return mocks[name]; }, module, module.exports,
  );
  return { state, calls, render: (native = false, pathname = '/dashboard') => module.exports.useNativeAppBootReadiness(native, pathname), cleanup: () => cleanup?.() };
}

test('ordinary website installs no native readiness observer; installed bridge enables actual guest auth pages', () => {
  const f = fixture(); f.render(); assert.deepEqual(f.calls, []);
  f.state.bridge = true; f.state.auth = { isLoaded: true, isSignedIn: false, userId: null, sessionId: null }; f.state.session = null;
  f.render(false, '/sign-in'); assert.equal(f.calls.at(-1).session, 'guest'); assert.equal(f.calls.at(-1).pathname, '/sign-in');
  f.cleanup(); assert.ok(f.calls.at(-1).closed);
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
