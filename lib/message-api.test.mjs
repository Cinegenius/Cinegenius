import {nativeContractFixture} from './native-contract-fixture.mjs';
import * as messageAttachments from './message-attachments.ts';
import {attachmentServerFixture} from './message-attachment-fixture.mjs';
import test from 'node:test';
import {PGlite} from '@electric-sql/pglite';
import {nativeInboxCursor,nativeInboxPageURL} from './native-inbox-conversations.ts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import * as supportIdentity from './support-identity.ts';
import * as messagingBackend from './messaging-backend.ts';
import * as startedOfferTemplate from './support-started-offer-template.ts';
import { createClient } from '@supabase/supabase-js';
const require = createRequire(import.meta.url);
const { NextRequest, NextResponse } = require('next/server');
const chat = '20000000-0000-4000-8000-000000000001';
const message = '30000000-0000-4000-8000-000000000001';
function fixture(file, { signedIn = true, admin = false, allowed = true, rpcResult, blocked = false, friends = false, results = {}, setupIncomplete = false, emailFailure = false, teamContext = {data:{version:1,showInInbox:false,channels:[]},error:null} } = {}) {
  const calls = [];
  const emailCalls = [];
  const recipientLookups = [];
  const db = createClient('https://test.invalid', 'fixture-only-key', { auth: { persistSession: false }, global: { fetch: async (input, init) => {
    const url = new URL(input);
    calls.push({ url, body: init?.body && JSON.parse(init.body) });
    const table = url.pathname.split('/').at(-1);
    const data = url.pathname.includes('/rpc/') ? (table === 'workspace_team_context' ? teamContext : rpcResult ?? {data: ['start_direct_conversation','send_conversation_message'].includes(table) ? {conversationId:chat,message:{id:message,sender_id:'user_me',content:'Eigene Testnachricht'},created:true} : message,error:null}) : { data: typeof results[table] === 'function' ? await results[table](url, init) : results[table] ?? [], error: null };
    return new Response(JSON.stringify(data.error ?? data.data), { status: data.error ? 400 : 200, headers: { 'content-type': 'application/json' } });
  } } });
  const mocks = {
    '@/lib/native-push-worker':{scheduleNativePushAfterCommit(){}},
    '@/lib/native-contact-contract':nativeContractFixture,
    '@/lib/message-attachments':messageAttachments,
    '@/lib/message-attachment-server':attachmentServerFixture(db),
    '@/lib/db': { db },
    '@/lib/messaging-backend': messagingBackend,
    '@/lib/support-identity': supportIdentity,
    '@/lib/support-started-offer-template': startedOfferTemplate,
    '@/lib/requireAdmin': { requireAdmin: async () => admin ? { userId: 'admin_test' } : NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 }) },
    '@/lib/admin-support': { resolveAdminSupportTarget: async () => ({ recipientUserId: 'user_me', targetType: 'profile', targetId: 'user_me', targetLabel: 'Testprofil', editUrl: '/profile-setup', missingFields: [], setupIncomplete }), SupportTargetError: class extends Error {} },
    '@/lib/admin-support-participants': { adminSupportParticipants: async (_ids, profiles) => new Map(profiles.map(profile => [profile.user_id, profile])) },
    '@/lib/support-setup-template': { SETUP_TEMPLATE_KEY: 'profile_setup', setupSupportTemplate: () => ({}) },
    'next-intl/server': { getTranslations: async () => key => key },
    '@/lib/auth': { requireAuth: async () => signedIn ? { userId: 'user_me' } : NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 }) },
    '@/lib/rateLimit': { rateLimit: async () => ({ allowed }) },
    '@/lib/trust': { anyBlockExists: async () => blocked, areAcceptedFriends: async () => friends },
    '@clerk/nextjs/server': { clerkClient: async () => ({ users: { getUser: async userId => {
      recipientLookups.push(userId);
      return { emailAddresses: [{ emailAddress: 'recipient@example.invalid' }] };
    } } }) },
    '@/lib/email': { sendNewMessageEmail: async (...args) => {
      emailCalls.push(args);
      if (emailFailure) throw new Error('Fixture provider failure');
    } },
    '@/lib/message-read-state': { applyParticipantReadReceipts: rows => rows },
    '@/lib/unread-message-counts': { getUnreadMessageCounts: async () => ({ count: 0, byConversation: {} }) },
  };
  const compiled = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const compiledModule = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), compiledModule, compiledModule.exports);
  return { ...compiledModule.exports, calls, emailCalls, recipientLookups };
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
  const response = await detail.GET(request(`/api/conversations/${chat}?before=2026-10-10T00%3A00%3A00.000Z&before_id=${message}`), params);
  assert.equal(response.status, 200);
  const query = detail.calls.find(call => call.url.pathname.endsWith('/messages')).url.searchParams;
  assert.deepEqual(query.getAll('or'), ['(sender_id.neq.user_me,hidden_for_sender_at.is.null)', `(created_at.lt.2026-10-10T00:00:00.000Z,and(created_at.eq.2026-10-10T00:00:00.000Z,id.lt.${message}))`]);
  const list = fixture(listFile, { results: { conversations: [{
    id: chat, kind: 'direct', sender_id: 'user_me', receiver_id: 'user_friend', messages: [],
    conversation_members: [{ user_id: 'user_me', joined_at: '2026-10-01', left_at: null }],
  }] } });
  const listResponse = await list.GET(request('/api/conversations'));
  assert.equal(listResponse.status, 200);
  assert.equal((await listResponse.json()).data[0].id, chat);
  const preview = list.calls.find(call => call.url.pathname.endsWith('/conversations')).url.searchParams;
  assert.equal(preview.get('messages.or'), '(sender_id.neq.user_me,hidden_for_sender_at.is.null)');
  assert.equal(preview.get('messages.limit'), '1');
});

