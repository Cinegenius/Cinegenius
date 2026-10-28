import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import * as supportIdentity from './support-identity.ts';
import { createClient } from '@supabase/supabase-js';
const require = createRequire(import.meta.url);
const { NextRequest, NextResponse } = require('next/server');
const chat = '20000000-0000-4000-8000-000000000001';
const message = '30000000-0000-4000-8000-000000000001';
function fixture(file, { signedIn = true, admin = false, allowed = true, rpcResult = { data: message, error: null }, blocked = false, friends = false, results = {}, setupIncomplete = false } = {}) {
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
    '@/lib/support-identity': supportIdentity,
    '@/lib/requireAdmin': { requireAdmin: async () => admin ? { userId: 'admin_test' } : NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 }) },
    '@/lib/admin-support': { resolveAdminSupportTarget: async () => ({ recipientUserId: 'user_me', targetType: 'profile', targetId: 'user_me', targetLabel: 'Testprofil', editUrl: '/profile-setup', missingFields: [], setupIncomplete }), SupportTargetError: class extends Error {} },
    '@/lib/admin-support-participants': { adminSupportParticipants: async (_ids, profiles) => new Map(profiles.map(profile => [profile.user_id, profile])) },
    '@/lib/support-setup-template': { SETUP_TEMPLATE_KEY: 'profile_setup', setupSupportTemplate: () => ({}) },
    'next-intl/server': { getTranslations: async () => key => key },
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

test('support peer has no public profile, including legacy sender IDs', () => {
  assert.equal(supportIdentity.conversationPeerProfileHref({ kind: 'support', sender_id: supportIdentity.SUPPORT_ACTOR_ID, receiver_id: 'user_me' }, 'user_me'), null);
  assert.equal(supportIdentity.conversationPeerProfileHref({ sender_id: supportIdentity.SUPPORT_ACTOR_ID, receiver_id: 'user_me' }, 'user_me'), null);
  assert.equal(supportIdentity.conversationPeerProfileHref(undefined, 'user_me', supportIdentity.SUPPORT_ACTOR_ID), null);
  assert.equal(supportIdentity.conversationPeerProfileHref({ kind: 'direct', sender_id: 'user_me', receiver_id: 'user_other' }, 'user_me'), '/profile/user_other');
});
test('support conversations cannot be read or replied to by another recipient', async () => {
  const api = fixture(detailFile, { results: { conversations: { id: chat, kind: 'support', sender_id: supportIdentity.SUPPORT_ACTOR_ID, receiver_id: 'another_member' } } });
  assert.equal((await api.GET(request(`/api/conversations/${chat}`), params)).status, 404);
  assert.equal(api.calls.some(call => call.url.pathname.endsWith('/messages')), false);
});

