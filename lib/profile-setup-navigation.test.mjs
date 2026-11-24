import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {createTranslator} from 'next-intl';
import {START_QUICK_START_DRAFT, createQuickStartIntentData, validateQuickStartDraft} from './quick-start-flow.ts';

const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../components/ProfileSetupWizard.tsx', import.meta.url), 'utf8');
const syntax = ts.createSourceFile('ProfileSetupWizard.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const compiled = ts.transpileModule(`${source}\nexport {ProfileSetupContent};`, {
  compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX},
}).outputText;
const libraries = {};
for (const statement of syntax.statements) {
  if (!ts.isImportDeclaration(statement) || statement.importClause?.isTypeOnly) continue;
  const name = statement.moduleSpecifier.text;
  if (name.startsWith('@/lib/') && !['use-setup-analytics', 'use-form-router', 'use-form-draft', 'use-exclusive-profile-art', 'compressImage'].includes(name.split('/').at(-1))) {
    libraries[name] = await import(new URL(`../${name.slice(2)}.ts`, import.meta.url));
  }
}

function draft(patch = {}) {
  return {...structuredClone(START_QUICK_START_DRAFT), welcomeAcknowledged: true, name: 'Fixture member',
    step: 'intro', intents: ['crew'], activeIntent: 'crew', personCity: 'Köln, Nordrhein-Westfalen', personCountry: 'DE',
    talentIntro: 'Preserve this introduction', profileAvatarUrl: '', showInHomeCrew: false,
    sections: {crew: {...createQuickStartIntentData(), departmentIds: ['kamera'], roles: [{departmentId: 'kamera', role: 'A-Kamera Operator'}]}},
    requestKeys: {company: '10000000-0000-4000-8000-000000000001'}, ...patch};
}

/** Actual wizard state, validation and event handlers; no real accounts or writes.
 * Unrelated child editors stay opaque, while PlaceField is tested separately. */
