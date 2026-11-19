import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { authorizedListingFreshnessCron } from './listing-freshness-cron-auth.ts';

const secret = 'synthetic-worker-secret';
const targets = [
  { name: 'shots-cleanup', feature: 'SHOTS_CLEANUP_CRON_ENABLED', sibling: 'NATIVE_PUSH_CRON_ENABLED', worker: 'shots' },
  { name: 'native-push', feature: 'NATIVE_PUSH_CRON_ENABLED', sibling: 'SHOTS_CLEANUP_CRON_ENABLED', worker: 'push' },
];

// Compile the real factory and route into the same isolated server environment.
// Only the worker boundaries are synthetic; no production worker or .env is loaded.
function fixture(target, options = {}) {
  const env = { CRON_SECRET: secret, ...options.env };
  const calls = [], logs = [], cache = new Map();
  const run = async (worker) => {
    calls.push(worker);
    if (options.error) throw options.error;
    return options.result ?? { completed: true };
  };
  const mocks = {
    './listing-freshness-cron-auth': { authorizedListingFreshnessCron },
    '@/lib/shots-cleanup': { runShotsCleanup: () => run('shots') },
    '@/lib/native-push-worker': { runNativePushWorker: () => run('push') },
  };
  const context = vm.createContext({
    Request, Response, Headers, Buffer, process: { env },
    console: Object.fromEntries(['log', 'warn', 'error', 'debug', 'info'].map((name) => [name, (...args) => logs.push(args)])),
  });
  function load(path) {
    if (cache.has(path)) return cache.get(path);
    const source = readFileSync(new URL('../' + path, import.meta.url), 'utf8');
    const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const module = { exports: {} };
    const require = (name) => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name === '@/lib/app-service-cron') return load('lib/app-service-cron.ts');
      throw new Error('Unmocked cron dependency: ' + name);
    };
    new vm.Script('(function(require,module,exports){' + output + '\n})', { filename: path }).runInContext(context)(require, module, module.exports);
    cache.set(path, module.exports);
    return module.exports;
  }
  return {
    route: load(`app/api/cron/${target.name}/route.ts`), env, calls, logs,
    request(method = 'GET', authorization = `Bearer ${secret}`, extraHeaders = {}, search = '') {
      return new Request(`https://fixture.invalid/api/cron/${target.name}${search}`, {
        method, headers: { ...(authorization === null ? {} : { authorization }), ...extraHeaders },
      });
    },
  };
}

function privateResponse(response) {
  for (const name of ['Cache-Control', 'CDN-Cache-Control', 'Vercel-CDN-Cache-Control']) {
    assert.match(response.headers.get(name) ?? '', /no-store/i, name);
  }
}

test('real shared cron authentication accepts only the configured exact Bearer secret', () => {
  assert.equal(authorizedListingFreshnessCron(`Bearer ${secret}`, secret), true);
  for (const authorization of [null, '', secret, `bearer ${secret}`, `Bearer ${secret} `, `Bearer ${secret.slice(1)}x`, `Bearer ${secret}x`]) {
    assert.equal(authorizedListingFreshnessCron(authorization, secret), false);
  }
  assert.equal(authorizedListingFreshnessCron('Bearer ', ''), false);
  assert.equal(authorizedListingFreshnessCron(`Bearer ${secret}`, undefined), false);
});

test('both real route modules are dynamic Node GET crons scheduled once every five minutes', () => {
  const configuration = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  for (const target of targets) {
    assert.deepEqual(configuration.crons.filter(({ path }) => path === `/api/cron/${target.name}`), [
      { path: `/api/cron/${target.name}`, schedule: '*/5 * * * *' },
    ]);
    const { route } = fixture(target);
    assert.equal(route.runtime, 'nodejs');
    assert.equal(route.dynamic, 'force-dynamic');
    assert.equal(route.maxDuration, 150);
    assert.deepEqual(Object.keys(route).sort(), ['GET', 'HEAD', 'dynamic', 'maxDuration', 'runtime'].sort());
  }
});

