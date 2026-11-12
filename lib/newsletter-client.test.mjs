import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { createTranslator } from 'use-intl/core';
import { uiErrorMessage } from './ui-error-message.ts';

// Run the actual browser callbacks with controlled HTTP promises. These fixtures
// never contact the subscription endpoint, database or email provider.
function compileCallback(file, name) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let callback;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) callback = node;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(callback, `${name} callback exists`);
  const compiled = ts.transpileModule(callback.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return dependencies => new Function(...Object.keys(dependencies), `${compiled}; return ${name};`)(...Object.values(dependencies));
}
const signupCallback = compileCallback('../components/NewsletterSignup.tsx', 'submit');
const actionCallback = compileCallback('../components/NewsletterAction.tsx', 'apply');
const response = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const deferred = () => { let resolve; const promise = new Promise(accept => { resolve = accept; }); return { promise, resolve }; };

function translator(locale = 'de') {
  const messages = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8'));
  return createTranslator({ locale, messages, namespace: 'NewsletterSignup', onError(error) { throw error; } });
}

function signup(fetch, locale) {
  const state = { email: 'member@example.test', consent: true, busy: false, message: null, fieldError: null, focused: null };
  const pending = { current: false };
  const t = translator(locale);
  const fields = Object.fromEntries(['email', 'consent'].map(name => [name, { validity: { typeMismatch: false }, focus() { state.focused = name; } }]));
  const set = field => value => { state[field] = value; };
  return {
    state, t, fields,
    submit() {
      return signupCallback({
        email: state.email, consent: state.consent, pending, fetch, t, uiErrorMessage,
        setBusy: set('busy'), setMessage: set('message'), setFieldError: set('fieldError'),
        setEmail: set('email'), setConsent: set('consent'),
      })({ preventDefault() {}, currentTarget: { elements: { namedItem: name => fields[name] } } });
    },
  };
}

function action(fetch, mode = 'confirm', locale) {
  const state = { busy: false, result: null };
  const pending = { current: false };
  const t = translator(locale);
  return {
    state, t,
    apply() {
      return actionCallback({
        pending, result: state.result, confirm: mode === 'confirm', token: 'confirmation-token', id: 'subscription-id', proof: 'unsubscribe-proof',
        fetch, t, uiErrorMessage, setBusy: value => { state.busy = value; }, setResult: value => { state.result = value; },
      })();
    },
  };
}

for (const locale of ['de', 'en', 'es', 'it', 'cs', 'hu', 'nl', 'nl-BE', 'sv']) {
  test(`newsletter validation and retry copy resolve in ${locale}`, async () => {
    let calls = 0;
    const form = signup(async () => { calls++; return response(200, { message: 'unexpected' }); }, locale);
    form.state.email = '';
    await form.submit();
    assert.equal(form.state.fieldError, 'emailRequired');
    assert.equal(form.state.focused, 'email');
    form.state.email = 'member@example';
    await form.submit();
    assert.equal(form.state.fieldError, 'emailInvalid');
    form.state.email = 'member@example.test';
    form.state.consent = false;
    await form.submit();
    assert.equal(form.state.fieldError, 'consentRequired');
    assert.equal(form.state.focused, 'consent');
    assert.equal(form.state.consent, false);
    assert.equal(calls, 0);
    for (const key of ['emailRequired', 'emailInvalid', 'consentRequired', 'retry', 'actionError', 'actionRateLimited']) assert.notEqual(form.t(key), key);
    const page = action(async () => { throw new TypeError('Failed to fetch'); }, 'confirm', locale);
    await page.apply();
    assert.deepEqual(page.state.result, { ok: false, text: page.t('actionError') });
  });
}

test('signup sends only the typed address and explicit consent, retaining inputs after confirmation', async () => {
  const requests = [];
  const form = signup(async (url, init) => { requests.push({ url, body: JSON.parse(init.body) }); return response(200, { message: 'Check your email' }); });
  form.state.email = ' member@example.test ';
  await form.submit();
  assert.deepEqual(requests, [{ url: '/api/newsletter/subscribe', body: { email: 'member@example.test', consent: true } }]);
  assert.equal(form.state.email, ' member@example.test ');
  assert.equal(form.state.consent, true);
  assert.deepEqual(form.state.message, { ok: true, text: 'Check your email' });
});

