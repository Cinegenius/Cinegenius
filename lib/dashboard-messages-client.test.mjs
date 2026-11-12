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
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'confirmReply') sendCallback = node.initializer;
  if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect') {
    const callback = node.arguments[0];
    const text = callback?.getText(ast) ?? '';
    if (text.includes('setMessagesLoading(true)') && text.includes('incomingUnreadMessageIds')) loadCallback = callback;
  }
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(sendCallback, 'the actual dashboard confirmed-message callback exists');
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
    confirm: (message,conversationId='chat-a',accountId='owner') => compile(sendCallback, dependencies())(message,conversationId,accountId),
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

test('a confirmed message is merged only into its originating account and conversation',()=>{
 const page=fixture(async()=>response(200,{}));
 page.confirm(message('stored'));assert.deepEqual(page.state.activeMessages.map(row=>row.id),['stored']);
 page.select('chat-b');page.state.activeMessages=[message('b')];
 page.confirm(message('late-a'));assert.deepEqual(page.state.activeMessages.map(row=>row.id),['b']);
 page.confirm(message('foreign'),'chat-b','other-account');assert.deepEqual(page.state.activeMessages.map(row=>row.id),['b']);
});

test('a pending history snapshot cannot remove a reply confirmed by the shared composer',async()=>{
 const history=deferred();const page=fixture(()=>history.promise);const cleanup=page.load();
 page.confirm(message('confirmed'));history.resolve(response(200,{messages:[message('older')]}));await settle();
 assert.deepEqual(new Set(page.state.activeMessages.map(row=>row.id)),new Set(['older','confirmed']));cleanup?.();
});

test('dashboard uses the account-and-conversation keyed private composer with guarded switching',()=>{
 assert.match(source,/MessageComposer key=\{`\$\{user.id\}:conversation:/);
 assert.match(source,/leaveEditor\(\(\) => setSelectedConversation/);
 assert.doesNotMatch(source,/body: JSON.stringify\(\{ content: draftAtSend/);
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
