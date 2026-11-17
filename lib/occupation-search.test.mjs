import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { occupationSearchValues } from './occupation-search.ts';
import { departments, getDepartmentRoleSearchTerms } from './departments.ts';
import { normalizeOccupation } from './gripTaxonomy.ts';

const json = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const taxonomy = json('./i18n/taxonomy-index.json');
const at = (object,key) => key.split('.').reduce((value,part) => value?.[part],object);
const locales = ['de','en','es','it','cs','hu','nl','nl-BE','sv','fr','pl','pt-PT','zh-Hans','ja','ko','ru','uk'];
const entries = departments.flatMap(department => department.roles.map(role => ({
  department,role,key:taxonomy[department.id].roles[role],
  values:getDepartmentRoleSearchTerms(department,role),
})));
const canonicalKeys = new Set(entries.map(entry => normalizeOccupation(entry.role)));
const allowedValues = new Set(entries.flatMap(entry => entry.values));

for (const locale of locales) {
  test(locale + ': current-language standard, masculine, feminine and neutral forms find canonical stored occupations', () => {
    const messages = json('../messages/' + locale + '.json').Taxonomy;
    const translate = key => at(messages,key);
    let checked = 0;
    for (const entry of entries) {
      const formKey = entry.key.replace(/^roles\./,'roleForms.');
      for (const label of [translate(entry.key), ...['masculine','feminine','neutral'].map(form => translate(formKey + '.' + form))]) {
        const values = occupationSearchValues(label,locale,translate);
        // A literal stable title wins if a translated spelling coincides with it.
        if (!canonicalKeys.has(normalizeOccupation(label)) || normalizeOccupation(label) === normalizeOccupation(entry.role)) {
          assert.ok(values.includes(entry.role),locale + ':' + entry.role + ':' + label);
        }
        assert.equal(values.length,new Set(values).size);
        assert.ok(values.every(value => allowedValues.has(value)),label + ': only canonical titles/curated aliases');
        checked++;
      }
    }
    assert.equal(checked,962*4);
  });
}

test('canonical and exact legacy forms do not depend on the owner form or caller locale', () => {
  const messages=json('../messages/de.json').Taxonomy, translate=key=>at(messages,key);
  for (const value of ['Oberbeleuchterin','Oberbeleuchter','Best Girl Electric','Best Boy Electric','BestGirl']) {
    const matches=occupationSearchValues(value,'de',translate);
    assert.ok(matches.includes(value.includes('Best') ? 'Best Boy Electric' : 'Gaffer (Oberbeleuchter)'));
  }
  assert.ok(occupationSearchValues('Gaffer (Oberbeleuchter)','ja',()=>{throw new Error('Canonical title needs no translated scan');}).includes('Gaffer (Oberbeleuchter)'));
  for(const entry of entries) {
    assert.ok(occupationSearchValues(entry.role,'de',translate).includes(entry.role));
  }
});

test('exact matching preserves qualification and assistant boundaries, without Latin-only normalization', () => {
  const messages=json('../messages/de.json').Taxonomy, translate=key=>at(messages,key);
  const head='Gaffer (Oberbeleuchter)';
  for(const query of ['Oberbeleuchterin Assistentin','Oberbeleuchterin und Kamerafrau für meine Filme','einen Beruf gibt es nicht','', '!!!','私の専門職','医師しか知らない']) {
    assert.deepEqual(occupationSearchValues(query,'de',translate),[],query);
  }
  const assistant=occupationSearchValues('Lichtassistentin','de',translate);
  assert.ok(assistant.includes('Lichtassistent*in'));
  assert.ok(!assistant.includes(head));
  assert.ok(!occupationSearchValues('Best Girl Grip','de',translate).includes('Best Boy Electric'));
  assert.deepEqual(occupationSearchValues('Ärztin','de',translate),[], 'No invented medical qualification');
  assert.deepEqual(occupationSearchValues('Arzt','de',translate),[], 'No invented medical qualification');
  assert.deepEqual(occupationSearchValues('  OBERBELEUCHTERIN  ','de',translate),occupationSearchValues('Oberbeleuchterin','de',translate));
  assert.notEqual(normalizeOccupation('撮影監督'),normalizeOccupation('音響監督'));
});

test('cached lookup is isolated by translation function and locale, and returned arrays cannot poison it', () => {
  const messages=json('../messages/de.json').Taxonomy;
  const roleKey=taxonomy.licht.roles['Gaffer (Oberbeleuchter)'].replace(/^roles\./,'roleForms.')+'.feminine';
  let calls=0;
  const first=key=>{calls++;return key===roleKey?'Eindeutiger lokaler Prüfberuf':at(messages,key);};
  const second=key=>at(messages,key);
  const values=occupationSearchValues('Eindeutiger lokaler Prüfberuf','de',first);
  assert.ok(values.includes('Gaffer (Oberbeleuchter)'));
  const initialCalls=calls;
  values.push('Injected unrelated profession');
  assert.ok(!occupationSearchValues('Eindeutiger lokaler Prüfberuf','de',first).includes('Injected unrelated profession'));
  assert.equal(calls,initialCalls,'Same translator+locale reuses its index');
  assert.deepEqual(occupationSearchValues('Eindeutiger lokaler Prüfberuf','de',second),[]);
  occupationSearchValues('Eindeutiger lokaler Prüfberuf','en',first);
  assert.ok(calls>initialCalls,'Another locale never reuses a locale-only result');
});
