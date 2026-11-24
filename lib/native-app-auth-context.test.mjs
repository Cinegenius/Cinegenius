import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';

const compiled = ts.transpileModule(readFileSync(new URL('./native-app-auth-context.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function fixture({ crypto = webcrypto, protocol = 'https:', frame = false } = {}) {
  const attributes = new Map([['data-native-app-boot-ready', 'v1']]);
  const root = { getAttribute: name => attributes.get(name) ?? null,
    setAttribute: (name, value) => attributes.set(name, value), removeAttribute: name => attributes.delete(name) };
  const document = { documentElement: root };
  const window = { crypto }; window.self = window; window.top = frame ? {} : window;
  const module = { exports: {} };
  new Function('module', 'exports', 'document', 'window', 'location', compiled)(module, module.exports, document, window, { protocol });
  return { ...module.exports, root, attributes, window,
    value: () => root.getAttribute(module.exports.NATIVE_APP_AUTH_CONTEXT) };
}

test('new scope emits exactly 128 random bits as lowercase hex without altering the legacy boot marker', () => {
  let calls = 0;
  const f = fixture({ crypto: { getRandomValues(bytes) {
    calls++; assert.equal(bytes.byteLength, 16); assert.ok(bytes instanceof Uint8Array);
    bytes.set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 254, 255]); return bytes;
  } } });
  const dispose = f.installNativeAppAuthContext();
  assert.equal(f.value(), '000102030405060708090a0b0c0dfeff'); assert.equal(calls, 1);
  assert.equal(f.root.getAttribute('data-native-app-boot-ready'), 'v1');
  assert.equal(f.attributes.size, 2); dispose(); dispose();
  assert.equal(f.value(), null); assert.equal(f.root.getAttribute('data-native-app-boot-ready'), 'v1');
});

test('new installations rotate; late old cleanup cannot revoke a newer claim even if a test RNG repeats bytes', () => {
  for (const crypto of [webcrypto, { getRandomValues: bytes => bytes.fill(1) }]) {
    const f = fixture({ crypto }), firstCleanup = f.installNativeAppAuthContext(), first = f.value();
    const currentCleanup = f.installNativeAppAuthContext(), current = f.value();
    assert.match(current, /^[a-f0-9]{32}$/);
    if (crypto === webcrypto) assert.notEqual(current, first);
    firstCleanup(); assert.equal(f.value(), current); currentCleanup(); assert.equal(f.value(), null);
    f.installNativeAppAuthContext(); currentCleanup(); assert.match(f.value(), /^[a-f0-9]{32}$/);
  }
});

test('missing or failed secure randomness revokes any old marker without a substitute value', () => {
  for (const crypto of [null, {}, { getRandomValues() { throw new Error('unavailable'); } }]) {
    const f = fixture(); const old = f.installNativeAppAuthContext(); assert.ok(f.value());
    f.window.crypto = crypto;
    const dispose = f.installNativeAppAuthContext(); assert.equal(f.value(), null);
    old(); dispose(); assert.equal(f.value(), null);
    assert.equal(f.root.getAttribute('data-native-app-boot-ready'), 'v1');
  }
});

test('non-HTTPS and embedded documents never expose a context marker', () => {
  for (const options of [{ protocol: 'http:' }, { frame: true }]) {
    const f = fixture(options); f.root.setAttribute(f.NATIVE_APP_AUTH_CONTEXT, 'old');
    f.installNativeAppAuthContext()(); assert.equal(f.value(), null);
  }
});
