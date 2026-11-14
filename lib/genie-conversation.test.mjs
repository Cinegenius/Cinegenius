import test from 'node:test';
import assert from 'node:assert/strict';
import {clearConversation, readConversation, safeLinks, saveConversation, trimExchanges} from './genie-conversation.ts';
import {GENIE_LINKS, GENIE_MAX_HISTORY_CHARS, GENIE_MAX_MESSAGE_CHARS, GENIE_MAX_MESSAGES} from './genie.ts';

const KEY = 'cg_genie_conversation_v1';
const NOW = 1_800_000_000_000;
const IDLE = 10 * 60 * 1000;
const SCOPE = 'sess_first';
const pair = (id = 1, user = 'A question', reply = 'An answer', links = []) => ({id, user, reply, links});
const envelope = (exchanges = [pair()], overrides = {}) => ({version: 1, scope: SCOPE, updatedAt: NOW, exchanges, ...overrides});
function storage(initial = null) {
  let raw = initial;
  const removed = [], written = [];
  return {
    get raw() { return raw; }, removed, written,
    getItem(key) { assert.equal(key, KEY); return raw; },
    setItem(key, value) { assert.equal(key, KEY); written.push(value); raw = value; },
    removeItem(key) { assert.equal(key, KEY); removed.push(key); raw = null; },
  };
}
function rejectsStored(value, scope = SCOPE, now = NOW) {
  const saved = storage(typeof value === 'string' ? value : JSON.stringify(value));
  assert.deepEqual(readConversation(saved, scope, now), []);
  assert.equal(saved.raw, null);
  assert.deepEqual(saved.removed, [KEY]);
}

test('a completed conversation round trips within its exact session', () => {
  const saved = storage();
  const exchanges = [pair(2), pair(5, 'Follow up', 'More detail', [{label: 'Help', href: '/help'}])];
  saveConversation(saved, SCOPE, exchanges, NOW);
  assert.deepEqual(JSON.parse(saved.raw), envelope(exchanges));
  assert.deepEqual(readConversation(saved, SCOPE, NOW + IDLE - 1), exchanges);
  assert.equal(saved.removed.length, 0);
});

test('missing storage is empty and does not cause a write', () => {
  const saved = storage();
  assert.deepEqual(readConversation(saved, SCOPE, NOW), []);
  assert.equal(saved.removed.length, 0);
  assert.equal(saved.written.length, 0);
});

test('10-minute inactivity expiry and a different sign-in session remove the conversation', () => {
  rejectsStored(envelope(), SCOPE, NOW + IDLE);
  rejectsStored(envelope(), SCOPE, NOW + IDLE + 1);
  rejectsStored(envelope(), 'sess_second');
  rejectsStored(envelope(), '');
  rejectsStored(envelope(), '   ');
  rejectsStored(envelope(), 'x'.repeat(257));
  rejectsStored(envelope(), 'sess_\0first');
});

test('malformed envelopes, timestamps and unexpected transient fields are removed', () => {
  for (const value of [
    '{broken', 'null', '[]', 'true', '',
    envelope([], {}), envelope(undefined, {version: 2}),
    envelope(undefined, {updatedAt: NOW + 1}), envelope(undefined, {updatedAt: -1}),
    envelope(undefined, {updatedAt: 1.2}), envelope(undefined, {updatedAt: String(NOW)}),
    envelope(undefined, {updatedAt: null}), envelope(undefined, {exchanges: null}),
    envelope(undefined, {scope: null}), envelope(undefined, {pendingUser: 'Unsent'}),
    envelope(undefined, {draft: 'Private draft'}), envelope(undefined, {status: 'errorNetwork'}),
  ]) rejectsStored(value);
  rejectsStored(envelope(), SCOPE, NaN);
  rejectsStored(envelope(), SCOPE, Infinity);
});