for (const target of targets) {
  test(`${target.name}: only explicit Vercel production plus its own exact flag runs work`, async () => {
    for (const env of [
      {}, { NODE_ENV: 'production' }, { NODE_ENV: 'production', [target.feature]: 'true' },
      { VERCEL_ENV: 'preview', NODE_ENV: 'production', [target.feature]: 'true' },
      { VERCEL_ENV: 'development', [target.feature]: 'true' },
      { VERCEL_ENV: 'production' },
      ...['false', 'TRUE', '1', ''].map((value) => ({ VERCEL_ENV: 'production', [target.feature]: value })),
      { VERCEL_ENV: 'production', [target.sibling]: 'true' },
    ]) {
      const f = fixture(target, { env });
      const response = await f.route.GET(f.request('GET', undefined, { 'x-vercel-env': 'production', 'user-agent': 'vercel-cron/1.0' }));
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { status: 'disabled' });
      assert.deepEqual(f.calls, []);
      privateResponse(response);
    }
    const f = fixture(target, { env: { VERCEL_ENV: 'production', [target.feature]: 'true' } });
    const response = await f.route.GET(f.request());
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { completed: true });
    assert.deepEqual(f.calls, [target.worker]);
    privateResponse(response);
  });

  test(`${target.name}: authentication fails closed before exposing feature state`, async () => {
    for (const enabled of [false, true]) {
      const f = fixture(target, { env: { VERCEL_ENV: 'production', [target.feature]: String(enabled) } });
      for (const authorization of [null, '', 'Bearer wrong', `Bearer ${secret.slice(1)}x`]) {
        const response = await f.route.GET(f.request('GET', authorization, { 'user-agent': 'vercel-cron/1.0' }, `?secret=${secret}`));
        assert.equal(response.status, 401);
        assert.deepEqual(await response.json(), { error: { code: 'unauthorized' } });
        privateResponse(response);
      }
      assert.deepEqual(f.calls, []);
    }
    const f = fixture(target, { env: { CRON_SECRET: undefined, VERCEL_ENV: 'production', [target.feature]: 'true' } });
    const response = await f.route.GET(f.request());
    assert.equal(response.status, 401);
    assert.deepEqual(f.calls, []);
    privateResponse(response);
  });

  test(`${target.name}: explicit HEAD rejects without authenticating or starting a worker`, async () => {
    const f = fixture(target, { env: { VERCEL_ENV: 'production', [target.feature]: 'true' } });
    assert.equal(f.route.HEAD, f.route.GET);
    for (const method of ['HEAD', 'POST', 'PUT', 'DELETE', 'OPTIONS']) {
      const response = await (method === 'HEAD' ? f.route.HEAD : f.route.GET)(f.request(method, null));
      assert.equal(response.status, 405);
      assert.equal(response.headers.get('Allow'), 'GET');
      assert.equal(await response.text(), '');
      privateResponse(response);
    }
    assert.deepEqual(f.calls, []);
  });

  test(`${target.name}: worker and serialization failures return generic private errors without raw logs`, async () => {
    for (const failure of [{ error: new Error('PRIVATE_TOKEN_PROOF_PROVIDER_CANARY') }, { result: { cannotSerialize: 1n } }]) {
      const f = fixture(target, { env: { VERCEL_ENV: 'production', [target.feature]: 'true' }, ...failure });
      const response = await f.route.GET(f.request());
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), { error: { code: 'unavailable' } });
      assert.deepEqual(f.calls, [target.worker]);
      assert.deepEqual(f.logs, []);
      privateResponse(response);
    }
  });

  test(`${target.name}: feature and deployment guards are re-evaluated for every request`, async () => {
    const f = fixture(target, { env: { VERCEL_ENV: 'preview', [target.feature]: 'true' } });
    assert.deepEqual(await (await f.route.GET(f.request())).json(), { status: 'disabled' });
    f.env.VERCEL_ENV = 'production';
    assert.deepEqual(await (await f.route.GET(f.request())).json(), { completed: true });
    f.env[target.feature] = 'false';
    f.env[target.sibling] = 'true';
    assert.deepEqual(await (await f.route.GET(f.request())).json(), { status: 'disabled' });
    assert.deepEqual(f.calls, [target.worker]);
  });

  test(`${target.name}: HTTP 200 relays worker health and aggregate results without claiming delivery or purge`, async () => {
    const result = target.worker === 'shots'
      ? { processed: 10, purged: 7, retry: 3, healthy: false }
      : { status: 'disabled', claimed: 0, accepted: 0, cancelled: 0, retry: 0, failed: 0 };
    const f = fixture(target, { env: { VERCEL_ENV: 'production', [target.feature]: 'true' }, result });
    const response = await f.route.GET(f.request());
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), result);
    assert.deepEqual(f.calls, [target.worker]);
    privateResponse(response);
  });
}