async function fixture(initial, {handler, locale = 'de'} = {}) {
  const slots = [], timers = new Map(), writes = [], payloads = [], focused = [], frames = [], observations = [];
  let cursor = 0, timerId = 0, dirty = true, tree, effects = [], saved = structuredClone(initial);
  const equal = (a, b) => a?.length === b.length && b.every((value, index) => Object.is(value, a[index]));
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = {value: typeof initial === 'function' ? initial() : initial};
      return [slots[index].value, value => { slots[index].value = typeof value === 'function' ? value(slots[index].value) : value; dirty = true; }];
    },
    useRef(initial) { const index = cursor++; return slots[index] ??= {current: initial}; },
    useMemo(run, deps) { const index = cursor++; if (!slots[index] || !equal(slots[index].deps, deps)) slots[index] = {deps, value: run()}; return slots[index].value; },
    useCallback(callback, deps) { return react.useMemo(() => callback, deps); },
    useEffect(run, deps) {
      const index = cursor++, previous = slots[index];
      if (!previous || !equal(previous.deps, deps)) { slots[index] = {deps, cleanup: previous?.cleanup}; effects.push(() => {previous?.cleanup?.(); slots[index].cleanup = run();}); }
    },
  };
  const messages = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8'));
  const translators = new Map();
  const translate = namespace => { if (!translators.has(namespace)) translators.set(namespace, createTranslator({locale, messages, namespace, onError(error) {throw error;}})); return translators.get(namespace); };
  const router = {replace() {throw Error('Unexpected navigation outside setup');}};
  const params = new URLSearchParams('welcome=1');
  const user = {id: 'fixture-account', fullName: 'Fixture member'};
  const art = {props: {}, suggest() {throw Error('Existing drafts must not generate images');}};
  const deps = {...libraries, react, 'react/jsx-runtime': require('react/jsx-runtime'),
    'next-intl': {useLocale: () => locale, useTranslations: translate},
    'next/navigation': {useSearchParams: () => params},
    '@clerk/nextjs': {useUser: () => ({user})},
    '@/lib/use-form-router': {useFormRouter: () => router},
    '@/lib/use-setup-analytics': {useSetupAnalytics: context => event => observations.push({event, ...context})},
    '@/lib/use-form-draft': {useExistingDraftProtection: () => ({complete() {}})},
    '@/lib/use-exclusive-profile-art': {useExclusiveProfileArt: () => art, useProfileArtSaveRequest: () => () => {throw Error('No publication in navigation fixture');}},
    '@/lib/compressImage': {compressImage() {throw Error('No upload in navigation fixture');}},
  };
  for (const statement of syntax.statements) {
    if (!ts.isImportDeclaration(statement) || statement.importClause?.isTypeOnly) continue;
    const name = statement.moduleSpecifier.text;
    if (name.startsWith('@/components/') || name === 'next/link' || name === 'lucide-react') {
      deps[name] = {__esModule: true, default: name.split('/').at(-1)};
      for (const binding of statement.importClause?.namedBindings?.elements ?? []) deps[name][binding.propertyName?.text ?? binding.name.text] = binding.name.text === 'focusResponsiblePerson' ? () => {} : binding.name.text;
    }
  }
  const walk = node => node == null || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(walk) : [node, ...walk(node.props?.children)];
  const text = node => node == null || typeof node === 'boolean' ? '' : typeof node === 'string' || typeof node === 'number' ? String(node) : Array.isArray(node) ? node.map(text).join(' ') : text(node.props?.children);
  const document = {getElementById(id) {
    const present = walk(tree).some(node => node.props?.id === id || node.type === 'PlaceField' && `${node.props.id}-country` === id);
    return present ? {scrollIntoView() {}, focus() {focused.push(id);}} : null;
  }, querySelector: () => null};
  const fetch = async (url, options) => {
    const custom = await handler?.(url, options); if (custom) return custom;
    if (url === '/api/profile' && !options?.method) return Response.json({exists: false, profile: null});
    if (url === '/api/user-settings' && !options?.method) return Response.json({settings: {show_in_home_crew: false}});
    assert.equal(url, '/api/onboarding', 'No unrelated endpoint should run');
    if (!options?.method) return Response.json({draft: {intent: 'crew', setupComplete: false, quickStart: saved}});
    assert.equal(options.method, 'PUT');
    const payload = JSON.parse(options.body); writes.push(payload.quickStart); payloads.push(payload);
    const issue = payload.quickStart.step === 'review' ? validateQuickStartDraft(payload.quickStart, {requirePrimary: false, translate: translate()}) : null;
    if (issue) return Response.json({error: issue.message}, {status: 400});
    saved = payload.quickStart; return Response.json({saved: true});
  };
  deps["@/lib/setup-fetch"] = {fetchSetup: (url, options) => libraries["@/lib/setup-fetch"].fetchSetup(url, options, fetch)};
  const mod = {exports: {}};
  new Function('require', 'module', 'exports', 'fetch', 'window', 'document', 'requestAnimationFrame', 'setTimeout', 'clearTimeout', compiled)(name => {
    assert.ok(Object.hasOwn(deps, name), `Uncontrolled dependency: ${name}`); return deps[name];
  }, mod, mod.exports, fetch, {scrollTo() {}}, document, run => frames.push(run), run => {timers.set(++timerId, run); return timerId;}, id => timers.delete(id));
  function render() {
    let cycles = 0;
    do { assert.ok(++cycles < 30, 'Wizard effects must settle'); cursor = 0; dirty = false; tree = mod.exports.ProfileSetupContent(); const pending = effects; effects = []; pending.forEach(run => run()); } while (dirty);
    frames.splice(0).forEach(run => run());
  }
  async function settle() { for (let i = 0; i < 24; i++) {await Promise.resolve(); if (dirty) render();} }
  render(); await settle();
  return {
    writes, payloads, focused, observations, render, settle,
    choices: () => walk(tree).filter(node => node.type === 'input' && node.props.type === 'radio').map(node => node.props.value),
    draft: () => slots.find(slot => slot.value?.version === 3 && slot.value?.step)?.value,
    nextDisabled: () => walk(tree).find(node => node.type === "button" && text(node).trim() === translate("setup")("copy102"))?.props.disabled,
    place: () => walk(tree).find(node => node.type === 'PlaceField'),
    alerts: () => walk(tree).filter(node => node.props?.role === 'alert').map(text),
    async next() { const button = walk(tree).find(node => node.type === 'button' && text(node).trim() === translate('setup')('copy102')); assert.ok(button, 'Next is available'); await button.props.onClick(); await settle(); },
    async finish() { const button = walk(tree).find(node => node.type === 'button' && text(node).trim() === translate('setup')('publishProfile')); assert.ok(button, 'Finish is available'); await button.props.onClick(); await settle(); },
    cleanup() {slots.forEach(slot => slot?.cleanup?.()); timers.clear();},
  };
}

