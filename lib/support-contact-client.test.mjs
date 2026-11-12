import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('../components/SupportContactForm.tsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('support.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let submit;
function visit(node) { if (ts.isFunctionDeclaration(node) && node.name?.text === 'submit') submit = node; ts.forEachChild(node, visit); } visit(ast);
assert.ok(submit);
const compiled = ts.transpileModule(submit.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const key = '11111111-1111-4111-8111-111111111111', chat = '22222222-2222-4222-8222-222222222222';
const response = (status, body) => ({ ok: status >= 200 && status < 300, json: async () => body });
function fixture(fetch, { flush = async () => true } = {}) {
  const state = { value: { content: 'Own unsent test request', requestKey: key }, sending: false, phase: 'idle', error: '', conversationId: null, completed: 0, snapshots: [] };
  const currentAccount = { current: 'owner' }, pending = { current: false };
  const set = field => value => { state[field] = typeof value === 'function' ? value(state[field]) : value; };
  const dependencies = () => ({ value: state.value, accountId: 'owner', currentAccount, sameAccount: true, pending, draft: { loaded: true, flush: async () => { state.snapshots.push(structuredClone(state.value)); return flush(); }, complete: async () => { state.completed++; } }, setSendPhase: phase => { state.phase = phase; state.sending = phase !== 'idle'; }, setError: set('error'), setValue: set('value'), setConversationId: set('conversationId'), flushSync: work => work(), uuid: /^[0-9a-f-]{36}$/i, crypto: { randomUUID: () => key }, AbortController, window: { setTimeout: () => 1, clearTimeout() {} }, fetch, t: key => key, uiErrorMessage: (error, fallback) => error.message || fallback });
  return { state, currentAccount, send: () => { const deps = dependencies(); return new Function(...Object.keys(deps), compiled + ';return submit;')(...Object.values(deps))({ preventDefault() {} }); } };
}
const tick = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
test('support form preserves message and request key on failures, allowing a safe retry', async () => {
  let fail = true; const requests = [];
  const form = fixture(async (_url, init) => { requests.push(JSON.parse(init.body)); return fail ? response(503, { error: 'offline' }) : response(200, { conversationId: chat, messageId: key }); });
  await form.send(); assert.equal(form.state.error, 'offline'); assert.equal(form.state.value.content, 'Own unsent test request'); assert.equal(form.state.completed, 0);
  assert.equal(requests[0].accountId, 'owner');
  assert.deepEqual(form.state.snapshots[0], { content: 'Own unsent test request', requestKey: key });
  fail = false; await form.send(); assert.deepEqual(requests[0], requests[1]); assert.equal(form.state.completed, 1); assert.equal(form.state.conversationId, chat); assert.equal(form.state.value.content, '');
});
test('an unconfirmed 2xx response does not clear the message or claim it was sent', async () => {
  const form = fixture(async () => response(200, {})); await form.send();
  assert.equal(form.state.value.requestKey, key); assert.equal(form.state.value.content, 'Own unsent test request'); assert.equal(form.state.conversationId, null); assert.equal(form.state.error, 'sendError');
});
test('late completion after account switch cannot clear or expose the previous account message', async () => {
  let resolve; const pending = new Promise(yes => { resolve = yes; }); const form = fixture(() => pending);
  const send = form.send(); await tick(); form.currentAccount.current = 'another-member';
  resolve(response(200, { conversationId: chat, messageId: key })); await send;
  assert.equal(form.state.conversationId, null); assert.equal(form.state.completed, 0); assert.equal(form.state.value.content, 'Own unsent test request');
});
test('double taps produce one request and no duplicate local completion', async () => {
  let resolve, calls = 0; const pending = new Promise(yes => { resolve = yes; }); const form = fixture(() => { calls++; return pending; });
  const send = form.send(); await form.send(); await tick(); assert.equal(calls, 1);
  resolve(response(200, { conversationId: chat, messageId: key })); await send; assert.equal(form.state.completed, 1);
});
test('private recovery confirms the exact key and text before a contact request begins', async () => {
  let confirm, calls = 0; const saving = new Promise(resolve => { confirm = resolve; });
  const form = fixture(async () => { calls++; return response(200, { conversationId: chat, messageId: key }); }, { flush: () => saving });
  form.state.value.requestKey = '';
  const send = form.send(); await tick(); assert.equal(calls, 0); assert.equal(form.state.phase, 'saving');
  assert.deepEqual(form.state.snapshots, [{ content: 'Own unsent test request', requestKey: key }]);
  await form.send(); assert.equal(form.state.snapshots.length, 1);
  confirm(true); await send; assert.equal(calls, 1); assert.equal(form.state.completed, 1);
});
test('a failed private save retains input and retry key without sending or claiming success', async () => {
  let calls = 0;
  const form = fixture(async () => { calls++; return response(200, { conversationId: chat, messageId: key }); }, { flush: async () => false });
  await form.send(); assert.equal(calls, 0); assert.equal(form.state.completed, 0); assert.equal(form.state.conversationId, null);
  assert.equal(form.state.error, 'recoveryError'); assert.equal(form.state.sending, false);
  assert.deepEqual(form.state.value, { content: 'Own unsent test request', requestKey: key });
});
test('an account switch during recovery never posts the old account text', async () => {
  let confirm, calls = 0; const saving = new Promise(resolve => { confirm = resolve; });
  const form = fixture(async () => { calls++; return response(200, { conversationId: chat, messageId: key }); }, { flush: () => saving });
  const send = form.send(); form.currentAccount.current = 'another-member'; confirm(true); await send;
  assert.equal(calls, 0); assert.equal(form.state.completed, 0); assert.equal(form.state.conversationId, null);
});
