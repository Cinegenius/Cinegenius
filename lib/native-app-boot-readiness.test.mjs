import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as tasks from './auth-session-tasks.ts';

const source = readFileSync(process.env.CINEGENIUS_BOOT_SOURCE ?? 'lib/native-app-boot-readiness.ts', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const marker = 'data-native-app-boot-ready';
function fixture({ pathname = '/dashboard', search = '', session = 'member', task, smart = false, meaningful = true, authForm = false, setup = false } = {}) {
  let next = 0;
  const frames = new Map(), mutations = [], resizes = [], cleanups = [];
  class Node {
    constructor(rect = {}) { this.isConnected = true; this.attrs = new Map(); this.selectors = new Map(); this.children = []; this.disabled = false;
      this.box = { left: 0, top: 0, width: 393, height: 80, ...rect }; this.style = { getPropertyValue: name => this.attrs.get(name) ?? '' };
      this.computed = { display: 'block', visibility: 'visible', opacity: '1', position: 'static' }; }
    getAttribute(name) { return this.attrs.get(name) ?? null; }
    setAttribute(name, value) { this.attrs.set(name, value); }
    removeAttribute(name) { this.attrs.delete(name); }
    getBoundingClientRect() { return { ...this.box, right: this.box.left + this.box.width, bottom: this.box.top + this.box.height }; }
    querySelector(selector) { return this.selectors.get(selector) ?? null; }
    querySelectorAll() { return this.children; }
  }
  const eventTarget = () => {
    const listeners = new Map();
    return { addEventListener(name, callback) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(callback); },
      removeEventListener(name, callback) { listeners.get(name)?.delete(callback); },
      emit(name) { for (const callback of [...listeners.get(name) ?? []]) callback(); },
      listenerCount: () => [...listeners.values()].reduce((n, set) => n + set.size, 0) };
  };
  const root = new Node(), body = new Node({ height: 852 }), header = new Node({ top: 12, height: 56 });
  const content = new Node({ top: 80, height: 600 }), dock = new Node({ top: 780, height: 64 }), profile = new Node({ width: 44, height: 44 });
  const landing = new Node({ top: 80, height: 500 }), form = new Node({ top: 120, height: 400 }), wizard = new Node({ top: 0, height: 800 });
  const field = new Node({ width: 200, height: 44 }), title = new Node({ height: 24 });
  content.computed.position = 'fixed';
  root.attrs.set('data-cg-native-community-appearance', 'app'); root.attrs.set('--cg-app-content-top', '80px'); root.attrs.set('--cg-app-content-height', '600px');
  header.selectors.set('[data-native-app-action="profile"]', profile);
  if (meaningful) content.selectors.set('h1,[role="alert"]', title);
  content.selectors.set('[data-native-browse-toolbar="v1"]', new Node());
  if (smart) content.selectors.set('[data-native-smart-landing]', landing);
  form.children.push(field); wizard.children.push(field); wizard.selectors.set('h1,[role="alert"]', title);
  const elements = new Map([
    ['header[data-native-app-navbar="v1"]', header], ['main[data-native-app-surface="v1"]', content],
    ['nav[data-native-app-bottom-nav="v1"][data-native-app-gesture-ready="v1"]', dock],
  ]);
  if (authForm) elements.set('[data-native-auth-ready="v1"]', form);
  if (setup) elements.set('[data-native-onboarding-surface="v1"]', wizard);
  const document = { ...eventTarget(), documentElement: root, body, visibilityState: 'visible', querySelector: selector => elements.get(selector) ?? null };
  const window = { ...eventTarget(), innerWidth: 393, innerHeight: 852, visualViewport: { ...eventTarget(), width: 393, height: 852 } }; window.top = window.self = window;
  const location = { protocol: 'https:', pathname, search };
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', 'document', 'window', 'location', 'HTMLElement', 'getComputedStyle', 'MutationObserver', 'ResizeObserver', 'requestAnimationFrame', 'cancelAnimationFrame', compiled)(
    name => { assert.equal(name, './auth-session-tasks'); return tasks; }, mod, mod.exports, document, window, location, Node, node => node.computed,
    class { constructor(callback) { this.callback = callback; mutations.push(this); } observe() {} disconnect() { this.closed = true; } },
    class { constructor(callback) { this.callback = callback; resizes.push(this); } observe() {} disconnect() { this.closed = true; } },
    callback => { frames.set(++next, callback); return next; }, id => frames.delete(id),
  );
  const install = (options = {}) => { const cleanup = mod.exports.installNativeAppBootReadiness({ pathname, session, task, ...options }); cleanups.push(cleanup); return cleanup; };
  install();
  return { ...mod.exports, root, body, header, content, dock, profile, landing, form, wizard, field, elements, document, window, location, frames, mutations, resizes, install,
    ready: () => root.getAttribute(marker),
    frame() { const current = [...frames.values()]; frames.clear(); current.forEach(callback => callback()); },
    change(record = { type: 'childList', target: content }) { mutations.filter(observer => !observer.closed).forEach(observer => observer.callback([record])); },
    cleanup() { cleanups.forEach(cleanup => cleanup()); },
  };
}

