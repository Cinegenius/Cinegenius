import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const {NextRequest, NextResponse} = require('next/server');
const {createTranslator} = require('next-intl');
const LOCALES = ['de', 'en', 'es', 'it', 'cs', 'hu', 'nl', 'nl-BE', 'sv'];
const BASE = 'https://newsletter.example.test';
const EMAIL = 'subscriber@example.test';
const SUBSCRIPTION = '00000000-0000-4000-8000-000000000001';
const SECRET = 'newsletter-test-only-signing-key';
const TOKEN = 'a'.repeat(43);
const catalogs = new Map(LOCALES.map(locale => [locale, JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8'))]));
const compiled = new Map();

/** Closed imports, dummy environment and captured transports: no account access or real mail. */
function harness(options = {}) {
  const locale = options.locale ?? 'de';
  const t = createTranslator({locale, messages: catalogs.get(locale), namespace: 'NewsletterSignup', onError(error) {throw error;}});
  const state = {rpc: [], updates: [], filters: [], rates: [], mails: [], logs: [], imports: [], network: 0};
  const result = () => {
    if (options.dbThrows) throw new Error(`Private database failure: ${EMAIL} ${TOKEN}`);
    return Object.hasOwn(options, 'dbResult') ? options.dbResult : {data: {id: SUBSCRIPTION}, error: null};
  };
  const builder = {
    update(value) {state.updates.push(structuredClone(value)); return this;},
    eq(...args) {state.filters.push(['eq', ...args]); return this;},
    gt(...args) {state.filters.push(['gt', ...args]); return this;},
    select(...args) {state.filters.push(['select', ...args]); return this;},
    maybeSingle() {return this;},
    then(resolve, reject) {return Promise.resolve().then(result).then(resolve, reject);},
  };
  const mocks = {
    'server-only': {},
    'node:crypto': require('node:crypto'),
    'next/server': {NextRequest, NextResponse},
    'next-intl/server': {getLocale: async () => locale, getTranslations: async input => {
      assert.equal(input.locale, locale);
      assert.equal(input.namespace, 'NewsletterSignup');
      return t;
    }},
    '@/lib/db': {db: {
      async rpc(name, args) {
        state.rpc.push({name, args: structuredClone(args)});
        if (options.rpcThrows) throw new Error(`Private RPC failure: ${EMAIL} ${TOKEN}`);
        return Object.hasOwn(options, 'rpcResult') ? options.rpcResult : {data: 'pending', error: null};
      },
      from(table) {assert.equal(table, 'newsletter_subscriptions'); return builder;},
    }},
    '@/lib/rateLimit': {rateLimit: async (...args) => {
      state.rates.push(args);
      return {allowed: options.allowed !== false, remaining: 1};
    }},
    '@/lib/email': {sendNewsletterConfirmationEmail: async (...args) => {
      state.mails.push(structuredClone(args));
      if (options.mailThrows) throw new Error(`Private mail failure: ${EMAIL} ${TOKEN}`);
      return Object.hasOwn(options, 'mailResult') ? options.mailResult : true;
    }},
  };
  const context = vm.createContext({
    Buffer, URL, Date, process: {env: {NEXT_PUBLIC_APP_URL: BASE, ...(options.missingSecret ? {} : {SUPABASE_SERVICE_ROLE_KEY: SECRET})}},
    console: {error: (...args) => state.logs.push(args)},
    fetch() {state.network++; throw new Error('Network forbidden in newsletter API tests');},
  });
  const loaded = new Map();
  function load(file) {
    assert.ok(file === 'lib/newsletter.ts' || /^app\/api\/newsletter\/(subscribe|confirm|unsubscribe)\/route\.ts$/.test(file));
    if (loaded.has(file)) return loaded.get(file).exports;
    if (!compiled.has(file)) compiled.set(file, ts.transpileModule(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), {
      compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
    }).outputText);
    const mod = {exports: {}};
    loaded.set(file, mod);
    new vm.Script(`(function(require,module,exports){${compiled.get(file)}\n})`, {filename: file}).runInContext(context)(name => {
      state.imports.push(name);
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name === '@/lib/newsletter') return load('lib/newsletter.ts');
      throw new Error(`Unexpected dependency: ${name}`);
    }, mod, mod.exports);
    return mod.exports;
  }
  async function post(action, payload, raw) {
    return load(`app/api/newsletter/${action}/route.ts`).POST(new NextRequest(`${BASE}/api/newsletter/${action}`, {
      method: 'POST', headers: {'Content-Type': 'application/json', 'x-forwarded-for': '192.0.2.4'},
      body: raw ?? JSON.stringify(payload),
    }));
  }
  const proof = () => load('lib/newsletter.ts').newsletterUnsubscribeProof(SUBSCRIPTION);
  return {state, t, post, proof};
}

function assertPrivate(h) {
  assert.equal(h.state.network, 0);
  assert.equal(h.state.imports.some(name => /clerk|auth|supabaseAdmin/i.test(name)), false);
  const logs = JSON.stringify(h.state.logs);
  for (const privateValue of [EMAIL, TOKEN, SECRET]) assert.equal(logs.includes(privateValue), false);
}

for (const locale of LOCALES) test(`anonymous signup uses the typed address and localized confirmation (${locale})`, async () => {
  const h = harness({locale});
  const response = await h.post('subscribe', {email: '  SUBSCRIBER@EXAMPLE.TEST  ', consent: true});
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {message: h.t('genericResponse')});
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(h.state.rpc.length, 1);
  assert.equal(h.state.rpc[0].name, 'newsletter_request_confirmation');
  assert.equal(h.state.rpc[0].args.p_email, EMAIL);
  assert.equal(h.state.rpc[0].args.p_consent_version, '2026-11-02');
  assert.match(h.state.rpc[0].args.p_confirmation_token_hash, /^[a-f0-9]{64}$/);
  assert.ok(Date.parse(h.state.rpc[0].args.p_confirmation_expires_at) > Date.now() + 47 * 3600_000);
  const [to, link, copy, mailLocale] = h.state.mails[0];
  assert.equal(to, EMAIL);
  assert.equal(new URL(link).origin, BASE);
  assert.equal(new URL(link).pathname, '/newsletter/confirm');
  const sentToken = new URL(link).searchParams.get('token');
  assert.match(sentToken, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(require('node:crypto').createHash('sha256').update(sentToken).digest('hex'), h.state.rpc[0].args.p_confirmation_token_hash);
  assert.equal(copy.subject, h.t('confirmSubject'));
  assert.equal(mailLocale, locale);
  assertPrivate(h);
});

test('signup requires explicit boolean consent and a valid address before persistence or mail', async () => {
  for (const payload of [null, {}, {email: EMAIL}, {email: EMAIL, consent: false}, {email: EMAIL, consent: 'true'}, {email: EMAIL, consent: 1}, {email: 'invalid', consent: true}, {email: 'x'.repeat(255), consent: true}, {email: [EMAIL], consent: true}]) {
    const h = harness();
    const response = await h.post('subscribe', payload);
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {error: h.t('invalidRequest')});
    assert.equal(h.state.rpc.length, 0);
    assert.equal(h.state.mails.length, 0);
    assertPrivate(h);
  }
});

