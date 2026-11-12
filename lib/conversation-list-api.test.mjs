import {intlServerFor} from './i18n-test-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const {createClient} = require('@supabase/supabase-js');
const {NextRequest, NextResponse} = require('next/server');
const identity = await import('./support-identity.ts');
const receipts = await import('./message-read-state.ts');
const messaging = await import('./messaging-backend.ts');
const routeSource = readFileSync(new URL('../app/api/conversations/route.ts', import.meta.url), 'utf8');
const owner = 'fixture_owner';
const chatId = index => `20000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
const messageId = index => `30000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
const membership = (index, values = {}) => ({conversation_id: chatId(index), user_id: owner, role: 'member', joined_at: new Date(Date.UTC(2026, 9, 1, index)).toISOString(), left_at: null, ...values});
const conversation = (index, values = {}) => ({id: chatId(index), kind: 'direct', sender_id: owner, receiver_id: `fixture_peer_${index}`, created_at: '2026-09-01T00:00:00.000Z', updated_at: new Date(Date.UTC(2026, 9, 1, index)).toISOString(), messages: [], ...values});

function fixture({memberships = [], conversations = [], unread = {count: 0, byConversation: {}}, signedIn = true, failureTable = null, unreadFailure = false, malformedMembership = false} = {}) {
  const calls = [];
  const tables = {conversation_members: memberships, conversations, profiles: [], message_reads: []};
  const db = createClient('https://fixture.invalid', 'fixture-only-key', {auth: {persistSession: false}, global: {fetch: async (input, init) => {
    assert.equal(init?.method ?? 'GET', 'GET', 'The inbox list must not write');
    const url = new URL(input);
    const table = url.pathname.split('/').at(-1);
    assert.ok(Object.hasOwn(tables, table), `Unexpected table ${table}`);
    calls.push(url);
    if (table === failureTable) return Response.json({code: 'fixture_failure', message: 'Fixture unavailable'}, {status: 400});
    const query = url.searchParams;
    let rows = structuredClone(tables[table]);
    for (const [key, value] of query) {
      if (key.includes('.')) continue;
      if (value.startsWith('eq.')) rows = rows.filter(row => String(row[key]) === value.slice(3));
      if (value === 'is.null') rows = rows.filter(row => row[key] === null);
      if (value.startsWith('in.(')) {
        const accepted = value.slice(4, -1).split(',').map(item => item.replace(/^"|"$/g, ''));
        rows = rows.filter(row => accepted.includes(String(row[key])));
      }
    }
    if (table === 'conversations' && query.get('select')?.includes('conversation_members')) {
      rows = rows.map(row => {
        let active = memberships.filter(member => member.conversation_id === row.id);
        const account = query.get('conversation_members.user_id');
        if (account?.startsWith('eq.')) active = active.filter(member => member.user_id === account.slice(3));
        if (query.get('conversation_members.left_at') === 'is.null') active = active.filter(member => member.left_at === null);
        return {...row, conversation_members: active};
      });
      if (query.get('select').includes('conversation_members!inner')) rows = rows.filter(row => row.conversation_members.length > 0);
      if (malformedMembership) rows = rows.map(row => {
        const result = {...row};
        if (malformedMembership === 'missing') delete result.conversation_members;
        else if (malformedMembership === 'null') result.conversation_members = null;
        else if (malformedMembership === 'object') result.conversation_members = membership(999);
        else result.conversation_members = [{...membership(999), user_id: 'fixture_someone_else'}];
        return result;
      });
    }
    const ordering = query.get('order')?.split(',') ?? [];
    rows.sort((a, b) => {
      for (const clause of ordering) {
        const [key, direction] = clause.split('.');
        const comparison = String(a[key]).localeCompare(String(b[key]));
        if (comparison) return direction === 'desc' ? -comparison : comparison;
      }
      return 0;
    });
    if (query.has('limit')) rows = rows.slice(0, Number(query.get('limit')));
    if (table === 'conversations' && query.has('messages.limit')) rows = rows.map(row => ({...row, messages: [...row.messages].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, Number(query.get('messages.limit')))}));
    return Response.json(rows);
  }}});
  const mocks = {
    'next-intl/server': intlServerFor(),
    '@/lib/support-identity': identity,
    '@/lib/db': {db},
    '@/lib/auth': {requireAuth: async () => signedIn ? {userId: owner} : NextResponse.json({error: 'unauthorized'}, {status: 401})},
    '@/lib/trust': {},
    '@/lib/rateLimit': {},
    '@clerk/nextjs/server': {},
    'next/server': {NextRequest, NextResponse},
    '@/lib/email': {sendNewMessageEmail() { throw new Error('No external mail calls allowed'); }},
    '@/lib/message-read-state': receipts,
    '@/lib/messaging-backend': messaging,
    '@/lib/unread-message-counts': {getUnreadMessageCounts: async id => {
      assert.equal(id, owner);
      if (unreadFailure) throw new Error('Fixture unread failure');
      return unread;
    }},
  };
  const compiled = ts.transpileModule(routeSource, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
  const loaded = {exports: {}};
  new Function('require', 'module', 'exports', compiled)(name => {
    assert.ok(Object.hasOwn(mocks, name), `Unexpected dependency ${name}`);
    return mocks[name];
  }, loaded, loaded.exports);
  return {calls, get: () => loaded.exports.GET(new NextRequest('https://fixture.invalid/api/conversations'))};
}

