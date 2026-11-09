import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { renderToStaticMarkup } from 'react-dom/server';
import { createTranslator } from 'next-intl';
import * as core from './places/core.ts';

const require = createRequire(import.meta.url);
const source = ts.transpileModule(readFileSync(new URL('../components/PlaceField.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const regions = [
  { id: 'DE:geonames:2861876', name: 'Nordrhein-Westfalen', en: 'North Rhine-Westphalia', aliases: ['Nordrhein-Westfalen', 'North Rhine-Westphalia'] },
  { id: 'DE:geonames:2951839', name: 'Bayern', en: 'Bavaria', aliases: ['Bayern', 'Bavaria'] },
  { id: 'DE:geonames:2950157', name: 'Berlin', en: 'Berlin', aliases: ['Berlin'] },
  { id: 'DE:geonames:2911297', name: 'Hamburg', en: 'Hamburg', aliases: ['Hamburg'] },
];
const cities = [
  { id: 'geonames:2886242', country: 'DE', name: 'Köln', en: 'Cologne', canonicalName: 'Köln', aliases: ['Köln', 'Koeln', 'Cologne'], regionId: regions[0].id, district: 'Regierungsbezirk Köln' },
  { id: 'geonames:2950159', country: 'DE', name: 'Berlin', en: 'Berlin', canonicalName: 'Berlin', aliases: ['Berlin'], regionId: regions[2].id },
  { id: 'geonames:2911298', country: 'DE', name: 'Hamburg', en: 'Hamburg', canonicalName: 'Hamburg', aliases: ['Hamburg'], regionId: regions[3].id },
  { id: 'geonames:2656954', country: 'GB', name: 'Ashford', en: 'Ashford', canonicalName: 'Ashford', aliases: ['Ashford'], regionId: 'GB:geonames:6269131', district: 'Surrey' },
  { id: 'geonames:2656955', country: 'GB', name: 'Ashford', en: 'Ashford', canonicalName: 'Ashford', aliases: ['Ashford'], regionId: 'GB:geonames:6269131', district: 'Kent' },
];
function responseFor(url) {
  const params = new URL(url, 'https://own-fixture.invalid').searchParams, locale = params.get('locale') ?? 'de';
  if (params.has('resolve')) {
    const city = params.get('resolve').split(',')[0].trim();
    return { city: ['bayern', 'bavaria'].includes(core.placeKey(city)) ? '' : city, regionId: ['bayern', 'bavaria'].includes(core.placeKey(city)) ? regions[1].id : null };
  }
  const country = params.get('country'), regionId = params.get('region'), query = core.placeKey(params.get('q') ?? '');
  const regionRows = country === 'DE' ? regions : country === 'GB' ? [{ id: 'GB:geonames:6269131', name: 'England', en: 'England', aliases: ['England'] }] : [];
  return {
    regions: regionRows.map(region => ({ id: region.id, name: locale === 'en' ? region.en : region.name, aliases: region.aliases })),
    cities: query.length < 2 ? [] : cities.filter(city => city.country === country && (!regionId || regionId === city.regionId) && city.aliases.some(alias => core.placeKey(alias).includes(query))).map(city => ({
      ...city, name: locale === 'en' ? city.en : city.name, region: regionRows.find(region => region.id === city.regionId)?.[locale === 'en' ? 'en' : 'name'] ?? '',
    })),
  };
}
function fixture({ value = ', , DE', selectedCityId = '', controlled = true, deferred = false } = {}) {
  const slots = [], timers = new Map(), changes = [], selections = [], requests = [];
  let cursor = 0, timerId = 0, dirty = true, tree, locale = 'de', queuedEffects = [];
  let props = { id: 'own-place', value, ...(controlled ? { selectedCityId } : {}), required: true };
  const same = (a, b) => a?.length === b.length && b.every((value, i) => Object.is(value, a[i]));
  const react = {
    useId: () => 'own-place-generated',
    useState: initial => {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, value => { const next = typeof value === 'function' ? value(slots[index].value) : value; if (!Object.is(next, slots[index].value)) { slots[index].value = next; dirty = true; } }];
    },
    useRef: initial => { const index = cursor++; if (!(index in slots)) slots[index] = { current: initial }; return slots[index]; },
    useMemo: (run, deps) => { const index = cursor++; if (!slots[index] || !same(slots[index].deps, deps)) slots[index] = { deps, value: run() }; return slots[index].value; },
    useEffect: (run, deps) => {
      const index = cursor++, previous = slots[index];
      if (!previous || !same(previous.deps, deps)) { slots[index] = { deps, cleanup: previous?.cleanup }; queuedEffects.push(() => { previous?.cleanup?.(); slots[index].cleanup = run(); }); }
    },
  };
  const messages = Object.fromEntries(['de', 'en', 'es', 'it', 'cs', 'hu'].map(language => [language, JSON.parse(readFileSync(new URL(`../messages/${language}.json`, import.meta.url), 'utf8'))]));
  const deps = { react, 'next-intl': { useLocale: () => locale, useTranslations: () => createTranslator({ locale, messages: messages[locale], namespace: 'Places' }) }, '@/lib/places/core': core, '@/lib/places/countries': require('./places/countries.ts') };
  const mod = { exports: {} };
  const fetch = (url, options) => {
    const request = { url, options }; requests.push(request);
    if (deferred) return new Promise((resolve, reject) => { request.resolve = () => resolve({ ok: true, json: async () => responseFor(url) }); request.reject = reject; });
    return Promise.resolve({ ok: true, json: async () => responseFor(url) });
  };
  new Function('require', 'module', 'exports', 'fetch', 'setTimeout', 'clearTimeout', source)(name => deps[name] ?? require(name), mod, mod.exports, fetch, run => { const id = ++timerId; timers.set(id, run); return id; }, id => timers.delete(id));
  props.onChange = (raw, id) => { changes.push({ value: raw, id }); props = { ...props, value: raw, ...(controlled ? { selectedCityId: id ?? '' } : {}) }; dirty = true; };
  props.onSelection = id => selections.push(id);
  function render() {
    let cycles = 0;
    do {
      assert.ok(++cycles < 30, 'component should settle without an effect loop');
      cursor = 0; dirty = false; tree = mod.exports.default(props);
      const effects = queuedEffects; queuedEffects = []; effects.forEach(run => run());
    } while (dirty);
    return tree;
  }
  function walk(predicate, element) {
    if (!element || typeof element !== 'object') return [];
    if (Array.isArray(element)) return element.flatMap(child => walk(predicate, child));
    return [...(predicate(element) ? [element] : []), ...walk(predicate, element.props?.children)];
  }
  const all = predicate => walk(predicate, render());
  const city = () => all(node => node.props?.role === 'combobox')[0];
  const options = () => all(node => node.props?.role === 'option');
  const markup = () => renderToStaticMarkup(render());
  async function flush() { for (let i = 0; i < 8; i++) await Promise.resolve(); render(); }
  async function settle() {
    for (let i = 0; i < 8; i++) { render(); if (!timers.size) { await flush(); if (!timers.size) return; } const jobs = [...timers.values()]; timers.clear(); jobs.forEach(run => run()); await flush(); }
    assert.fail('component should finish bounded fetch effects');
  }
  function key(name, composing = false) {
    const event = { key: name, nativeEvent: { isComposing: composing }, prevented: false, stopped: false, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; } };
    city().props.onKeyDown(event); render(); return event;
  }
  render();
  return {
    render, all, city, options, markup, changes, selections, requests, settle, flush, key,
    get props() { return props; },
    input(value) { city().props.onChange({ target: { value } }); render(); },
    focus() { city().props.onFocus(); render(); },
    changeLocale(value) { locale = value; dirty = true; render(); },
    async respond(index) { requests[index].resolve(); await flush(); },
    cleanup() { slots.forEach(slot => slot?.cleanup?.()); timers.clear(); },
  };
}

