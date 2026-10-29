import test from 'node:test';
import assert from 'node:assert/strict';
import { observeCompanyLogoDemos, logoDemoPlan } from './company-logo-demo.ts';
const LEGACY_DEMO_KEY = 'cinegenius:home-company-logo-demo:v3';

function fixture(prefix, { reduced = false, loaded = true, stored } = {}) {
  const originals = new Map();
  const install = (key, value) => { originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { configurable: true, value }); };
  let now = 0, frame = 0, reduce = reduced, busy = false, callback;
  const frames = new Map(), saved = new Map(), motions = new Map(), histories = new Map();
  if (stored) saved.set(LEGACY_DEMO_KEY, JSON.stringify(stored));
  const doc = new EventTarget(), win = new EventTarget(); doc.visibilityState = 'visible';
  const coins = Array.from({ length: 6 }, (_, index) => {
    const history = []; let transform = '';
    const rotor = { style: { get transform() { return transform; }, set transform(value) { transform = value; history.push({ now, value }); }, willChange: '' } };
    const image = { complete: loaded, naturalWidth: loaded ? 200 : 0 };
    const coin = { dataset: { logoDemoId: `${prefix}-${index}` }, isConnected: true, querySelectorAll: () => [image], image };
    motions.set(coin, { rotor, angle: 0, frame: 0, gesture: null }); histories.set(coin, history); return coin;
  });
  const root = new EventTarget(); root.querySelectorAll = () => coins;
  install('document', doc);
  install('window', win);
  install('sessionStorage', { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) });
  install('requestAnimationFrame', cb => { frames.set(++frame, cb); return frame; });
  install('cancelAnimationFrame', id => frames.delete(id));
  let disconnected = false;
  install('IntersectionObserver', class { constructor(cb) { callback = cb; } observe() {} disconnect() { disconnected = true; } });
  const options = { motionFor: coin => motions.get(coin), reduced: () => reduce, busy: () => busy, reset: (_coin, motion) => { motion.angle = 0; motion.frame = 0; motion.gesture = null; motion.rotor.style.transform = ''; motion.rotor.style.willChange = ''; } };
  let controller = observeCompanyLogoDemos(root, options);
  return {
    coins, motions, histories, frames, saved, root,
    get controller() { return controller; },
    reveal(indices) { callback(coins.map((target, index) => ({ target, isIntersecting: indices.includes(index), intersectionRatio: indices.includes(index) ? 1 : 0 }))); },
    tick(time) { now = time; const batch = [...frames.values()]; frames.clear(); for (const cb of batch) cb(now); },
    visibility(value) { doc.visibilityState = value; doc.dispatchEvent(new Event('visibilitychange')); },
    reduced(value) { reduce = value; controller.refresh(); },
    busy(value) { busy = value; },
    pointerUp() { doc.dispatchEvent(new Event('pointerup')); },
    pageHide() { win.dispatchEvent(new Event('pagehide')); },
    pageShow(persisted = false) { const event = new Event('pageshow'); Object.defineProperty(event, 'persisted', { value: persisted }); win.dispatchEvent(event); },
    remount() { controller.dispose(); controller = observeCompanyLogoDemos(root, options); disconnected = false; },
    close() { controller.dispose(); assert.equal(frames.size, 0); assert.equal(disconnected, true); for (const [key, original] of originals) { if (original) Object.defineProperty(globalThis, key, original); else delete globalThis[key]; } },
  };
}

test('six visible logos have staggered starts, both directions, varied gentle durations and finish frontally once per page visit', () => {
  const f = fixture('six');
  try {
    f.reveal([0, 1, 2, 3, 4, 5]);
    for (const time of [0, 120, 260, 500, 700]) f.tick(time);
    const angles = f.coins.map(coin => f.motions.get(coin).angle);
    assert.ok(angles.some(angle => angle > 0) && angles.some(angle => angle < 0));
    assert.ok(new Set(f.coins.map((_, index) => logoDemoPlan(index).duration)).size > 3);
    assert.ok(new Set(f.coins.map(coin => f.histories.get(coin)[0].now)).size > 1);
    f.tick(3000);
    assert.ok(f.coins.every(coin => f.motions.get(coin).angle === 0 && f.motions.get(coin).rotor.style.transform === ''));
    assert.equal(f.frames.size, 0);
    assert.equal(f.saved.size, 0, 'the demonstration must not write browser storage');
    f.reveal([]); f.reveal([0, 1, 2, 3, 4, 5]); assert.equal(f.frames.size, 0);
    f.remount(); f.reveal([0, 1, 2, 3, 4, 5]); assert.equal(f.frames.size, 6, 'a new visit must demonstrate the logos again');
  } finally { f.close(); }
});

