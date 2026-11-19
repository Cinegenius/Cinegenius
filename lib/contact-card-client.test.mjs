import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {translatorFor} from './i18n-test-fixture.mjs';
import {taxonomyLabel} from './departments.ts';

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
function fixture({locale = 'de', role = 'Kamera', occupationForm = 'standard', handler = async () => true, pending = false, error = '', cardProps = {}} = {}) {
  let cursor = 0, dirty = true, disposed = false, writesAfterDispose = 0, tree;
  const slots = [], effects = [], calls = [];
  const contact = {friendship_id: 'friendship-1', user_id: 'member+with?query', display_name: 'Alexandra Beispiel', avatar_url: null, role, occupationForm};
  const mocks = {
    react: {
      useState(initial) {const index = cursor++; slots[index] ??= {value: initial}; return [slots[index].value, value => {if (disposed) writesAfterDispose++; if (!Object.is(slots[index].value, value)) {slots[index].value = value; dirty = true;}}];},
      useRef(initial) {const index = cursor++; slots[index] ??= {current: initial}; return slots[index];},
      useEffect(callback, deps) {const index = cursor++; if (!slots[index]) {slots[index] = {deps}; effects.push(() => {slots[index].cleanup = callback();});}},
    },
    'react/jsx-runtime': require('react/jsx-runtime'),
    'next/link': {default: 'a'},
    'next-intl': {useTranslations: namespace => translatorFor(locale, namespace)},
    'lucide-react': {Loader2: 'spinner-icon', MessageSquare: 'message-icon', Star: 'star-icon'},
    '@/lib/departments': {taxonomyLabel},
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
      tree = mod.exports.default({contact, pending, error, ...cardProps, onRemove: id => {calls.push(id); return handler(id);}});
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

for(const locale of ["de","en","es","it","cs","hu","nl","nl-BE","sv","fr","pl","pt-PT","zh-Hans","ja","ko","ru","uk"]) test(`contact occupations use shared reader labels in ${locale} without changing a contact`,()=>{
 for(const role of ["Gaffer (Oberbeleuchter)","Oberbeleuchterin","Own custom profession"]){
  const f=fixture({locale,role}),before=JSON.stringify(f.contact),expected=taxonomyLabel(role,translatorFor(locale));
  assert.ok(elements(f.tree,node=>node.type==="p"&&node.props.children===expected).length,locale+" / "+role);
  assert.equal(JSON.stringify(f.contact),before);assert.deepEqual(f.calls,[]);f.dispose();
 }
});

for(const form of ['standard','masculine','feminine','neutral'])test(`contact card honors the displayed person's ${form} occupation preference`,()=>{
 const f=fixture({role:'Gaffer (Oberbeleuchter)',occupationForm:form});
 const label=taxonomyLabel('Gaffer (Oberbeleuchter)',translatorFor('de'),form);
 assert.ok(elements(f.tree,node=>node.type==='p'&&node.props.children===label).length);
 if(form==='feminine'){assert.match(label,/Oberbeleuchterin/);assert.doesNotMatch(label,/\*/);}
 assert.deepEqual(f.calls,[]);f.dispose();
});


test('optional Homies star uses the caller callback and leaves ordinary contact cards unchanged',()=>{
 const ordinary=fixture();assert.equal(elements(ordinary.tree,n=>n.type==='button'&&n.props['aria-pressed']!==undefined).length,0);ordinary.dispose();
 for(const locale of ['de','en','es','it','cs','hu','nl','nl-BE','sv','fr','pl','pt-PT','zh-Hans','ja','ko','ru','uk']){
  let invoked=0;const f=fixture({locale,cardProps:{favorite:true,onFavorite:()=>invoked++}});const button=elements(f.tree,n=>n.type==='button'&&n.props['aria-pressed']===true)[0];
  assert.ok(button,locale);assert.equal(button.props['aria-label'],translatorFor(locale,'Contacts')('removeHomie',{name:f.contact.display_name}));assert.equal(button.props.disabled,false);button.props.onClick();assert.equal(invoked,1);assert.deepEqual(f.calls,[]);f.dispose();
 }
});
test('favorite capability cannot enable a disabled action, and hidden profiles keep direct messaging',()=>{
 const f=fixture({cardProps:{favorite:false,favoriteDisabled:true,onFavorite(){},contact:{friendship_id:'friendship-1',user_id:'hidden',display_name:'Member',avatar_url:null,role:'',profile_visible:false}}});
 const button=elements(f.tree,n=>n.type==='button'&&n.props['aria-pressed']===false)[0];assert.equal(button.props.disabled,true);
 const links=elements(f.tree,n=>n.type==='a');assert.equal(links.length,1);assert.equal(links[0].props.href,'/messages?to=hidden');assert.deepEqual(f.calls,[]);f.dispose();
});
