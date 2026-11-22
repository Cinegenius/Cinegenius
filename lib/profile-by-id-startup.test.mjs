import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { setImmediate as tick } from 'node:timers/promises';
import ts from 'typescript';
import { NextRequest, NextResponse } from 'next/server.js';
import { profileAccess } from './profile-privacy.ts';
import * as contactVisibility from './contact-visibility.ts';

const require = createRequire(import.meta.url);
function load(file, mocks) {
  const compiled = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), loaded, loaded.exports);
  return loaded.exports;
}

/** Exercise the real route and permission graph; every DB operation is local. */
function fixture({ viewer = 'own-member', target = 'own-member', visibility = 'public', ghost = false, blocked = false, permissionError = false, authError = false, authGate, permissionGate } = {}) {
  const calls = { auth: 0, guards: [], queries: [] };
  const profile = { user_id: target, display_name: 'Synthetic profile', avatar_url: '/api/media/synthetic-avatar', slug: 'synthetic-profile' };
  const db = { from(table) {
    const operations = [];
    const execute = async () => {
      calls.queries.push({ table, operations });
      if (table === 'profiles') return { data: profile, error: null };
      if (permissionGate) await permissionGate;
      if (permissionError) return { data: null, error: { code: 'FIXTURE_DENIED' } };
      if (table === 'user_settings') return { data: [{ user_id: target, profile_visibility: visibility, ghost_mode: ghost }], error: null };
      if (table === 'blocks' && blocked && operations.some(op => op[0] === 'select' && op[1] === 'blocker_id')) return { data: [{ blocker_id: target }], error: null };
      return { data: [], error: null };
    };
    const query = {
      select(...args) { operations.push(['select', ...args]); return query; },
      eq(...args) { operations.push(['eq', ...args]); return query; },
      in(...args) { operations.push(['in', ...args]); return query; },
      maybeSingle: execute,
      then(resolve, reject) { return execute().then(resolve, reject); },
    };
    return query;
  } };
  const graph = load('lib/linked-profile-access.ts', { 'server-only': {}, '@/lib/db': { db }, '@/lib/profile-privacy': { profileAccess } });
  const trust = load('lib/trust.ts', { 'server-only': {}, '@/lib/db': { db }, '@/lib/linked-profile-access': graph, '@/lib/contact-visibility': contactVisibility });
  const route = load(process.env.CINEGENIUS_PROFILE_BY_ID_SOURCE ?? 'app/api/profile/by-id/route.ts', {
    '@/lib/db': { db },
    '@/lib/trust': { async canViewProfile(...args) { calls.guards.push(args); return trust.canViewProfile(...args); } },
    '@clerk/nextjs/server': { async auth() { calls.auth++; if (authGate) await authGate; if (authError) throw Error('Synthetic session verification failure'); return { userId: viewer }; } },
    'next-intl/server': { getTranslations: async () => key => key },
    'next/server': { NextRequest, NextResponse },
  });
  return { calls, profile, get: (id = target) => route.GET(new NextRequest('https://www.cinegenius.co/api/profile/by-id?id=' + encodeURIComponent(id))) };
}

test('own startup profile needs one current-session verification and one profile query, without the five-query permission graph', async () => {
  const f = fixture({ visibility: 'private', ghost: true, permissionError: true });
  const response = await f.get();
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { profile: f.profile });
  assert.equal(f.calls.auth, 1); assert.deepEqual(f.calls.guards, []);
  assert.deepEqual(f.calls.queries, [{ table: 'profiles', operations: [['select', 'user_id, display_name, avatar_url, slug'], ['eq', 'user_id', 'own-member']] }]);
  assert.equal(response.headers.get('cache-control'), 'private, no-store, max-age=0');
});

test('the owner fast lane waits for current session verification before reading a profile', async () => {
  const gate = Promise.withResolvers(), f = fixture({ authGate: gate.promise });
  const pending = f.get(); await tick();
  assert.equal(f.calls.auth, 1); assert.deepEqual(f.calls.guards, []); assert.deepEqual(f.calls.queries, []);
  gate.resolve(); assert.equal((await pending).status, 200); assert.deepEqual(f.calls.guards, []); assert.equal(f.calls.queries.length, 1);
});

test('another account still waits for every current permission query before any profile fields are read', async () => {
  const gate = Promise.withResolvers(), f = fixture({ viewer: 'current-viewer', target: 'foreign-owner', permissionGate: gate.promise });
  const pending = f.get(); await tick();
  assert.deepEqual(f.calls.guards, [['foreign-owner', 'current-viewer']]);
  assert.equal(f.calls.queries.length, 5); assert.ok(f.calls.queries.every(query => query.table !== 'profiles'));
  gate.resolve(); const response = await pending;
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { profile: f.profile });
  assert.equal(f.calls.queries.length, 6); assert.equal(f.calls.queries.at(-1).table, 'profiles');
});

test('foreign private, ghost, blocked and failed permission decisions never read profile fields', async () => {
  for (const options of [{ visibility: 'private' }, { ghost: true }, { blocked: true }, { permissionError: true }]) {
    const f = fixture({ ...options, viewer: 'current-viewer', target: 'foreign-owner' });
    const response = await f.get();
    assert.equal(response.status, 200); assert.deepEqual(await response.json(), { profile: null });
    assert.deepEqual(f.calls.guards, [['foreign-owner', 'current-viewer']]);
    assert.equal(f.calls.queries.length, 5); assert.ok(f.calls.queries.every(query => query.table !== 'profiles'));
    assert.equal(response.headers.get('cache-control'), 'private, no-store, max-age=0');
  }
});

test('guests retain public-profile access checks and cannot use the requested ID as identity', async () => {
  const visible = fixture({ viewer: null, target: 'public-owner' });
  const response = await visible.get(); assert.deepEqual(await response.json(), { profile: visible.profile });
  assert.deepEqual(visible.calls.guards, [['public-owner', null]]); assert.equal(visible.calls.queries.length, 2);
  const hidden = fixture({ viewer: null, target: 'private-owner', visibility: 'private' });
  assert.deepEqual(await (await hidden.get()).json(), { profile: null });
  assert.deepEqual(hidden.calls.guards, [['private-owner', null]]); assert.equal(hidden.calls.queries.length, 1);
});

test('a failed current-session verification fails closed before permission or profile reads', async () => {
  const f = fixture({ authError: true });
  await assert.rejects(() => f.get(), /Synthetic session verification failure/);
  assert.equal(f.calls.auth, 1); assert.deepEqual(f.calls.guards, []); assert.deepEqual(f.calls.queries, []);
});

test('invalid requested IDs retain the existing validation path before authentication or data access', async () => {
  for (const id of ['', 'not/valid', 'x'.repeat(129)]) {
    const f = fixture(); const response = await f.get(id);
    assert.equal(response.status, 400); assert.equal(f.calls.auth, 0); assert.deepEqual(f.calls.guards, []); assert.deepEqual(f.calls.queries, []);
  }
});