test('IDs and individual message content must form valid complete pairs', () => {
  for (const changed of [
    {id: 0}, {id: -1}, {id: 1.5}, {id: '1'}, {id: Number.MAX_SAFE_INTEGER + 1},
    {user: ''}, {user: ' \n '}, {user: null}, {user: 'A\0B'},
    {user: 'x'.repeat(GENIE_MAX_MESSAGE_CHARS + 1)},
    {reply: ''}, {reply: ' \t '}, {reply: 12}, {reply: 'A\0B'},
    {reply: 'x'.repeat(GENIE_MAX_MESSAGE_CHARS + 1)},
    {links: null}, {pendingUser: 'Unsent'}, {status: 'errorFailed'},
  ]) rejectsStored(envelope([{...pair(), ...changed}]));
  rejectsStored(envelope([pair(1), pair(1)]));
  rejectsStored(envelope([pair(2), pair(1)]));
  rejectsStored(envelope([{id: 1, user: 'Only a user message', links: []}]));
});

test('read rejects payloads beyond message, aggregate character and raw byte limits', () => {
  rejectsStored(envelope(Array.from({length: 5}, (_, index) => pair(index + 1))));
  rejectsStored(envelope([pair(1, 'x'.repeat(2000), 'x'.repeat(2000)), pair(2, 'x'.repeat(2000), 'x'.repeat(2000)), pair(3)]));
  rejectsStored(' '.repeat(32 * 1024 + 1));
  // Characters can fit their own limit while JSON escaping exceeds 32 KiB.
  const escaped = envelope([pair(1, '\u0001'.repeat(2000), '\u0001'.repeat(2000)), pair(2, '\u0001'.repeat(2000), '\u0001'.repeat(2000))]);
  assert.ok(JSON.stringify(escaped).length > 32 * 1024);
  rejectsStored(escaped);
  const multibyte = JSON.stringify(envelope([pair(1, '漢'.repeat(1000), '漢'.repeat(1000),
    Array.from({length: 100}, () => ({label: '漢'.repeat(100), href: '/help'})))]));
  assert.ok(multibyte.length < 32 * 1024);
  assert.ok(Buffer.byteLength(multibyte) > 32 * 1024);
  rejectsStored(multibyte);
});

test('saving keeps the last four complete pairs and respects the shared character budget', () => {
  const saved = storage();
  const exchanges = Array.from({length: 8}, (_, index) => pair(index + 1));
  saveConversation(saved, SCOPE, exchanges, NOW);
  assert.deepEqual(readConversation(saved, SCOPE, NOW), exchanges.slice(-4));
  const large = Array.from({length: 4}, (_, index) => pair(index + 1, 'x'.repeat(2000), 'y'.repeat(2000)));
  saveConversation(saved, SCOPE, large, NOW);
  assert.deepEqual(readConversation(saved, SCOPE, NOW), large.slice(-2));
  assert.equal(exchanges.length, 8, 'saving must not mutate live state');
});

test('saving also drops complete oldest pairs when encoded JSON exceeds 32 KiB', () => {
  const saved = storage();
  const pairs = [pair(1, '\u0001'.repeat(2000), '\u0001'.repeat(2000)), pair(2, '\u0001'.repeat(2000), '\u0001'.repeat(2000))];
  saveConversation(saved, SCOPE, pairs, NOW);
  assert.ok(Buffer.byteLength(saved.raw) <= 32 * 1024);
  assert.deepEqual(readConversation(saved, SCOPE, NOW), pairs.slice(-1));
});

test('empty, invalid or incomplete histories remove any previous saved conversation', () => {
  for (const pairs of [[], [pair(0)], [pair(1, '', 'An answer')], [{id: 1, user: 'Waiting', links: []}], [{...pair(), draft: 'Private'}]]) {
    const saved = storage(JSON.stringify(envelope()));
    saveConversation(saved, SCOPE, pairs, NOW);
    assert.equal(saved.raw, null);
    assert.equal(saved.written.length, 0);
  }
  for (const [scope, now] of [['', NOW], [' ', NOW], [SCOPE, NaN], [SCOPE, -1]]) {
    const saved = storage(JSON.stringify(envelope()));
    saveConversation(saved, scope, [pair()], now);
    assert.equal(saved.raw, null);
  }
  const saved = storage(JSON.stringify(envelope()));
  clearConversation(saved);
  assert.equal(saved.raw, null);
});

