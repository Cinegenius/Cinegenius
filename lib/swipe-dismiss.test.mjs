import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const code = ts.transpileModule(readFileSync(new URL('./use-swipe-dismiss.ts', import.meta.url), 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
}).outputText;

// Run the actual hook against a controlled touch host; real scrolling is also
// checked in Chromium. These cases cover cancellation and form protection.
function fixture({enabled = true, reduced = false} = {}) {
  const listeners = new Map(), frames = new Map(), effects = [], animations = [];
  let closed = 0, nextFrame = 0;
  class Element {
    parentElement = null; scrollTop = 0; interactive = false; handle = false;
    constructor(parent, values = {}) { this.parentElement = parent; Object.assign(this, values); }
    closest(selector) { return (selector.includes('data-swipe') ? this.handle : this.interactive) ? this : this.parentElement?.closest(selector); }
  }
  const surface = new Element(null, {
    style: {transform: '', willChange: ''},
    contains(target) { for (let node = target; node; node = node.parentElement) if (node === this) return true; return false; },
    getBoundingClientRect: () => ({top: 200}),
    addEventListener(name, callback) { listeners.set(name, callback); },
    removeEventListener(name) { listeners.delete(name); },
    animate(keyframes, options) { const animation = {keyframes, options, canceled: false, onfinish: null, cancel() { this.canceled = true; }}; animations.push(animation); return animation; },
  });
  const header = new Element(surface, {handle: true}), content = new Element(surface), text = new Element(content), input = new Element(content, {interactive: true});
  const mod = {exports: {}};
  new Function('require', 'module', 'exports', 'window', 'Element', 'requestAnimationFrame', 'cancelAnimationFrame', code)(
    name => { assert.equal(name, 'react'); return {useRef: current => ({current}), useLayoutEffect: callback => callback(), useEffect: callback => effects.push(callback)}; },
    mod, mod.exports, {innerHeight: 844, matchMedia: () => ({matches: reduced})}, Element,
    callback => { frames.set(++nextFrame, callback); return nextFrame; }, id => frames.delete(id),
  );
  mod.exports.useSwipeDismiss({current: surface}, enabled, () => { closed++; });
  const cleanups = effects.map(effect => effect());
  const touch = (y, x = 20, identifier = 1) => ({clientX: x, clientY: y, identifier});
  function dispatch(name, {target = header, y = 20, x = 20, cancelable = true, touches, changedTouches} = {}) {
    let prevented = false;
    const point = touch(y, x);
    listeners.get(name)?.({target, cancelable, touches: touches ?? (name === 'touchend' ? [] : [point]), changedTouches: changedTouches ?? [point], preventDefault() { prevented = true; }});
    return prevented;
  }
  return {
    surface, header, content, text, input, listeners, frames, animations, touch, dispatch,
    get closed() { return closed; },
    flush() { for (const [id, callback] of frames) { frames.delete(id); callback(); } },
    finish() { animations.at(-1)?.onfinish?.(); },
    dispose() { cleanups.forEach(cleanup => cleanup?.()); },
  };
}

test('a deliberate downward swipe follows the finger and closes only after release animation', () => {
  const f = fixture(); f.dispatch('touchstart');
  assert.equal(f.dispatch('touchmove', {y: 130}), true); f.flush();
  assert.equal(f.surface.style.transform, 'translateY(110px)'); assert.equal(f.closed, 0);
  f.dispatch('touchend', {y: 130}); assert.equal(f.closed, 0);
  f.finish(); assert.equal(f.closed, 1); f.dispose(); assert.equal(f.listeners.size, 0);
});

test('small drags, reversals and touch cancellation return to the existing position', () => {
  for (const mode of ['short', 'reversed', 'cancel']) {
    const f = fixture(); f.dispatch('touchstart'); f.dispatch('touchmove', {y: mode === 'short' ? 50 : 150});
    if (mode === 'reversed') f.dispatch('touchmove', {y: 30});
    f.flush(); f.dispatch(mode === 'cancel' ? 'touchcancel' : 'touchend'); f.finish();
    assert.equal(f.closed, 0); assert.equal(f.surface.style.transform, ''); f.dispose();
  }
});

test('upward and horizontal gestures stay native even if later redirected downwards', () => {
  for (const point of [{y: 0}, {x: 100, y: 30}]) {
    const f = fixture(); f.dispatch('touchstart');
    assert.equal(f.dispatch('touchmove', point), false);
    assert.equal(f.dispatch('touchmove', {y: 180}), false);
    f.dispatch('touchend'); assert.equal(f.animations.length, 0); assert.equal(f.closed, 0); f.dispose();
  }
});

test('scrolled content and nested lists retain their scroll gesture all the way to the top', () => {
  const f = fixture(); f.content.scrollTop = 100; f.dispatch('touchstart', {target: f.text});
  f.content.scrollTop = 0;
  assert.equal(f.dispatch('touchmove', {y: 180, target: f.text}), false);
  f.dispatch('touchend'); assert.equal(f.closed, 0); assert.equal(f.animations.length, 0);
  f.dispatch('touchstart', {target: f.text}); assert.equal(f.dispatch('touchmove', {y: 180}), true);
  f.dispatch('touchend'); f.finish(); assert.equal(f.closed, 1); f.dispose();
});

test('headers remain draggable while the content is scrolled; form fields never dismiss', () => {
  const f = fixture(); f.content.scrollTop = 200;
  f.dispatch('touchstart', {target: f.input}); assert.equal(f.dispatch('touchmove', {y: 180}), false);
  f.dispatch('touchend'); assert.equal(f.closed, 0);
  f.dispatch('touchstart'); f.dispatch('touchmove', {y: 180}); f.dispatch('touchend'); f.finish();
  assert.equal(f.closed, 1); f.dispose();
});

test('pinching and a browser-owned noncancelable gesture cannot dismiss the window', () => {
  for (const interruption of [{touches: [{identifier: 1}, {identifier: 2}]}, {cancelable: false}]) {
    const f = fixture(); f.dispatch('touchstart'); f.dispatch('touchmove', {y: 180});
    f.dispatch('touchmove', {y: 190, ...interruption}); f.finish();
    f.dispatch('touchend'); assert.equal(f.closed, 0); f.dispose();
  }
});

test('disabled dialogs attach no listeners and reduced motion closes without animation', () => {
  const off = fixture({enabled: false}); assert.equal(off.listeners.size, 0); off.dispose();
  const f = fixture({reduced: true}); f.dispatch('touchstart'); f.dispatch('touchmove', {y: 180}); f.dispatch('touchend');
  assert.equal(f.animations.length, 0); assert.equal(f.closed, 1); f.dispose();
});

test('movement uses one pending frame; unmount cancels frames and late animation callbacks', () => {
  const f = fixture(); f.dispatch('touchstart');
  for (let y = 40; y <= 180; y += 10) f.dispatch('touchmove', {y});
  assert.equal(f.frames.size, 1); f.dispatch('touchend'); const animation = f.animations.at(-1);
  f.dispose(); assert.equal(f.frames.size, 0); assert.equal(animation.canceled, true);
  assert.equal(animation.onfinish, null); assert.equal(f.surface.style.transform, ''); assert.equal(f.closed, 0);
});