test('current Clerk classification requires loaded matching active resources and never treats a pending task as app membership', t => {
  const f = fixture(); t.after(() => f.cleanup());
  const own = { authLoaded: true, sessionLoaded: true, signedIn: true, userId: 'own', sessionId: 'session-a', session: { id: 'session-a', status: 'active', user: { id: 'own' } } };
  assert.equal(f.nativeBootSession(own), 'member');
  for (const change of [{ authLoaded: false }, { sessionLoaded: false }, { userId: 'other' }, { sessionId: 'other' }, { session: { ...own.session, status: 'revoked' } }, { session: { ...own.session, user: undefined } }, { session: { ...own.session, currentTask: { key: 'setup-mfa' } } }]) assert.equal(f.nativeBootSession({ ...own, ...change }), 'unresolved');
  const guest = { authLoaded: true, sessionLoaded: true, signedIn: false, userId: null, sessionId: null, session: null };
  assert.equal(f.nativeBootSession(guest), 'guest'); assert.equal(f.nativeBootSession({ ...guest, signedIn: undefined }), 'unresolved');
  const pending = { ...guest, session: { id: 'pending', status: 'pending', user: { id: 'own' }, currentTask: { key: 'setup-mfa' } } };
  assert.equal(f.nativeBootSession(pending), 'pending'); assert.equal(f.nativeBootSession({ ...pending, userId: 'other' }), 'unresolved');
});

test('the real native shell and measured viewport require two stable frames without timers or requests', t => {
  const f = fixture(); t.after(() => f.cleanup()); assert.equal(f.ready(), null);
  f.frame(); assert.equal(f.ready(), null); f.frame(); assert.equal(f.ready(), 'v1'); assert.equal(f.frames.size, 0);
  f.content.box.height = 610; f.change(); f.frame(); assert.equal(f.ready(), null, 'An out-of-sync measured viewport is not ready');
  f.root.attrs.set('--cg-app-content-height', '610px'); f.change(); f.frame(); assert.equal(f.ready(), null); f.frame(); assert.equal(f.ready(), 'v1');
  f.content.computed.position = 'static'; f.change(); f.frame(); assert.equal(f.ready(), null);
});

test('moved chrome needs another stable frame, and hidden/disabled/offscreen controls never pass', t => {
  for (const invalid of [f => { f.profile.disabled = true; }, f => { f.header.computed.visibility = 'hidden'; }, f => { f.dock.box.top = 900; }, f => { f.elements.delete('nav[data-native-app-bottom-nav="v1"][data-native-app-gesture-ready="v1"]'); }]) {
    const f = fixture(); t.after(() => f.cleanup()); invalid(f); f.frame(); f.frame(); assert.equal(f.ready(), null);
  }
  const f = fixture(); t.after(() => f.cleanup()); f.frame(); f.header.box.top = 14; f.frame(); assert.equal(f.ready(), null); f.frame(); assert.equal(f.ready(), 'v1');
});

test('Smart cannot pass an outer shell or anonymous placeholder before its fresh route-ready signal', t => {
  const f = fixture({ pathname: '/search', search: '?smart=1', smart: true }); t.after(() => f.cleanup());
  f.frame(); f.frame(); assert.equal(f.ready(), null);
  f.landing.attrs.set('data-native-route-ready', 'v1'); f.change(); f.frame(); assert.equal(f.ready(), null); f.frame(); assert.equal(f.ready(), 'v1');
  f.landing.attrs.delete('data-native-route-ready'); f.change(); f.frame(); assert.equal(f.ready(), null);
  const missing = fixture({ pathname: '/search', search: '?smart=1' }); t.after(() => missing.cleanup()); missing.frame(); missing.frame(); assert.equal(missing.ready(), null);
});

test('auth pages need usable loaded guest forms, allow unchecked registration consent, and never pass a signed-in departing form', t => {
  for (const pathname of ['/sign-in', '/sign-up']) {
    const f = fixture({ pathname, session: 'guest', authForm: true }); t.after(() => f.cleanup()); f.field.disabled = true;
    f.frame(); f.frame(); assert.equal(f.ready(), 'v1', 'Input/consent rules do not have to enable submit to show the form');
  }
  for (const session of ['unresolved', 'member']) { const f = fixture({ pathname: '/sign-in', session, authForm: true }); t.after(() => f.cleanup()); f.frame(); f.frame(); assert.equal(f.ready(), null); }
  const noForm = fixture({ pathname: '/sign-in', session: 'guest' }); t.after(() => noForm.cleanup()); noForm.frame(); noForm.frame(); assert.equal(noForm.ready(), null);
});