test('phone rows wait for their own visibility and a paused logo resumes without elapsed-time jumps', () => {
  const f = fixture('rows');
  try {
    f.reveal([0, 1]); f.tick(0); f.tick(500);
    assert.ok(f.coins.slice(2).every(coin => f.histories.get(coin).length === 0));
    const previous = f.motions.get(f.coins[0]).angle;
    f.reveal([]); f.tick(20000); assert.equal(f.motions.get(f.coins[0]).angle, previous); assert.equal(f.frames.size, 0);
    f.reveal([0, 1]); f.tick(21000); assert.equal(f.motions.get(f.coins[0]).angle, previous);
    f.tick(24000); assert.equal(f.frames.size, 0);
    f.reveal([2, 3]); f.tick(25000); f.tick(28000);
    f.reveal([4, 5]); f.tick(29000); f.tick(32000);
    assert.ok(f.coins.every(coin => f.histories.get(coin).some(entry => entry.value)));
    assert.ok(f.coins.every(coin => f.motions.get(coin).angle === 0));
  } finally { f.close(); }
});

test('hidden browser tabs pause at the current angle and reduced motion cancels demos cleanly', () => {
  const f = fixture('visibility');
  try {
    f.reveal([0, 1]); f.tick(0); f.tick(500);
    const before = f.motions.get(f.coins[0]).angle;
    f.visibility('hidden'); f.tick(10000); assert.equal(f.frames.size, 0); assert.equal(f.motions.get(f.coins[0]).angle, before);
    f.visibility('visible'); f.tick(11000); assert.equal(f.motions.get(f.coins[0]).angle, before);
    f.tick(11200); assert.notEqual(f.motions.get(f.coins[0]).angle, before);
    f.reduced(true); assert.equal(f.frames.size, 0); assert.equal(f.motions.get(f.coins[0]).angle, 0);
    f.reveal([2, 3, 4, 5]); assert.equal(f.frames.size, 0);
  } finally { f.close(); }
});

test('manual takeover preserves the exact angle, cancels only that demo and resumes the remaining logos after release', () => {
  const f = fixture('takeover');
  try {
    f.reveal([0, 1]); f.tick(0); f.tick(500);
    const own = f.motions.get(f.coins[0]), other = f.motions.get(f.coins[1]);
    const from = own.angle, otherFrom = other.angle;
    f.controller.pause(); f.busy(true); f.tick(2000);
    assert.equal(own.angle, from); assert.equal(other.angle, otherFrom); assert.equal(f.frames.size, 0);
    assert.equal(f.controller.takeover(f.coins[0]), true); assert.equal(own.angle, from);
    own.angle = from + 30; own.rotor.style.transform = `rotateY(${own.angle}deg)`;
    f.busy(false); f.pointerUp(); f.tick(3000);
    assert.equal(own.angle, from + 30, 'demo must not overwrite manual rotation'); assert.equal(other.angle, otherFrom);
    f.tick(6000); assert.equal(other.angle, 0); assert.equal(own.angle, from + 30);
    f.reveal([0]); assert.equal(f.frames.size, 0);
  } finally { f.close(); }
});

test('only loaded real logos are eligible; delayed image loading wakes the visible demos', () => {
  const f = fixture('loading', { loaded: false });
  try {
    f.reveal([0, 1, 2]); assert.equal(f.frames.size, 0);
    f.coins[0].image.complete = true; f.coins[0].image.naturalWidth = 200;
    f.coins[1].image.complete = true; f.coins[1].image.naturalWidth = 200; f.coins[1].dataset.logoFailed = 'true';
    f.root.dispatchEvent(new Event('load')); f.tick(0); f.tick(500);
    assert.ok(f.motions.get(f.coins[0]).angle > 0); assert.equal(f.histories.get(f.coins[1]).length, 0); assert.equal(f.histories.get(f.coins[2]).length, 0);
    f.visibility('hidden'); f.reveal([3, 4, 5]); assert.equal(f.frames.size, 0);
  } finally { f.close(); }
});

