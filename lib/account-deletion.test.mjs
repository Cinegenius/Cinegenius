import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const { NextResponse } = require('next/server');

function fixture({ guest = false, failedTable, rejectedTable, clerkFailure = false, privacyFailure = false, privacyMismatch = false, requestAccount = 'synthetic-owner' } = {}) {
  const queries = [], clerkCalls = [];
  const db = { from(table) {
    const query = { table, filters: [], operation: null }; queries.push(query);
    const builder = {
      delete() { query.operation='delete'; return this; },
      upsert(value) { query.operation='upsert'; query.value=value; return this; },
      select() { return this; },
      async single() { return {data:privacyMismatch?{...query.value,ghost_mode:false}:query.value,error:privacyFailure?{message:'PRIVATE_DATABASE_DETAIL'}:null}; },
      eq(...args) { query.filters.push(['eq', ...args]); return this; },
      or(...args) { query.filters.push(['or', ...args]); return this; },
      then(resolve, reject) {
        return (table === rejectedTable ? Promise.reject(new Error('PRIVATE_DATABASE_DETAIL'))
          : Promise.resolve({ data: null, error: table === failedTable ? { message: 'PRIVATE_DATABASE_DETAIL' } : null })).then(resolve, reject);
      },
    };
    return builder;
  } };
  const dependencies = {
    '@/lib/db': { db },
    '@/lib/auth': { requireAuth: async () => guest ? NextResponse.json({ error: 'unauthorized' }, { status: 401 }) : { userId: 'synthetic-owner' } },
    '@clerk/nextjs/server': { clerkClient: async () => ({ users: { deleteUser: async id => { clerkCalls.push(id); if (clerkFailure) throw new Error('PRIVATE_PROVIDER_DETAIL'); } } }) },
    'next-intl/server': { getTranslations: async () => key => { assert.equal(key, 'requestFailed'); return 'Request failed'; } },
  };
  const code = ts.transpileModule(readFileSync(new URL('../app/api/account/route.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => dependencies[name] ?? require(name), module, module.exports);
  return { run: () => module.exports.DELETE(new Request('https://www.cinegenius.co/api/account', {method:'DELETE',headers:requestAccount?{'X-Account-Id':requestAccount}:{}})), queries, clerkCalls };
}

test('account deletion rejects a guest before data or identity operations', async () => {
  const f = fixture({ guest: true }); assert.equal((await f.run()).status, 401);
  assert.equal(f.queries.length, 0); assert.equal(f.clerkCalls.length, 0);
});
for (const failure of ['failedTable', 'rejectedTable']) {
  test(`account deletion retains the login on ${failure} and does not disclose failure details`, async () => {
    const f = fixture({ [failure]: 'profiles' }), response = await f.run();
    assert.equal(response.status, 503); assert.deepEqual(await response.json(), { error: 'Request failed' });
    assert.deepEqual(f.clerkCalls, []); assert.match(response.headers.get('cache-control'), /no-store/);
    assert.equal(response.headers.get('vercel-cdn-cache-control'), 'no-store');
  });
}
test('account removal scopes all current steps to the authenticated account and removes identity last', async () => {
  const f = fixture(), response = await f.run(); assert.equal(response.status, 200);
  assert.equal(f.queries.length, 12);
  for (const query of f.queries.filter(q=>q.operation==='delete')) assert.ok(JSON.stringify(query.filters).includes('synthetic-owner'), query.table);
  assert.equal(f.queries[0].operation,'upsert');assert.equal(f.queries[0].value.ghost_mode,true);assert.ok(!f.queries.some(q=>q.table==='user_settings'&&q.operation==='delete'));
  assert.deepEqual(f.clerkCalls, ['synthetic-owner']); assert.deepEqual(await response.json(), { success: true });
});
test('identity-provider failure produces a retryable private error rather than success', async () => {
  const f = fixture({ clerkFailure: true }), response = await f.run();
  assert.equal(response.status, 503); assert.deepEqual(await response.json(), { error: 'Request failed' });
});

for(const failure of ['privacyFailure','privacyMismatch'])test(`unconfirmed privacy withdrawal (${failure}) aborts before any deletion`,async()=>{
 const f=fixture({[failure]:true});assert.equal((await f.run()).status,503);assert.deepEqual(f.clerkCalls,[]);
 assert.ok(!f.queries.some(q=>q.operation==='delete'));
});
test('a partial content failure retains the privacy tombstone and the login',async()=>{
 const f=fixture({failedTable:'profiles'});assert.equal((await f.run()).status,503);
 assert.equal(f.queries[0].table,'user_settings');assert.equal(f.queries[0].value.profile_visibility,'private');
 assert.ok(!f.queries.some(q=>q.table==='user_settings'&&q.operation==='delete'));assert.deepEqual(f.clerkCalls,[]);
});

for(const requestAccount of [null,'previous-account'])test(`missing/stale account binding ${requestAccount} cannot hide or delete the current account`,async()=>{
 const f=fixture({requestAccount});assert.equal((await f.run()).status,409);assert.deepEqual(f.queries,[]);assert.deepEqual(f.clerkCalls,[]);
});
