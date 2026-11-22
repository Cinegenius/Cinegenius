import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function fixture() {
  const attributes = new Map(), events = new Map(); let observer, server = false;
  const root = { getAttribute: name => attributes.get(name) ?? null }, location = { pathname: '/dashboard', search: '', hash: '' };
  const document = { documentElement: root };
  const window = { addEventListener: (key, fn) => events.set(key, fn), removeEventListener: key => events.delete(key) };
  const mod = { exports: {} };
  const source = readFileSync('lib/use-native-dashboard-bootstrap.ts', 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', 'document', 'location', 'window', 'MutationObserver', compiled)(
    name => { assert.equal(name, 'react'); return { useSyncExternalStore: (_, snapshot, serverSnapshot) => server ? serverSnapshot() : snapshot() }; },
    mod, mod.exports, document, location, window,
    class { constructor(changed) { this.changed = changed; observer = this; } observe(target, options) { this.target = target; this.options = options; } disconnect() { this.closed = true; } },
  );
  return { ...mod.exports, attributes, location, events, root, get observer() { return observer; }, server: value => { server = value; } };
}

test('cold dashboard requires the exact native document-start marker and an entirely bare route', () => {
  const f = fixture(); assert.equal(f.nativeDashboardBootstrapSnapshot(), 'content');
  f.attributes.set('data-native-app-startup', 'v1'); assert.equal(f.nativeDashboardBootstrapSnapshot(), 'bootstrap');
  for (const [field, value] of [['search', '?tab=settings'], ['search', '?tab=overview'], ['search', '?redirect=/profile-setup'], ['hash', '#bookings'], ['pathname', '/profile-setup'], ['pathname', '/dashboard/projects/new']]) {
    const before = f.location[field]; f.location[field] = value; assert.equal(f.nativeDashboardBootstrapSnapshot(), 'content', `${field}=${value}`); f.location[field] = before;
  }
  f.attributes.set('data-native-app-startup', 'true'); assert.equal(f.nativeDashboardBootstrapSnapshot(), 'content');
});

test('hydration defers page effects until the native signal is known; explicit tabs and later deliberate dashboard remain normal', () => {
  const f = fixture(); f.server(true);
  assert.equal(f.useNativeDashboardBootstrap(''), true, 'No first-hydration DashboardContent before document-start snapshot');
  assert.equal(f.useNativeDashboardBootstrap('tab=settings'), false, 'Explicit destination is never intercepted');
  f.server(false); assert.equal(f.useNativeDashboardBootstrap(''), false, 'Ordinary website has no additional loading phase after hydration');
  f.attributes.set('data-native-app-startup', 'v1'); assert.equal(f.useNativeDashboardBootstrap(''), true);
  f.attributes.delete('data-native-app-startup'); assert.equal(f.useNativeDashboardBootstrap(''), false, 'Native clears phase only on real destination/explicit intent');
});

test('the startup phase observes only its presentation attribute and actual route events, with complete cleanup', () => {
  const f = fixture(); let changes = 0; const cleanup = f.subscribeNativeDashboardBootstrap(() => { changes++; });
  assert.equal(f.observer.target, f.root); assert.deepEqual(f.observer.options.attributeFilter, ['data-native-app-startup']);
  f.observer.changed(); f.events.get('popstate')(); f.events.get('hashchange')(); assert.equal(changes, 3);
  cleanup(); assert.ok(f.observer.closed); assert.equal(f.events.size, 0);
});