test('a newly active old chat stays visible beyond fifty active memberships, sorted by last activity', async () => {
  const memberships = Array.from({length: 61}, (_, index) => membership(index));
  const latest = {id: messageId(0), sender_id: 'fixture_peer_0', content: 'Fixture only', created_at: '2026-11-10T10:00:00.000Z', read_at: null};
  const conversations = memberships.map((_, index) => conversation(index, index === 0 ? {updated_at: latest.created_at, messages: [latest]} : {}));
  const f = fixture({memberships, conversations, unread: {count: 1, byConversation: {[chatId(0)]: 1}}});
  const response = await f.get();
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.data.length, 50);
  assert.equal(body.data[0].id, chatId(0));
  assert.equal(body.data[0].messages[0].id, latest.id);
  assert.equal(body.data[0].unread_count, 1);
  assert.equal(body.unreadCount, 1);
  assert.deepEqual(body.data.map(row => row.id), [chatId(0), ...Array.from({length: 49}, (_, index) => chatId(60 - index))]);
  assert.ok(body.data.every(row => !Object.hasOwn(row, 'conversation_members')));
  assert.match(response.headers.get('cache-control'), /no-store/);
});

test('current membership boundaries exclude left, foreign and missing memberships before the fifty-chat limit', async () => {
  const memberships = Array.from({length: 51}, (_, index) => membership(index));
  memberships.push(membership(101, {left_at: '2026-11-09T00:00:00.000Z'}), membership(102, {user_id: 'fixture_someone_else'}));
  const conversations = Array.from({length: 51}, (_, index) => conversation(index));
  conversations.push(...[101, 102, 103].map(index => conversation(index, {updated_at: '2026-11-10T12:00:00.000Z'})));
  const f = fixture({memberships, conversations});
  const response = await f.get();
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.data.length, 50);
  assert.deepEqual(body.data.map(row => row.id), Array.from({length: 50}, (_, index) => chatId(50 - index)));
  assert.ok(body.data.every(row => ![chatId(101), chatId(102), chatId(103)].includes(row.id)));
});

test('group previews keep the current join boundary, roles and active member count', async () => {
  const joined = '2026-11-10T09:00:00.000Z';
  const memberships = [membership(1, {role: 'admin', joined_at: joined}), membership(1, {user_id: 'fixture_peer_1', joined_at: joined}), membership(2, {joined_at: joined})];
  const conversations = [conversation(1, {kind: 'group', group_name: 'Fixture group', messages: [{id: messageId(1), sender_id: 'fixture_peer_1', content: 'Before current join', created_at: '2026-11-10T08:00:00.000Z'}]}), conversation(2, {kind: 'group', group_name: 'New fixture', messages: [{id: messageId(2), sender_id: 'fixture_peer_2', content: 'After current join', created_at: '2026-11-10T09:30:00.000Z'}]})];
  const response = await fixture({memberships, conversations}).get();
  assert.equal(response.status, 200);
  const body = await response.json();
  const old = body.data.find(row => row.id === chatId(1));
  assert.deepEqual(old.messages, []);
  assert.equal(old.isAdmin, true);
  assert.equal(old.memberCount, 2);
  assert.equal(body.data.find(row => row.id === chatId(2)).messages[0].id, messageId(2));
});

test('a genuinely empty active inbox is successful and preserves the unread result', async () => {
  const response = await fixture({memberships: [membership(1, {left_at: '2026-11-09T00:00:00.000Z'})], conversations: [conversation(1)]}).get();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {data: [], unreadCount: 0});
});

test('database and unread-count failures remain errors instead of empty inbox successes', async () => {
  for (const options of [{failureTable: 'conversations'}, {unreadFailure: true}, {failureTable: 'conversation_members'}]) {
    const f = fixture({memberships: [membership(1)], conversations: [conversation(1, {kind: 'group'})], ...options});
    const response = await f.get();
    assert.equal(response.status, 500);
    const body = await response.json();
    assert.ok(body.error);
    assert.equal(Object.hasOwn(body, 'data'), false);
  }
});

test('a missing, null, non-array or unverified membership projection returns a closed error response', async () => {
  for (const projection of [true, 'missing', 'null', 'object']) {
    const response = await fixture({memberships: [membership(1)], conversations: [conversation(1)], malformedMembership: projection}).get();
    assert.equal(response.status, 500);
    const body = await response.json();
    assert.ok(body.error);
    assert.equal(Object.hasOwn(body, 'data'), false);
  }
});

test('signed-out inbox requests do not access conversation storage', async () => {
  const f = fixture({signedIn: false});
  assert.equal((await f.get()).status, 401);
  assert.equal(f.calls.length, 0);
});