test('step five returns an incomplete saved draft to its missing city instead of repeating an unfixable warning', async () => {
  const f = await fixture(draft({personCity: ''}));
  try {
    await f.next();
    assert.equal(f.draft().step, 'location');
    assert.equal(f.writes.length, 0, 'Reject locally before sending an invalid review snapshot');
    assert.ok(f.alerts().length);
    assert.deepEqual(f.focused, ['quick-start-person-city']);
    const place = f.place();
    place.props.onChange('Köln, Nordrhein-Westfalen, DE', 'geonames:2886242'); f.render();
    assert.deepEqual(f.alerts(), [], 'Editing the relevant field clears the old warning');
    await f.next(); await f.next(); await f.next();
    assert.equal(f.draft().step, 'review');
    assert.equal(f.writes.at(-1).personPlaceCityId, 'geonames:2886242');
    assert.equal(f.draft().talentIntro, 'Preserve this introduction');
    assert.equal(f.draft().requestKeys.company, '10000000-0000-4000-8000-000000000001');
    assert.equal(f.draft().showInHomeCrew, false);
  } finally {f.cleanup();}
});

test('finishing a recovered draft explains and focuses a missing main occupation', async () => {
  const roles = ['Filmtonmeister*in', 'Musik Mischtonmeister*in', 'Re-Recording Mixer', 'Tonmeister / Sound Mixer'].map(role => ({departmentId: 'ton', role}));
  const f = await fixture(draft({step: 'review', primaryOccupation: null, additionalOccupation: null,
    sections: {crew: {...createQuickStartIntentData(), departmentIds: ['ton'], roles}}}));
  try {
    await f.finish();
    assert.equal(f.draft().step, 'review');
    assert.ok(f.alerts().some(message => message.includes('Haupttätigkeit')));
    assert.ok(f.alerts().every(message => !message.includes('occupation.')));
    assert.deepEqual(f.focused, ['quick-start-primary-occupation']);
    assert.equal(f.draft().sections.crew.roles.length, 4);
    assert.equal(f.writes.length, 0, 'Validation must not publish or overwrite the recovered draft');
  } finally {f.cleanup();}
});

test('the selected Crew path cannot leave the location step without a city', async () => {
  const f = await fixture(draft({step: 'location', personCity: ''}));
  try {await f.next(); assert.equal(f.draft().step, 'location'); assert.equal(f.writes.length, 0); assert.ok(f.alerts().length);}
  finally {f.cleanup();}
});

test('a missing country is focused in the real composite place field and other draft contents survive', async () => {
  const f = await fixture(draft({personCountry: ''}));
  try {await f.next(); assert.equal(f.draft().step, 'location'); assert.deepEqual(f.focused, ['quick-start-person-city-country']); assert.equal(f.draft().personCity, 'Köln, Nordrhein-Westfalen');}
  finally {f.cleanup();}
});

test('older location-first drafts choose a goal without losing entered location or introduction', async () => {
  const f = await fixture(draft({step: 'location', intents: [], activeIntent: null}));
  try {assert.equal(f.draft().step, 'goals'); assert.equal(f.draft().personCity, 'Köln, Nordrhein-Westfalen'); assert.equal(f.draft().talentIntro, 'Preserve this introduction');}
  finally {f.cleanup();}
});

