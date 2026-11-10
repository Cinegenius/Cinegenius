import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Exercise the actual page callbacks with controlled HTTP promises. No React
// renderer, real account, database, message send or email provider is involved.
const source = readFileSync(new URL('../app/dashboard/page.tsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('dashboard.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let sendCallback;
let loadCallback;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'sendReply') sendCallback = node.initializer;
  if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect') {
    const callback = node.arguments[0];
    const text = callback?.getText(ast) ?? '';
    if (text.includes('setMessagesLoading(true)') && text.includes('incomingUnreadMessageIds')) loadCallback = callback;
  }
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(sendCallback, 'the actual dashboard send callback exists');
assert.ok(loadCallback, 'the actual dashboard message-load effect exists');

function compile(callback, dependencies) {
  const compiled = ts.transpileModule(`const execute = ${callback.getText(ast)};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  return new Function(...Object.keys(dependencies), `${compiled}\nreturn execute;`)(...Object.values(dependencies));
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((accept, fail) => { resolve = accept; reject = fail; });
  return { promise, resolve, reject };
}
const response = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const settle = async () => { for (let index = 0; index < 20; index++) await Promise.resolve(); };
const message = (id, content = id) => ({ id, sender_id: 'owner', content, created_at: '2026-11-10T08:00:00Z', read_at: null });

function fixture(fetch) {
  const state = { replyText: 'Unsent test draft', replyError: '', messageLoadError: '', activeMessages: [], messagesLoading: false, sending: false, notifications: [], conversations: [], unreadCount: 0, refreshed: 0 };
  const messageViewRef = { current: { userId: 'owner', conversationId: 'chat-a' } };
  const messageSendPendingRef = { current: false };
  const setter = key => value => { state[key] = typeof value === 'function' ? value(state[key]) : value; };
  const dependencies = () => ({
    user: { id: messageViewRef.current.userId },
    selectedConversation: messageViewRef.current.conversationId,
    replyText: state.replyText,
    sending: state.sending,
    messageViewRef,
    messageSendPendingRef,
    fetch,
    setActiveMessages: setter('activeMessages'),
    setMessagesLoading: setter('messagesLoading'),
    setReplyText: setter('replyText'),
    setSending: setter('sending'),
    setReplyError: setter('replyError'),
    setMessageLoadError: setter('messageLoadError'),
    setConversations: setter('conversations'),
    setUnreadMessagesTotal: setter('unreadCount'),
    setConversationsReady: () => {},
    dashboardMessageText: key => key,
    incomingUnreadMessageIds: () => [],
    applyReadReceiptTimestamps: rows => rows,
    notifyMessagesRead: owner => state.notifications.push(owner),
    loadDashboardConversations: async () => { state.refreshed++; },
    mergeMessagesById: (current, incoming) => [...new Map([...current, ...incoming].map(row => [row.id, row])).values()],
    messagesEndRef: { current: { scrollIntoView() {} } },
    setTimeout: callback => { callback(); return 1; },
  });
  return {
    state,
    send: () => compile(sendCallback, dependencies())(),
    sender: () => compile(sendCallback, dependencies()),
    select(conversationId, userId = 'owner') { messageViewRef.current = { userId, conversationId }; },
    load: () => compile(loadCallback, dependencies())(),
  };
}

test('dashboard ignores a late conversation response after switching recipients', async () => {
  const first = deferred(), second = deferred();
  const page = fixture(url => url.endsWith('/chat-a') ? first.promise : second.promise);
  const cleanupFirst = page.load();
  page.select('chat-b');
  cleanupFirst?.();
  const cleanupSecond = page.load();
  second.resolve(response(200, { messages: [message('from-b')] }));
  await settle();
  assert.deepEqual(page.state.activeMessages.map(row => row.id), ['from-b']);
  first.resolve(response(200, { messages: [message('from-a')] }));
  await settle();
  assert.deepEqual(page.state.activeMessages.map(row => row.id), ['from-b']);
  cleanupSecond?.();
});

test('a stale load cannot dismiss the selected conversation loading indicator', async () => {
  const first = deferred(), second = deferred();
  const page = fixture(url => url.endsWith('/chat-a') ? first.promise : second.promise);
  const cleanupFirst = page.load();
  page.select('chat-b');
  cleanupFirst?.();
  const cleanupSecond = page.load();
  first.resolve(response(200, { messages: [message('from-a')] }));
  await settle();
  assert.equal(page.state.messagesLoading, true);
  assert.deepEqual(page.state.activeMessages, []);
  second.resolve(response(200, { messages: [message('from-b')] }));
  await settle();
  assert.equal(page.state.messagesLoading, false);
  cleanupSecond?.();
});

test('dashboard shows load failures instead of an apparently empty conversation', async () => {
  const page = fixture(async () => response(500, { error: 'Fixture unavailable' }));
  const cleanup = page.load();
  await settle();
  assert.equal(page.state.messageLoadError, 'messageLoadError');
  assert.equal(page.state.messagesLoading, false);
  cleanup?.();
});

test('rejected replies keep the draft and expose the server failure without treating the send as successful', async () => {
  for (const status of [401, 403, 429, 500]) {
    let fetches = 0;
    const page = fixture(async (_url, options) => {
      fetches++;
      return options?.method === 'POST' ? response(status, { error: `Fixture HTTP ${status}` }) : response(200, { messages: [] });
    });
    await page.send();
    assert.equal(page.state.replyText, 'Unsent test draft');
    assert.equal(page.state.replyError, `Fixture HTTP ${status}`);
    assert.equal(page.state.sending, false);
    assert.equal(fetches, 1);
  }
});

test('network failures preserve the draft and produce a localized visible failure', async () => {
  const page = fixture(async () => { throw new TypeError('Fixture offline'); });
  await assert.doesNotReject(page.send());
  assert.equal(page.state.replyText, 'Unsent test draft');
  assert.equal(page.state.replyError, 'sendError');
  assert.equal(page.state.sending, false);
});

test('dashboard clears the draft only after a confirmed stored message', async () => {
  const pending = deferred();
  const page = fixture(() => pending.promise);
  const sending = page.send();
  assert.equal(page.state.replyText, 'Unsent test draft');
  pending.resolve(response(200, { message: message('confirmed', 'Unsent test draft') }));
  await sending;
  assert.equal(page.state.replyText, '');
  assert.deepEqual(page.state.activeMessages.map(row => row.id), ['confirmed']);
  assert.equal(page.state.replyError, '');
});

test('a confirmed reply from a previous recipient cannot replace the current conversation or its new draft', async () => {
  const pending = deferred();
  const page = fixture((_url, options) => options?.method === 'POST' ? pending.promise : Promise.resolve(response(200, { messages: [message('from-a')] })));
  const sending = page.send();
  page.select('chat-b');
  page.state.activeMessages = [message('from-b')];
  page.state.replyText = 'New draft for B';
  pending.resolve(response(200, { message: message('from-a') }));
  await sending;
  assert.deepEqual(page.state.activeMessages.map(row => row.id), ['from-b']);
  assert.equal(page.state.replyText, 'New draft for B');
});

test('a success status without a stored message confirmation retains the draft', async () => {
  const page = fixture(async (_url, options) => response(200, options?.method === 'POST' ? {} : { messages: [] }));
  await page.send();
  assert.equal(page.state.replyText, 'Unsent test draft');
  assert.equal(page.state.replyError, 'sendError');
});

test('typing a new draft while a confirmed reply is pending does not lose the new text', async () => {
  const pending = deferred();
  const page = fixture((_url, options) => options?.method === 'POST' ? pending.promise : Promise.resolve(response(200, { messages: [message('confirmed')] })));
  const sending = page.send();
  page.state.replyText = 'New text during the request';
  pending.resolve(response(200, { message: message('confirmed') }));
  await sending;
  assert.equal(page.state.replyText, 'New text during the request');
});

test('a pending history snapshot cannot remove a reply already confirmed in the same conversation', async () => {
  const history = deferred(), reply = deferred();
  const page = fixture((_url, options) => options?.method === 'POST' ? reply.promise : history.promise);
  const cleanup = page.load();
  const sending = page.send();
  reply.resolve(response(200, { message: message('confirmed') }));
  await settle();
  history.resolve(response(200, { messages: [message('older')] }));
  await sending;
  await settle();
  assert.deepEqual(new Set(page.state.activeMessages.map(row => row.id)), new Set(['older', 'confirmed']));
  cleanup?.();
});

test('malformed successful history responses show a load error instead of an empty conversation', async () => {
  for (const messages of [undefined, null, {}, 'not a message list']) {
    const page = fixture(async () => response(200, { messages }));
    const cleanup = page.load();
    await settle();
    assert.equal(page.state.messageLoadError, 'messageLoadError');
    assert.equal(page.state.messagesLoading, false);
    cleanup?.();
  }
});
