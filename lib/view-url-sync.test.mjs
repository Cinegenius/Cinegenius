import test from 'node:test';
import assert from 'node:assert/strict';
import { scheduleViewUrlReplace } from './view-url-sync.ts';

function fixture(href = 'https://example.test/props') {
  const tasks = new Map(), events = new Map(), clicks = new Set(), replacements = [];
  let id = 0;
  const browser = {
    location: new URL(href),
    setTimeout(fn) { tasks.set(++id, fn); return id; },
    clearTimeout(key) { tasks.delete(key); },
    addEventListener(name, fn) { if (!events.has(name)) events.set(name, new Set()); events.get(name).add(fn); },
    removeEventListener(name, fn) { events.get(name)?.delete(fn); },
    document: { addEventListener(name, fn) { clicks.add(fn); }, removeEventListener(name, fn) { clicks.delete(fn); } },
  };
  return {
    browser, replacements,
    start(href = '/props?q=test') { return scheduleViewUrlReplace(browser, href, next => replacements.push(next)); },
    fire() { for (const fn of [...tasks.values()]) fn(); },
    event(name) { for (const fn of [...(events.get(name) ?? [])]) fn(); },
    click(href, options = {}) {
      const link = { href, target: options.target ?? '', hasAttribute: key => key === 'download' && options.download };
      for (const fn of [...clicks]) fn({button: 0, ...options, target: {closest: () => link}});
    },
    pending() { return tasks.size; },
    listeners() { return clicks.size + [...events.values()].reduce((count, set) => count + set.size, 0); },
  };
}

test('filter address updates replace only a changed URL in the current area', () => {
  const app = fixture();
  app.start('/props');
  app.start('/jobs?q=test');
  app.start('https://another.test/props');
  assert.equal(app.pending(), 0);
  app.start(); app.fire(); app.fire();
  assert.deepEqual(app.replacements, ['/props?q=test']);
  assert.equal(app.listeners(), 0);
});

test('a clicked destination wins over pending filter updates across all public areas', () => {
  for (const path of ['/props', '/locations', '/jobs', '/search']) {
    for (const destination of ['/profile/person', '/companies/studio', '/', '/admin', `${path}?q=other`]) {
      const app = fixture(`https://example.test${path}`);
      app.start(`${path}?q=test`);
      app.click(`https://example.test${destination}`);
      app.fire();
      assert.deepEqual(app.replacements, [], `${path} must not override ${destination}`);
      assert.equal(app.listeners(), 0);
    }
  }
});

test('back, forward, page exit and effect cleanup cancel delayed replacements', () => {
  for (const event of ['popstate', 'pagehide']) {
    const app = fixture(); app.start(); app.event(event); app.fire();
    assert.deepEqual(app.replacements, []);
    assert.equal(app.pending(), 0);
  }
  const app = fixture(); const cleanup = app.start(); cleanup(); app.fire();
  assert.deepEqual(app.replacements, []);
  assert.equal(app.listeners(), 0);
});

test('URL changes without a click cannot be overwritten by an old delayed update', () => {
  const app = fixture(); app.start(); app.browser.location = new URL('https://example.test/profile/person'); app.fire();
  assert.deepEqual(app.replacements, []);
});

test('modified clicks, new tabs and downloads do not interrupt the current view', () => {
  for (const options of [{metaKey:true}, {ctrlKey:true}, {shiftKey:true}, {altKey:true}, {button:1}, {target:'_blank'}, {download:true}]) {
    const app = fixture(); app.start(); app.click('https://example.test/profile/person', options); app.fire();
    assert.deepEqual(app.replacements, ['/props?q=test']);
  }
});