test('malformed signup JSON cannot persist or send', async () => {
  const h = harness();
  assert.equal((await h.post('subscribe', null, '{')).status, 400);
  assert.equal(h.state.rpc.length, 0);
  assert.equal(h.state.mails.length, 0);
  assertPrivate(h);
});

test('signup rate limit denies before persistence and mail without storing the IP', async () => {
  const h = harness({allowed: false});
  const response = await h.post('subscribe', {email: EMAIL, consent: true});
  assert.equal(response.status, 429);
  assert.deepEqual(await response.json(), {error: h.t('rateLimited')});
  assert.match(h.state.rates[0][0], /^newsletter-signup:[a-f0-9]{24}$/);
  assert.equal(h.state.rpc.length, 0);
  assert.equal(h.state.mails.length, 0);
  assertPrivate(h);
});

test('already confirmed signup returns the generic response without another message', async () => {
  const h = harness({rpcResult: {data: 'confirmed', error: null}});
  const response = await h.post('subscribe', {email: EMAIL, consent: true});
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {message: h.t('genericResponse')});
  assert.equal(h.state.mails.length, 0);
  assertPrivate(h);
});

test('signup database rejection, transport loss and malformed RPC status fail without mail', async () => {
  for (const options of [{rpcResult: {data: null, error: {code: 'PGRST202'}}}, {rpcThrows: true}, {rpcResult: {data: null, error: null}}, {rpcResult: {data: 'unsubscribed', error: null}}, {rpcResult: {data: {}, error: null}}, {rpcResult: {data: 'pending'}}, {rpcResult: undefined}]) {
    const h = harness(options);
    const response = await h.post('subscribe', {email: EMAIL, consent: true});
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {error: h.t('submitError')});
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(h.state.mails.length, 0);
    assertPrivate(h);
  }
});

test('signup mail rejection, transport loss and unexpected mail results remain retryable errors', async () => {
  for (const options of [{mailResult: false}, {mailThrows: true}, {mailResult: undefined}, {mailResult: {ok: true}}]) {
    const h = harness(options);
    const response = await h.post('subscribe', {email: EMAIL, consent: true});
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {error: h.t('submitError')});
    assert.equal(h.state.mails.length, 1);
    assertPrivate(h);
  }
});

