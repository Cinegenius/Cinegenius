import * as browseFacets from './browse-facets.ts';
import * as placeCore from './places/core.ts';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { NextResponse } from 'next/server.js';
import { PGlite } from '@electric-sql/pglite';
import * as browseGeography from './browse-geography.ts';
import { organizationTestBootstrap } from './test-fixtures/organization-database.mjs';

// Real route handlers, access rules, public projections and SQL migration.
// Only the HTTP database transport and external identity/audit services are replaced.
const require = createRequire(import.meta.url);
let pg, actor, auditAvailable = true, failWrite = false;
const audit = [];
function load(file, mocks) {
  const source = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', source)(name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), mod, mod.exports);
  return mod.exports;
}
const identifier = value => {
  assert.match(value, /^[a-z_]+$/);
  return `"${value}"`;
};
// A small parameterized PostgREST transport adapter. PostgreSQL performs all
// persistence, constraints, revision checks and triggers; no in-memory rows.
class Query {
  constructor(table) { this.table = identifier(table); this.columns = '*'; this.filters = []; this.orders = []; this.values = []; }
  select(columns) { this.columns = columns; return this; }
  insert(values) { this.operation = 'insert'; this.payload = values; return this; }
  update(values) { this.operation = 'update'; this.payload = values; return this; }
  parameter(value) { this.values.push(value); return `$${this.values.length}`; }
  column(name) { return name.startsWith('organization.') ? `o.${identifier(name.slice(13))}` : `t.${identifier(name)}`; }
  eq(name, value) { this.filters.push(`${this.column(name)}=${this.parameter(value)}`); return this; }
  neq(name, value) { this.filters.push(`${this.column(name)}<>${this.parameter(value)}`); return this; }
  in(name, values) { this.filters.push(values.length ? `${this.column(name)} in (${values.map(value => this.parameter(value)).join(',')})` : 'false'); return this; }
  ilike(name, value) { this.filters.push(`${this.column(name)} ilike ${this.parameter(value)}`); return this; }
  order(name, options = {}) { this.orders.push(`${this.column(name)} ${options.ascending === false ? 'desc' : 'asc'} nulls ${options.nullsFirst === true ? 'first' : 'last'}`); return this; }
  limit(count) { this.take = count; return this; }
  range(start, end) { this.offset = start; this.take = end - start + 1; return this; }
  maybeSingle() { this.singleRow = true; return this; }
  single() { this.singleRow = true; this.required = true; return this; }
  then(resolve, reject) { return this.run().then(resolve, reject); }
  async run() {
    if (failWrite && this.operation) return { data: null, error: { code: 'TEST_STORAGE_FAILURE' } };
    let sql;
    const joinMarker = ',organization:organizations!inner(';
    const [baseColumns, joined] = this.columns.split(joinMarker);
    const columns = baseColumns === '*' ? 't.*' : baseColumns.split(',').map(name => this.column(name)).join(',');
    const where = this.filters.length ? ` where ${this.filters.join(' and ')}` : '';
    if (this.operation) {
      const keys = Object.keys(this.payload);
      const values = keys.map(key => this.parameter(this.payload[key]));
      sql = this.operation === 'insert'
        ? `insert into ${this.table} as t (${keys.map(identifier).join(',')}) values (${values.join(',')}) returning ${columns}`
        : `update ${this.table} as t set ${keys.map((key, index) => `${identifier(key)}=${values[index]}`).join(',')}${where} returning ${columns}`;
      sql = `with changed as (${sql}) select row_to_json(changed) as row from changed`;
    } else {
      const relation = joined ? `,json_build_object(${joined.slice(0, -1).split(',').map(name => `'${name}',o.${identifier(name)}`).join(',')}) as organization` : '';
      const join = joined ? ' join organizations o on o.id=t.organization_id' : '';
      sql = `select ${columns}${relation} from ${this.table} t${join}${where}`;
      if (this.orders.length) sql += ` order by ${this.orders.join(',')}`;
      if (this.take !== undefined) sql += ` limit ${Number(this.take)}`;
      if (this.offset) sql += ` offset ${Number(this.offset)}`;
      sql = `select row_to_json(result) as row from (${sql}) result`;
    }
    try {
      const rows = (await pg.query(sql, this.values)).rows.map(row => row.row);
      if (this.singleRow && (rows.length > 1 || (this.required && !rows.length))) return { data: null, error: { code: 'PGRST116' } };
      return { data: this.singleRow ? rows[0] ?? null : rows, error: null };
    } catch (error) { return { data: null, error }; }
  }
}
const db = { from: table => new Query(table) };
const mocks = {
  '@/lib/places/core':placeCore,
  '@/lib/browse-facets':browseFacets,
  "@/lib/browse-geography": browseGeography,
  'server-only': {}, 'next/server': { NextResponse }, '@/lib/db': { db },
  '@/lib/auth': {
    requireAuth: async () => actor ? { userId: actor } : NextResponse.json({ error: 'unauthorized' }, { status: 401 }),
    requireAdmin: async () => actor === 'admin' ? { userId: actor } : NextResponse.json({ error: 'forbidden' }, { status: 403 }),
  },
  '@/lib/admin-audit': {
    startAdminAudit: async event => { if (!auditAvailable) return null; audit.push(event); return `test-${audit.length}`; },
    finishAdminAudit: async () => true,
    validateAdminReason: value => typeof value === 'string' && value.trim().length >= 5 ? value.trim() : null,
  },
  '@/lib/responsible-person-server': {
    validateResponsiblePerson: async (_, userId) => ({ person: { userId, firstName: 'Test', lastName: 'Person', public: false } }),
  },
};
mocks['@/lib/protected-media'] = load('./protected-media.ts', mocks);
mocks['@/lib/organization-taxonomy'] = load('./organization-taxonomy.ts', mocks);
mocks['@/lib/organization-access'] = load('./organization-access.ts', mocks);
mocks['@/lib/organization-media'] = load('./organization-media.ts', mocks);
const data = mocks['@/lib/organization-data'] = load('./organization-data.ts', mocks);
const organizations = load('../app/api/organizations/route.ts', mocks);
const entries = load('../app/api/organizations/entries/route.ts', mocks);
const moderation = load('../app/api/admin/organizations/route.ts', mocks);
const workspace = load('../app/api/organizations/workspace/route.ts', mocks);

