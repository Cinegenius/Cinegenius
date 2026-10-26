import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { createClient } from '@supabase/supabase-js';
const require = createRequire(import.meta.url);
const { NextRequest, NextResponse } = require('next/server');
const chat = '20000000-0000-4000-8000-000000000001';
const message = '30000000-0000-4000-8000-000000000001';
function fixture(file, { signedIn = true, allowed = true, rpcResult = { data: message, error: null }, blocked = false, friends = false, results = {} } = {}) {
  const calls = [];
  const db = createClient('https://test.invalid', 'fixture-only-key', { auth: { persistSession: false }, global: { fetch: async (input, init) => {
    const url = new URL(input);
    calls.push({ url, body: init?.body && JSON.parse(init.body) });
    const table = url.pathname.split('/').at(-1);
    const data = url.pathname.includes('/rpc/') ? rpcResult : { data: typeof results[table] === 'function' ? results[table](url, init) : results[table] ?? [], error: null };
    return new Response(JSON.stringify(data.error ?? data.data), { status: data.error ? 400 : 200, headers: { 'content-type': 'application/json' } });
  } } });
  const mocks = {
    '@/lib/db': { db },
    '@/lib/auth': { requireAuth: async () => signedIn ? { userId: 'user_me' } : NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 }) },
    '@/lib/rateLimit': { rateLimit: async () => ({ allowed }) },
    '@/lib/trust': { anyBlockExists: async () => blocked, areAcceptedFriends: async () => friends }, '@clerk/nextjs/server': {}, '@/lib/email': {},
    '@/lib/message-read-state': { applyParticipantReadReceipts: rows => rows },
    '@/lib/unread-message-counts': { getUnreadMessageCounts: async () => ({ count: 0, byConversation: {} }) },
  };
  const compiled = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const compiledModule = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), compiledModule, compiledModule.exports);
  return { ...compiledModule.exports, calls };
}
const request = (path, method = 'GET') => new NextRequest(`https://test.invalid${path}`, { method });
const params = { params: Promise.resolve({ id: chat }) };
const detailFile = '../app/api/conversations/[id]/route.ts';
const listFile = '../app/api/conversations/route.ts';

