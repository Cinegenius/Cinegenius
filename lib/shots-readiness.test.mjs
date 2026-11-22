import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { ShotsClientError } from './shots-client.ts';

const require = createRequire(import.meta.url);
const source = readFileSync(process.env.CINEGENIUS_SHOTS_SOURCE ?? 'components/app/ShotsExperience.tsx', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
const ready = /data-native-shots-ready="v1"/;
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const page = () => ({ serverNow: new Date().toISOString(), items: [], nextCursor: null, capabilities: { publish: false, homiesRead: true } });
const privatePage = () => ({ ...page(), items: [{ id: 'synthetic-private-shot', audience: 'community', expiresAt: new Date(Date.now() + 60_000).toISOString(), format: 'portrait', width: 600, height: 900, isMine: false, media: { thumbnail: '/synthetic-private-thumbnail', full: '/synthetic-private-full' } }] });
const same = (a, b) => !!a && !!b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));

/** Execute the real component's effects and deferred requests with local hooks; no server/provider request is possible. */
function fixture() {
  let cells = [], cursor = 0, pending = [], key, audienceProps, active = true, buttons = [];
  const requests = [];
  const auth = { isLoaded: true, isSignedIn: true, userId: 'user_first', sessionId: 'session-first' };
  const resource = { isLoaded: true, session: { id: 'session-first', status: 'active', user: { id: 'user_first' } } };
  const useState = initial => { const index = cursor++; if (!cells[index]) cells[index] = { value: typeof initial === 'function' ? initial() : initial }; const cell = cells[index]; return [cell.value, value => { if (active) cell.value = typeof value === 'function' ? value(cell.value) : value; }]; };
  const useRef = initial => { const index = cursor++; return (cells[index] ??= { current: initial }); };
  const memo = (callback, deps) => { const index = cursor++; if (!cells[index] || !same(cells[index].deps, deps)) cells[index] = { value: callback(), deps }; return cells[index].value; };
  const effect = (callback, deps, layout = false) => { const index = cursor++; const cell = cells[index] ??= {}; if (!same(cell.deps, deps)) { cell.deps = deps; pending.push({ cell, callback, layout }); } };
  const cleanup = () => { for (const cell of cells) cell?.cleanup?.(); pending = []; };
  const navigation = { register: () => () => {}, notify() {}, leave() { assert.fail('no readiness navigation'); } };
  const noEvent = () => {};
  const jsxRuntime = require('react/jsx-runtime');
  const jsx = kind => (type, props, elementKey) => { if (type === 'button') buttons.push(props); return jsxRuntime[kind](type, props, elementKey); };
  const mocks = {
    react: { ...React, useState, useRef, useMemo: memo, useCallback: (callback, deps) => memo(() => callback, deps), useEffect: effect, useLayoutEffect: (callback, deps) => effect(callback, deps, true) },
    'react/jsx-runtime': { ...jsxRuntime, jsx: jsx('jsx'), jsxs: jsx('jsxs') },
    'next/link': { default: props => React.createElement('a', props) },
    '@clerk/nextjs': { useAuth: () => auth, useSession: () => resource },
    'next-intl': { useLocale: () => 'en', useTranslations: () => key => key },
    '@/components/MediaImage': { default: props => { const imageProps = { ...props }; delete imageProps.unoptimized; return React.createElement('img', imageProps); } },
    '@/components/messaging/MessagingDialog': { default: () => null },
    '@/lib/native-dialog': { confirmDialog() { assert.fail('no readiness mutation'); }, dismissNativeDialog() {} },
    '@/contexts/FormDraftContext': { useFormNavigation: () => navigation },
    '@/lib/shots-client': { ShotsClientError, createShotsClient: accountId => ({ feed(audience, _cursor, signal) { const request = { ...deferred(), accountId, audience, signal }; requests.push(request); return request.promise; } }) },
    '@/lib/shots-photo': { SHOT_LOOKS: [] },
    './ShotsExperience.module.css': { default: new Proxy({}, { get: (_target, name) => String(name) }) },
    './ShotsAudienceControl': { default: props => { audienceProps = props; return React.createElement('button', { type: 'button' }, props.value); } },
  };
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', 'document', 'window', compiled)(name => {
    const value = mocks[name] ?? require(name); return 'default' in value ? { __esModule: true, ...value } : value;
  }, mod, mod.exports, { hidden: false, addEventListener: noEvent, removeEventListener: noEvent }, { addEventListener: noEvent, removeEventListener: noEvent });
  return {
    auth, resource, requests,
    render() { buttons = []; const tree = mod.exports.default(); if (tree.key !== key) { cleanup(); cells = []; key = tree.key; } cursor = 0; return renderToStaticMarkup(tree); },
    effects() { const work = pending; pending = []; for (const entry of [...work.filter(value => value.layout), ...work.filter(value => !value.layout)]) { entry.cell.cleanup?.(); entry.cell.cleanup = entry.callback(); } },
    audience(value) { audienceProps.onChange(value); },
    refresh() { const button = buttons.find(value => value.className === 'refresh'); assert.ok(button); button.onClick(); },
    close() { cleanup(); active = false; },
  };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('Shots waits for its actual delayed current-account feed and accepts a finished empty response', async t => {
  const f = fixture(); t.after(() => f.close());
  let html = f.render(); assert.doesNotMatch(html, ready); assert.match(html, /disabled=""/);
  f.effects(); await tick(); assert.equal(f.requests.length, 1); assert.equal(f.requests[0].accountId, 'user_first');
  html = f.render(); assert.doesNotMatch(html, ready, 'a visible title and toolbar cannot release pending data');
  f.requests[0].resolve(page()); await tick(); html = f.render(); assert.match(html, ready); assert.match(html, />empty</); assert.match(html, /disabled=""/, 'publish permission stays disabled');
});