test('an interrupted demo is not lost on remount before its first visible movement', () => {
  const f = fixture('interrupted-before-motion');
  try {
    f.reveal([0]); f.tick(0);
    assert.equal(f.motions.get(f.coins[0]).angle, 0);
    f.remount(); f.reveal([0]);
    assert.ok(f.frames.size > 0, 'a zero-degree frame must not consume the only visible demonstration');
    f.tick(1000); f.tick(1500);
    assert.ok(f.motions.get(f.coins[0]).angle > 0);
  } finally { f.close(); }
});

test('a reload/remount starts a fresh turn and ignores old session completion flags', () => {
  const f = fixture('reload', { stored: { completed: ['reload-0'], pending: { 'reload-1': { elapsed: 980, delay: 300, duration: 1900, target: -360 } } } });
  try {
    f.reveal([0, 1]); f.tick(0); f.tick(800);
    assert.ok(f.motions.get(f.coins[0]).angle > 0);
    f.remount(); f.reveal([0, 1]);
    assert.equal(f.motions.get(f.coins[0]).angle, 0);
    f.tick(9000); assert.equal(f.motions.get(f.coins[0]).angle, 0);
    f.tick(9500); assert.ok(f.motions.get(f.coins[0]).angle > 0);
    f.tick(12000); assert.equal(f.frames.size, 0);
    assert.deepEqual(JSON.parse(f.saved.get(LEGACY_DEMO_KEY)).completed, ['reload-0'], 'legacy session storage is neither read nor rewritten');
  } finally { f.close(); }
});

test('Back from browser cache starts another visit; scroll and tab switching do not replay a completed turn', () => {
  const f = fixture('back');
  try {
    f.reveal([0, 1]); f.tick(0); f.tick(3000); assert.equal(f.frames.size, 0);
    f.reveal([]); f.reveal([0, 1]); f.visibility('hidden'); f.visibility('visible'); f.pageShow();
    assert.equal(f.frames.size, 0, 'scrolling, tab switching and ordinary initial pageshow retain the same visit');
    f.pageHide(); f.pageShow(true);
    assert.equal(f.frames.size, 0, 'restored logos wait for fresh visibility after scroll restoration');
    f.reveal([0, 1]); assert.equal(f.frames.size, 2);
    f.tick(4000); f.tick(4500);
    assert.ok(f.motions.get(f.coins[0]).angle > 0);
    assert.ok(f.coins.slice(2).every(coin => !f.histories.get(coin).some(entry => entry.value)));
    f.tick(7000); assert.equal(f.frames.size, 0);
  } finally { f.close(); }
});

test('late cached-page events stay paused; Back resets interrupted gestures and preserves reduced motion', () => {
  const f = fixture('cached');
  try {
    f.reveal([0]); f.tick(0); f.tick(800);
    const before = f.motions.get(f.coins[0]).angle;
    f.controller.pause(); f.motions.get(f.coins[0]).gesture = { id: 1 };
    f.pageHide(); f.visibility('visible'); f.pointerUp(); f.root.dispatchEvent(new Event('load'));
    f.tick(9000); assert.equal(f.frames.size, 0); assert.equal(f.motions.get(f.coins[0]).angle, before);
    f.pageShow(true); assert.equal(f.motions.get(f.coins[0]).gesture, null); assert.equal(f.motions.get(f.coins[0]).angle, 0);
    f.reveal([0]); f.tick(10000); f.tick(10500); assert.ok(f.motions.get(f.coins[0]).angle > 0);
    f.pageHide(); f.reduced(true); f.pageShow(true); f.reveal([0, 1, 2, 3, 4, 5]);
    assert.equal(f.frames.size, 0); assert.ok(f.coins.every(coin => f.motions.get(coin).angle === 0));
  } finally { f.close(); }
});
