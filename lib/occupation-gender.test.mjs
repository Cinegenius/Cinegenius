import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { departments, getDepartmentRoleLabel, getDepartmentRoleSearchTerms, getOccupationSearchTerms, resolveDepartmentOccupation, resolveDepartmentRole, taxonomyLabel } from './departments.ts';
import { occupationCatalogue, occupationChoices, occupationReference, readPrimaryOccupation } from './primary-occupation.ts';

const json = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const catalog = json('../messages/de.json');
const taxonomy = json('./i18n/taxonomy-index.json');
const aliases = json('./i18n/occupation-aliases.de.json');
const at = (object, key) => key.split('.').reduce((value, bit) => value[bit], object);
const translate = key => at(catalog, key);
const tTaxonomy = key => at(catalog.Taxonomy, key);
const tAnimals = key => at(catalog.FilmAnimals, key);
const display = (departmentId, role) => getDepartmentRoleLabel(departmentId, role, 'de', departmentId === 'filmtiere-tiertraining' ? tAnimals : undefined, tTaxonomy);

test('all 962 existing roles in 25 departments retain their exact choice IDs and reviewed display', () => {
  assert.equal(departments.length, 25);
  assert.equal(occupationCatalogue.length, 962);
  assert.equal(new Set(occupationCatalogue.map(option => option.roleId)).size, 962);
  assert.deepEqual(Object.keys(aliases), departments.map(department => department.id));
  for (const department of departments) {
    assert.deepEqual(Object.keys(aliases[department.id]), department.roles, department.id);
    assert.deepEqual(Object.keys(taxonomy[department.id].roles), department.roles, department.id);
    for (const role of department.roles) {
      const expectedId = department.id + '/' + encodeURIComponent(role);
      const option = occupationCatalogue.find(item => item.roleId === expectedId);
      assert.ok(option, expectedId);
      assert.equal(option.label, role);
      assert.deepEqual(readPrimaryOccupation(occupationReference(option)), option);
      assert.equal(display(department.id, role), tTaxonomy(taxonomy[department.id].roles[role]), department.id + ': ' + role);
      assert.ok(!display(department.id, role).includes('*'), department.id + ': ' + role);
      assert.ok(!display(department.id, role).includes('/in'), department.id + ': ' + role);
    }
  }
});

const professionalForms = [
  ['produktion', 'Produzent/in', 'Produzent', 'Produzentin'],
  ['regie', 'Regisseur/in', 'Regisseur', 'Regisseurin'],
  ['kamera', 'EB Kameramann*frau', 'EB-Kameramann', 'EB-Kamerafrau'],
  ['licht', 'Gaffer (Oberbeleuchter)', 'Oberbeleuchter', 'Oberbeleuchterin'],
  ['grip', 'Dolly Grip / Dollyfahrer*in', 'Dollyfahrer', 'Dollyfahrerin'],
  ['ton', 'Filmtonmeister*in', 'Filmtonmeister', 'Filmtonmeisterin'],
  ['art', 'Stukkatuer*in', 'Stuckateur', 'Stuckateurin'],
  ['kostuem', 'Direktrice', 'Schnittmodelleur', 'Schnittdirektrice'],
  ['musik', 'Komponist*in', 'Komponist', 'Komponistin'],
  ['set-logistik', 'Dolmetscher*in', 'Dolmetscher', 'Dolmetscherin'],
  ['cast', 'Schauspieler', 'Schauspieler', 'Schauspielerin'],
  ['sfx', 'Waffenmeister', 'Waffenmeister', 'Waffenmeisterin'],
  ['broadcast', 'Produktionsingenieur*in', 'Produktionsingenieur', 'Produktionsingenieurin'],
  ['redaktion', 'Chefredakteur*in', 'Chefredakteur', 'Chefredakteurin'],
  ['social', 'Reels Videograf', 'Reels-Videograf', 'Reels-Videografin'],
  ['foto', 'Fotograf/in', 'Fotograf', 'Fotografin'],
  ['ki', 'KI-Animator/in', 'KI-Animator', 'KI-Animatorin'],
  ['drehbuch', 'Drehbuchautor*in', 'Drehbuchautor', 'Drehbuchautorin'],
  ['public-relations', 'Promotionkoordinator*in', 'Promotionkoordinator', 'Promotionkoordinatorin'],
  ['sicherheit-sanitaetsdienst', 'Rettungssanitäter/in', 'Rettungssanitäter', 'Rettungssanitäterin'],
  ['catering-setverpflegung', 'Setkoch / Setköchin', 'Setkoch', 'Setköchin'],
  ['filmtiere-tiertraining', 'Filmtiertrainer/in', 'Filmtiertrainer', 'Filmtiertrainerin'],
];
for (const [departmentId, canonical, masculine, feminine] of professionalForms) {
  test(departmentId + ': male and female forms share the existing role', () => {
    const department = departments.find(item => item.id === departmentId);
    const expectedId = departmentId + '/' + encodeURIComponent(canonical);
    const terms = getDepartmentRoleSearchTerms(department, canonical);
    for (const form of [masculine, feminine]) {
      assert.ok(terms.includes(form), form + ': search alias missing');
      assert.equal(resolveDepartmentRole(departmentId, form), canonical, form);
      assert.equal(display(departmentId, form), display(departmentId, canonical), form);
      assert.ok(occupationChoices([form]).some(option => option.roleId === expectedId), form);
      assert.ok(getOccupationSearchTerms(form).includes(canonical), form);
    }
  });
}