test('delete route requires a session and valid identifiers before touching storage', async () => {
  const signedOut = fixture(detailFile, { signedIn: false });
  assert.equal((await signedOut.DELETE(request(`/api/conversations/${chat}?message_id=${message}`, 'DELETE'), params)).status, 401);
  assert.equal(signedOut.calls.length, 0);
  const invalid = fixture(detailFile);
  assert.equal((await invalid.DELETE(request(`/api/conversations/${chat}?message_id=invalid`, 'DELETE'), params)).status, 400);
  assert.equal(invalid.calls.length, 0);
  const limited = fixture(detailFile, { allowed: false });
  assert.equal((await limited.DELETE(request(`/api/conversations/${chat}?message_id=${message}`, 'DELETE'), params)).status, 429);
  assert.equal(limited.calls.length, 0);
});
test('delete route uses verified actor, confirms stored ID, and returns a private response', async () => {
  const api = fixture(detailFile);
  const response = await api.DELETE(request(`/api/conversations/${chat}?message_id=${message}&sender_id=user_other`, 'DELETE'), params);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { hiddenMessageId: message });
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(api.calls[0].body, { p_actor: 'user_me', p_conversation: chat, p_message: message });
});
test('delete route does not report success for denied or unconfirmed writes', async () => {
  for (const [rpcResult, status] of [[{ data: null, error: { code: '42501', message: 'denied' } }, 404], [{ data: null, error: null }, 500]]) {
    const api = fixture(detailFile, { rpcResult });
    assert.equal((await api.DELETE(request(`/api/conversations/${chat}?message_id=${message}`, 'DELETE'), params)).status, status);
  }
});
test('contact lookup checks exact pair and active membership, including chats outside the sidebar limit', async () => {
  const api = fixture(listFile, { results: { conversations: [{ id: chat }] } });
  const response = await api.GET(request('/api/conversations?with_user=user_friend'));
  assert.deepEqual(await response.json(), { conversationId: chat });
  const query = api.calls[0].url.searchParams;
  assert.equal(query.get('kind'), 'eq.direct');
  assert.equal(query.get('conversation_members.user_id'), 'eq.user_me');
  assert.equal(query.get('conversation_members.left_at'), 'is.null');
  assert.equal(query.get('or'), '(and(sender_id.eq.user_me,receiver_id.eq.user_friend),and(sender_id.eq.user_friend,receiver_id.eq.user_me))');
  assert.equal(query.get('limit'), '1');
  assert.match(query.get('order'), /listing_id.*nullsfirst/);
  assert.equal((await api.GET(request('/api/conversations?with_user=user_me'))).status, 400);
  assert.equal((await api.GET(request('/api/conversations?with_user=bad.id'))).status, 400);
});
test('both detail and sidebar filter hidden own messages before pagination', async () => {
  const detail = fixture(detailFile, { results: {
    conversations: { id: chat, kind: 'direct', sender_id: 'user_me', receiver_id: 'user_friend' },
    conversation_members: url => url.searchParams.has('user_id') ? { role: 'member', joined_at: '2026-10-01', left_at: null } : [{ user_id: 'user_me' }, { user_id: 'user_friend' }],
  } });
  const response = await detail.GET(request(`/api/conversations/${chat}?before=2026-10-10&before_id=${message}`), params);
  assert.equal(response.status, 200);
  const query = detail.calls.find(call => call.url.pathname.endsWith('/messages')).url.searchParams;
  assert.deepEqual(query.getAll('or'), ['(sender_id.neq.user_me,hidden_for_sender_at.is.null)', `(created_at.lt.2026-10-10,and(created_at.eq.2026-10-10,id.lt.${message}))`]);
  const list = fixture(listFile, { results: { conversation_members: [{ conversation_id: chat, joined_at: '2026-10-01' }] } });
  assert.equal((await list.GET(request('/api/conversations'))).status, 200);
  const preview = list.calls.find(call => call.url.pathname.endsWith('/conversations')).url.searchParams;
  assert.equal(preview.get('messages.or'), '(sender_id.neq.user_me,hidden_for_sender_at.is.null)');
  assert.equal(preview.get('messages.limit'), '1');
});

const startMessage = () => new NextRequest('https://test.invalid/api/conversations', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ receiver_id: 'user_stranger', content: 'Eigene Testnachricht' }),
});
test('non-friends can start a direct chat and persist the first message', async () => {
  const api = fixture(listFile, { friends: false, results: {
    user_settings: { message_permission: 'everyone', email_new_message: false },
    conversations: (_url, init) => init?.method === 'POST' ? { id: chat } : null,
    profiles: { display_name: 'Testsender' },
  } });
  const response = await api.POST(startMessage());
  assert.equal(response.status, 200);
  assert.equal((await response.json()).conversationId, chat);
  const members = api.calls.find(call => call.url.pathname.endsWith('/conversation_members'));
  assert.deepEqual(members.body.map(member => member.user_id), ['user_me', 'user_stranger']);
  assert.equal(api.calls.find(call => call.url.pathname.endsWith('/send_conversation_message')).body.p_sender_id, 'user_me');
  assert.equal(api.calls.some(call => call.url.pathname.endsWith('/friendships')), false);
});
test('direct messaging respects blocks and explicit friends-only consent', async () => {
  for (const options of [
    { blocked: true, results: { user_settings: { message_permission: 'everyone' } } },
    { friends: false, results: { user_settings: { message_permission: 'friends_only' } } },
  ]) {
    const api = fixture(listFile, options);
    assert.equal((await api.POST(startMessage())).status, 403);
    assert.equal(api.calls.some(call => call.url.pathname.endsWith('/send_conversation_message')), false);
    assert.equal(api.calls.some(call => call.url.pathname.endsWith('/conversations')), false);
  }
  const signedOut = fixture(listFile, { signedIn: false });
  assert.equal((await signedOut.POST(startMessage())).status, 401);
  assert.equal(signedOut.calls.length, 0);
});