test('new setup chooses the goal before the location so the city requirement is active', async () => {
  const f = await fixture(draft({step: 'name', intents: [], activeIntent: null, personCity: ''}));
  try {await f.next(); assert.equal(f.draft().step, 'goals'); assert.equal(f.writes.at(-1).step, 'goals');}
  finally {f.cleanup();}
});

test('search-only users can reach review without a personal location or provider creation', async () => {
  const f = await fixture(draft({intents: ['search'], activeIntent: 'search', sections: {}, personCity: '', personCountry: ''}));
  try {await f.next(); assert.equal(f.draft().step, 'review'); assert.equal(f.writes.at(-1).step, 'review');}
  finally {f.cleanup();}
});

test('company drafts with a missing business location return to the company fields without publishing anything', async () => {
  const f = await fixture(draft({intents: ['company'], activeIntent: 'company', personCity: '', sections: {company: {...createQuickStartIntentData(), title: 'Fixture company', city: '', categoryIds: ['filmproduktion']}}}));
  try {
    await f.next(); assert.equal(f.draft().step, 'details'); assert.equal(f.draft().activeIntent, 'company');
    assert.equal(f.draft().sections.company.title, 'Fixture company'); assert.equal(f.writes.length, 0);
    assert.deepEqual(f.focused, ['quick-start-company-city']);
  } finally {f.cleanup();}
});

for (const intent of ['company','equipment','location','crew','talent','search']) test(`${intent}: a disconnected name save stays visible, preserves inputs and allows Next again`,async()=>{
 let names=0;
 const original=draft({step:'name',intents:[intent],activeIntent:intent,accountPerson:{firstName:'Own',lastName:'Member'}});
 const f=await fixture(original,{handler:async(url)=>{if(url==='/api/responsible-person'){if(++names===1)throw new TypeError('Failed to fetch');return Response.json({saved:true});}}});
 try {await f.next();assert.equal(f.draft().step,'name');assert.equal(f.nextDisabled(),false);assert.equal(f.draft().name,original.name);assert.ok(f.alerts().some(x=>x.includes('gespeichert')));assert.ok(f.alerts().every(x=>!x.includes('TypeError')));await f.next();assert.equal(f.draft().step,'goals');assert.equal(names,2);assert.deepEqual(f.alerts(),[]);}
 finally{f.cleanup();}
});

test('malformed recovery replies cannot start an empty draft or overwrite saved inputs',async()=>{
 const f=await fixture(draft(),{handler:url=>url==='/api/onboarding'?new Response('{broken') : null});
 try{assert.equal(f.writes.length,0);assert.ok(f.alerts().length);assert.notEqual(f.draft().name,'Fixture member');}
 finally{f.cleanup();}
});


for (const locale of ['de','en','es','it','cs','hu','nl','nl-BE','sv','fr','pl','pt-PT','zh-Hans','ja','ko','ru','uk']) {
 test(`${locale}: a new member sees only the five active paths and can reach goal selection`, async () => {
  const f = await fixture(draft({step: 'name', intents: [], activeIntent: null}), {locale});
  try {
   await f.next();
   assert.equal(f.draft().step, 'goals');
   assert.deepEqual(f.choices(), ['crew','talent','location','equipment','company']);
   assert.equal(f.payloads.at(-1).intent, null);
   assert.deepEqual(f.alerts(), []);
  } finally {f.cleanup();}
 });
}

test('an existing saved search selection remains selected and can continue', async () => {
 const f = await fixture(draft({step: 'goals', intents: ['search'], activeIntent: 'search', sections: {}, personCity: ''}));
 try {
  assert.ok(f.choices().includes('search'));
  assert.deepEqual(f.draft().intents, ['search']);
  await f.next();
  assert.equal(f.draft().step, 'location');
  assert.equal(f.payloads.at(-1).intent, 'search');
  assert.deepEqual(f.alerts(), []);
 } finally {f.cleanup();}
});