test('only the exact pending security task becomes ready; onboarding waits for its real controls', t => {
  const pending = fixture({ pathname: '/sign-in/tasks/setup-mfa', session: 'pending', task: 'setup-mfa', authForm: true }); t.after(() => pending.cleanup()); pending.frame(); pending.frame(); assert.equal(pending.ready(), 'v1');
  const wrong = fixture({ pathname: '/sign-in', session: 'pending', task: 'setup-mfa', authForm: true }); t.after(() => wrong.cleanup()); wrong.frame(); wrong.frame(); assert.equal(wrong.ready(), null);
  const setup = fixture({ pathname: '/profile-setup', setup: true }); t.after(() => setup.cleanup()); setup.wizard.children = []; setup.frame(); setup.frame(); assert.equal(setup.ready(), null); setup.wizard.children.push(setup.field); setup.change(); setup.frame(); setup.frame(); assert.equal(setup.ready(), 'v1');
});

test('lifecycle loss clears immediately, and late cleanup cannot clear a newer document/session owner', t => {
  const f = fixture(); t.after(() => f.cleanup()); f.frame(); f.frame(); assert.equal(f.ready(), 'v1');
  f.window.emit('blur'); assert.equal(f.ready(), null); f.window.emit('focus'); f.frame(); assert.equal(f.ready(), null); f.frame(); assert.equal(f.ready(), 'v1');
  f.document.visibilityState = 'hidden'; f.document.emit('visibilitychange'); assert.equal(f.ready(), null); f.document.visibilityState = 'visible'; f.document.emit('visibilitychange'); f.frame(); f.frame(); assert.equal(f.ready(), 'v1');
  const cleanupNew = f.install(); f.frame(); f.frame(); assert.equal(f.ready(), 'v1'); cleanupNew(); assert.equal(f.ready(), null);
  const old = f.install(); f.frame(); f.frame(); f.install(); f.frame(); f.frame(); old(); assert.equal(f.ready(), 'v1');
  f.location.pathname = '/other'; f.window.emit('popstate'); assert.equal(f.ready(), null); f.frame(); assert.equal(f.ready(), null);
});

test('normal content updates and draggable control styles do not repeat native readiness edges', t => {
  const f = fixture(); t.after(() => f.cleanup()); f.frame(); f.frame(); const outsider = new f.field.constructor();
  f.change({ type: 'attributes', attributeName: 'style', target: outsider }); assert.equal(f.frames.size, 0);
  f.change(); f.frame(); assert.equal(f.ready(), 'v1'); assert.equal(f.frames.size, 0);
  f.cleanup(); assert.equal(f.window.listenerCount() + f.document.listenerCount() + f.window.visualViewport.listenerCount(), 0); assert.ok(f.mutations.every(observer => observer.closed)); assert.ok(f.resizes.every(observer => observer.closed));
});

test('directory shells wait for the hydrated native toolbar and never accept an early loading skeleton', t => {
  const f = fixture({ pathname: '/creators' }); t.after(() => f.cleanup()); f.content.selectors.delete('[data-native-browse-toolbar="v1"]'); f.frame(); f.frame(); assert.equal(f.ready(), null);
  f.content.selectors.set('[data-native-browse-toolbar="v1"]', f.field); f.change(); f.frame(); f.frame(); assert.equal(f.ready(), 'v1');
  const empty = fixture({ meaningful: false }); t.after(() => empty.cleanup()); empty.frame(); empty.frame(); assert.equal(empty.ready(), null);
});

test('terminal public route recovery can finish without a directory toolbar or Smart results, but requires real controls', t => {
  for (const [pathname, search] of [['/creators', ''], ['/locations', ''], ['/projects', ''], ['/search', '?smart=1']]) {
    const f = fixture({ pathname, search, meaningful: false }); t.after(() => f.cleanup());
    f.content.selectors.delete('[data-native-browse-toolbar="v1"]');
    const recovery = new f.field.constructor({ top: 100, height: 300 });
    f.content.selectors.set('[data-native-route-error="v1"]', recovery);
    f.frame(); f.frame(); assert.equal(f.ready(), null, 'An empty marker must not admit a skeleton');
    recovery.selectors.set('h1,[role="alert"]', f.field);
    f.change(); f.frame(); f.frame(); assert.equal(f.ready(), null, 'A heading alone is not usable recovery');
    recovery.children.push(f.field); f.change(); f.frame(); f.frame(); assert.equal(f.ready(), 'v1');
    recovery.computed.display = 'none'; f.change(); f.frame(); assert.equal(f.ready(), null);
  }
});

test('Shots does not admit its heading while fresh account feed is loading, but accepts the current feed or public recovery signal', t => {
  for (const session of ['member', 'guest']) {
    const f = fixture({ pathname: '/app/shots', session }); t.after(() => f.cleanup());
    f.frame(); f.frame(); assert.equal(f.ready(), null);
    f.content.selectors.set('[data-native-shots-ready="v1"]', f.field); f.change(); f.frame(); f.frame(); assert.equal(f.ready(), 'v1');
    f.content.selectors.delete('[data-native-shots-ready="v1"]'); f.change(); f.frame(); assert.equal(f.ready(), null);
  }
});
