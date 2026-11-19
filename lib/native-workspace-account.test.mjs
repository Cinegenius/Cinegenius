import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';

function load(file, mocks) {
  const module = {exports: {}};
  const context = vm.createContext({Request, Response, URL, AbortSignal});
  const text = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
  }).outputText;
  new vm.Script('(function(require,module,exports){' + text + '\n})').runInContext(context)(id => {
    assert.ok(id in mocks, 'Unexpected dependency: ' + id);
    return mocks[id];
  }, module, module.exports);
  return module.exports;
}

const owner = 'user_Owner1';
const other = 'user_Other2';
const uuid = number => '00000000-0000-4000-8000-' + String(number).padStart(12, '0');

async function fixture(options = {}) {
  const pg = new PGlite();
  await pg.exec(`
    create table listings(id text primary key, user_id text, type text, title text, city text,
      company_id text, created_at timestamptz default now(), published boolean default false,
      description text default 'private description', metadata jsonb default '{"private":"secret"}');
    create table companies(id text primary key, owner_user_id text);
    create table company_members(company_id text, user_id text, role text, status text);
    insert into companies values ('owned', '${owner}'), ('editable', '${other}'), ('revoked', '${other}'), ('reader', '${other}'), ('pending', '${other}');
    insert into company_members values ('editable', '${owner}', 'manager', 'accepted'), ('revoked', '${owner}', 'manager', 'removed'), ('reader', '${owner}', 'member', 'accepted'), ('pending', '${owner}', 'admin', 'pending');
  `);
  const calls = [];
  // Execute the production query chains against an isolated SQL database. This
  // adapter supports only the read operations used here; any write fails.
  const db = {from(table) {
    assert.ok(['listings', 'companies', 'company_members'].includes(table));
    const state = {table, columns: [], filters: [], orders: [], limit: null, signal: null};
    calls.push(state);
    const query = {
      select(value) {state.columns = value.split(',').map(column => column.trim()); return query;},
      eq(column, value) {state.filters.push([column, value]); return query;},
      order(column, options = {}) {state.orders.push([column, options.ascending !== false]); return query;},
      limit(value) {state.limit = value; return query;},
      abortSignal(signal) {state.signal = signal; return query;},
      then(resolve, reject) {
        return (async () => {
          state.signal?.throwIfAborted();
          if (options.failTable === table) return {data: null, error: {code: 'TEST_FAILURE', details: 'private diagnostic'}};
          const identifier = name => {assert.match(name, /^[a-z_]+$/); return '"' + name + '"';};
          let sql = 'select ' + state.columns.map(identifier).join(',') + ' from ' + identifier(table);
          const params = state.filters.map(([, value]) => value);
          if (state.filters.length) sql += ' where ' + state.filters.map(([column], index) => identifier(column) + ' = $' + (index + 1)).join(' and ');
          if (state.orders.length) sql += ' order by ' + state.orders.map(([column, ascending]) => identifier(column) + (ascending ? ' asc' : ' desc')).join(',');
          if (state.limit !== null) {assert.ok(Number.isInteger(state.limit)); sql += ' limit ' + state.limit;}
          const result = await pg.query(sql, params);
          state.signal?.throwIfAborted();
          return {data: result.rows, error: null};
        })().then(resolve, reject);
      },
    };
    return query;
  }};
  const roles = load('lib/company-roles.ts', {});
  const access = load('lib/listing-access.ts', {'server-only': {}, '@/lib/db': {db}, '@/lib/company-roles': roles});
  const service = load('lib/native-workspace-account-server.ts', {'server-only': {}, '@/lib/db': {db}, '@/lib/listing-access': access});
  const route = load('app/api/native/v1/workspace-account/route.ts', {
    '@/lib/auth': {getCurrentUser: async () => {
      if (options.authFails) throw Error('private auth details');
      return options.actor === null ? null : {userId: options.actor ?? owner};
    }},
    '@/lib/native-workspace-account-server': service,
  });
  async function insert(number, account = owner, company = null, type = 'location', city = 'Berlin') {
    await pg.query('insert into listings(id,user_id,company_id,type,title,city) values($1,$2,$3,$4,$5,$6)', [uuid(number), account, company, type, 'Studio ' + number, city]);
  }
  return {pg, calls, route, service, insert};
}

const request = (query = '', headers = {}, signal) => new Request('https://www.cinegenius.co/api/native/v1/workspace-account' + query, {headers, signal});
function privateResponse(response) {
  assert.match(response.headers.get('content-type'), /application\/json/);
  assert.equal(response.headers.get('cache-control'), 'private, no-store, max-age=0');
  assert.equal(response.headers.get('cdn-cache-control'), 'no-store');
  assert.equal(response.headers.get('vercel-cdn-cache-control'), 'no-store');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
}