test('signup retains input on HTTP and network failure and can retry', async () => {
  let attempt = 0;
  const form = signup(async () => {
    attempt++;
    if (attempt === 1) return response(503, { error: 'Temporarily unavailable' });
    if (attempt === 2) throw new TypeError('Failed to fetch');
    return response(200, { message: 'Check your email' });
  });
  await form.submit();
  assert.deepEqual(form.state.message, { ok: false, text: 'Temporarily unavailable' });
  assert.equal(form.state.busy, false);
  await form.submit();
  assert.deepEqual(form.state.message, { ok: false, text: form.t('submitError') });
  assert.equal(form.state.email, 'member@example.test');
  assert.equal(form.state.consent, true);
  await form.submit();
  assert.equal(form.state.message.ok, true);
  assert.equal(attempt, 3);
});

test('signup rejects malformed and contradictory 2xx responses without clearing input', async () => {
  const malformed = [null, [], {}, { message: '' }, { message: '   ' }, { error: 'Not accepted' }, { message: 'Accepted', error: 'Not accepted' }];
  for (const body of malformed) {
    const form = signup(async () => response(200, body));
    await form.submit();
    assert.deepEqual(form.state.message, { ok: false, text: form.t('submitError') });
    assert.equal(form.state.email, 'member@example.test');
    assert.equal(form.state.consent, true);
  }
  const form = signup(async () => ({ ok: true, json: async () => { throw new SyntaxError('HTML response'); } }));
  await form.submit();
  assert.equal(form.state.message.ok, false);
});

test('pending signup guards double submission and never erases later input', async () => {
  const request = deferred();
  let calls = 0;
  const form = signup(() => { calls++; return request.promise; });
  const sending = form.submit();
  assert.equal(form.state.busy, true);
  await form.submit();
  assert.equal(calls, 1);
  form.state.email = 'later-entry@example.test';
  form.state.consent = false;
  request.resolve(response(200, { message: 'Check your email' }));
  await sending;
  assert.equal(form.state.email, 'later-entry@example.test');
  assert.equal(form.state.consent, false);
  assert.equal(form.state.busy, false);
});

for (const mode of ['confirm', 'unsubscribe']) {
  test(`${mode} distinguishes invalid links from temporary failures and supports retry`, async () => {
    const invalidKey = mode === 'confirm' ? 'confirmInvalid' : 'unsubscribeInvalid';
    let status = 400;
    const page = action(async () => response(status, status === 200 ? { message: 'Completed' } : { error: translator()(invalidKey) }), mode);
    await page.apply();
    assert.equal(page.state.result.text, page.t(invalidKey));
    for (status of [429, 503]) {
      await page.apply();
      assert.deepEqual(page.state.result, { ok: false, text: page.t(status === 429 ? 'actionRateLimited' : 'actionError') });
      assert.equal(page.state.busy, false);
    }
    status = 200;
    await page.apply();
    assert.deepEqual(page.state.result, { ok: true, text: 'Completed' });
  });

  test(`${mode} requires acknowledged JSON and guards pending and successful actions`, async () => {
    for (const body of [null, {}, { message: '' }, { message: 'Completed', error: 'Failure' }]) {
      const page = action(async () => response(200, body), mode);
      await page.apply();
      assert.deepEqual(page.state.result, { ok: false, text: page.t('actionError') });
    }
    const request = deferred();
    let calls = 0;
    const page = action(() => { calls++; return request.promise; }, mode);
    const applying = page.apply();
    await page.apply();
    assert.equal(calls, 1);
    request.resolve(response(200, { message: 'Completed' }));
    await applying;
    await page.apply();
    assert.equal(calls, 1);
    assert.equal(page.state.busy, false);
  });
}