const startMessage = () => new NextRequest('https://test.invalid/api/conversations', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ accountId:'user_me',idempotencyKey:'own-message-key',receiver_id: 'user_stranger', content: 'Eigene Testnachricht' }),
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
  assert.equal(api.calls.some(call=>call.body && !call.url.pathname.includes('/rpc/')),false);
  assert.equal(api.calls.find(call => call.url.pathname.endsWith('/start_direct_conversation')).body.p_sender_id, 'user_me');
  assert.equal(api.calls.some(call => call.url.pathname.endsWith('/friendships')), false);
});
test('contact sends notify the recipient once for both new and existing direct conversations', async () => {
  for (const existing of [false, true]) {
    const api = fixture(listFile, { results: {
      user_settings: { message_permission: 'everyone', email_new_message: true },
      conversations: (_url, init) => init?.method === 'POST' || existing ? { id: chat } : null,
      profiles: { display_name: 'Testsender' },
    }, rpcResult: { data: {conversationId:chat,message:{ id: message, sender_id: 'user_me', content: 'Eigene Testnachricht' },created:true}, error: null } });
    const response = await api.POST(startMessage());
    assert.equal(response.status, 200);
    assert.equal((await response.json()).message.id, message);
    assert.equal(api.calls.filter(call => call.url.pathname.endsWith('/start_direct_conversation')).length, 1);
    assert.equal(api.calls.some(call => call.url.pathname.endsWith('/conversations') && call.body), false);
    assert.deepEqual(api.recipientLookups, ['user_stranger']);
    assert.deepEqual(api.emailCalls, [['recipient@example.invalid', 'Testsender', 'Eigene Testnachricht', chat]]);
  }
});
test('contact sends respect disabled email notifications for both new and existing conversations', async () => {
  for (const existing of [false, true]) {
    const api = fixture(listFile, { results: {
      user_settings: { message_permission: 'everyone', email_new_message: false },
      conversations: (_url, init) => init?.method === 'POST' || existing ? { id: chat } : null,
    } });
    assert.equal((await api.POST(startMessage())).status, 200);
    assert.equal(api.calls.filter(call => call.url.pathname.endsWith('/start_direct_conversation')).length, 1);
    assert.deepEqual(api.emailCalls, []);
    assert.deepEqual(api.recipientLookups, []);
  }
});
test('failed message writes do not trigger a contact email notification', async () => {
  const api = fixture(listFile, { results: {
    user_settings: { message_permission: 'everyone', email_new_message: true },
    conversations: { id: chat },
  }, rpcResult: { data: null, error: { message: 'Fixture write rejected' } } });
  assert.equal((await api.POST(startMessage())).status, 503);
  assert.deepEqual(api.emailCalls, []);
  assert.deepEqual(api.recipientLookups, []);
});
test('contact notification failures preserve the successfully stored message', async () => {
  const api = fixture(listFile, { emailFailure: true, results: {
    user_settings: { message_permission: 'everyone', email_new_message: true },
    conversations: { id: chat },
    profiles: { display_name: 'Testsender' },
  }, rpcResult: { data: {conversationId:chat,message:{id:message},created:true}, error: null } });
  const response = await api.POST(startMessage());
  assert.equal(response.status, 200);
  assert.equal((await response.json()).message.id, message);
  assert.equal(api.emailCalls.length, 1);
});
test('direct messaging delegates current blocking and consent to the atomic database check', async () => {
  const api=fixture(listFile,{rpcResult:{data:null,error:{code:'42501',message:'messaging_contact_unavailable'}}});
  assert.equal((await api.POST(startMessage())).status,403);
  assert.equal(api.calls.filter(call=>call.url.pathname.includes('/rpc/')).length,1);
  assert.equal(api.calls.some(call=>call.url.pathname.endsWith('/conversations')),false);
  assert.equal(api.emailCalls.length,0);
  const signedOut=fixture(listFile,{signedIn:false});assert.equal((await signedOut.POST(startMessage())).status,401);assert.equal(signedOut.calls.length,0);
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
test('member reply stays in the same support thread and uses the authenticated sender and retry key', async () => {
  const api = fixture(detailFile, { results: supportResults, rpcResult: { data: {conversationId:chat,message:{ id: message, sender_id: 'user_me', content: 'Antwort' },created:true}, error: null } });
  const body={accountId:'user_me',idempotencyKey:'own-support-key',content:'Antwort',sender_id:supportIdentity.SUPPORT_ACTOR_ID};
  const response=await api.POST(writeRequest(`/api/conversations/${chat}`,body),params);
  assert.equal(response.status,200);assert.equal((await response.json()).message.sender_id,'user_me');
  assert.deepEqual(api.calls.find(call=>call.url.pathname.endsWith('/send_conversation_message')).body,{p_conversation_id:chat,p_sender_id:'user_me',p_content:'Antwort',p_idempotency_key:'own-support-key'});
  assert.equal(api.calls.some(call=>call.url.pathname.endsWith('/conversations')&&call.body),false);
  const forbidden=fixture(detailFile,{rpcResult:{data:null,error:{code:'PT404',message:'messaging_inactive'}}});
  assert.equal((await forbidden.POST(writeRequest(`/api/conversations/${chat}`,body),params)).status,404);
  assert.equal(forbidden.emailCalls.length,0);
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

test('Team channels are filtered before the inbox page limit unless privately opted in; context failures are closed',async()=>{
 for(const showInInbox of [false,true]){
  const api=fixture(listFile,{teamContext:{data:{version:1,showInInbox,channels:[]},error:null}});
  assert.equal((await api.GET(request('/api/conversations'))).status,200);
  const query=api.calls.find(call=>call.url.pathname.endsWith('/conversations')).url.searchParams;
  assert.equal(query.get('workspace_team_id'),showInInbox?null:'is.null');assert.equal(query.get('limit'),'51');
 }
 for(const [code,status]of[['PGRST202',200],['42883',200],['XX000',503]]){
  const api=fixture(listFile,{teamContext:{data:null,error:{code,message:'PRIVATE'}}});
  const response=await api.GET(request('/api/conversations'));assert.equal(response.status,status);assert.doesNotMatch(JSON.stringify(await response.json()),/PRIVATE/);
  if(status===503)assert.equal(api.calls.some(call=>call.url.pathname.endsWith('/conversations')),false);
 }
});
test('inbox pagination is stable by time and UUID and rejects injected or incomplete cursors',async()=>{
 const conversations=Array.from({length:51},(_,n)=>({id:`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`,kind:'direct',sender_id:'user_me',receiver_id:'peer',updated_at:'2026-11-22T12:00:00.000Z',conversation_members:[{user_id:'user_me',left_at:null,joined_at:'2026-01-01'}],messages:[]}));
 const api=fixture(listFile,{results:{conversations}});
 const response=await api.GET(request('/api/conversations'));assert.equal(response.status,200);const body=await response.json();assert.equal(body.data.length,50);assert.deepEqual(body.nextCursor,{before:conversations[49].updated_at,before_id:conversations[49].id});
 const next=fixture(listFile);const valid='before=2026-11-22T12%3A00%3A00.000Z&before_id='+chat;
 assert.equal((await next.GET(request('/api/conversations?'+valid))).status,200);const query=next.calls.find(call=>call.url.pathname.endsWith('/conversations')).url.searchParams;
 assert.match(query.get('or'),/updated_at.lt.2026-11-22T12:00:00.000Z/);assert.equal(query.get('order'),'updated_at.desc,id.desc');
 for(const suffix of ['before=2026-11-22','before_id='+chat,valid.replace(chat,'bad),id.eq.other')]){const invalid=fixture(listFile);assert.equal((await invalid.GET(request('/api/conversations?'+suffix))).status,400);}
});

test('PostgreSQL offset/microsecond cursors survive actual API and native paging with no lost or duplicate rows',async t=>{
 const pg=new PGlite();
 try{
  await pg.exec(`create table cursor_conversations(id uuid primary key,updated_at timestamptz not null);
   insert into cursor_conversations select ('10000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
    '2026-11-22T16:00:00.123456+00:00'::timestamptz+case when n<=75 then interval '0' else (n-75)*interval '1 microsecond' end from generate_series(1,120) n;`);
  const expected=(await pg.query('select array_agg(id order by updated_at desc,id desc) ids from cursor_conversations')).rows[0].ids;
  for(const zone of ['UTC','Europe/Berlin']){
   await pg.query("select set_config('TimeZone',$1,false)",[zone]);
   const api=fixture(listFile,{results:{conversations:async url=>{
    const filter=url.searchParams.get('or');let before=null,beforeId=null;
    if(filter){const match=/^\(updated_at\.lt\.([^,]+),and\(updated_at\.eq\.([^,]+),id\.lt\.([0-9a-f-]{36})\)\)$/.exec(filter);assert.ok(match,filter);assert.equal(match[1],match[2]);before=match[1];beforeId=match[3];}
    const {rows}=await pg.query(`select coalesce(json_agg(json_build_object('id',c.id,'kind','direct','sender_id','user_me','receiver_id','peer','updated_at',c.updated_at,
     'conversation_members',json_build_array(json_build_object('user_id','user_me','left_at',null,'joined_at','2026-01-01T00:00:00Z')),'messages','[]'::json) order by c.updated_at desc,c.id desc),'[]'::json) page
     from (select * from cursor_conversations where ($1::timestamptz is null or updated_at<$1::timestamptz or (updated_at=$1::timestamptz and id<$2::uuid)) order by updated_at desc,id desc limit $3) c`,[before,beforeId,Number(url.searchParams.get('limit'))]);
    return rows[0].page;
   }}});
   const found=[],boundaries=[];let cursor=null,pages=0;
   do{
    const response=await api.GET(request(nativeInboxPageURL(cursor)));assert.equal(response.status,200,zone);const body=await response.json();assert.ok(body.data.length<=50);found.push(...body.data.map(row=>row.id));pages++;
    if(body.nextCursor){boundaries.push(body.nextCursor);assert.match(body.nextCursor.before,/\.\d{6}[+-]\d{2}:\d{2}$/);assert.notEqual(new Date(body.nextCursor.before).toISOString(),body.nextCursor.before);cursor=nativeInboxCursor(body.nextCursor);assert.ok(cursor);assert.equal(cursor.before,body.nextCursor.before);}else cursor=null;
    assert.ok(pages<=3);
   }while(cursor);
   assert.equal(pages,3);assert.deepEqual(found,expected);assert.equal(new Set(found).size,120);
   t.diagnostic(JSON.stringify({kind:'inbox',zone,pages,expected:120,found:found.length,unique:new Set(found).size,boundaries}));
  }
 }finally{await pg.close();}
});

test('existing message history accepts raw offsets and rejects malformed timestamps or UUID filter injection',async()=>{
 const before='2026-11-22T17:00:00.123456+01:00';
 const results={conversations:{id:chat,kind:'group',group_name:'Own group'},conversation_members:url=>url.searchParams.has('user_id')?{role:'member',joined_at:'2026-11-01T00:00:00+00:00',left_at:null}:[{user_id:'user_me',role:'member'}],messages:[]};
 const api=fixture(detailFile,{results});const query=new URLSearchParams({before,before_id:message});assert.equal((await api.GET(request('/api/conversations/'+chat+'?'+query),params)).status,200);
 const sent=api.calls.find(call=>call.url.pathname.endsWith('/messages')).url.searchParams;assert.ok(sent.getAll('or').some(value=>value.includes('created_at.lt.'+before)));assert.equal(sent.get('created_at'),'gte.2026-11-01T00:00:00+00:00');
 for(const patch of [{before:'' ,before_id:''},{before:'2026-02-30T00:00:00Z'},{before:'2026-11-22T17:00:00+14:01'},{before:'2026-11-22T17:00:00Z'+String.fromCharCode(10)},{before_id:message+String.fromCharCode(10)},{before_id:'bad),id.neq.other'}]){
  const f=fixture(detailFile,{results}),bad=new URLSearchParams({before,before_id:message,...patch});assert.equal((await f.GET(request('/api/conversations/'+chat+'?'+bad),params)).status,400);assert.equal(f.calls.some(call=>call.url.pathname.endsWith('/messages')),false);
 }
 for(const patch of [{before:'',before_id:''},{before:'2026-02-30T00:00:00Z'},{before:'2026-11-22T17:00:00+24:00'},{before:'2026-11-22T17:00:00Z'+String.fromCharCode(10)},{before_id:message+String.fromCharCode(10)}]){const f=fixture(listFile);assert.equal((await f.GET(request('/api/conversations?'+new URLSearchParams({before,before_id:message,...patch})))).status,400);assert.equal(f.calls.some(call=>call.url.pathname.endsWith('/conversations')),false);}
});

test('PostgreSQL history pages retain microseconds, UUID ties, hidden-message filtering and the group join boundary',async t=>{
 const pg=new PGlite(),joined='2026-11-22T16:00:00.123455+00:00';
 try{
  await pg.exec(`create table cursor_messages(id uuid primary key,created_at timestamptz not null,sender_id text not null,hidden_for_sender_at timestamptz);
   insert into cursor_messages select ('30000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
    '2026-11-22T16:00:00.123456+00:00'::timestamptz+case when n<=350 then interval '0' else (n-350)*interval '1 microsecond' end,'peer',null from generate_series(1,450) n;
   insert into cursor_messages select ('30000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'2026-11-22T16:00:00.123454+00:00','peer',null from generate_series(451,470) n;
   insert into cursor_messages select ('30000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'2026-11-22T16:00:01.123456+00:00','user_me',now() from generate_series(471,473) n;`);
  const expected=(await pg.query("select array_agg(id order by created_at desc,id desc) ids from cursor_messages where created_at >= $1::timestamptz and (sender_id <> 'user_me' or hidden_for_sender_at is null)",[joined])).rows[0].ids;
  for(const zone of ['UTC','Europe/Berlin']){
   await pg.query("select set_config('TimeZone',$1,false)",[zone]);
   const results={conversations:{id:chat,kind:'group',group_name:'Own group'},conversation_members:url=>url.searchParams.has('user_id')?{role:'member',joined_at:joined,left_at:null}:[{user_id:'user_me',role:'member'}],messages:async url=>{
    const filters=url.searchParams.getAll('or');assert.equal(filters[0],'(sender_id.neq.user_me,hidden_for_sender_at.is.null)');assert.equal(url.searchParams.get('order'),'created_at.desc,id.desc');assert.equal(url.searchParams.get('created_at'),'gte.'+joined);
    let before=null,beforeId=null;
    if(filters[1]){const match=/^\(created_at\.lt\.([^,]+),and\(created_at\.eq\.([^,]+),id\.lt\.([0-9a-f-]{36})\)\)$/.exec(filters[1]);assert.ok(match,filters[1]);assert.equal(match[1],match[2]);before=match[1];beforeId=match[3];}
    const {rows}=await pg.query(`select coalesce(json_agg(json_build_object('id',m.id,'conversation_id',$5::text,'sender_id',m.sender_id,'content','Synthetic history','created_at',m.created_at,'read_at',null) order by m.created_at desc,m.id desc),'[]'::json) page
     from (select * from cursor_messages where created_at >= $1::timestamptz and (sender_id <> 'user_me' or hidden_for_sender_at is null)
      and ($2::timestamptz is null or created_at<$2::timestamptz or (created_at=$2::timestamptz and id<$3::uuid)) order by created_at desc,id desc limit $4) m`,[joined,before,beforeId,Number(url.searchParams.get('limit')),chat]);return rows[0].page;
   }};
   const api=fixture(detailFile,{results}),found=[],boundaries=[];let cursor=null,pages=0;
   do{
    const suffix=cursor?'?'+new URLSearchParams(cursor):'';const response=await api.GET(request('/api/conversations/'+chat+suffix),params);assert.equal(response.status,200,zone);const body=await response.json();assert.equal(body.conversation.historyFrom,joined);assert.ok(body.messages.length<=200);
    found.push(...body.messages.slice().reverse().map(row=>row.id));pages++;
    if(body.nextCursor){boundaries.push(body.nextCursor);cursor=nativeInboxCursor(body.nextCursor);assert.ok(cursor);assert.match(cursor.before,/\.\d{6}[+-]\d{2}:\d{2}$/);}else cursor=null;
    assert.equal(body.hasOlder,!!cursor);assert.ok(pages<=3);
   }while(cursor);
   assert.equal(pages,3);assert.deepEqual(found,expected);assert.equal(new Set(found).size,450);
   t.diagnostic(JSON.stringify({kind:'history',zone,pages,expected:450,found:found.length,unique:new Set(found).size,excludedBeforeJoin:20,excludedHiddenOwn:3,boundaries}));
  }
 }finally{await pg.close();}
});
