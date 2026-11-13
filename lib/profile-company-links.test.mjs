import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import {translatorFor} from './i18n-test-fixture.mjs';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../', import.meta.url));
const cached = new Map();
function catalogueModule(filename) {
  if (cached.has(filename)) return cached.get(filename);
  const mod = {exports: {}};
  cached.set(filename, mod.exports);
  const source = ts.transpileModule(readFileSync(filename, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true}}).outputText;
  new Function('require', 'module', 'exports', source)(name => {
    if (name.startsWith('@/lib/')) return catalogueModule(path.join(root, name.slice(2)) + '.ts');
    if (name.startsWith('.') && !name.endsWith('.json')) return catalogueModule(path.resolve(path.dirname(filename), name) + '.ts');
    return createRequire(filename)(name);
  }, mod, mod.exports);
  cached.set(filename, mod.exports);
  return mod.exports;
}
const categories = catalogueModule(path.join(root, 'lib/companyCategories.ts'));
const departments = catalogueModule(path.join(root, 'lib/departments.ts'));

function render(membership, locale = 'de') {
  const t = translatorFor(locale);
  const logos = [];
  const mocks = {
    'next/link': {__esModule: true, default: ({children, ...props}) => React.createElement('a', props, children)},
    'next-intl': {useTranslations: () => t},
    'lucide-react': {ExternalLink: () => React.createElement('svg', {'aria-hidden': true})},
    '@/components/CompanyLogo': {__esModule: true, default: props => {logos.push(props); return React.createElement('div', {'data-logo': props.src ?? '', className: props.className});}},
    '@/lib/companyCategories': categories,
    '@/lib/departments': departments,
  };
  const source = ts.transpileModule(readFileSync(new URL('../components/ProfileCompanyLinks.tsx', import.meta.url), 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true}}).outputText;
  const mod = {exports: {}};
  new Function('require', 'module', 'exports', source)(name => mocks[name] ?? require(name), mod, mod.exports);
  return {html: renderToStaticMarkup(React.createElement(mod.exports.default, {membership})), logos, t};
}

const membership = overrides => ({
  id: 'public-member', title: 'PRIVATE_TITLE_CANARY', public_titles: ['DOP / Kamera'], is_company_owner: false,
  companies: {id: 'company', slug: 'test-company', name: 'Test & Film', logo_url: '/api/media/owner/original-logo.webp', categories: ['lichtverleih']},
  ...overrides,
});

test('no memberships produce neither a section nor a placeholder company', () => {
  for (const value of [null, []]) assert.equal(render(value).html, '');
});

for (const locale of ['de', 'en', 'es', 'it', 'cs', 'hu', 'nl', 'nl-BE', 'sv']) {
  test(`company cards localize catalogue and owner copy while retaining public names and titles: ${locale}`, () => {
    const {html, logos, t} = render([membership({is_company_owner: true, public_titles: []})], locale);
    assert.ok(html.includes(departments.taxonomyLabel('Lichtverleih', t)));
    assert.ok(html.includes(t('responsiblePerson.functions.owner')));
    assert.ok(html.includes('Test &amp; Film'));
    assert.ok(!html.includes('PRIVATE_TITLE_CANARY'));
    assert.match(html, /href="\/companies\/test-company"/);
    assert.equal(logos[0].src, '/api/media/owner/original-logo.webp');
    assert.equal(logos[0].name, 'Test & Film');
  });
}

test('public titles stay verbatim and private membership titles never fill the public role', () => {
  const customTitle = 'Founder / プロデューサー';
  const {html} = render([membership({public_titles: [customTitle, 'Sound']})], 'sv');
  assert.ok(html.includes(customTitle + ' · Sound'));
  assert.ok(!html.includes('PRIVATE_TITLE_CANARY'));
  const missing = render([membership({public_titles: [], is_company_owner: false})], 'en');
  assert.ok(missing.html.includes(missing.t('Ui.text_46a19d00aadaa0')));
});

test('missing or unknown optional metadata keeps every linked company discoverable', () => {
  const first = membership({companies: {id: 'one', slug: 'one/branch', name: 'Long company name', logo_url: null, categories: ['unknown-category']}});
  const second = membership({id: 'two', companies: {id: 'two', slug: 'two', name: 'Another company', logo_url: null, categories: null}});
  const {html, logos} = render([first, second]);
  assert.equal((html.match(/<a /g) ?? []).length, 2);
  assert.match(html, /href="\/companies\/one%2Fbranch"/);
  assert.ok(!html.includes('unknown-category'));
  assert.deepEqual(logos.map(logo => logo.src), [null, null]);
  for (const logo of logos) {
    assert.match(logo.className, /h-16 w-16/);
    assert.ok(!logo.className.includes('w-full'));
  }
});
