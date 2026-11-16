import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {NextRequest} from 'next/server.js';
import {intlClientFor, intlServerFor, notificationCopy} from './i18n-test-fixture.mjs';
import * as roles from './company-roles.ts';
import * as membership from './company-membership-requests.ts';
import * as navigation from './company-navigation.ts';

const require = createRequire(import.meta.url);
function load(file, mocks) {
  const code = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true},
  }).outputText;
  const module = {exports: {}};
  new Function('require', 'module', 'exports', code)(name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), module, module.exports);
  return module.exports;
}

// In-memory request-scoped database; no real Supabase, Clerk or notifications.
function fixture() {
  const company = (id, owner) => ({id, slug: id, name: id, owner_user_id: owner, published: true, city: 'Test city', email: 'PRIVATE_CANARY', responsible_person: {name: 'PRIVATE_CANARY'}});
  const rows = {
    companies: [company('a', 'owner-a'), company('b', 'owner-b'), company('c', 'owner-a')],
    company_members: [], profiles: [{user_id: 'owner-a', display_name: 'Camera crew', positions: ['Kamera']}], notifications: [],
  };
  let actor = 'owner-a', fail = false;
  const db = {from(table) {
    let filters = [], columns = '*', mode = 'read', payload;
    const q = {
      select(value = '*') {columns = value; return q;},
      eq(key, value) {filters.push(row => row[key] === value); return q;},
      in(key, values) {filters.push(row => values.includes(row[key])); return q;},
      order() {return q;},
      insert(value) {mode = 'insert'; payload = value; return q;},
      update(value) {mode = 'update'; payload = value; return q;},
      delete() {mode = 'delete'; return q;},
      then(resolve, reject) {return Promise.resolve(run(false)).then(resolve, reject);},
      async maybeSingle() {return run(true);}, async single() {return run(true);},
    };
    function run(single) {
      if (fail) return {data: null, error: {code: 'TEST_UNAVAILABLE'}};
      rows[table] ??= [];
      let matches = rows[table].filter(row => filters.every(fn => fn(row)));
      if (mode === 'insert') {
        matches = (Array.isArray(payload) ? payload : [payload]).map(value => ({id: `test-${table}-${rows[table].length}`, ...structuredClone(value)}));
        rows[table].push(...matches);
      }
      if (mode === 'update') matches.forEach(row => Object.assign(row, structuredClone(payload)));
      if (mode === 'delete') rows[table] = rows[table].filter(row => !matches.includes(row));
      const projected = matches.map(row => columns === '*' ? {...row} : Object.fromEntries(columns.split(',').map(key => key.trim()).map(key => [key, row[key]])));
      return {data: single ? projected[0] ?? null : projected, error: null};
    }
    return q;
  }};
  const mocks = {
    'server-only': {}, '@/lib/db': {db}, '@/lib/company-roles': roles,
    'next-intl/server': intlServerFor(), '@/lib/i18n/notification-copy': notificationCopy,
    '@/lib/company-membership-requests': membership,
    '@/lib/linked-profile-access': {visibleLinkedProfileIds: async ids => new Set(ids)},
    '@/lib/auth': {requireAuth: async () => ({userId: actor}), getCurrentUser: async () => ({userId: actor})},
    '@clerk/nextjs/server': {auth: async () => ({userId: actor})},
    'next/cache': {revalidatePath() {}, revalidateTag() {}},
    'next/navigation': {redirect(url) {throw new Error(`redirect:${url}`);}, notFound() {throw new Error('not-found');}},
    '@/components/organizations/OrganizationAccessPanel': () => null,
    './DashboardClient': () => null,
  };
  const access = load('./company-access.ts', mocks);
  mocks['@/lib/company-access'] = access;
  const api = load('../app/api/company-members/route.ts', mocks);
  const dashboard = load('../app/company-dashboard/page.tsx', mocks).default;
  const request = (method, body) => new NextRequest('https://fixture.invalid/api/company-members', {method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
  return {rows, access, dashboard, actor: value => {actor = value;}, fail: () => {fail = true;},
    post: body => api.POST(request('POST', body)), patch: body => api.PATCH(request('PATCH', body))};
}

test('a company owner can request a crew membership in another company without gaining management rights', async () => {
  const f = fixture();
  const response = await f.post({company_id: 'b', public_titles: ['Kamera'], role: 'admin', status: 'accepted'});
  assert.equal(response.status, 200);
  const member = (await response.json()).data;
  assert.equal(member.role, 'member'); assert.equal(member.status, 'pending');
  assert.equal(await f.access.getCompanyAccess('b', 'owner-a'), null);
  assert.equal((await f.access.getCompanyAccess('a', 'owner-a')).role, 'owner');
  assert.equal((await f.access.getCompanyAccess('c', 'owner-a')).role, 'owner');
  assert.equal((await f.post({company_id: 'b', public_titles: ['Ton']})).status, 200);
  assert.equal(f.rows.company_members.length, 1);
  assert.equal((await f.patch({id: member.id, status: 'accepted'})).status, 403);
  f.actor('owner-b');
  assert.equal((await f.patch({id: member.id, status: 'accepted'})).status, 200);
  assert.equal((await f.access.getCompanyAccess('b', 'owner-a')).role, 'member');
  assert.equal(await f.access.hasCompanyCapability('b', 'owner-a', 'edit_offers'), false);
  assert.deepEqual(f.rows.profiles[0].positions, ['Kamera']);
});

test('accepted roles are company-scoped, public job titles do not grant permissions, withdrawn access ends immediately', async () => {
  const f = fixture();
  f.rows.company_members.push({id: 'b-editor', company_id: 'b', user_id: 'owner-a', role: 'manager', status: 'accepted', public_titles: ['Geschäftsführer/in']});
  assert.equal(await f.access.hasCompanyCapability('b', 'owner-a', 'edit_company'), true);
  assert.equal(await f.access.hasCompanyCapability('b', 'owner-a', 'manage_team'), false);
  assert.equal(await f.access.hasCompanyCapability('a', 'owner-b', 'edit_company'), false);
  f.rows.company_members[0].status = 'pending';
  assert.equal(await f.access.hasCompanyCapability('b', 'owner-a', 'edit_company'), false);
});

test('dashboard preserves two owned companies and a membership, never serializes private contact fields', async () => {
  const f = fixture();
  f.rows.company_members.push({company_id: 'b', user_id: 'owner-a', role: 'member', status: 'accepted'});
  for (const id of ['a', 'b', 'c']) {
    const page = await f.dashboard({searchParams: Promise.resolve({company_id: id})});
    const dashboard = page.props.children[0];
    assert.equal(dashboard.props.company.id, id);
    assert.equal(dashboard.props.permissionRole, id === 'b' ? 'member' : 'owner');
    assert.deepEqual(dashboard.props.companyOptions.map(company => company.id), ['a', 'b', 'c']);
    assert.ok(!JSON.stringify(dashboard.props).includes('PRIVATE_CANARY'));
    assert.equal(dashboard.props.company.owner_user_id, undefined);
    assert.ok(dashboard.key?.includes(id));
  }
});

test('a missing, pending or inaccessible requested company cannot silently open a different company', async () => {
  const f = fixture();
  f.rows.company_members.push({company_id: 'b', user_id: 'owner-a', role: 'member', status: 'pending'});
  for (const company_id of ['b', 'missing']) await assert.rejects(f.dashboard({searchParams: Promise.resolve({company_id})}), /not-found/);
  f.fail();
  await assert.rejects(f.dashboard({searchParams: Promise.resolve({})}), /lookup failed/);
});

test('editor and dashboard URLs retain the explicit company and every supported tab', () => {
  for (const tab of ['overview', 'services', 'equipment', 'team']) {
    assert.equal(navigation.companyDashboardTab(tab), tab);
    const url = new URL(navigation.companyDashboardUrl('firm/with space', tab), 'https://fixture.invalid');
    assert.equal(url.searchParams.get('company_id'), 'firm/with space');
    assert.equal(navigation.companyDashboardTab(url.searchParams.get('tab')), tab);
  }
  assert.equal(navigation.companyDashboardTab('invalid'), 'overview');
  assert.equal(navigation.companyEditorUrl('firm/with space'), '/company-setup?company_id=firm%2Fwith%20space');
});

for (const locale of ['de', 'en', 'es', 'it', 'cs', 'hu', 'nl', 'nl-BE', 'sv']) test(`company selection keeps names, explicit new-company entry and existing locale copy: ${locale}`, () => {
  const Component = load('../components/CompanySwitcher.tsx', {
    'next/link': ({children, ...props}) => React.createElement('a', props, children),
    'next-intl': intlClientFor(locale), '@/lib/company-navigation': navigation,
  }).default;
  const html = renderToStaticMarkup(React.createElement(Component, {companies: [{id: 'a', name: 'Film A', city: null}, {id: 'b', name: 'Film B', city: 'Berlin'}], selectedId: 'b', onSelect() {}}));
  assert.match(html, /href="\/company-setup\?new=1"/);
  assert.match(html, /value="b" selected=""/);
  assert.match(html, /Film A/); assert.match(html, /Film B/);
  assert.ok(!html.includes('undefined'));
});
