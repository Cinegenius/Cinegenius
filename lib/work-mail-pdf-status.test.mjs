import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const {NextRequest, NextResponse} = require('next/server');
const root = new URL('../', import.meta.url);
const actor = 'user_MailReader';
const itemId = '10000000-0000-4000-8000-000000000001';
const read = relative => readFileSync(new URL(relative, root), 'utf8');
function load(relative, mocks = {}) {
  const code = ts.transpileModule(read(relative), {compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  }}).outputText;
  const module = {exports: {}};
  new Function('require', 'module', 'exports', 'process', code)(
    name => Object.hasOwn(mocks, name) ? mocks[name] : require(name),
    module, module.exports, {env: {}});
  return module.exports;
}
const common = load('lib/work-mail.ts');

function fixture({schema = true, signedIn = true, session = 'session_MailReader', header = actor,
  bytes = Buffer.from('%PDF-local-fixture'), attachments = [], foreign = false, engine} = {}) {
  const calls = [], state = {engineLoads: 0, destroyed: 0, textCalls: 0};
  const record = {id: itemId, owner_id: foreign ? 'user_Other' : actor, source: 'gmail',
    provider_id: 'synthetic-message', connection_id: null, subject: 'Synthetic mail', sender: 'source@fixture.invalid',
    received_at: '2026-11-26T12:00:00Z', preview_text: 'DISPO\nLicht 08:30', attachments,
    original_size: 1, original_hash: common.workMailHash('x'), status: 'ready', imported_at: null, created_at: '2026-11-26T12:00:00Z'};
  const rpc = async (owner, action) => {
    calls.push({owner, action});
    if (action === 'status') { if (!schema) throw new common.WorkMailError(); return {version: 1, alias: null, connections: []}; }
    if (action === 'list') return {items: []};
    if (action === 'item_get') return record;
    if (action === 'attachment_get') return {size: bytes.length, sha256: common.workMailHash(bytes)};
    if (action === 'attachments_list') return [];
    throw new Error('Unexpected private store operation');
  };
  const store = {workMailRPC: rpc, workMailLoadBytes: async () => bytes,
    workMailStoragePath: () => 'synthetic-private-path',
    workMailStoreBytes: async () => { throw new Error('No storage write expected'); }};
  const oauth = load('lib/work-mail-oauth.ts', {'server-only': {}});
  const mocks = {'server-only': {}, './work-mail': common, './work-mail-store': store,
    './work-mail-oauth': oauth, './work-mail-resend': {getWorkMailResendAttachment: async () => { throw new Error('No provider request expected'); }}};
  // A dependency can throw before exporting a constructor. Status must not
  // evaluate it, while the PDF operation must map the failure inside its try.
  Object.defineProperty(mocks, 'pdf-parse', {get() {
    state.engineLoads++;
    if (engine) return engine(state);
    throw new ReferenceError('DOMMatrix is not defined');
  }});
  const service = load('lib/work-mail-service.ts', mocks);
  const helper = load('lib/work-mail-route.ts', {
    'server-only': {}, 'next/server': {NextResponse}, './work-mail': common, './work-mail-oauth': oauth,
    '@clerk/nextjs/server': {auth: async () => ({userId: signedIn ? actor : null, sessionId: session})},
    '@/lib/auth': {requireAuth: async () => signedIn ? {userId: actor} : NextResponse.json({}, {status: 401})},
    'next-intl/server': {getTranslations: async () => key => 'translated:' + key},
  });
  const route = load('app/api/work/mail/route.ts', {
    'next/server': {NextRequest, NextResponse}, '@/lib/work-mail': common,
    '@/lib/work-mail-route': helper, '@/lib/work-mail-store': store,
    '@/lib/work-mail-service': service, '@/lib/work-mail-oauth': oauth,
    '@/lib/rateLimit': {rateLimit: async () => ({allowed: true})},
  });
  const request = action => new NextRequest('https://www.cinegenius.co/api/work/mail', {
    ...(action ? {method: 'POST', body: JSON.stringify({accountId: actor, action, itemId})} : {}),
    headers: {'X-Mail-Account': header, Origin: 'https://www.cinegenius.co', 'Content-Type': 'application/json'},
  });
  return {route, service, state, calls, request};
}
const pdfAttachment = [{id: 'attachment-one', name: 'Tagesdispo.pdf', type: 'application/pdf', size: 18}];

