import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { translatorFor } from './i18n-test-fixture.mjs';
import * as catalog from './marketplaceCategories.ts';
import * as search from './marketplace-category-search.ts';

const require = createRequire(import.meta.url), jsx = require('react/jsx-runtime');
const code = ts.transpileModule(readFileSync(new URL('../components/MarketplaceCategoryNavigation.tsx', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const nodes = (tree, predicate) => {
  const out = [];
  function walk(node) { if (Array.isArray(node)) node.forEach(walk); else if (node && typeof node === 'object' && node.props) { if (predicate(node)) out.push(node); walk(node.props.children); } }
  walk(tree); return out;
};
const text = node => node == null || typeof node === 'boolean' ? '' : Array.isArray(node) ? node.map(text).join(' ') : typeof node === 'object' ? text(node.props?.children) : String(node);

// Real component handlers and translators; this deliberately makes no claim about DOM layout.
function fixture(locale = 'de', selection = { department: null, subcategory: '' }) {
  let cursor = 0, slots = [], tree;
  const changes = [];
  const hooks = { useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial; return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }]; }, useMemo: callback => callback() };
  const mocks = { react: hooks, 'react/jsx-runtime': jsx, 'next-intl': { useLocale: () => locale, useTranslations: namespace => translatorFor(locale, namespace) }, 'lucide-react': new Proxy({}, { get: () => 'svg' }), '@/lib/marketplaceCategories': catalog, '@/lib/marketplace-category-search': search };
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => { assert.ok(Object.hasOwn(mocks, name), name); return mocks[name]; }, mod, mod.exports);
  const props = { ...selection, onChange: (...choice) => changes.push(choice) };
  const render = () => { cursor = 0; tree = mod.exports.default(props); return tree; };
  const find = predicate => nodes(tree, predicate);
  render(); return { render, find, changes, t: translatorFor(locale, 'MarketplaceNavigation') };
}

for (const locale of ['de', 'en', 'es', 'it', 'cs', 'hu', 'nl', 'nl-BE', 'sv']) {
  test(locale + ': all categories remain reachable and direct alias choice returns one canonical path', () => {
    const f = fixture(locale);
    f.find(node => node.type === 'button' && text(node).trim() === f.t('allCategories'))[0].props.onClick(); f.render();
    f.find(node => node.type === 'button' && text(node) === f.t('showAll'))[0].props.onClick(); f.render();
    const choiceButtons = f.find(node => node.type === 'button' && node.props.className?.includes('focus-visible:outline-gold'));
    assert.equal(choiceButtons.length, catalog.DEPARTMENTS.length);
    for (const button of choiceButtons) button.props.onClick();
    assert.deepEqual(new Set(f.changes.map(choice => choice[0])), new Set(catalog.DEPARTMENTS.map(row => row.id)));
    f.find(node => node.type === 'input')[0].props.onChange({ target: { value: 'Sofa' } }); f.render();
    const results = f.find(node => node.type === 'button' && node.props.className?.includes('focus-visible:outline-gold'));
    assert.equal(results.length, 1); results[0].props.onClick();
    assert.deepEqual(f.changes.at(-1), ['requisiten', 'requisiten-moebel']);
  });
}

test('a chosen subcategory stays visible while changing or removing its parent uses explicit handlers', () => {
  const f = fixture('de', { department: 'licht', subcategory: 'licht-signal' });
  assert.ok(f.find(node => node.props['aria-current'] === 'page').length);
  assert.equal(f.find(node => node.type === 'input').length, 0);
  f.find(node => node.type === 'button' && text(node) === f.t('change'))[0].props.onClick(); f.render();
  assert.equal(f.find(node => node.type === 'input').length, 1);
  f.find(node => node.type === 'button' && text(node).trim() === f.t('allCategories'))[0].props.onClick();
  assert.deepEqual(f.changes.at(-1), [null]);
});