test('request identity limits the real SQL query to own locations and a minimal native payload', async () => {
  const f = await fixture();
  try {
    await f.insert(1); await f.insert(2, other); await f.insert(3, owner, null, 'prop');
    const response = await f.route.GET(request('?userId=' + other, {'X-Native-Account': other}));
    assert.equal(response.status, 200); privateResponse(response);
    assert.deepEqual(await response.json(), {accountID: owner, locations: [{id: uuid(1), title: 'Studio 1', city: 'Berlin'}], limited: false});
    assert.equal(f.calls.length, 1, 'Personal location opening needs one narrow database read');
    assert.deepEqual(f.calls[0].columns, ['id', 'title', 'city', 'company_id']);
    assert.deepEqual(f.calls[0].filters, [['user_id', owner], ['type', 'location']]);
  } finally {await f.pg.close();}
});

test('current company ownership/edit permission is required even for a former listing creator', async () => {
  const f = await fixture();
  try {
    for (const [number, company] of [[1, null], [2, 'owned'], [3, 'editable'], [4, 'revoked'], [5, 'reader'], [6, 'pending']]) await f.insert(number, owner, company);
    await f.insert(7, other, 'editable');
    let response = await f.route.GET(request());
    assert.deepEqual((await response.json()).locations.map(row => row.id).sort(), [1, 2, 3].map(uuid));
    await f.pg.exec("update company_members set status = 'removed' where company_id = 'editable'");
    response = await f.route.GET(request());
    assert.deepEqual((await response.json()).locations.map(row => row.id).sort(), [1, 2].map(uuid), 'A new request cannot reuse revoked company access');
  } finally {await f.pg.close();}
});

test('guests and failed authentication never query private rows and always receive no-store JSON', async () => {
  for (const options of [{actor: null}, {authFails: true}, {actor: '../invalid'}]) {
    const f = await fixture(options);
    try {
      const response = await f.route.GET(request());
      assert.equal(response.status, options.actor === null ? 401 : 503); privateResponse(response);
      assert.deepEqual(await response.json(), {error: options.actor === null ? 'unauthorized' : 'unavailable'});
      assert.equal(f.calls.length, 0);
    } finally {await f.pg.close();}
  }
});

test('listing/company failures and interrupted reads are unavailable rather than empty successful accounts', async () => {
  for (const failTable of ['listings', 'companies', 'company_members']) {
    const f = await fixture({failTable});
    try {
      await f.insert(1, owner, 'editable');
      const response = await f.route.GET(request());
      assert.equal(response.status, 503); privateResponse(response);
      assert.deepEqual(await response.json(), {error: 'unavailable'});
    } finally {await f.pg.close();}
  }
  const f = await fixture();
  try {
    const controller = new AbortController(); controller.abort();
    const response = await f.route.GET(request('', {}, controller.signal));
    assert.equal(response.status, 503); privateResponse(response);
    assert.deepEqual(await response.json(), {error: 'unavailable'});
    assert.equal(f.calls.length, 0);
  } finally {await f.pg.close();}
});

test('empty accounts succeed, native fields stay bounded and the 201st candidate discloses truncation', async () => {
  const f = await fixture();
  try {
    assert.deepEqual(await (await f.route.GET(request())).json(), {accountID: owner, locations: [], limited: false});
    await f.pg.exec(`insert into listings(id,user_id,type,title,city,metadata)
      select '00000000-0000-4000-8000-' || lpad(n::text,12,'0'), '${owner}', 'location', 'Studio', null, jsonb_build_object('private',repeat('x',10000))
      from generate_series(1,200) n`);
    let response = await f.route.GET(request());
    let body = await response.json();
    assert.equal(body.locations.length, 200); assert.equal(body.limited, false);
    await f.insert(201);
    response = await f.route.GET(request()); body = await response.json();
    assert.equal(body.locations.length, 200); assert.equal(body.limited, true);
    assert.ok(JSON.stringify(body).length < 20000, 'Private metadata/description cannot expand the native payload');
    assert.ok(body.locations.every(row => Object.keys(row).sort().join(',') === 'city,id,title'));
    assert.ok(f.calls.filter(call => call.table === 'listings').every(call => call.limit === 201));
    assert.ok(!JSON.stringify(body).includes('private'));
    await f.pg.exec("update listings set title = ''");
    response = await f.route.GET(request());
    assert.equal(response.status, 503, 'Corrupt rows cannot silently remove archive permissions');
  } finally {await f.pg.close();}
});
