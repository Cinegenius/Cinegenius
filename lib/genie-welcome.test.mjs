import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { translatorFor } from './i18n-test-fixture.mjs';

const require = createRequire(import.meta.url);
const source = ts.transpileModule(readFileSync(new URL('../components/GenieWelcome.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function elements(value, predicate, result = []) {
  if (Array.isArray(value)) value.forEach(child => elements(child, predicate, result));
  else if (value?.props) {
    if (predicate(value)) result.push(value);
    elements(value.props.children, predicate, result);
  }
  return result;
}

function fixture({ scope = 'own-session', path = '/dashboard', locale = 'de', storage = new Map(), blocked = false, enabled = true } = {}) {
  let cursor = 0, dirty = true, tree, timerId = 0, opens = 0, dismissals = 0, writesAfterDispose = 0, disposed = false, dialogOpen = false;
  const slots = [], effects = [], timers = new Map(), listeners = new Map();
  const document = {
    visibilityState: 'visible', activeElement: null,
    querySelector(selector) { assert.equal(selector, 'dialog[open]'); return dialogOpen ? { open: true } : null; },
    addEventListener(name, callback) { listeners.set(name, callback); },
    removeEventListener(name) { listeners.delete(name); },
  };
  const window = {
    setTimeout(callback, delay) { timers.set(++timerId, { callback, delay }); return timerId; },
    clearTimeout(id) { timers.delete(id); },
    sessionStorage: {
      getItem(key) { if (blocked) throw Error('Storage blocked'); return storage.get(key) ?? null; },
      setItem(key, value) { if (blocked) throw Error('Storage blocked'); storage.set(key, value); },
    },
  };
  const mocks = {
    react: {
      useState(initial) {
        const index = cursor++;
        slots[index] ??= { value: initial };
        return [slots[index].value, value => {
          if (disposed) writesAfterDispose++;
          if (!Object.is(slots[index].value, value)) { slots[index].value = value; dirty = true; }
        }];
      },
      useEffect(callback, deps) {
        const index = cursor++, previous = slots[index];
        if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
          slots[index] = { deps, cleanup: previous?.cleanup };
          effects.push(() => { previous?.cleanup?.(); slots[index].cleanup = callback(); });
        }
      },
    },
    'react/jsx-runtime': require('react/jsx-runtime'),
    'next/navigation': { usePathname: () => path },
    'next-intl': { useTranslations: namespace => translatorFor(locale, namespace) },
    'lucide-react': { X: () => null },
    './Genie.module.css': { default: new Proxy({}, { get: (_, key) => String(key) }) },
  };
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', 'window', 'document', 'fetch', source)(
    name => { assert.ok(Object.hasOwn(mocks, name), `Unexpected welcome import: ${name}`); return mocks[name]; },
    mod, mod.exports, window, document, () => assert.fail('A welcome must never send an AI or data request'),
  );
  function render() {
    for (let pass = 0; pass < 10 && dirty; pass++) {
      cursor = 0; dirty = false;
      tree = mod.exports.default({ memoryScope: scope, enabled, onOpen: () => opens++, onDismiss: () => dismissals++ });
      effects.splice(0).forEach(effect => effect());
    }
    assert.equal(dirty, false);
    return tree;
  }
  render();
  return {
    storage, timers, listeners,
    get tree() { return tree; }, get opens() { return opens; }, get dismissals() { return dismissals; },
    get writesAfterDispose() { return writesAfterDispose; },
    advance(delay) {
      for (const [id, timer] of [...timers]) if (timer.delay === delay) { timers.delete(id); timer.callback(); }
      render();
    },
    path(value) { path = value; dirty = true; render(); },
    enabled(value) { enabled = value; dirty = true; render(); },
    dialog(value) { dialogOpen = value; listeners.get('focusin')?.(); render(); },
    editable(value) {
      document.activeElement = value ? { isContentEditable: true, closest: () => null } : null;
      listeners.get(value ? 'focusin' : 'focusout')?.(); render();
    },
    busy(value) {
      document.activeElement = value ? { closest(selector) { assert.ok(selector.includes('input')); return this; } } : null;
      listeners.get(value ? 'focusin' : 'focusout')?.(); render();
    },
    hidden(value) { document.visibilityState = value ? 'hidden' : 'visible'; listeners.get('visibilitychange')?.(); render(); },
    hover(value) { tree.props[value ? 'onMouseEnter' : 'onMouseLeave'](); render(); },
    focus(value) {
      if (value) tree.props.onFocusCapture();
      else tree.props.onBlurCapture({ currentTarget: { contains: () => false }, relatedTarget: null });
      render();
    },
    escape({ composing = false } = {}) {
      let prevented = false, stopped = false;
      tree.props.onKeyDown({ key: 'Escape', nativeEvent: { isComposing: composing }, preventDefault() { prevented = true; }, stopPropagation() { stopped = true; } });
      render(); return { prevented, stopped };
    },
    click(key) {
      const button = elements(tree, node => node.type === 'button' && (node.props['aria-label'] === translatorFor(locale, 'Genie')(key) || node.props.children === translatorFor(locale, 'Genie')(key)))[0];
      assert.ok(button); button.props.onClick(); render();
    },
    dispose() { disposed = true; slots.forEach(slot => slot?.cleanup?.()); },
  };
}

test('a signed-in welcome is delayed, opens no chat automatically and expires without moving focus', () => {
  const f = fixture(); assert.equal(f.tree, null);
  f.advance(1500); assert.equal(f.tree.type, 'aside'); assert.equal(f.opens, 0);
  f.advance(8000); assert.equal(f.tree, null); assert.equal(f.dismissals, 0); f.dispose();
});

