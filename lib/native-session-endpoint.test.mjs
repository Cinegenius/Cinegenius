import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setImmediate as tick } from 'node:timers/promises';
import ts from 'typescript';
import * as locales from './i18n/locales.ts';
import * as adminPolicy from './admin-policy.ts';

function load(file, mocks) {
  const code = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', 'Response', 'fetch', code)(name => {
    assert.ok(Object.hasOwn(mocks, name), 'Unexpected dependency in lean session endpoint: ' + name);
    return mocks[name];
  }, loaded, loaded.exports, Response, () => assert.fail('The session endpoint must not make outgoing HTTP requests'));
  return loaded.exports;
}

/** Only the current-request Clerk boundary is mocked; getCurrentUser is real. */
function fixture({ state = 'active', userId = 'user_Current', locale = 'de', authError = false, localeError = false, authGate } = {}) {
  const calls = { auth: [], locale: 0 };
  const auth = load('lib/auth/index.ts', {
    '@clerk/nextjs/server': { async auth(options) {
      calls.auth.push(options);
      if (authGate) await authGate;
      if (authError) throw Error('PRIVATE_AUTH_VERIFICATION_DETAIL');
      // Installed Clerk treats pending security-task sessions as signed out by
      // default. Never opt this current-request helper out of that policy.
      const active = state === 'active' || state === 'pending' && options?.treatPendingAsSignedOut === false;
      return { userId: active ? userId : null, sessionId: active ? 'sess_Synthetic' : null, sessionStatus: state === 'pending' ? 'pending' : active ? 'active' : null };
    } },
    'next-intl/server': { getTranslations: async () => assert.fail('Session identity must not load response translations') },
    '../../messages/de.json': { default: { System: {} } },
    'next/server': { NextResponse: Response },
    '@/lib/admin-policy': adminPolicy,
  });
  const endpoint = load(process.env.CINEGENIUS_NATIVE_SESSION_SOURCE ?? 'app/api/native/v1/session/route.ts', {
    '@/lib/auth': auth,
    '@/lib/i18n/locales': locales,
    'next-intl/server': { async getLocale() { calls.locale++; if (localeError) throw Error('PRIVATE_LOCALE_DETAIL'); return locale; } },
  });
  return { ...endpoint, calls, change(next) {
    if ('state' in next) state = next.state;
    if ('userId' in next) userId = next.userId;
    if ('locale' in next) locale = next.locale;
  } };
}

function privateResponse(response) {
  assert.equal(response.headers.get('cache-control'), 'private, no-store, max-age=0');
  assert.equal(response.headers.get('cdn-cache-control'), 'no-store');
  assert.equal(response.headers.get('vercel-cdn-cache-control'), 'no-store');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('set-cookie'), null, 'This endpoint does not copy or export session credentials');
}

test('the active current request returns only its verified user ID and canonical locale', async () => {
  const f = fixture({ userId: 'user_Verified', locale: 'en' });
  assert.equal(f.runtime, 'nodejs'); assert.equal(f.dynamic, 'force-dynamic');
  const response = await f.GET(); privateResponse(response);
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { userId: 'user_Verified', locale: 'en' });
  assert.deepEqual(f.calls, { auth: [undefined], locale: 1 });
});

for (const state of ['guest', 'pending', 'signed-out']) test(`${state} receives401 without locale, profile or service lookups`, async () => {
  const f = fixture({ state }); const response = await f.GET(); privateResponse(response);
  assert.equal(response.status, 401); assert.deepEqual(await response.json(), { error: 'unauthorized' });
  assert.deepEqual(f.calls, { auth: [undefined], locale: 0 });
});

test('a request waits for its current verification; no identity is exposed before it settles', async () => {
  const gate = Promise.withResolvers(), f = fixture({ authGate: gate.promise });
  let finished = false;
  const pending = f.GET().then(response => { finished = true; return response; }); await tick();
  assert.equal(finished, false); assert.equal(f.calls.locale, 0);
  gate.resolve(); const response = await pending; assert.equal(response.status, 200); privateResponse(response);
});

test('logout and account replacement are checked again on every call, without a cached identity', async () => {
  const f = fixture({ userId: 'user_A', locale: 'es' });
  assert.deepEqual(await (await f.GET()).json(), { userId: 'user_A', locale: 'es' });
  f.change({ state: 'signed-out' }); const loggedOut = await f.GET(); privateResponse(loggedOut);
  assert.equal(loggedOut.status, 401); assert.deepEqual(await loggedOut.json(), { error: 'unauthorized' });
  f.change({ state: 'active', userId: 'user_B', locale: 'nl_BE' }); const next = await f.GET(); privateResponse(next);
  assert.deepEqual(await next.json(), { userId: 'user_B', locale: 'nl-BE' });
  assert.deepEqual(f.calls, { auth: [undefined, undefined, undefined], locale: 2 });
});

test('spoofed query and client identity headers cannot select the returned account or locale', async () => {
  const f = fixture({ userId: 'user_Current', locale: 'it' });
  const request = new Request('https://www.cinegenius.co/api/native/v1/session?userId=user_Forged&accountId=user_Forged&locale=fr', {
    headers: { 'X-Native-Account': 'user_Forged', 'X-CineGenius-User': 'user_Forged', 'Accept-Language': 'fr' },
  });
  const response = await f.GET(request); privateResponse(response);
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { userId: 'user_Current', locale: 'it' });
  const guest = fixture({ state: 'guest' }); const denied = await guest.GET(request); privateResponse(denied);
  assert.equal(denied.status, 401); assert.deepEqual(await denied.json(), { error: 'unauthorized' });
});

for (const locale of locales.SUPPORTED_LOCALES) test(`session locale preserves the existing canonical app choice: ${locale}`, async () => {
  const f = fixture({ locale }); const response = await f.GET(); privateResponse(response);
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { userId: 'user_Current', locale });
});

test('regional/case aliases normalize through the existing app locale policy; unsupported values use its default', async () => {
  for (const [source, expected] of [
    [' NL_be ', 'nl-BE'], ['EN_us', 'en'], ['pt-BR', 'pt-PT'], ['zh_CN', 'zh-Hans'], ['zh-hans-SG', 'zh-Hans'],
    ['unsupported', locales.DEFAULT_LOCALE], ['', locales.DEFAULT_LOCALE], [null, locales.DEFAULT_LOCALE],
  ]) {
    const f = fixture({ locale: source }); const response = await f.GET(); privateResponse(response);
    assert.deepEqual(await response.json(), { userId: 'user_Current', locale: expected });
  }
});

test('verification and locale failures return only503 without leaking diagnostics or identity', async () => {
  for (const options of [{ authError: true }, { localeError: true }]) {
    const f = fixture(options); const response = await f.GET(); privateResponse(response);
    assert.equal(response.status, 503); assert.deepEqual(await response.json(), { error: 'unavailable' });
    assert.deepEqual(f.calls.auth, [undefined]); assert.equal(f.calls.locale, options.authError ? 0 : 1);
  }
});
