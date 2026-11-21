import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {createClient} from '@supabase/supabase-js';
import {completedCompanyHref, normalizeQuickStartDraft, START_QUICK_START_DRAFT} from './quick-start-flow.ts';
import {isQuickStartContentSaved} from './onboarding-save.ts';

const require = createRequire(import.meta.url);
const id = '11111111-2222-4333-8444-555555555555';
const company = {id, slug: 'studio-fixture-start-1234', name: 'Fixture Studio', owner_user_id: 'owner', published: true, description: 'Test studio', categories: []};
const source = ts.transpileModule(readFileSync(new URL('../app/companies/[slug]/page.tsx', import.meta.url), 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX},
}).outputText;

function fixture({rows = [company], userId = null, failColumn = null} = {}) {
  const calls = [];
  const db = createClient('https://fixture.invalid', 'test-only-key', {
    auth: {persistSession: false}, global: {fetch: async input => {
      const url = new URL(input);
      calls.push(url);
      if (!url.pathname.endsWith('/companies')) return Response.json([]);
      if (failColumn && url.searchParams.has(failColumn)) return Response.json({code: '42501', message: 'Fixture unavailable'}, {status: 403});
      const column = url.searchParams.has('slug') ? 'slug' : 'id';
      return Response.json(rows.filter(row => row[column] === url.searchParams.get(column)?.slice(3)));
    }},
  });
  const stop = (kind, url) => { throw Object.assign(new Error(kind), {kind, url}); };
  const deps = {
    '@/lib/db': {db},
    'next/navigation': {notFound: () => stop('notFound'), redirect: url => stop('redirect', url)},
    '@clerk/nextjs/server': {auth: async () => ({userId})},
    'next-intl/server': {getLocale: async () => 'de'},
    '@/lib/places/catalog': {placeReadFields: value => value},
    '@/lib/places/core': {placeDisplay: value => value},
    '@/components/organizations/PublicOrganizationLinks': {default: () => null},
    '@/lib/responsible-person-server': {publicResponsiblePerson: async () => null, responsibleForCompany: async () => null},
    '@/lib/linked-profile-access': {visibleLinkedProfileIds: async () => new Set()},
    '@/lib/company-membership-requests': {isPublicCompanyMembership: status => status === 'accepted'},
    './CompanyDetail': {default: () => null},
  };
  const mod = {exports: {}};
  new Function('require', 'module', 'exports', source)(name => deps[name] ?? require(name), mod, mod.exports);
  const params = reference => ({params: Promise.resolve({slug: reference})});
  return {calls, page: reference => mod.exports.default(params(reference)), metadata: reference => mod.exports.generateMetadata(params(reference))};
}

test('completion keeps the company ID for retries and the returned slug for navigation, including restored drafts', () => {
  const draft = normalizeQuickStartDraft({...START_QUICK_START_DRAFT, intents: ['company'], completed: {profile: false, listings: {}, company: id, companySlug: company.slug}});
  assert.equal(draft.completed.company, id);
  assert.equal(isQuickStartContentSaved(draft), true);
  assert.equal(completedCompanyHref(draft.completed), `/companies/${company.slug}`);
  assert.equal(completedCompanyHref(normalizeQuickStartDraft(JSON.parse(JSON.stringify(draft))).completed), `/companies/${company.slug}`);
});

test('old saved completions keep working without inventing a slug from the company name', () => {
  const draft = normalizeQuickStartDraft({...START_QUICK_START_DRAFT, intents: ['company'], completed: {profile: false, listings: {}, company: id}});
  assert.equal(completedCompanyHref(draft.completed), `/companies/${id}`);
  assert.equal(isQuickStartContentSaved(draft), true);
  assert.equal(completedCompanyHref({...draft.completed, companySlug: '  '}), `/companies/${id}`);
  assert.equal(completedCompanyHref({profile: false, listings: {}, companySlug: company.slug}), null);
  assert.equal(completedCompanyHref({...draft.completed, companySlug: 'studio / ?#'}), '/companies/studio%20%2F%20%3F%23');
});

test('an already issued company ID link redirects to the actual public slug', async () => {
  const f = fixture();
  await assert.rejects(f.page(id), error => error.kind === 'redirect' && error.url === `/companies/${company.slug}`);
  assert.equal(f.calls.length, 2);
  assert.equal(f.calls[0].searchParams.get('slug'), `eq.${id}`);
  assert.equal(f.calls[1].searchParams.get('id'), `eq.${id}`);
});

test('normal slug links still render the company without an ID fallback or ownership exposure', async () => {
  const f = fixture();
  const result = await f.page(company.slug);
  assert.equal(result.props.company.name, company.name);
  assert.equal(result.props.company.owner_user_id, undefined);
  assert.equal(result.props.company.email, null);
  assert.equal(f.calls.filter(url => url.pathname.endsWith('/companies')).length, 1);
});

for (const published of [false, null]) {
  for (const userId of [null, 'other-account']) {
    test(`private company ID remains hidden before redirect (${published}, ${userId})`, async () => {
      const f = fixture({rows: [{...company, published}], userId});
      await assert.rejects(f.page(id), error => error.kind === 'notFound' && !error.url);
      assert.ok(f.calls.every(url => url.pathname.endsWith('/companies')));
      assert.deepEqual(await f.metadata(id), {});
    });
  }
}

test('an owner can follow an old ID link to their private company without publishing it', async () => {
  const f = fixture({rows: [{...company, published: false}], userId: 'owner'});
  await assert.rejects(f.page(id), error => error.kind === 'redirect' && error.url === `/companies/${company.slug}`);
  assert.deepEqual(await f.metadata(id), {});
  assert.ok(f.calls.every(url => url.pathname.endsWith('/companies')));
});

test('UUID-shaped exact slugs take precedence over another company ID', async () => {
  const f = fixture({rows: [company, {...company, id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', slug: id, name: 'Exact slug'}]});
  const result = await f.page(id);
  assert.equal(result.props.company.name, 'Exact slug');
  assert.equal(f.calls.filter(url => url.pathname.endsWith('/companies')).length, 1);
});

test('unknown references stay not found; arbitrary strings are never sent to the UUID column', async () => {
  for (const reference of ['unknown-studio', 'undefined', id]) {
    const f = fixture({rows: []});
    await assert.rejects(f.page(reference), error => error.kind === 'notFound');
    assert.equal(f.calls.length, reference === id ? 2 : 1);
  }
});

test('public ID metadata uses the canonical slug, and visibility is rechecked on every request', async () => {
  const row = {...company};
  const f = fixture({rows: [row]});
  assert.equal((await f.metadata(id)).alternates.canonical, `https://www.cinegenius.co/companies/${company.slug}`);
  row.published = false;
  assert.deepEqual(await f.metadata(id), {});
  await assert.rejects(f.page(id), error => error.kind === 'notFound');
});

test('failed company reads propagate as errors rather than misleading not-found pages', async () => {
  for (const failColumn of ['slug', 'id']) {
    const f = fixture({failColumn});
    await assert.rejects(f.page(id), /company_read_failed/);
    assert.equal(f.calls.length, failColumn === 'slug' ? 1 : 2);
  }
});
