import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import {translatorFor} from './i18n-test-fixture.mjs';

const require = createRequire(import.meta.url);
const compiled = ts.transpileModule(readFileSync(new URL('../components/NotificationCenter.tsx', import.meta.url), 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX},
}).outputText;
const notices = [
  {id: 'chat-notice', type: 'new_message', title: 'CHAT_NOTICE_CANARY', body: '', href: '/messages/chat', read: false, created_at: '2026-11-12T00:00:00Z'},
  {id: 'booking-notice', type: 'booking_request', title: 'BOOKING_NOTICE_CANARY', body: '', href: '/bookings/own', read: false, created_at: '2026-11-12T00:00:00Z'},
  {id: 'old-notice', type: 'verification_approved', title: 'READ_NOTICE_CANARY', body: '', href: '/profile', read: true, created_at: '2026-11-12T00:00:00Z'},
];

function nodes(value, match, found = []) {
  if (Array.isArray(value)) value.forEach(child => nodes(child, match, found));
  else if (value?.props) {
    if (match(value)) found.push(value);
    nodes(value.props.children, match, found);
  }
  return found;
}
function text(value) {
  if (Array.isArray(value)) return value.map(text).join('');
  if (value === null || value === undefined || typeof value === 'boolean') return '';
  return value?.props ? text(value.props.children) : String(value);
}

function fixture({includeMessages, locale = 'de', status = 'ready', open = true, count = 3, notifications = notices} = {}) {
  const marks = [], refreshed = [], navigated = [];
  const mocks = {
    react: {...React, useState: () => [open, () => {}], useRef: initial => ({current: initial}), useEffect() {}},
    'next/navigation': {useRouter: () => ({push: href => navigated.push(href)})},
    'next-intl': {useTranslations: namespace => translatorFor(locale, namespace), useLocale: () => locale},
    'next/link': {default: ({children, ...props}) => React.createElement('a', props, children)},
    '@/lib/notifications': {timeAgo: () => '', notificationMeta: {}},
  };
  const mod = {exports: {}};
  new Function('require', 'module', 'exports', compiled)(name => mocks[name] ?? require(name), mod, mod.exports);
  const inbox = {status, count, notifications, refresh: async retry => {refreshed.push(retry);}, markRead: async id => {marks.push(id); return true;}};
  const tree = mod.exports.default({inbox, ...(includeMessages === undefined ? {} : {includeMessages})});
  const html = renderToStaticMarkup(tree);
  return {tree, html, marks, refreshed, navigated, t: translatorFor(locale, 'notifications')};
}

test('legacy notification consumers retain their combined message badge and links by default', async () => {
  const f = fixture();
  const badge = nodes(f.tree, node => node.type === 'span' && node.props.className?.includes('absolute'))[0];
  assert.equal(text(badge), '5', 'three unread chats and two unread notifications');
  assert.ok(f.html.includes('CHAT_NOTICE_CANARY'));
  assert.ok(f.html.includes('href="/messages"'));
  const markAll = nodes(f.tree, node => node.type === 'button' && text(node).includes(f.t('markAllRead')))[0];
  await markAll.props.onClick();
  assert.deepEqual(f.marks, [undefined], 'existing mark-all call is unchanged');
});

test('the separate header bell counts only visible notifications and acknowledges only those IDs', async () => {
  const original = structuredClone(notices);
  const f = fixture({includeMessages: false});
  const badge = nodes(f.tree, node => node.type === 'span' && node.props.className?.includes('absolute'))[0];
  assert.equal(text(badge), '1');
  assert.ok(f.html.includes('BOOKING_NOTICE_CANARY'));
  assert.ok(f.html.includes('READ_NOTICE_CANARY'));
  assert.ok(!f.html.includes('CHAT_NOTICE_CANARY'));
  assert.ok(!f.html.includes('href="/messages'));
  assert.deepEqual(f.marks, [], 'opening or rendering the bell never marks anything read');
  const markAll = nodes(f.tree, node => node.type === 'button' && text(node).includes(f.t('markAllRead')))[0];
  await markAll.props.onClick();
  assert.deepEqual(f.marks, ['booking-notice']);
  assert.deepEqual(notices, original, 'presentation never mutates the shared inbox snapshot');
});

test('bell-only empty state stays truthful in all nine languages when only chats are unread', () => {
  for (const locale of ['de', 'en', 'es', 'it', 'cs', 'hu', 'nl', 'nl-BE', 'sv']) {
    const f = fixture({includeMessages: false, locale, notifications: [notices[0]]});
    assert.ok(f.html.includes(f.t('empty')), locale);
    assert.ok(!f.html.includes('CHAT_NOTICE_CANARY'), locale);
    assert.equal(nodes(f.tree, node => node.type === 'span' && node.props.className?.includes('absolute')).length, 0, locale);
  }
});

test('bell-only notification navigation retains the existing read acknowledgement and destination', async () => {
  const f = fixture({includeMessages: false});
  const booking = nodes(f.tree, node => node.props.href === '/bookings/own')[0];
  let prevented = false;
  await booking.props.onClick({preventDefault() {prevented = true;}});
  assert.equal(prevented, true);
  assert.deepEqual(f.marks, ['booking-notice']);
  assert.deepEqual(f.navigated, ['/bookings/own']);
});

test('bell-only opening and retry retain the shared inbox refresh behavior', async () => {
  const closed = fixture({includeMessages: false, open: false});
  nodes(closed.tree, node => node.type === 'button')[0].props.onClick();
  assert.deepEqual(closed.refreshed, [undefined]);
  for (const status of ['error', 'expired']) {
    const f = fixture({includeMessages: false, status, notifications: [], count: null});
    const retry = nodes(f.tree, node => node.type === 'button' && text(node) === f.t('retry'))[0];
    await retry.props.onClick();
    assert.deepEqual(f.refreshed, [true]);
    assert.ok(!f.html.includes(f.t('empty')));
    assert.deepEqual(f.marks, []);
  }
});
