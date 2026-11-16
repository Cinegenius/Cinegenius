import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createTranslator, createFormatter } from 'use-intl/core';
import ts from 'typescript';
import * as activity from './account-activity-client.ts';

const { isAccountActivityStatus, requestAccountActivity, trackAccountActivity, AccountActivityError, ACTIVITY_INTERVAL_MS } = activity;
const status = (stage = 'active', extra = {}) => ({ enabled: true, state: {
  stage, exempt: false, lastActivityAt: '2026-11-16T12:00:00.000Z',
  reminderAt: '2027-11-16T12:00:00.000Z', warningAt: '2028-02-16T12:00:00.000Z',
  pauseAt: '2028-05-16T12:00:00.000Z', deletionNoticeAt: '2028-11-16T12:00:00.000Z', reviewAfter: null,
}, ...extra });
const flush = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(accept => { resolve = accept; }); return { promise, resolve }; };
const response = (value = status(), options = {}) => new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' }, ...options });

class Target {
  listeners = new Map();
  visibilityState = 'visible';
  addEventListener(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(fn); }
  removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); }
  emit(type, isTrusted = false) { for (const fn of this.listeners.get(type) ?? []) fn({ type, isTrusted }); }
  count() { return [...this.listeners.values()].reduce((n, fns) => n + fns.size, 0); }
}
function tracker(request = async () => status(), options = {}) {
  const page = new Target(), events = new Target(), confirmed = [], calls = [];
  let clock = 0, online = options.online ?? true;
  page.visibilityState = options.visibility ?? 'visible';
  const stop = trackAccountActivity({ page, events, online: () => online, now: () => clock,
    request: (method, signal) => { calls.push({ method, signal }); return request(method, signal); }, confirmed: result => confirmed.push(result) });
  return { page, events, confirmed, calls, stop, advance: ms => { clock += ms; }, online: value => { online = value; } };
}

test('activity status validates capabilities, all stages, UTC PostgreSQL dates and nullable review', () => {
  for (const stage of activity.ACTIVITY_STAGES) assert.equal(isAccountActivityStatus(status(stage)), true);
  assert.equal(isAccountActivityStatus({ enabled: false, state: null }), true);
  assert.equal(isAccountActivityStatus({ enabled: true, state: null }), true);
  const postgres = status(); postgres.state.lastActivityAt = '2026-11-16T12:00:00.123456+00:00';
  postgres.state.reviewAfter = '2028-12-20T12:00:00Z';
  assert.equal(isAccountActivityStatus(postgres), true);
});

test('malformed/contradictory 2xx payloads and invalid dates never look like saved activity', () => {
  for (const value of [null, [], {}, { enabled: false }, { enabled: 'true', state: null },
    { enabled: false, state: status().state }, { enabled: false, state: null, reactivated: true },
    { enabled: true, state: null, reactivated: true }, status('unknown'), status('paused', { reactivated: true }),
    status('active', { reactivated: 'true' }), status('active', { state: {} })]) assert.equal(isAccountActivityStatus(value), false);
  for (const date of ['yesterday', '2026-02-30T12:00:00Z', '2026-11-16', '2026-11-16T12:00:00+01:00', null]) {
    const value = status(); value.state.pauseAt = date; assert.equal(isAccountActivityStatus(value), false);
  }
});

test('GET and POST use same-origin private requests without account/time/body/token', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (...args) => { calls.push(args); return response(); });
  for (const method of ['GET', 'POST']) await requestAccountActivity(method, new AbortController().signal);
  assert.deepEqual(calls.map(([url, init]) => [url, init.method, init.body, init.credentials, init.cache, init.redirect]), [
    ['/api/account/activity', 'GET', undefined, 'same-origin', 'no-store', 'error'],
    ['/api/account/activity', 'POST', undefined, 'same-origin', 'no-store', 'error'],
  ]);
  for (const [, init] of calls) assert.deepEqual(init.headers, { Accept: 'application/json' });
});