test('Best Boy/Girl aliases preserve Electric, Grip, Rigging and compact spelling', () => {
  for (const [departmentId, canonical, feminine] of [
    ['licht', 'Best Boy Electric', 'Best Girl Electric'],
    ['licht', 'Rigging Best Boy', 'Rigging Best Girl'],
    ['grip', 'Best Boy Grip / 2. Kamerabühne', 'Best Girl Grip'],
    ['grip', 'Rigging Best Boy Grip', 'Rigging Best Girl Grip'],
  ]) {
    assert.equal(resolveDepartmentRole(departmentId, feminine), canonical);
    assert.equal(display(departmentId, feminine), display(departmentId, canonical));
    assert.ok(display(departmentId, canonical).includes('Best Girl'));
  }
  assert.equal(resolveDepartmentRole('licht', 'BestGirl'), 'Best Boy Electric');
  assert.equal(resolveDepartmentOccupation('Rigging Best Boy')?.department.id, 'licht');
  assert.equal(taxonomyLabel('Rigging Best Boy', translate), display('licht', 'Rigging Best Boy'));
  assert.equal(resolveDepartmentRole('licht', 'Best Girl Grip'), undefined);
  assert.equal(resolveDepartmentRole('grip', 'Best Girl Electric'), undefined);
});

test('irregular professions retain role boundaries, including medical qualifications', () => {
  for (const form of ['Stuntman', 'Stuntwoman', 'Stuntmann', 'Stuntfrau']) assert.equal(resolveDepartmentRole('cast', form), 'Stunt Performer');
  for (const form of ['Arzt', 'Ärztin', 'Set-Ärztin']) assert.equal(resolveDepartmentOccupation(form), null);
  assert.equal(resolveDepartmentRole('sicherheit-sanitaetsdienst', 'Set-Arzt'), 'Set-Sanitäter/in / Set Medic', 'pre-existing legacy alias stays compatible');
  assert.equal(resolveDepartmentRole('licht', 'Oberbeleuchterin Assistentin'), undefined);
  assert.equal(resolveDepartmentRole('licht', 'Lichtassistentin'), 'Lichtassistent*in');
  assert.equal(display('virtual', 'Virtual Production Engineer'), 'Virtual Production Engineer');
  assert.ok(display('post', 'CG Software Entwickler*in').includes('Softwareentwicklerin'));
  assert.ok(display('maske', 'Chefmaskenbildner*in').includes('Chefmaskenbildnerin'));
});

test('new aliases cannot steal a literal role, guess a department or rewrite custom member text', () => {
  assert.ok(occupationChoices(['Boom Operator', 'Tonassistenz']).every(option => option.departmentId === 'ton'));
  assert.equal(taxonomyLabel('Oberbeleuchterin', translate), display('licht', 'Gaffer (Oberbeleuchter)'));
  for (const value of ['Regie', 'Drehbuch', 'Musik', 'Redaktion']) assert.equal(occupationChoices([value]).length, 0, value);
  for (const department of departments) assert.equal(taxonomyLabel(department.label, translate), tTaxonomy(taxonomy[department.id].label), department.label);
  for (const value of ['Mein eigener Beruf', 'Oberbeleuchterin und Kamerafrau für meine Filme', '私の専門職', 'Ärztin']) {
    assert.equal(taxonomyLabel(value, translate), value);
    assert.equal(resolveDepartmentOccupation(value), null);
  }
  assert.equal(resolveDepartmentOccupation('Playback Operator'), null);
});