const supportThreadFile = '../app/api/admin/support/threads/[id]/route.ts';
const supportInboxFile = '../app/api/admin/support/threads/route.ts';
const writeRequest = (path, body) => new NextRequest(`https://test.invalid${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const supportResults = {
  conversations: { id: chat, kind: 'support', sender_id: supportIdentity.SUPPORT_ACTOR_ID, receiver_id: 'user_me', support_user_id: 'user_me' },
  conversation_members: url => url.searchParams.has('user_id') ? { role: 'member', joined_at: '2026-10-01', left_at: null } : [{ user_id: 'user_me' }, { user_id: supportIdentity.SUPPORT_ACTOR_ID }],
};
test('member reply stays in the same support thread and uses the authenticated sender', async () => {
  const api = fixture(detailFile, { results: supportResults, rpcResult: { data: { id: message, sender_id: 'user_me', content: 'Antwort' }, error: null } });
  const response = await api.POST(writeRequest(`/api/conversations/${chat}`, { content: 'Antwort', sender_id: supportIdentity.SUPPORT_ACTOR_ID }), params);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).message.sender_id, 'user_me');
  assert.deepEqual(api.calls.find(call => call.url.pathname.endsWith('/send_conversation_message')).body, { p_conversation_id: chat, p_sender_id: 'user_me', p_content: 'Antwort' });
  assert.equal(api.calls.some(call => call.url.pathname.endsWith('/conversations') && call.body), false);
  const forbidden = fixture(detailFile, { results: { ...supportResults, conversations: { ...supportResults.conversations, receiver_id: 'another_member' } } });
  assert.equal((await forbidden.POST(writeRequest(`/api/conversations/${chat}`, { content: 'Denied' }), params)).status, 404);
  assert.equal(forbidden.calls.some(call => call.url.pathname.includes('/rpc/')), false);
});
test('support inbox and reply routes reject normal members before querying any data', async () => {
  for (const file of [supportInboxFile, supportThreadFile]) {
    const api = fixture(file);
    assert.equal((await api.GET(request('/api/admin/support/threads'), params)).status, 403);
    assert.equal((await api.POST(writeRequest('/api/admin/support/threads', { content: 'Forged' }), params)).status, 403);
    assert.equal(api.calls.length, 0);
  }
});
test('admin replies use verified actor and existing support thread; replay keeps same message', async () => {
  const api = fixture(supportThreadFile, { admin: true, results: { conversations: { id: chat, support_user_id: 'user_me' } }, rpcResult: { data: { message_id: message, created: false }, error: null } });
  const response = await api.POST(writeRequest(`/api/admin/support/threads/${chat}`, { content: 'Supportantwort', admin_user_id: 'forged_admin', idempotencyKey: message }), params);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).duplicate, true);
  assert.deepEqual(api.calls.find(call => call.url.pathname.endsWith('/send_support_message')).body, { p_conversation_id: chat, p_admin_user_id: 'admin_test', p_content: 'Supportantwort', p_idempotency_key: message });
});
test('long support history returns newest page chronologically with a bounded older cursor', async () => {
  const messages = Array.from({ length: 201 }, (_, index) => ({ id: String(index).padStart(36,'0'), sender_id: 'user_me', created_at: new Date(Date.UTC(2026,9,26,0,201-index)).toISOString() }));
  const api = fixture(supportThreadFile, { admin: true, results: { conversations: supportResults.conversations, messages, profiles: { user_id: 'user_me', display_name: 'Testmitglied' } } });
  const response = await api.GET(request(`/api/admin/support/threads/${chat}`), params);
  const body = await response.json();
  assert.equal(body.messages.length, 200);assert.equal(body.hasOlder, true);
  assert.equal(body.messages.at(-1).id, messages[0].id);
  assert.equal(body.nextCursor.before_id, messages[199].id);
  const query = api.calls.find(call => call.url.pathname.endsWith('/messages')).url.searchParams;
  assert.equal(query.get('limit'), '201');assert.equal(query.get('order'), 'created_at.desc,id.desc');
});

test('initial admin support send uses resolved member and confirmed conversation ID', async () => {
  const api = fixture(supportInboxFile, { admin: true, results: { support_message_templates: { enabled: true, body: 'Freie Nachfrage' } }, rpcResult: { data: { conversation_id: chat, message_id: message, created: false }, error: null } });
  const response = await api.POST(writeRequest('/api/admin/support/threads', { targetType: 'profile', targetId: 'user_me', templateKey: 'check_in', content: 'Hallo Testmitglied', receiver_id: 'forged_recipient', idempotencyKey: message }), params);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).conversationId, chat);
  const rpc = api.calls.find(call => call.url.pathname.endsWith('/create_support_conversation'));
  assert.equal(rpc.body.p_recipient_user_id, 'user_me');
  assert.equal(rpc.body.p_admin_user_id, 'admin_test');
});

test('setup reminders recheck current account completion and require the unchanged direct setup link', async () => {
  const body = { targetType: 'profile', targetId: 'user_me', templateKey: 'profile_setup', content: 'Continue: https://test.invalid/profile-setup', idempotencyKey: message };
  const results = { support_message_templates: { enabled: true, body: '{{Bearbeitungslink}}' } };
  const complete = fixture(supportInboxFile, { admin: true, results });
  assert.equal((await complete.POST(writeRequest('/api/admin/support/threads', body))).status,409);
  assert.equal(complete.calls.some(call=>call.url.pathname.includes('/rpc/')),false);
  const wrongLink = fixture(supportInboxFile, { admin: true, results, setupIncomplete:true });
  assert.equal((await wrongLink.POST(writeRequest('/api/admin/support/threads', {...body,content:'wrong link'}))).status,400);
  assert.equal(wrongLink.calls.some(call=>call.url.pathname.includes('/rpc/')),false);
  const ready = fixture(supportInboxFile, { admin: true, results, setupIncomplete:true, rpcResult: { data: { conversation_id: chat, message_id: message, created:false },error:null } });
  assert.equal((await ready.POST(writeRequest('/api/admin/support/threads', body))).status,200);
});