test('request failures, HTML and malformed JSON do not become success', async t => {
  for (const code of [401, 403, 429, 503]) {
    t.mock.method(globalThis, 'fetch', async () => response({}, { status: code, headers: { 'Retry-After': '120' } }));
    await assert.rejects(requestAccountActivity('POST', new AbortController().signal), error => error.status === code && error.retryMs === 120_000);
  }
  for (const value of [{}, { enabled: false }, { enabled: true, state: { stage: 'active' } }]) {
    t.mock.method(globalThis, 'fetch', async () => response(value));
    await assert.rejects(requestAccountActivity('GET', new AbortController().signal), AccountActivityError);
  }
  t.mock.method(globalThis, 'fetch', async () => new Response('<html>Sign in</html>', { headers: { 'Content-Type': 'text/html' } }));
  await assert.rejects(requestAccountActivity('GET', new AbortController().signal), AccountActivityError);
});

test('caller cancellation rejects a late otherwise valid response', async t => {
  const result = deferred(), caller = new AbortController(); let signal;
  t.mock.method(globalThis, 'fetch', (_url, init) => { signal = init.signal; return result.promise; });
  const pending = requestAccountActivity('GET', caller.signal); caller.abort();
  assert.equal(signal.aborted, true); result.resolve(response());
  await assert.rejects(pending, { name: 'AbortError' });
});

test('an unresponsive request times out without confirming activity', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  t.mock.method(globalThis, 'fetch', (_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  }));
  const pending = requestAccountActivity('GET', new AbortController().signal);
  const rejected = assert.rejects(pending, { name: 'AbortError' });
  t.mock.timers.tick(12_000); await rejected;
});

test('session entry, concurrent resume and real interaction share an hourly throttle without a heartbeat', async () => {
  const pending = deferred(), f = tracker(() => pending.promise);
  f.events.emit('cinegenius:app-resume'); f.events.emit('pageshow'); f.page.emit('pointerdown', true);
  assert.equal(f.calls.length, 1); pending.resolve(status()); await flush();
  assert.equal(f.confirmed.length, 1);
  f.advance(ACTIVITY_INTERVAL_MS - 1); f.events.emit('cinegenius:app-resume'); assert.equal(f.calls.length, 1);
  f.advance(2); await flush(); assert.equal(f.calls.length, 1, 'clock alone sends nothing');
  f.page.emit('pointerdown', false); assert.equal(f.calls.length, 1);
  f.events.emit('cinegenius:app-resume'); await flush(); assert.equal(f.calls.length, 2); f.stop();
});

test('background or offline entry sends nothing and a foreground network return recovers', async () => {
  const f = tracker(undefined, { visibility: 'hidden', online: false });
  f.events.emit('cinegenius:app-resume'); assert.equal(f.calls.length, 0);
  f.page.visibilityState = 'visible'; f.page.emit('visibilitychange'); assert.equal(f.calls.length, 0);
  f.online(true); f.events.emit('online'); await flush(); assert.equal(f.calls.length, 1); f.stop();
});

test('disabled, not-yet-recorded and still-inactive responses never confirm activity', async () => {
  for (const value of [{ enabled: false, state: null }, { enabled: true, state: null }, status('warning'), status('paused')]) {
    const f = tracker(async () => value); await flush(); assert.equal(f.confirmed.length, 0);
    f.events.emit('cinegenius:app-resume'); assert.equal(f.calls.length, 1); f.stop();
  }
});

test('rate limit and transient errors retry on a later entry without a success throttle', async () => {
  for (const error of [new TypeError('offline'), new AccountActivityError(503), new AccountActivityError(429, 600_000)]) {
    let attempt = 0;
    const f = tracker(async () => { if (++attempt === 1) throw error; return status(); }); await flush();
    assert.equal(f.confirmed.length, 0); f.advance(59_000); f.events.emit('online'); assert.equal(f.calls.length, 1);
    f.advance(error.retryMs ?? 60_000); f.events.emit('cinegenius:app-resume'); await flush();
    assert.equal(f.calls.length, 2); assert.equal(f.confirmed.length, 1); f.stop();
  }
});

