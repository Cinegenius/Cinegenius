import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const code = ts.transpileModule(readFileSync(new URL('../components/Genie.tsx', import.meta.url), 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX},
}).outputText;

// Exercise the actual launcher effect with a controlled pointer/viewport host.
// This verifies interaction rules; browser layout and native keyboards are separate checks.
function fixture() {
  const refs = [], effects = [], listeners = new Map(), viewportListeners = new Map(), frames = new Map();
  const styles = new Map(), attributes = new Map(), writes = [];
  let nextFrame = 0, closed = 0;
  const surface = {
    focus() {},
    style: {setProperty(key, value) {styles.set(key, value); writes.push([key, value]);}},
    toggleAttribute(key, value) {attributes.set(key, value); writes.push([key, value]);},
  };
  const viewport = {
    height: 844, offsetTop: 0,
    addEventListener(name, callback) {viewportListeners.set(name, callback);},
    removeEventListener(name) {viewportListeners.delete(name);},
  };
  const window = {
    innerHeight: 844, visualViewport: viewport,
    addEventListener(name, callback) {listeners.set(name, callback);},
    removeEventListener(name) {listeners.delete(name);},
    sessionStorage: {},
  };
  const mocks = {
    react: {
      useState: () => [true, value => {if (value === false) closed++;}],
      useRef: value => {const ref = {current: value}; refs.push(ref); return ref;},
      useId: () => 'fixture', useCallback: callback => callback,
      useEffect: callback => effects.push(callback), useSyncExternalStore: () => false,
    },
    'react/jsx-runtime': require('react/jsx-runtime'),
    'next/dynamic': {default: () => 'mock-panel'},
    'next/navigation': {usePathname: () => '/creators'},
    '@clerk/nextjs': {useSession: () => ({isLoaded: true, session: {id: 'fixture-session'}})},
    'next-intl': {useTranslations: () => key => key},
    'lucide-react': {X: () => null},
    '@/lib/genie-conversation': {clearConversation() {}, readConversation() {}},
    './Genie.module.css': {default: {}},
  };
  const mod = {exports: {}};
  new Function('require', 'module', 'exports', 'window', 'requestAnimationFrame', 'cancelAnimationFrame', code)(
    name => {assert.ok(Object.hasOwn(mocks, name), `Unexpected import: ${name}`); return mocks[name];},
    mod, mod.exports, window,
    callback => {const id = ++nextFrame; frames.set(id, callback); return id;},
    id => frames.delete(id),
  );
  const wrapper = mod.exports.default({});
  wrapper.type(wrapper.props);
  refs[1].current = surface;
  const cleanups = effects.map(callback => callback());
  return {
    styles, attributes, writes, frames, listeners, viewportListeners,
    get closed() {return closed;},
    pointer(name, {inside = false, ...values} = {}) {
      listeners.get(name)?.({isPrimary: true, button: 0, pointerId: 1, clientX: 20, clientY: 20,
        composedPath: () => inside ? [surface] : [{}], ...values});
    },
    click({inside = false, ...values} = {}) {
      listeners.get('click')?.({defaultPrevented: false, composedPath: () => inside ? [surface] : [{}], ...values});
    },
    resize(height, offsetTop = 0, event = 'resize') {
      Object.assign(viewport, {height, offsetTop}); viewportListeners.get(event)?.();
    },
    flush() {const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback());},
    dispose() {cleanups.forEach(cleanup => cleanup?.());},
  };
}

test('outside touch waits for a completed click; cancellation leaves chat open', () => {
  const ui = fixture();
  ui.pointer('pointerdown'); assert.equal(ui.closed, 0);
  ui.pointer('pointerup'); assert.equal(ui.closed, 0);
  ui.pointer('pointercancel'); ui.click(); assert.equal(ui.closed, 0);
  ui.dispose();
});

test('a confirmed outside tap closes exactly once', () => {
  const ui = fixture();
  ui.pointer('pointerdown'); ui.pointer('pointerup', {clientX: 23}); ui.click(); ui.click();
  assert.equal(ui.closed, 1); ui.dispose();
});

test('horizontal and vertical drags never dismiss the chat, including a return to start', () => {
  for (const movement of [{clientX: 70}, {clientY: 130}]) {
    const ui = fixture();
    ui.pointer('pointerdown'); ui.pointer('pointermove', movement);
    ui.pointer('pointerup'); ui.click();
    assert.equal(ui.closed, 0); ui.dispose();
  }
});

test('displacement on release, inside gestures and secondary presses do not dismiss', () => {
  for (const start of [{inside: true}, {isPrimary: false}, {button: 2}]) {
    const ui = fixture(); ui.pointer('pointerdown', start); ui.pointer('pointerup'); ui.click();
    assert.equal(ui.closed, 0); ui.dispose();
  }
  const ui = fixture(); ui.pointer('pointerdown'); ui.pointer('pointerup', {clientY: 70}); ui.click();
  assert.equal(ui.closed, 0); ui.dispose();
});

test('opening click and prevented outside click do not immediately dismiss the chat', () => {
  const ui = fixture(); ui.click();
  ui.pointer('pointerdown'); ui.pointer('pointerup'); ui.click({defaultPrevented: true});
  assert.equal(ui.closed, 0); ui.dispose();
});

test('keyboard viewport bursts share one frame and unchanged values do not rewrite styles', () => {
  const ui = fixture(); assert.equal(ui.writes.length, 3);
  ui.resize(700); ui.resize(500); ui.resize(420, 0, 'scroll');
  assert.equal(ui.frames.size, 1); assert.equal(ui.writes.length, 3);
  ui.flush();
  assert.equal(ui.styles.get('--genie-viewport-height'), '420px');
  assert.equal(ui.styles.get('--genie-keyboard-offset'), '424px');
  assert.equal(ui.attributes.get('data-compact'), true);
  const before = ui.writes.length;
  ui.resize(420); ui.resize(420, 0, 'scroll'); ui.flush(); assert.equal(ui.writes.length, before);
  ui.resize(420, 10); ui.flush(); assert.equal(ui.writes.length, before + 1);
  ui.dispose();
});

test('closing removes all listeners and cancels the pending viewport frame', () => {
  const ui = fixture(); ui.resize(400); assert.equal(ui.frames.size, 1);
  ui.dispose(); assert.equal(ui.frames.size, 0);
  assert.equal(ui.listeners.size, 0); assert.equal(ui.viewportListeners.size, 0);
});