test('a completed feed error releases truthful retry UI, while an audience change immediately rearms', async t => {
  const f = fixture(); t.after(() => f.close()); f.render(); f.effects(); await tick();
  f.requests[0].reject(new ShotsClientError('network')); await tick();
  let html = f.render(); assert.match(html, ready); assert.match(html, /role="alert"/); assert.match(html, />retry</);
  f.audience('homies'); html = f.render(); assert.doesNotMatch(html, ready, 'even before effects, an old-audience error is not fresh');
  f.effects(); await tick(); assert.equal(f.requests[1].audience, 'homies'); assert.doesNotMatch(f.render(), ready);
  f.requests[1].resolve(page()); await tick(); assert.match(f.render(), ready);
});

test('denied feed access renders only a ready public heading and real sign-in link', async t => {
  const f = fixture(); t.after(() => f.close()); f.render(); f.effects(); await tick();
  f.requests[0].resolve(privatePage()); await tick();
  let html = f.render(); assert.match(html, ready); assert.match(html, /synthetic-private-thumbnail/); f.effects();
  f.refresh(); f.render(); f.effects(); await tick(); assert.doesNotMatch(f.render(), ready);
  f.requests[1].reject(new ShotsClientError('unauthorized', 401)); await tick();
  html = f.render(); assert.match(html, ready); assert.match(html, /data-native-shots-public="v1"/); assert.match(html, /<h1\b/); assert.match(html, /href="\/sign-in\?redirect_url=%2Fapp%2Fshots"/); assert.doesNotMatch(html, /data-shots-root|data-shot-id|<img|synthetic-private/);
});

test('a session/account replacement aborts old work and never marks the new pending feed ready', async t => {
  const f = fixture(); t.after(() => f.close()); f.render(); f.effects(); await tick();
  f.auth.userId = 'user_second'; f.auth.sessionId = 'session-second'; f.resource.session = { id: 'session-second', status: 'active', user: { id: 'user_second' } };
  assert.doesNotMatch(f.render(), ready); assert.equal(f.requests[0].signal.aborted, true);
  f.effects(); await tick(); assert.equal(f.requests[1].accountId, 'user_second');
  f.requests[0].resolve(page()); await tick(); assert.doesNotMatch(f.render(), ready, 'late first-account success cannot release the second account');
  f.requests[1].resolve(page()); await tick(); assert.match(f.render(), ready);
});

test('unresolved Clerk state has no marker; settled signed-out or mismatched resources have only public recovery', t => {
  const f = fixture(); t.after(() => f.close()); f.auth.isLoaded = false;
  assert.doesNotMatch(f.render(), ready); assert.equal(f.requests.length, 0);
  f.auth.isLoaded = true; f.auth.isSignedIn = false; f.auth.userId = null; f.auth.sessionId = null; f.resource.session = null;
  let html = f.render(); assert.match(html, ready); assert.match(html, /data-native-shots-public="v1"/); assert.doesNotMatch(html, /data-shots-root|<img/);
  f.auth.isSignedIn = true; f.auth.userId = 'user_first'; f.auth.sessionId = 'session-first'; f.resource.session = { id: 'session-other', status: 'active', user: { id: 'user_other' } };
  html = f.render(); assert.match(html, /data-native-shots-public="v1"/); assert.doesNotMatch(html, /data-shots-root|<img/); assert.equal(f.requests.length, 0);
});