test('account/session disposal aborts and discards late responses, including reactivation', async () => {
  const delayed = deferred(), old = tracker(() => delayed.promise); old.stop();
  assert.equal(old.calls[0].signal.aborted, true); assert.equal(old.page.count() + old.events.count(), 0);
  const next = tracker(); delayed.resolve(status('active', { reactivated: true })); await flush();
  assert.equal(old.confirmed.length, 0); assert.equal(next.confirmed.length, 1); next.stop();
});

test('background interruption discards an older request even after a fresh resume succeeds', async () => {
  const delayed = deferred(); let attempt = 0;
  const f = tracker(() => ++attempt === 1 ? delayed.promise : Promise.resolve(status()));
  f.page.visibilityState = 'hidden'; f.page.emit('visibilitychange'); assert.equal(f.calls[0].signal.aborted, true);
  f.page.visibilityState = 'visible'; f.events.emit('cinegenius:app-resume'); await flush();
  delayed.resolve(status('active', { reactivated: true })); await flush(); assert.equal(f.confirmed.length, 1); f.stop();
});

const require = createRequire(import.meta.url);
const componentSource = ts.transpileModule(readFileSync(new URL('../components/AccountActivitySettings.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;
function render(locale, data, accountId = 'synthetic-account') {
  const messages = JSON.parse(readFileSync(new URL('../messages/' + locale + '.json', import.meta.url), 'utf8'));
  const mock = {
    react: { ...React, useEffect: () => {}, useState: initial => [initial?.kind === 'loading' ? data : initial, () => {}] },
    'next-intl': { useTranslations: namespace => createTranslator({ locale, messages, namespace, onError: error => { throw error; } }), useFormatter: () => createFormatter({ locale, timeZone: 'UTC' }) },
    '@/lib/account-activity-client': activity,
  };
  const m = { exports: {} }; new Function('require', 'module', 'exports', componentSource)(name => mock[name] ?? require(name), m, m.exports);
  return renderToStaticMarkup(React.createElement(m.exports.default, { accountId }));
}
for (const locale of ['de', 'en', 'es', 'it', 'cs', 'hu', 'nl', 'nl-BE', 'sv']) {
  test(`${locale}: status, every stage, server dates and recovery render without missing copy`, () => {
    for (const stage of activity.ACTIVITY_STAGES) {
      const data = status(stage); data.state.reviewAfter = '2028-12-20T12:00:00Z';
      const html = render(locale, { kind: 'ready', data });
      assert.doesNotMatch(html, /AccountActivity\.|Invalid Date|undefined/);
      assert.match(html, /dateTime="2028-12-20T12:00:00Z"/);
      assert.equal((html.match(/<time /g) ?? []).length, 6);
    }
    for (const data of [{ enabled: false, state: null }, { enabled: true, state: null }, status('active', { state: { ...status().state, exempt: true } })]) {
      assert.doesNotMatch(render(locale, { kind: 'ready', data }), /<time /);
    }
    assert.match(render(locale, { kind: 'loading' }), /aria-busy="true"/);
    assert.match(render(locale, { kind: 'error' }), /role="alert"/);
    assert.equal(render(locale, { kind: 'ready', data: status() }, null), '');
  });
}

test('React tracker waits for a confirmed account AND session before registering any activity', () => {
  const compiled = ts.transpileModule(readFileSync(new URL('../components/AccountActivityTracker.tsx', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const router = { refresh() {} };
  for (const auth of [{ isLoaded: false, userId: 'user_one', sessionId: 'session_one' }, { isLoaded: true, userId: null, sessionId: null }, { isLoaded: true, userId: 'user_one', sessionId: null }]) {
    let registrations = 0;
    const mocks = { react: { useEffect: fn => fn() }, '@clerk/nextjs': { useAuth: () => auth }, 'next/navigation': { useRouter: () => router }, '@/lib/account-activity-client': { ...activity, trackAccountActivity() { registrations++; } } };
    const mod = { exports: {} }; new Function('require', 'module', 'exports', compiled)(name => mocks[name], mod, mod.exports); mod.exports.default();
    assert.equal(registrations, 0);
  }
});