test('confirmation needs a valid token without requiring an account or mail', async () => {
  for (const payload of [null, {}, {token: 12}, {token: 'short'}, {token: 'a'.repeat(129)}]) {
    const h = harness();
    const response = await h.post('confirm', payload);
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {error: h.t('confirmInvalid')});
    assert.equal(h.state.updates.length, 0);
    assertPrivate(h);
  }
});

test('confirmation updates only an unexpired pending token hash', async () => {
  const h = harness();
  const response = await h.post('confirm', {token: TOKEN});
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {message: h.t('confirmed')});
  assert.equal(h.state.updates[0].status, 'confirmed');
  assert.equal(h.state.updates[0].confirmation_token_hash, null);
  assert.equal(h.state.updates[0].confirmation_expires_at, null);
  assert.ok(h.state.filters.some(item => item[0] === 'eq' && item[1] === 'status' && item[2] === 'pending'));
  assert.ok(h.state.filters.some(item => item[0] === 'eq' && item[1] === 'confirmation_token_hash' && item[2] === require('node:crypto').createHash('sha256').update(TOKEN).digest('hex')));
  assert.ok(h.state.filters.some(item => item[0] === 'gt' && item[1] === 'confirmation_expires_at' && Number.isFinite(Date.parse(item[2]))));
  assert.equal(h.state.mails.length, 0);
  assertPrivate(h);
});

test('unknown or expired confirmation remains an invalid-link error', async () => {
  const h = harness({dbResult: {data: null, error: null}});
  const response = await h.post('confirm', {token: TOKEN});
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {error: h.t('confirmInvalid')});
  assertPrivate(h);
});

for (const locale of LOCALES) test(`confirmation backend errors keep the token retryable (${locale})`, async () => {
  for (const options of [{dbResult: {data: null, error: {code: '08006'}}}, {dbThrows: true}, {dbResult: {data: {}, error: null}}, {dbResult: {error: null}}, {dbResult: {data: {id: SUBSCRIPTION}}}, {dbResult: undefined}]) {
    const h = harness({locale, ...options});
    const response = await h.post('confirm', {token: TOKEN});
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {error: h.t('actionError')});
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assertPrivate(h);
  }
});

test('confirmation rate limit explains the ten-minute delay instead of invalidating the token', async () => {
  const h = harness({allowed: false});
  const response = await h.post('confirm', {token: TOKEN});
  assert.equal(response.status, 429);
  assert.deepEqual(await response.json(), {error: h.t('actionRateLimited')});
  assert.equal(h.state.rates[0][1], 10);
  assert.equal(h.state.rates[0][2], 600);
  assert.equal(h.state.updates.length, 0);
  assertPrivate(h);
});

test('unsubscribe verifies its proof before touching a subscription', async () => {
  for (const payload of [null, {}, {id: SUBSCRIPTION}, {id: SUBSCRIPTION, proof: 'bad'}, {id: SUBSCRIPTION, proof: '0'.repeat(64)}, {id: 'invalid', proof: '0'.repeat(64)}]) {
    const h = harness();
    const response = await h.post('unsubscribe', payload);
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {error: h.t('unsubscribeInvalid')});
    assert.equal(h.state.updates.length, 0);
    assertPrivate(h);
  }
});

test('anonymous unsubscribe is repeatable and only changes its confirmed subscription', async () => {
  const h = harness({dbResult: {data: null, error: null}});
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await h.post('unsubscribe', {id: SUBSCRIPTION, proof: h.proof()});
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {message: h.t('unsubscribed')});
  }
  assert.equal(h.state.updates[0].status, 'unsubscribed');
  assert.ok(h.state.filters.some(item => item[0] === 'eq' && item[1] === 'id' && item[2] === SUBSCRIPTION));
  assert.ok(h.state.filters.some(item => item[0] === 'eq' && item[1] === 'status' && item[2] === 'confirmed'));
  assert.equal(h.state.mails.length, 0);
  assertPrivate(h);
});

test('unsubscribe database and signing configuration failures remain retryable backend errors', async () => {
  const validProof = harness().proof();
  for (const options of [{dbResult: {data: null, error: {code: '08006'}}}, {dbThrows: true}, {dbResult: {}}, {dbResult: undefined}, {missingSecret: true}]) {
    const h = harness(options);
    const response = await h.post('unsubscribe', {id: SUBSCRIPTION, proof: validProof});
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {error: h.t('actionError')});
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assertPrivate(h);
  }
});
