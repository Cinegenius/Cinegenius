import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const source = await readFile(new URL('../src/workplace-account.js', import.meta.url), 'utf8');
const owner = 'user_Owner1';
const own = { id: '9e031ba4-993c-4809-8b50-b4564a7c9d2c', user_id: owner, type: 'location', title: 'Studio', city: 'Berlin', metadata: { private: 'not-for-native' } };
async function run(responses) {
  const calls = [];
  const context = vm.createContext({ setTimeout, clearTimeout, AbortController, fetch: async (path, options) => {
    calls.push({ path, options });
    const next = responses.shift();
    if (next instanceof Error) throw next;
    const { status = 200, body, type = 'application/json' } = next;
    return { status, ok: status >= 200 && status < 300, headers: { get: () => type }, json: async () => body };
  } });
  return { result: JSON.parse(await vm.runInContext(`(async()=>{${source}})()`, context)), calls };
}
const identity = id => ({ body: { userId: id, person: { privateName: 'omit' } } });
test('native projection uses only owned existing locations and no private profile fields', async () => {
  const { result, calls } = await run([identity(owner), { body: { data: [own, { ...own, id: 'other', user_id: 'user_Other' }, { ...own, id: 'prop', type: 'prop' }] } }, identity(owner)]);
  assert.deepEqual(result, { accountID: owner, locations: [{ id: own.id, title: 'Studio', city: 'Berlin' }], limited: false });
  assert.deepEqual(calls.map(c => c.path), ['/api/responsible-person', '/api/listings?mine=true', '/api/responsible-person']);
  for (const { options } of calls) {
    assert.equal(options.credentials, 'same-origin'); assert.equal(options.cache, 'no-store'); assert.equal(options.redirect, 'error');
    assert.equal(options.method, undefined); assert.equal(options.headers.Authorization, undefined);
  }
});
test('account switch during the request discards the entire result', async () => {
  const { result } = await run([identity(owner), { body: { data: [own] } }, identity('user_Other')]);
  assert.deepEqual(result, { error: 'accountChanged' });
});
test('expired session opens reauthentication, not an empty library', async () => {
  for (const responses of [[{ status: 401 }], [identity(owner), { status: 401 }], [identity(owner), { body: { data: [own] } }, { status: 401 }]]) {
    assert.deepEqual((await run(responses)).result, { error: 'signInRequired' });
  }
});
test('network, server and malformed responses fail closed without leaking error details', async () => {
  for (const responses of [
    [{ status: 503 }], [new Error('sensitive endpoint query')], [{ body: {}, type: 'text/html' }],
    [identity('../not-an-account')], [identity(owner), { body: {} }, identity(owner)],
  ]) assert.deepEqual((await run(responses)).result, { error: 'accountUnavailable' });
});
test('existing endpoint result cap is disclosed instead of claiming completeness', async () => {
  const rows = Array.from({ length: 200 }, (_, i) => ({ ...own, id: String(i) }));
  const { result } = await run([identity(owner), { body: { data: rows } }, identity(owner)]);
  assert.equal(result.limited, true); assert.equal(result.locations.length, 200);
});