test('rendered city combobox selects an explicit ID, confirms it, closes suggestions and clears the ID on manual editing', async () => {
  const f = fixture();
  try {
    assert.match(f.markup(), /role="combobox"/); assert.match(f.markup(), /placeholder="Stadt oder Gemeinde suchen"/);
    f.input('Cologne'); await f.settle();
    assert.equal(f.city().props['aria-expanded'], true); assert.equal(f.options().length, 1);
    assert.match(f.markup(), /role="listbox"/);
    f.options()[0].props.onClick(); f.render();
    assert.equal(f.changes.at(-1).id, 'geonames:2886242'); assert.deepEqual(f.selections, ['geonames:2886242']);
    assert.equal(f.city().props['aria-expanded'], false); assert.equal(f.options().length, 0);
    assert.match(f.markup(), /Ausgewählter Ort: Köln/);
    await f.settle(); assert.equal(f.options().length, 0);
    f.input('Köl'); assert.equal(f.changes.at(-1).id, undefined); assert.equal(f.props.selectedCityId, '');
    assert.doesNotMatch(f.markup(), /Ausgewählter Ort:/);
    await f.settle(); assert.equal(f.options().length, 1); assert.equal(f.props.selectedCityId, '');
  } finally { f.cleanup(); }
});

test('keyboard arrows highlight separate homonyms and Enter selects only the highlighted identity', async () => {
  const f = fixture({ value: ', , GB' });
  try {
    f.input('Ashford'); await f.settle(); assert.equal(f.options().length, 2);
    const down = f.key('ArrowDown'); assert.equal(down.prevented, true);
    assert.equal(f.city().props['aria-activedescendant'], f.options()[0].props.id);
    f.key('ArrowDown'); assert.equal(f.options()[1].props['aria-selected'], true);
    f.key('ArrowUp'); assert.equal(f.options()[0].props['aria-selected'], true);
    f.key('ArrowDown'); const enter = f.key('Enter'); assert.equal(enter.prevented, true);
    assert.equal(f.props.selectedCityId, 'geonames:2656955'); assert.equal(f.options().length, 0);
    assert.match(f.markup(), /Ausgewählter Ort: Ashford/);
  } finally { f.cleanup(); }
});

