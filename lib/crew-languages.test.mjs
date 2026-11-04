import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCrewLanguages, matchesCrewLanguage, crewLanguageLabel } from './crew-languages.ts';
test('combines exact aliases and splits legacy lists', () => {
 assert.deepEqual(normalizeCrewLanguages(['Deutsch, Englisch', 'English', 'Español', 'Deutschland']), ['de','en','es']);
 assert.equal(matchesCrewLanguage(['Deutsch, Englisch'], 'en'), true);
 assert.equal(matchesCrewLanguage(['English'], 'Englisch'), true);
 assert.equal(matchesCrewLanguage(['Deutschland'], 'de'), false);
});
test('preserves uncommon languages and handles missing data', () => {
 assert.deepEqual(normalizeCrewLanguages(['Bisaya','bisaya']), ['custom:bisaya']);
 assert.equal(matchesCrewLanguage(['Bisaya'], 'custom:bisaya'), true);
 assert.deepEqual(normalizeCrewLanguages(null), []);
 assert.deepEqual(normalizeCrewLanguages(['n/a', 'Deutschland']), []);
 assert.equal(crewLanguageLabel('Deutsch', 'en'), 'German');
});
test('labels and matching work across all supported locales', () => {
 for(const locale of ['de','en','es','it','cs','hu']) {
  for(const id of ['de','en','es','fr']) {
   const label = crewLanguageLabel(id,locale);
   assert.notEqual(label,id);
   assert.equal(matchesCrewLanguage([label],id),true);
  }
 }
});