before(async () => {
  pg = new PGlite();
  await pg.exec(organizationTestBootstrap);
  await pg.exec(readFileSync(new URL('../supabase/migrations/20261103170000_organizations_and_news.sql', import.meta.url), 'utf8'));
  await pg.exec('alter table listings add column published boolean, add column type text');
  await pg.exec(readFileSync(new URL('../supabase/migrations/20261109170000_canonical_places.sql', import.meta.url), 'utf8'));
});
after(async () => pg?.close());
async function scenario(fn) {
  actor = 'owner'; auditAvailable = true; failWrite = false; audit.length = 0;
  await pg.exec('begin');
  try { await fn(); } finally { await pg.exec('rollback'); }
}
const request = (body, method = 'POST') => new Request('https://test.invalid/api/organizations', { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
async function call(handler, body, status = 200) {
  const response = await handler(request(body));
  const json = await response.json();
  assert.equal(response.status, status, JSON.stringify(json));
  return json;
}
const organizationBody = { name: 'Synthetic Film Academy', topics: ['education'], city: 'Test city' };
const entryBody = { title: 'Synthetic Workshop', entryType: 'workshop', topic: 'education', format: 'onsite', description: 'Synthetic description', startsAt: '2027-01-10T10:00:00Z', endsAt: '2027-01-10T12:00:00Z' };
async function createOrganization(extra = {}) { return (await call(organizations.POST, { ...organizationBody, ...extra }, 201)).organization; }
async function createEntry(parent, extra = {}) { return (await call(entries.POST, { ...entryBody, organizationId: parent.id, ...extra }, 201)).entry; }
async function approve(kind, item) {
  const previous = actor; actor = 'admin';
  try { return (await call(moderation.PATCH, { kind, id: item.id, status: 'approved', reviewed: true, expectedUpdatedAt: item.updated_at })).item; }
  finally { actor = previous; }
}

test('API: private save, reload, submission, exact admin approval and public detail form one durable flow', () => scenario(async () => {
  const parent = await createOrganization(); const child = await createEntry(parent);
  assert.equal(await data.approvedEntryBySlugs(parent.slug, child.slug), null);
  const response = await workspace.GET();
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const saved = (await response.json()).workspace;
  assert.equal(saved.entries[0].description, entryBody.description);
  assert.equal(saved.organizations[0].owner_user_id, 'owner');
  actor = null; assert.equal((await workspace.GET()).status, 401);
  actor = 'owner';
  const submittedParent = (await call(organizations.PATCH, { ...organizationBody, id: parent.id, expectedUpdatedAt: parent.updated_at, submit: true })).organization;
  const submittedChild = (await call(entries.PATCH, { ...entryBody, id: child.id, expectedUpdatedAt: child.updated_at, submit: true })).entry;
  actor = 'admin';
  const review = await moderation.GET(new Request('https://test.invalid/api/admin/organizations?submittedOnly=true'));
  assert.equal((await review.json()).entries[0].id, child.id);
  await call(moderation.PATCH, { kind: 'entry', id: child.id, expectedUpdatedAt: submittedChild.updated_at, status: 'approved', reviewed: true }, 409);
  await approve('organization', submittedParent); await approve('entry', submittedChild);
  actor = null;
  const publicView = await data.approvedEntryBySlugs(parent.slug, child.slug);
  assert.equal(publicView.entry.id, child.id);
  assert.equal(publicView.entry.image_url, null); // Images are optional.
  assert.equal('responsible_person' in publicView.organization, false);
  assert.equal('owner_user_id' in publicView.organization, false);
  assert.equal((await data.approvedEntries()).entries.length, 1);
  actor = 'owner'; assert.equal((await data.organizationWorkspace(actor)).entries[0].moderation_status, 'approved');
  assert.equal(audit.length, 2);
}));

test('API: member cannot impersonate an owner, approve content or access another workspace', () => scenario(async () => {
  const parent = await createOrganization({ owner_user_id: 'stranger', moderation_status: 'approved' });
  assert.equal(parent.moderation_status, 'draft');
  actor = 'stranger';
  await call(entries.POST, { ...entryBody, organizationId: parent.id }, 403);
  await call(organizations.PATCH, { ...organizationBody, id: parent.id, expectedUpdatedAt: parent.updated_at }, 403);
  await call(moderation.PATCH, { kind: 'organization', id: parent.id, status: 'approved', reviewed: true, expectedUpdatedAt: parent.updated_at }, 403);
  assert.deepEqual(await data.organizationWorkspace(actor), { organizations: [], entries: [] });
  assert.equal((await db.from('organizations').select('owner_user_id').eq('id', parent.id).single()).data.owner_user_id, 'owner');
}));

test('API: stale approval and missing audit cannot publish; owner edits require another review', () => scenario(async () => {
  const parent = await createOrganization(); const child = await createEntry(parent);
  await approve('organization', parent);
  const edited = (await call(entries.PATCH, { ...entryBody, id: child.id, expectedUpdatedAt: child.updated_at, title: 'New reviewed title' })).entry;
  actor = 'admin';
  await call(moderation.PATCH, { kind: 'entry', id: child.id, expectedUpdatedAt: child.updated_at, status: 'approved', reviewed: true }, 409);
  auditAvailable = false;
  await call(moderation.PATCH, { kind: 'entry', id: child.id, expectedUpdatedAt: edited.updated_at, status: 'approved', reviewed: true }, 503);
  assert.equal(await data.approvedEntryBySlugs(parent.slug, child.slug), null);
  auditAvailable = true;
  const approved = await approve('entry', edited);
  actor = 'owner';
  const resubmitted = (await call(entries.PATCH, { ...entryBody, id: child.id, expectedUpdatedAt: approved.updated_at, description: 'Changed after approval' })).entry;
  assert.equal(resubmitted.moderation_status, 'submitted');
  assert.equal(await data.approvedEntryBySlugs(parent.slug, child.slug), null);
  assert.equal((await data.approvedEntries()).entries.length, 0);
  await call(entries.PATCH, { ...entryBody, id: child.id, expectedUpdatedAt: approved.updated_at }, 409);
  assert.equal((await data.organizationWorkspace(actor)).entries[0].description, 'Changed after approval');
}));

test('API: rejection, correction and resubmission preserve the same entry and public address', () => scenario(async () => {
  const parent = await createOrganization(); const child = await createEntry(parent, { submit: true });
  actor = 'admin';
  const rejected = (await call(moderation.PATCH, { kind: 'entry', id: child.id, expectedUpdatedAt: child.updated_at, status: 'changes_requested', reason: 'Please clarify the venue.' })).item;
  actor = 'owner';
  const revised = (await call(entries.PATCH, { ...entryBody, id: child.id, expectedUpdatedAt: rejected.updated_at, venue: 'Synthetic hall', submit: true })).entry;
  assert.equal(revised.id, child.id); assert.equal(revised.slug, child.slug); assert.equal(revised.moderation_status, 'submitted');
  const persisted = (await data.organizationWorkspace(actor)).entries[0];
  assert.equal(persisted.moderation_reason, ''); assert.equal(persisted.venue, 'Synthetic hall');
}));

test('API: media must belong to the authenticated uploader or the exact existing content', () => scenario(async () => {
  const key = `owner/${'a'.repeat(32)}.webp`; const foreignKey = `stranger/${'b'.repeat(32)}.webp`;
  await pg.query('insert into media_assets values ($1,$2,$3,null,null,$4),($5,$6,$7,null,null,$4)', [key, `/api/media/${key}`, 'owner', 'image/webp', foreignKey, `/api/media/${foreignKey}`, 'stranger']);
  await call(organizations.POST, { ...organizationBody, logoUrl: `/api/media/${foreignKey}` }, 400);
  await call(organizations.POST, { ...organizationBody, logoUrl: 'blob:https://test.invalid/local-preview' }, 400);
  const parent = await createOrganization({ logoUrl: `/api/media/${key}` });
  const child = await createEntry(parent);
  await call(entries.PATCH, { ...entryBody, id: child.id, expectedUpdatedAt: child.updated_at, imageUrl: `/api/media/${key}` }, 400);
  assert.equal((await pg.query('select source_type,source_id from media_assets where storage_path=$1', [key])).rows[0].source_id, parent.id);
  const edited = (await call(organizations.PATCH, { ...organizationBody, id: parent.id, expectedUpdatedAt: parent.updated_at, logoUrl: `/api/media/${key}` })).organization;
  assert.equal(edited.id, parent.id);
}));

test('API: revoked organization administrators lose write and workspace access', () => scenario(async () => {
  const parent = await createOrganization(); const child = await createEntry(parent);
  await pg.query("insert into organization_members(organization_id,user_id,role) values ($1,'delegate','admin')", [parent.id]);
  actor = 'delegate'; assert.equal((await data.organizationWorkspace(actor)).entries.length, 1);
  const edited = (await call(entries.PATCH, { ...entryBody, id: child.id, expectedUpdatedAt: child.updated_at })).entry;
  await pg.exec("update organization_members set status='ended' where user_id='delegate'");
  await call(entries.PATCH, { ...entryBody, id: child.id, expectedUpdatedAt: edited.updated_at }, 403);
  assert.deepEqual(await data.organizationWorkspace(actor), { organizations: [], entries: [] });
}));

test('API: dates, unsafe links and failed writes never produce a successful save', () => scenario(async () => {
  const parent = await createOrganization();
  await call(entries.POST, { ...entryBody, organizationId: parent.id, endsAt: '2020-01-01' }, 400);
  await call(entries.POST, { ...entryBody, organizationId: parent.id, externalUrl: 'javascript:alert(1)' }, 400);
  failWrite = true;
  await call(entries.POST, { ...entryBody, organizationId: parent.id }, 503);
  assert.equal((await data.organizationWorkspace(actor)).entries.length, 0);
  failWrite = false;
  const child = await createEntry(parent);
  const changed = (await call(entries.PATCH, { ...entryBody, id: child.id, expectedUpdatedAt: child.updated_at, entryType: 'news' })).entry;
  const stored = (await data.organizationWorkspace(actor)).entries[0];
  assert.equal(stored.starts_at, null); assert.equal(stored.ends_at, null);
  assert.equal(changed.id, child.id); assert.equal(stored.description, entryBody.description);
}));

test('API: public search and pagination share approval rules; hiding the parent removes its entries', () => scenario(async () => {
  const parent = await approve('organization', await createOrganization());
  for (let index = 0; index < 26; index++) {
    await approve('entry', await createEntry(parent, { title: `Synthetic Workshop ${index}` }));
  }
  await createEntry(parent, { title: 'Private Workshop' });
  const first = await data.approvedEntries();
  const second = await data.approvedEntries({ page: 2 });
  assert.equal(first.entries.length, 24); assert.equal(first.hasMore, true);
  assert.equal(second.entries.length, 2); assert.equal(second.hasMore, false);
  assert.equal(new Set([...first.entries, ...second.entries].map(entry => entry.id)).size, 26);
  assert.equal((await data.approvedEntries({ type: 'news' })).entries.length, 0);
  assert.equal((await data.approvedEntries({ q: 'Private' })).entries.length, 0);
  assert.equal((await data.approvedEntries({ q: 'Workshop 25', type: 'workshop', topic: 'education' })).entries.length, 1);
  actor = 'admin';
  await call(moderation.PATCH, { kind: 'organization', id: parent.id, expectedUpdatedAt: parent.updated_at, status: 'hidden', reason: 'Synthetic visibility test.' });
  actor = null;
  assert.equal((await data.approvedEntries()).entries.length, 0);
  assert.equal(await data.approvedOrganizationBySlug(parent.slug), null);
  assert.equal(await data.approvedEntryBySlugs(parent.slug, first.entries[0].slug), null);
}));

test('API: legacy organization service areas survive place selection and omitted PATCH fields', () => scenario(async () => {
  const area = 'Deutschland · bundesweit';
  const parent = await createOrganization({ city: 'Köln, DE', selected_place_city_id: 'geonames:2886242', region: area });
  let stored = (await pg.query('select city,region,place_country_code,place_city_id,place_region_name from organizations where id=$1', [parent.id])).rows[0];
  assert.equal(stored.region, area); assert.equal(stored.place_city_id, 'geonames:2886242'); assert.equal(stored.place_country_code, 'DE');
  assert.notEqual(stored.place_region_name, area);
  const moved = (await call(organizations.PATCH, { ...organizationBody, id: parent.id, expectedUpdatedAt: parent.updated_at, city: 'Ashford, England, GB', selected_place_city_id: 'geonames:2656954' })).organization;
  stored = (await pg.query('select city,region,place_country_code,place_city_id from organizations where id=$1', [parent.id])).rows[0];
  assert.equal(stored.region, area); assert.equal(stored.place_city_id, 'geonames:2656954'); assert.equal(stored.place_country_code, 'GB');
  const unrelated = (await call(organizations.PATCH, { name: organizationBody.name, topics: ['education'], id: parent.id, expectedUpdatedAt: moved.updated_at, description: 'Only the description changed' })).organization;
  stored = (await pg.query('select city,region,place_country_code,place_city_id from organizations where id=$1', [parent.id])).rows[0];
  assert.equal(stored.region, area); assert.equal(stored.place_city_id, 'geonames:2656954');
  await call(organizations.PATCH, { name: organizationBody.name, topics: ['education'], id: parent.id, expectedUpdatedAt: unrelated.updated_at, region: 'Schweiz' });
  stored = (await pg.query('select region,place_country_code,place_city_id from organizations where id=$1', [parent.id])).rows[0];
  assert.equal(stored.region, 'Schweiz'); assert.equal(stored.place_country_code, 'GB'); assert.equal(stored.place_city_id, 'geonames:2656954');
}));

test('API: a legacy country-like service area is never a country hint for an unqualified city', () => scenario(async () => {
  const parent = await createOrganization({ city: 'Berlin', region: 'Schweiz' });
  const stored = (await pg.query('select city,region,place_country_code,place_city_id,place_status from organizations where id=$1', [parent.id])).rows[0];
  assert.equal(stored.city, 'Berlin'); assert.equal(stored.region, 'Schweiz');
  assert.equal(stored.place_country_code, null); assert.equal(stored.place_city_id, null); assert.equal(stored.place_status, 'pending');
}));

test('API: news keeps its own selected country through editing, publication and public country filters', () => scenario(async () => {
  const parent = await approve('organization', await createOrganization());
  let child = await createEntry(parent, { entryType: 'news', city: 'Köln, DE', selected_place_city_id: 'geonames:2886242' });
  let stored = (await data.organizationWorkspace(actor)).entries[0];
  assert.equal(stored.place_country_code, 'DE');
  assert.equal(stored.place_city_id, 'geonames:2886242');
  assert.equal(stored.starts_at, null);
  child = (await call(entries.PATCH, { ...entryBody, entryType: 'news', id: child.id, expectedUpdatedAt: child.updated_at, city: 'Ashford, England, GB', selected_place_city_id: 'geonames:2656954' })).entry;
  stored = (await data.organizationWorkspace(actor)).entries[0];
  assert.equal(stored.place_country_code, 'GB');
  assert.equal(stored.place_city_id, 'geonames:2656954');
  await approve('entry', child);
  actor = null;
  assert.deepEqual((await data.approvedEntries({ country: 'GB' })).entries.map(entry => entry.id), [child.id]);
  assert.equal((await data.approvedEntries({ country: 'DE' })).entries.length, 0);
  assert.equal((await data.approvedEntries()).entries.length, 1);
}));