test('the same session does not welcome again on navigation or reload; a new session does', () => {
  const storage = new Map(), f = fixture({ storage }); f.advance(1500); f.click('dismissWelcome');
  assert.equal(f.dismissals, 1); f.path('/creators'); f.advance(1500); assert.equal(f.tree, null); f.dispose();
  const restored = fixture({ storage }); restored.advance(1500); assert.equal(restored.tree, null); restored.dispose();
  const other = fixture({ storage, scope: 'new-session' }); other.advance(1500); assert.ok(other.tree); other.dispose();
});

test('guests, auth/setup routes and an unavailable launcher do not greet or write a seen marker', () => {
  for (const options of [{ scope: null }, { path: '/sign-in' }, { path: '/sign-up/verify' }, { path: '/profile-setup' }, { enabled: false }]) {
    const f = fixture(options); f.advance(1500); assert.equal(f.tree, null); assert.equal(f.storage.size, 0); assert.equal(f.opens, 0); f.dispose();
  }
});

test('typing or an inactive tab delays the welcome; starting input dismisses it without reading values', () => {
  const f = fixture(); f.busy(true); f.advance(1500); assert.equal(f.tree, null); assert.equal(f.storage.size, 0);
  f.busy(false); f.hidden(true); f.advance(1500); assert.equal(f.tree, null); assert.equal(f.storage.size, 0);
  f.hidden(false); f.advance(1500); assert.ok(f.tree);
  f.busy(true); assert.equal(f.tree, null); f.busy(false); f.advance(1500); assert.equal(f.tree, null); f.dispose();
});

test('an open native dialog blocks a welcome even while focus remains outside it', () => {
  const f = fixture(); f.dialog(true); f.advance(1500);
  assert.equal(f.tree, null); assert.equal(f.storage.size, 0); assert.equal(f.opens, 0);
  f.dialog(false); f.advance(1500); assert.ok(f.tree);
  f.dialog(true); assert.equal(f.tree, null, 'opening a dialog interrupts an existing announcement');
  f.dialog(false); f.advance(1500); assert.equal(f.tree, null); f.dispose();
});

test('native content-editable state delays the welcome for empty, plaintext-only and inherited editors', () => {
  const f = fixture(); f.editable(true); f.advance(1500);
  assert.equal(f.tree, null); assert.equal(f.storage.size, 0);
  f.editable(false); f.advance(1500); assert.ok(f.tree);
  f.editable(true); assert.equal(f.tree, null); assert.equal(f.dismissals, 0); f.dispose();
});

test('temporarily disabling an announcement discards it without focus changes or reopening it', () => {
  const f = fixture(); f.advance(1500); assert.ok(f.tree);
  f.enabled(false); assert.equal(f.tree, null);
  f.enabled(true); assert.equal(f.tree, null, 'returning before the expiry deadline must not revive it');
  f.advance(1500); f.advance(8000); assert.equal(f.tree, null);
  assert.equal(f.opens, 0); assert.equal(f.dismissals, 0); f.dispose();
});

test('hover pauses auto-dismiss and the explicit chat action is the only action that opens it', () => {
  const f = fixture(); f.advance(1500); f.hover(true); f.advance(8000); assert.ok(f.tree);
  f.hover(false); f.click('open'); assert.equal(f.opens, 1); assert.equal(f.tree, null); f.dispose();
});

test('keyboard focus pauses dismissal and Escape returns focus without opening the chat', () => {
  const f = fixture(); f.advance(1500); f.focus(true); f.advance(8000); assert.ok(f.tree);
  assert.deepEqual(f.escape({ composing: true }), { prevented: false, stopped: false }); assert.ok(f.tree);
  assert.deepEqual(f.escape(), { prevented: true, stopped: true }); assert.equal(f.tree, null);
  assert.equal(f.dismissals, 1); assert.equal(f.opens, 0); f.dispose();
  const blurred = fixture(); blurred.advance(1500); blurred.focus(true); blurred.focus(false); blurred.advance(8000);
  assert.equal(blurred.tree, null); assert.equal(blurred.dismissals, 0); blurred.dispose();
});

test('dismantling a visible welcome cancels expiry and a new page does not greet the same session again', () => {
  const storage = new Map(), page = fixture({ storage }); page.advance(1500); assert.ok(page.tree);
  page.dispose(); assert.equal(page.timers.size, 0); assert.equal(page.listeners.size, 0); assert.equal(page.writesAfterDispose, 0);
  const nextPage = fixture({ storage, path: '/creators' }); nextPage.advance(1500); assert.equal(nextPage.tree, null); nextPage.dispose();
});

test('blocked storage still deduplicates while mounted and unmount cancels pending announcements', () => {
  const f = fixture({ blocked: true }); f.advance(1500); f.click('dismissWelcome'); f.path('/jobs'); f.advance(1500); assert.equal(f.tree, null); f.dispose();
  const pending = fixture(); pending.dispose(); assert.equal(pending.timers.size, 0); assert.equal(pending.listeners.size, 0); pending.advance(1500); assert.equal(pending.writesAfterDispose, 0);
});

for (const locale of ['de', 'en', 'es', 'it', 'cs', 'hu', 'nl', 'nl-BE', 'sv']) test(`welcome and controls use the active catalogue: ${locale}`, () => {
  const f = fixture({ locale }); f.advance(1500);
  assert.equal(f.tree.props['aria-label'], translatorFor(locale, 'Genie')('assistantLabel'));
  assert.equal(elements(f.tree, node => node.props.role === 'status')[0].props.children, translatorFor(locale, 'Genie')('greeting'));
  f.click('dismissWelcome'); assert.equal(f.tree, null); f.dispose();
});