test('mail status GET loads and responds without evaluating an unavailable PDF engine', async () => {
  const f = fixture(), response = await f.route.GET(f.request());
  assert.equal(response.status, 200);
  const json = await response.json();
  assert.equal(json.accountId, actor); assert.equal(json.capabilities.archive, true);
  assert.deepEqual(json.items, []); assert.deepEqual(json.connections, []);
  assert.match(response.headers.get('cache-control'), /private, no-store/);
  assert.equal(f.state.engineLoads, 0); assert.deepEqual(f.calls.map(call => call.action), ['status', 'list']);
});

test('mail status schema fallback remains honest and PDF-free', async () => {
  const f = fixture({schema: false}), response = await f.route.GET(f.request());
  assert.equal(response.status, 200); assert.equal((await response.json()).capabilities.archive, false);
  assert.equal(f.state.engineLoads, 0); assert.equal(f.calls.length, 1);
});

test('mail status keeps current caller/session/account-header checks before any private access', async () => {
  for (const options of [{signedIn: false}, {session: null}, {header: 'user_Other'}]) {
    const f = fixture(options), response = await f.route.GET(f.request());
    assert.ok([401, 403].includes(response.status)); assert.equal(f.calls.length, 0); assert.equal(f.state.engineLoads, 0);
  }
});

test('plain-text mail analysis never loads PDF while foreign content still fails closed', async () => {
  const f = fixture(), result = await f.service.workMailAnalysisDocument(actor, itemId);
  assert.equal(result.source, 'messageText'); assert.match(result.document.pages[0].text, /DISPO/);
  assert.equal(result.document.sha256, common.workMailHash(result.document.pages[0].text)); assert.equal(f.state.engineLoads, 0);
  const other = fixture({foreign: true});
  await assert.rejects(other.service.workMailAnalysisDocument(actor, itemId), error => error.status === 404);
  assert.equal(other.state.engineLoads, 0);
});

test('invalid PDF bytes are rejected before loading an engine', async () => {
  const f = fixture({bytes: Buffer.from('not-a-pdf'), attachments: pdfAttachment});
  await assert.rejects(f.service.workMailAnalysisDocument(actor, itemId), error => error.code === 'analysisUnsupported' && error.status === 422);
  assert.equal(f.state.engineLoads, 0);
});

test('PDF module evaluation failure becomes the existing localized controlled response', async () => {
  const f = fixture({attachments: pdfAttachment}), response = await f.route.POST(f.request('analysis_document'));
  assert.equal(response.status, 422);
  assert.deepEqual(await response.json(), {code: 'analysisUnsupported', error: 'translated:analysisUnsupported'});
  assert.equal(f.state.engineLoads, 1); assert.equal(f.state.destroyed, 0);
});

test('PDF constructor failure is also inside the controlled boundary', async () => {
  const f = fixture({attachments: pdfAttachment, engine: () => ({PDFParse: class {constructor() { throw new Error('private dependency detail'); }}})});
  const response = await f.route.POST(f.request('analysis_document'));
  assert.equal(response.status, 422); assert.equal((await response.json()).code, 'analysisUnsupported'); assert.equal(f.state.engineLoads, 1);
});

test('available PDF engine retains page cleanup, text normalization and existing bounds', async () => {
  const f = fixture({attachments: pdfAttachment, engine: state => ({PDFParse: class {
    constructor(input) { assert.ok(input.data instanceof Uint8Array); }
    async getText(options) { state.textCalls++; assert.equal(options.first, 100); return {pages: [{text: 'DISPO\u0000 Cafe\u0301'}]}; }
    async destroy() { state.destroyed++; }
  }})});
  const result = await f.service.workMailAnalysisDocument(actor, itemId);
  assert.equal(result.document.pages[0].text, 'Tagesdispo.pdf\n\nDISPO Café');
  assert.equal(f.state.engineLoads, 1); assert.equal(f.state.textCalls, 1); assert.equal(f.state.destroyed, 1);
  const failed = fixture({attachments: pdfAttachment, engine: state => ({PDFParse: class {
    async getText() { throw new Error('private parser detail'); }
    async destroy() { state.destroyed++; }
  }})});
  await assert.rejects(failed.service.workMailAnalysisDocument(actor, itemId), error => error.status === 422 && error.code === 'analysisUnsupported');
  assert.equal(failed.state.destroyed, 1);
});
