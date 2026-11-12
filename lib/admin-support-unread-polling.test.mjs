import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdminSupportUnreadRequestOwner } from './admin-support-unread-polling.ts';
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const tick = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
const response = (unreadCount, status = 200) => new Response(JSON.stringify({ unreadCount }), { status });

test('support refresh is authenticated, private, shared while pending, and keeps reads unchanged', async () => {
  const pending = deferred(), calls = [];
  const owner = createAdminSupportUnreadRequestOwner({ getToken: async () => 'fixture-session-token', request: async (...args) => { calls.push(args); return pending.promise; } });
  await owner.refresh(); assert.equal(calls.length, 0);
  owner.setActive(true); const first = owner.refresh(); const second = owner.refresh(); await tick();
  assert.equal(first, second); assert.equal(calls.length, 1);
  assert.equal(calls[0][0], '/api/admin/support/unread'); assert.equal(calls[0][1].cache, 'no-store');
  assert.equal(calls[0][1].headers.Authorization, 'Bearer fixture-session-token'); assert.equal(calls[0][1].method, undefined);
  pending.resolve(response(8)); await first;
  assert.deepEqual(owner.snapshot(), { count: 8, status: 'ready' });
});

test('session switch aborts requests, clears old counts and ignores a late old response', async () => {
  const old = deferred(), fresh = deferred(); let calls = 0, signal;
  const owner = createAdminSupportUnreadRequestOwner({ getToken: async () => 'fixture', request: async (_url, options) => { if (++calls === 1) { signal = options.signal; return old.promise; } return fresh.promise; } });
  owner.setActive(true); const first = owner.refresh(); await tick();
  owner.setActive(false); assert.equal(signal.aborted, true); assert.equal(owner.snapshot().count, null);
  owner.setActive(true); const next = owner.refresh(); await tick();
  fresh.resolve(response(3)); await next; old.resolve(response(99)); await first;
  assert.deepEqual(owner.snapshot(), { count: 3, status: 'ready' });
});

test('a late token after deactivation sends no request', async () => {
  const token = deferred(); let calls = 0;
  const owner = createAdminSupportUnreadRequestOwner({ getToken: () => token.promise, request: async () => { calls++; return response(1); } });
  owner.setActive(true); const pending = owner.refresh(); owner.setActive(false);
  token.resolve('old-session'); await pending; assert.equal(calls, 0); assert.equal(owner.snapshot().count, null);
});

test('provider, access and malformed-response failures never report a false zero and can recover', async () => {
  for (const failure of [async () => response(0, 403), async () => response('invalid'), async () => response(-1), async () => { throw Error('offline'); }]) {
    let fail = false;
    const owner = createAdminSupportUnreadRequestOwner({ getToken: async () => 'fixture', request: async () => fail ? failure() : response(7) });
    owner.setActive(true); await owner.refresh(); fail = true; await owner.refresh();
    assert.deepEqual(owner.snapshot(), { count: 7, status: 'error' });
    fail = false; await owner.refresh(); assert.deepEqual(owner.snapshot(), { count: 7, status: 'ready' });
  }
});

test('a hanging token times out and a subsequent refresh can recover without reloading', async () => {
  let hang = true, requests = 0;
  const owner = createAdminSupportUnreadRequestOwner({ timeoutMs: 10, getToken: () => hang ? new Promise(() => {}) : Promise.resolve('fresh'), request: async () => { requests++; return response(4); } });
  owner.setActive(true); await owner.refresh();
  assert.deepEqual(owner.snapshot(), { count: null, status: 'error' }); assert.equal(requests, 0);
  hang = false; await owner.refresh(); assert.deepEqual(owner.snapshot(), { count: 4, status: 'ready' });
});

test('a read event invalidates an in-flight pre-read snapshot and refreshes immediately', async () => {
  const before = deferred(), after = deferred(); let calls = 0, oldSignal;
  const owner = createAdminSupportUnreadRequestOwner({ getToken: async () => 'fixture', request: async (_url, options) => { if (++calls === 1) { oldSignal = options.signal; return before.promise; } return after.promise; } });
  owner.setActive(true); const first = owner.refresh(); await tick();
  const refreshed = owner.refresh(true); await tick(); assert.equal(oldSignal.aborted, true); assert.equal(calls, 2);
  after.resolve(response(0)); await refreshed; before.resolve(response(8)); await first;
  assert.deepEqual(owner.snapshot(), { count: 0, status: 'ready' });
});
