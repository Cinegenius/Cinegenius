import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {translatorFor} from './i18n-test-fixture.mjs';

const require = createRequire(import.meta.url);
const code = ts.transpileModule(readFileSync(new URL('../components/ContactCard.tsx', import.meta.url), 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX},
}).outputText;
const deferred = () => {let resolve; const promise = new Promise(done => {resolve = done;}); return {promise, resolve};};
function elements(node, match, result = []) {
  if (Array.isArray(node)) node.forEach(child => elements(child, match, result));
  else if (node?.props) {
    if (match(node)) result.push(node);
    elements(node.props.children, match, result); elements(node.props.footer, match, result);
  }
  return result;
}

// Real card handlers; native dialog layout, focus and history are browser checks.
function fixture({locale = 'de', handler = async () => true, pending = false, error = ''} = {}) {
  let cursor = 0, dirty = true, disposed = false, writesAfterDispose = 0, tree;
  const slots = [], effects = [], calls = [];
  const contact = {friendship_id: 'friendship-1', user_id: 'member+with?query', display_name: 'Alexandra Beispiel', avatar_url: null, role: 'Kamera'};
  const mocks = {
    react: {
      useState(initial) {const index = cursor++; slots[index] ??= {value: initial}; return [slots[index].value, value => {if (disposed) writesAfterDispose++; if (!Object.is(slots[index].value, value)) {slots[index].value = value; dirty = true;}}];},
      useRef(initial) {const index = cursor++; slots[index] ??= {current: initial}; return slots[index];},
      useEffect(callback, deps) {const index = cursor++; if (!slots[index]) {slots[index] = {deps}; effects.push(() => {slots[index].cleanup = callback();});}},
    },
    'react/jsx-runtime': require('react/jsx-runtime'),
    'next/link': {default: 'a'},
    'next-intl': {useTranslations: namespace => translatorFor(locale, namespace)},
    'lucide-react': {Loader2: 'spinner-icon', MessageSquare: 'message-icon'},
    './MediaImage': {default: 'media-image'},
    './messaging/MessagingDialog': {default: 'confirmation-dialog'},
  };
  const mod = {exports: {}};
  new Function('require', 'module', 'exports', 'fetch', code)(name => {
    assert.ok(Object.hasOwn(mocks, name), `Unexpected card dependency: ${name}`); return mocks[name];
  }, mod, mod.exports, () => assert.fail('The card must not independently send messages or mutate contacts'));
  function render() {
    for (let pass = 0; dirty && pass < 10; pass++) {
      dirty = false; cursor = 0;
      tree = mod.exports.default({contact, pending, error, onRemove: id => {calls.push(id); return handler(id);}});
      effects.splice(0).forEach(effect => effect());
    }
    assert.equal(dirty, false);
  }
  render();
  const dialog = () => elements(tree, node => node.type === 'confirmation-dialog')[0];
  return {
    contact, calls, render, dialog,
    get tree() {return tree;}, get writesAfterDispose() {return writesAfterDispose;},
    open() {elements(tree, node => node.type === 'button' && !!node.props['aria-label'])[0].props.onClick(); render();},
    close() {dialog().props.onClose(); render();},
    cancel() {elements(dialog().props.footer, node => node.type === 'button')[0].props.onClick(); render();},
    confirm() {elements(dialog().props.footer, node => node.type === 'button')[1].props.onClick(); render();},
    async settle() {await new Promise(resolve => setImmediate(resolve)); render();},
    dispose() {disposed = true; slots.forEach(slot => slot?.cleanup?.());},
  };
}

test('message action targets the selected person directly without sending or deleting', () => {
  const f = fixture(); const links = elements(f.tree, node => node.type === 'a');
  assert.equal(links[0].props.href, '/messages?to=member%2Bwith%3Fquery');
  assert.equal(links[1].props.href, '/profile/member%2Bwith%3Fquery');
  assert.deepEqual(f.calls, []); assert.equal(f.dialog().props.open, false); f.dispose();
});

test('opening, cancelling and dismissing the confirmation never remove a contact', () => {
  const f = fixture(); f.open(); assert.equal(f.dialog().props.open, true); assert.deepEqual(f.calls, []);
  f.cancel(); assert.equal(f.dialog().props.open, false); f.open(); f.close();
  assert.equal(f.dialog().props.open, false); assert.deepEqual(f.calls, []); f.dispose();
});

test('explicit confirmation removes exactly the selected contact, once even on double taps', async () => {
  const request = deferred(), f = fixture({handler: () => request.promise}); f.open(); f.confirm(); f.confirm(); f.close(); f.cancel();
  assert.deepEqual(f.calls, ['friendship-1']); assert.equal(f.dialog().props.open, true); assert.equal(f.dialog().props.busy, true);
  request.resolve(true); await f.settle(); assert.equal(f.dialog().props.open, false); f.dispose();
});

test('failed removal keeps the confirmation available with an error and supports retry', async () => {
  let attempt = 0; const f = fixture({handler: async () => ++attempt > 1, error: 'Controlled failure'});
  f.open(); f.confirm(); await f.settle(); assert.equal(f.dialog().props.open, true); assert.equal(f.dialog().props.busy, false);
  assert.equal(elements(f.tree, node => node.props.role === 'alert')[0].props.children, 'Controlled failure');
  f.confirm(); await f.settle(); assert.equal(f.calls.length, 2); assert.equal(f.dialog().props.open, false); f.dispose();
});

test('unexpected failures retain the contact and late replies cannot update an unmounted card', async () => {
  const failure = fixture({handler: async () => {throw new Error('Interrupted');}}); failure.open(); failure.confirm(); await failure.settle();
  assert.equal(failure.dialog().props.open, true); assert.equal(elements(failure.tree, node => node.props.role === 'alert').length, 1); failure.dispose();
  const request = deferred(), late = fixture({handler: () => request.promise}); late.open(); late.confirm(); late.dispose(); request.resolve(true); await late.settle(); assert.equal(late.writesAfterDispose, 0);
});

for (const locale of ['de', 'en', 'es', 'it', 'cs', 'hu', 'nl', 'nl-BE', 'sv']) test(`contact action labels and named confirmation use ${locale}`, () => {
  const f = fixture({locale}), t = translatorFor(locale, 'Contacts');
  const message = elements(f.tree, node => node.type === 'a')[0];
  assert.equal(message.props['aria-label'], t('messageLabel', {name: f.contact.display_name}));
  f.open(); assert.equal(elements(f.dialog().props.children, node => node.type === 'p')[0].props.children, t('confirmRemove', {name: f.contact.display_name}));
  f.cancel(); assert.deepEqual(f.calls, []); f.dispose();
});
