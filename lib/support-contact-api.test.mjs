import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const { NextRequest, NextResponse } = require('next/server');
const conversation = '11111111-1111-4111-8111-111111111111', message = '22222222-2222-4222-8222-222222222222';
function fixture(file = '../app/api/support/route.ts', { signedIn = true, admin = true, allowed = true, data = [{ conversation_id: conversation, message_id: message, created: true }], error = null } = {}) {
  const calls = [];
  const mocks = {
    'next/server': { NextRequest, NextResponse },
    'next-intl/server': { getTranslations: async () => key => key },
    '@/lib/auth': { requireAuth: async () => signedIn ? { userId: 'current-member' } : NextResponse.json({ error: 'signed_out' }, { status: 401 }) },
    '@/lib/requireAdmin': { requireAdmin: async () => admin ? { userId: 'verified-admin' } : NextResponse.json({ error: 'forbidden' }, { status: 403 }) },
    '@/lib/rateLimit': { rateLimit: async () => ({ allowed }) },
    '@/lib/support-identity': { SUPPORT_ACTOR_ID: 'cinegenius-support' },
    '@/lib/db': { db: { rpc: async (name, args) => { calls.push({ name, args }); return { data, error }; } } },
  };
  const compiled = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} };
  new Function('require','module','exports',compiled)(name => mocks[name] ?? require(name), mod, mod.exports);
  return { ...mod.exports, calls };
}
const request = body => new NextRequest('https://test.invalid/api/support', { method: 'POST', body: JSON.stringify(body) });
const body = { content: ' Own fixture request ', idempotencyKey: message, accountId: 'current-member', user_id: 'forged-member', receiver_id: 'forged-admin' };

test('support contact requires a session and validates input before any persistence', async () => {
  for (const options of [{ signedIn: false }, { allowed: false }]) {
    const api = fixture(undefined, options); assert.equal((await api.POST(request(body))).status, options.signedIn === false ? 401 : 429); assert.equal(api.calls.length, 0);
  }
  for (const invalid of [{ accountId: 'current-member' }, { ...body, content: ' ' }, { ...body, content: 'x'.repeat(5001) }, { ...body, idempotencyKey: 'not-an-id' }]) {
    const api = fixture(); assert.equal((await api.POST(request(invalid))).status, 400); assert.equal(api.calls.length, 0);
  }
});
test('delayed requests from a changed or missing account cannot write under the active session', async () => {
  for (const accountId of ['previous-member', null, undefined]) {
    const api = fixture(); const response = await api.POST(request({ ...body, accountId }));
    assert.equal(response.status, 409); assert.equal(api.calls.length, 0);
    assert.deepEqual(await response.json(), { error: 'accountChanged' });
    assert.match(response.headers.get('cache-control'), /private, no-store/);
  }
});
test('only the verified member and localized server label reach the atomic contact function', async () => {
  const api = fixture(); const response = await api.POST(request(body));
  assert.equal(response.status, 200); assert.match(response.headers.get('cache-control'), /private, no-store/);
  assert.deepEqual(api.calls, [{ name: 'contact_support', args: { p_user_id: 'current-member', p_content: 'Own fixture request', p_idempotency_key: message, p_label: 'threadLabel' } }]);
  assert.deepEqual(await response.json(), { conversationId: conversation, messageId: message, duplicate: false });
});
test('safe retries return the stored message; failures and unconfirmed writes cannot claim delivery', async () => {
  const duplicate = fixture(undefined, { data: [{ conversation_id: conversation, message_id: message, created: false }] });
  assert.equal((await (await duplicate.POST(request(body))).json()).duplicate, true);
  for (const [options, status] of [[{ error: { code: 'PT409' } }, 409], [{ error: { code: 'database_failure' } }, 503], [{ data: [] }, 503], [{ data: [{ conversation_id: 'bad', message_id: message }] }, 503]]) {
    assert.equal((await fixture(undefined, options).POST(request(body))).status, status);
  }
});
test('global support unread count is admin-only, covers all conversations and never mutates read state', async () => {
  const file = '../app/api/admin/support/unread/route.ts';
  const denied = fixture(file, { admin: false }); assert.equal((await denied.GET()).status, 403); assert.equal(denied.calls.length, 0);
  const api = fixture(file, { data: [{ conversation_id: 'a', unread_count: 3 }, { conversation_id: 'older-page', unread_count: '4' }] });
  const response = await api.GET(); assert.deepEqual(await response.json(), { unreadCount: 7 });
  assert.match(response.headers.get('cache-control'), /private, no-store/);
  assert.deepEqual(api.calls, [{ name: 'unread_message_counts', args: { p_user_id: 'cinegenius-support' } }]);
  assert.equal((await fixture(file, { error: { code: 'offline' } }).GET()).status, 503);
});
test('invalid unread counter rows fail closed instead of claiming a successfully empty inbox', async () => {
  const file = '../app/api/admin/support/unread/route.ts';
  for (const data of [null, {}, [null], [{ unread_count: null }], [{ unread_count: '' }], [{ unread_count: 'invalid' }], [{ unread_count: -1 }], [{ unread_count: 1.5 }], [{ unread_count: Number.MAX_SAFE_INTEGER }, { unread_count: 1 }]]) {
    const response = await fixture(file, { data }).GET();
    assert.equal(response.status, 503); assert.deepEqual(await response.json(), { code: 'support_unread_unavailable' });
  }
  assert.deepEqual(await (await fixture(file, { data: [] }).GET()).json(), { unreadCount: 0 });
});