test('blocked reads, writes, quota limits and removals never break chat', () => {
  const failure = () => { throw new DOMException('Blocked', 'SecurityError'); };
  const blocked = {getItem: failure, setItem: failure, removeItem: failure};
  assert.deepEqual(readConversation(blocked, SCOPE, NOW), []);
  assert.doesNotThrow(() => saveConversation(blocked, SCOPE, [pair()], NOW));
  assert.doesNotThrow(() => saveConversation(blocked, SCOPE, [], NOW));
  assert.doesNotThrow(() => clearConversation(blocked));
  const saved = storage(JSON.stringify(envelope()));
  saved.setItem = () => { throw new DOMException('Full', 'QuotaExceededError'); };
  saveConversation(saved, SCOPE, [pair(2)], NOW);
  assert.equal(saved.raw, null, 'failed writes must not resurrect an older snapshot');
});

test('links are exact allowlist matches, unique, bounded and projected to safe fields', () => {
  const links = [
    null, [], 'link', {label: '', href: '/help'}, {label: ' ', href: '/help'},
    {label: 'x'.repeat(101), href: '/help'}, {label: 'Help\0', href: '/help'},
    {label: 'External', href: 'https://evil.example'}, {label: 'Script', href: 'javascript:alert(1)'},
    {label: 'Relative external', href: '//evil.example'}, {label: 'Query', href: '/help?private=1'},
    {label: 'Private profile', href: '/profile/private-id'},
    {label: 'Help', href: '/help', extra: 'Never store this'},
    {label: 'Duplicate', href: '/help'}, ...GENIE_LINKS.slice(0, 6).map(link => ({label: link.labelEn, href: link.href})),
  ];
  const clean = safeLinks(links);
  assert.equal(clean.length, 4);
  assert.deepEqual(clean[0], {label: 'Help', href: '/help'});
  assert.equal(new Set(clean.map(link => link.href)).size, clean.length);
  assert.ok(clean.every(link => GENIE_LINKS.some(allowed => allowed.href === link.href)));
  assert.deepEqual(safeLinks({label: 'Help', href: '/help'}), []);
  const saved = storage();
  saveConversation(saved, SCOPE, [pair(1, 'Question', 'Answer', links)], NOW);
  assert.deepEqual(readConversation(saved, SCOPE, NOW)[0].links, clean);
  const tampered = storage(JSON.stringify(envelope([pair(1, 'Question', 'Answer', links)])));
  assert.deepEqual(readConversation(tampered, SCOPE, NOW)[0].links, clean);
});

test('the pricing section survives conversation recovery without allowing arbitrary anchors or queries', () => {
  const link = {label: 'Preise & Konditionen', href: '/pricing#support-mediation'};
  const variants = [
    '/pricing#other-section', '/pricing?return_url=https://example.com#support-mediation',
    '//example.com/pricing#support-mediation', 'https://www.cinegenius.co/pricing#support-mediation',
  ].map(href => ({label: 'Unapproved link', href}));
  assert.deepEqual(safeLinks([link, ...variants]), [link]);
  const saved = storage();
  saveConversation(saved, SCOPE, [pair(1, 'What does CineGenius cost?', 'See the confirmed terms.', [link])], NOW);
  assert.deepEqual(readConversation(saved, SCOPE, NOW + 1)[0].links, [link]);
  assert.deepEqual(readConversation(saved, 'sess_second', NOW + 2), []);
});

test('trimming reserves the next user message without splitting or mutating pairs', () => {
  const pairs = Array.from({length: 6}, (_, index) => pair(index + 1, 'x'.repeat(1000), 'y'.repeat(1000)));
  assert.deepEqual(trimExchanges(pairs), pairs.slice(-4));
  const result = trimExchanges(pairs, 'Next question');
  assert.deepEqual(result, pairs.slice(-3));
  assert.ok(result.length * 2 + 1 <= GENIE_MAX_MESSAGES);
  assert.ok(result.reduce((size, item) => size + item.user.length + item.reply.length, 'Next question'.length) <= GENIE_MAX_HISTORY_CHARS);
  assert.equal(pairs.length, 6);
  assert.deepEqual(trimExchanges([], 'Question'), []);
  assert.deepEqual(trimExchanges(pairs, 'x'.repeat(GENIE_MAX_HISTORY_CHARS + 1)), []);
});