test('Enter selects a single visible suggestion, Escape only dismisses suggestions, and IME input is not submitted', async () => {
  const f = fixture();
  try {
    f.input('Cologne'); await f.settle(); const before = f.props.value;
    const escape = f.key('Escape'); assert.equal(escape.prevented, true); assert.equal(escape.stopped, true);
    assert.equal(f.options().length, 0); assert.equal(f.props.value, before); assert.equal(f.props.selectedCityId, '');
    assert.equal(f.key('Enter').prevented, false); assert.equal(f.props.selectedCityId, '');
    f.key('ArrowDown'); assert.equal(f.options().length, 1);
    f.key('Enter', true); assert.equal(f.props.selectedCityId, '');
    f.key('Enter'); assert.equal(f.props.selectedCityId, 'geonames:2886242');
    await f.settle(); f.key('ArrowDown');
    assert.equal(f.key('Tab').prevented, false); assert.equal(f.options().length, 0); assert.equal(f.props.selectedCityId, 'geonames:2886242');
  } finally { f.cleanup(); }
});

test('Bavaria typed as a city offers a region correction that retains the country and leaves city empty', async () => {
  const f = fixture();
  try {
    f.input('Bayern'); await f.settle(); assert.equal(f.city().props['aria-invalid'], true);
    assert.match(f.markup(), /Bayern ist eine Region/); assert.equal(f.props.selectedCityId, '');
    const button = f.all(node => node.type === 'button' && node.props.children === 'Als Region übernehmen')[0];
    assert.ok(button); button.props.onClick(); f.render(); await f.settle();
    assert.equal(f.props.value, ', Bayern, DE'); assert.equal(f.city().props.value, ''); assert.equal(f.props.selectedCityId, '');
    assert.equal(f.city().props['aria-invalid'], undefined); assert.doesNotMatch(f.markup(), /Bayern ist eine Region/);
  } finally { f.cleanup(); }
});

