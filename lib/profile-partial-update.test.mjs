import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const {NextRequest, NextResponse} = require('next/server');
const occupations = await import('./crew-occupations.ts');
const primary = await import('./primary-occupation.ts');
const types = await import('./profile-types.ts');
const display = await import('./profile-display.ts');
const compatibility = await import('./profile-db-compat.ts');
const routeSource = readFileSync(new URL('../app/api/profile/route.ts', import.meta.url), 'utf8');

function fixture(profile, {signedIn = true, missingTypes = false, readError = null} = {}) {
  let saved = {user_id: 'own-test-user', display_name: 'Own test', bio: 'Keep', role: 'member', verified: false, crew: null, ...structuredClone(profile)};
  const reads = [], writes = [];
  const db = {from(table) {
    assert.equal(table, 'profiles');
    let projection, payload, scopedUserId;
    const query = {
      select(value) { projection = value; return query; },
      eq(key, value) { assert.equal(key, 'user_id'); assert.equal(value, 'own-test-user'); scopedUserId = value; return query; },
      update(value) { payload = structuredClone(value); return query; },
      async maybeSingle() {
        assert.equal(scopedUserId, 'own-test-user');
        if (payload) {
          writes.push(payload);
          saved = {...saved, ...payload};
          return {data: {user_id: saved.user_id}, error: null};
        }
        reads.push(projection);
        if (readError) return {data: null, error: readError};
        const columns = projection.split(',').map(value => value.trim());
        if (missingTypes && columns.includes('profile_types')) {
          return {data: null, error: {code: 'PGRST204', message: "Could not find the 'profile_types' column of 'profiles' in the schema cache"}};
        }
        return {data: Object.fromEntries(columns.filter(key => key in saved).map(key => [key, structuredClone(saved[key])])), error: null};
      },
    };
    return query;
  }};
  const mocks = {
    '@/lib/places/catalog': {placeWriteFields() { throw new Error('No place changes in this fixture'); }},
    '@/lib/places/core': {PLACE_COLUMNS: ''},
    'next-intl/server': {},
    '@/lib/crew-occupations': occupations,
    '@/lib/primary-occupation': primary,
    '@/lib/db': {db},
    '@/lib/auth': {requireAuth: async () => signedIn ? {userId: 'own-test-user'} : NextResponse.json({error: 'unauthorized'}, {status: 401})},
    '@clerk/nextjs/server': {clerkClient() { throw new Error('No real identity-provider calls'); }},
    'next/cache': {revalidateTag() {}},
    'next/server': {NextRequest, NextResponse},
    '@/lib/profile-types': types,
    '@/lib/profile-display': display,
    '@/lib/profile-cover': {},
    '@/lib/profile-db-compat': compatibility,
  };
  const compiled = ts.transpileModule(routeSource, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
  const loaded = {exports: {}};
  new Function('require', 'module', 'exports', compiled)(name => {
    assert.ok(Object.hasOwn(mocks, name), `Unexpected dependency: ${name}`);
    return mocks[name];
  }, loaded, loaded.exports);
  return {
    api: loaded.exports,
    reads,
    writes,
    saved: () => structuredClone(saved),
    patch: body => loaded.exports.PATCH(new NextRequest('https://fixture.invalid/api/profile', {
      method: 'PATCH', headers: {'content-type': 'application/json'}, body: JSON.stringify(body),
    })),
  };
}

test('partial profile update can clear positions while preserving saved profile types and unrelated fields', async () => {
  const f = fixture({positions: ['Editor/in'], profile_types: ['actor'], profile_type: null});
  const response = await f.patch({positions: [], user_id: 'other-user', role: 'admin', verified: true});
  assert.equal(response.status, 200);
  assert.equal((await response.json()).success, true);
  assert.equal(f.writes.length, 1);
  assert.deepEqual(f.saved().positions, []);
  assert.deepEqual(f.saved().profile_types, ['actor']);
  assert.equal(f.saved().bio, 'Keep');
  assert.equal(f.saved().user_id, 'own-test-user');
  assert.equal(f.saved().role, 'member');
  assert.equal(f.saved().verified, false);
  assert.deepEqual(Object.keys(f.writes[0]).sort(), ['positions', 'updated_at']);
  const reload = await f.api.GET();
  assert.equal(reload.status, 200);
  assert.deepEqual((await reload.json()).profile.profile_types, ['actor']);
});

test('partial profile update can clear profile types while preserving saved positions', async () => {
  const f = fixture({positions: ['Editor/in'], profile_types: ['actor'], profile_type: 'actor'});
  assert.equal((await f.patch({profile_types: []})).status, 200);
  assert.equal(f.writes.length, 1);
  assert.deepEqual(f.saved().positions, ['Editor/in']);
  assert.deepEqual(f.saved().profile_types, []);
  assert.equal(f.saved().profile_type, null);
  assert.equal(Object.hasOwn(f.writes[0], 'positions'), false);
});

test('partial or combined removal of the last remaining activity stays invalid and never writes', async () => {
  for (const [profile, patch] of [
    [{positions: ['Editor/in'], profile_types: [], profile_type: null}, {positions: []}],
    [{positions: [], profile_types: ['actor'], profile_type: 'actor'}, {profile_types: []}],
    [{positions: ['Editor/in'], profile_types: ['actor'], profile_type: 'actor'}, {positions: [], profile_types: []}],
    [{positions: [], profile_types: ['actor'], profile_type: 'actor'}, {profile_type: null}],
  ]) {
    const f = fixture(profile);
    const response = await f.patch(patch);
    assert.equal(response.status, 400);
    assert.ok((await response.json()).fieldErrors.activity);
    assert.equal(f.writes.length, 0);
    assert.deepEqual(f.saved().positions, profile.positions);
    assert.deepEqual(f.saved().profile_types, profile.profile_types);
  }
});

test('legacy schema without optional profile_types still retains a saved primary profile type', async () => {
  const f = fixture({positions: ['Editor/in'], profile_type: 'actor'}, {missingTypes: true});
  assert.equal((await f.patch({positions: []})).status, 200);
  assert.equal(f.saved().profile_type, 'actor');
  assert.deepEqual(f.saved().positions, []);
});

test('unavailable saved activity state fails without changing a profile', async () => {
  const f = fixture({positions: ['Editor/in'], profile_types: ['actor']}, {readError: {code: 'fixture-error', message: 'Fixture unavailable'}});
  assert.equal((await f.patch({positions: []})).status, 500);
  assert.equal(f.writes.length, 0);
});

test('signed-out partial updates are rejected before reading or writing any profile', async () => {
  const f = fixture({positions: ['Editor/in'], profile_types: ['actor']}, {signedIn: false});
  assert.equal((await f.patch({positions: []})).status, 401);
  assert.equal(f.reads.length, 0);
  assert.equal(f.writes.length, 0);
});

test('profile type-only changes preserve untouched legacy crew metadata, while explicitly invalid crew stays rejected', async () => {
  const crew = {primaryOccupation: {departmentId: 'legacy', roleId: 'unknown'}, occupations: [{departmentId: 'legacy', roleId: 'unknown'}], certificates: ['Keep']};
  const profile = {positions: ['Legacy title'], profile_types: ['actor'], profile_type: 'actor', crew};
  const f = fixture(profile);
  assert.equal((await f.patch({profile_types: ['actor', 'model']})).status, 200);
  assert.deepEqual(f.saved().crew, crew);
  assert.deepEqual(f.saved().positions, ['Legacy title']);
  assert.deepEqual(f.saved().profile_types, ['actor', 'model']);
  assert.equal(Object.hasOwn(f.writes[0], 'crew'), false);
  const explicit = fixture(profile);
  assert.equal((await explicit.patch({positions: ['Legacy title'], crew})).status, 400);
  assert.equal(explicit.writes.length, 0);
});