test('city states Berlin and Hamburg remain selectable cities, including with a conflicting selected region', async () => {
  for (const name of ['Berlin', 'Hamburg']) {
    const f = fixture();
    try {
      f.input(name); await f.settle(); assert.equal(f.city().props['aria-invalid'], undefined);
      assert.equal(f.options().length, 1); assert.doesNotMatch(f.markup(), /Als Region übernehmen/);
      f.key('Enter'); assert.equal(f.props.selectedCityId, name === 'Berlin' ? 'geonames:2950159' : 'geonames:2911298');
    } finally { f.cleanup(); }
    const conflicting = fixture({ value: ', Bayern, DE' });
    try { await conflicting.settle(); conflicting.input(name); await conflicting.settle(); assert.equal(conflicting.city().props['aria-invalid'], undefined); assert.doesNotMatch(conflicting.markup(), /Als Region übernehmen/); }
    finally { conflicting.cleanup(); }
  }
});

test('unknown international places remain manual and pending without generating a selected identity', async () => {
  const f = fixture({ value: ', , NZ' });
  try {
    f.input('Small village outside the catalogue'); await f.settle();
    assert.equal(f.options().length, 0); assert.equal(f.props.selectedCityId, ''); assert.equal(f.city().props['aria-invalid'], undefined);
    assert.match(f.markup(), /Keine passenden Vorschläge/); assert.match(f.markup(), /Bis zur Bestätigung/);
    assert.equal(f.key('Enter').prevented, false); assert.equal(f.changes.at(-1).id, undefined);
  } finally { f.cleanup(); }
});

test('a saved selection remains confirmed and localized across language changes without emitting a new value', async () => {
  const f = fixture({ value: 'Köln, Nordrhein-Westfalen, DE', selectedCityId: 'geonames:2886242' });
  try {
    await f.settle(); assert.equal(f.options().length, 0); assert.match(f.markup(), /Ausgewählter Ort: Köln/);
    const original = f.props.value; f.changeLocale('en'); await f.settle();
    assert.equal(f.city().props.value, 'Cologne'); assert.match(f.markup(), /Selected place: Cologne/);
    assert.equal(f.props.value, original); assert.equal(f.props.selectedCityId, 'geonames:2886242'); assert.deepEqual(f.changes, []);
  } finally { f.cleanup(); }
});

test('an older-language fetch response cannot replace the current localized selected place', async () => {
  const f = fixture({ value: 'Cologne, , DE', selectedCityId: 'geonames:2886242', deferred: true });
  try {
    await f.settle(); assert.equal(f.requests.length, 1);
    f.changeLocale('en'); await f.settle(); assert.equal(f.requests.length, 2); assert.equal(f.requests[0].options.signal.aborted, true);
    await f.respond(1); assert.equal(f.city().props.value, 'Cologne');
    await f.respond(0); assert.equal(f.city().props.value, 'Cologne'); assert.match(f.markup(), /Selected place: Cologne/); assert.deepEqual(f.changes, []);
  } finally { f.cleanup(); }
});

test('callers without the optional selection prop still retain their explicit clicked choice', async () => {
  const f = fixture({ controlled: false });
  try { f.input('Cologne'); await f.settle(); f.key('Enter'); await f.settle(); assert.match(f.markup(), /Ausgewählter Ort: Köln/); assert.equal(f.options().length, 0); }
  finally { f.cleanup(); }
});

test('a failed suggestion request preserves manual input and never claims an explicit selection', async () => {
  const f = fixture({ deferred: true });
  try {
    f.input('Unlisted village'); await f.settle();
    f.requests[0].reject(Error('own fixture network failure')); await f.flush();
    assert.equal(f.city().props.value, 'Unlisted village'); assert.equal(f.props.selectedCityId, '');
    assert.match(f.markup(), /Vorschläge derzeit nicht verfügbar/); assert.doesNotMatch(f.markup(), /Ausgewählter Ort:/);
    f.input('Another village'); assert.equal(f.changes.at(-1).id, undefined);
  } finally { f.cleanup(); }
});
