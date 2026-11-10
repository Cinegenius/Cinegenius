import test from 'node:test';
import assert from 'node:assert/strict';
import {locationRoomLabel} from './location-rooms.ts';
import {translatorFor} from './i18n-test-fixture.mjs';

const kitchens = {
  de: ['Küche', 'Teeküche', 'Profiküche'],
  en: ['Kitchen', 'Kitchenette', 'Professional kitchen'],
  es: ['Cocina', 'Cocina auxiliar', 'Cocina profesional'],
  it: ['Cucina', 'Angolo cucina', 'Cucina professionale'],
  cs: ['Kuchyně', 'Kuchyňka', 'Profesionální kuchyně'],
  hu: ['Konyha', 'Teakonyha', 'Professzionális konyha'],
  nl: ['Keuken', 'Kitchenette', 'Professionele keuken'],
  'nl-BE': ['Keuken', 'Kitchenette', 'Professionele keuken'],
  sv: ['Kök', 'Pentry', 'Professionellt kök'],
};

for (const [locale, labels] of Object.entries(kitchens)) {
  test(`${locale}: one stored room ID uses the correct category-specific native label`, () => {
    const translate = translatorFor(locale);
    assert.deepEqual(['Wohnen', 'Büro', 'Gastronomie'].map(category =>
      locationRoomLabel('kitchen_room', category, translate)), labels);
    for (const unknown of ['private_custom_room', 'My own room', '__proto__']) {
      assert.equal(locationRoomLabel(unknown, 'Wohnen', translate), unknown);
    }
    assert.equal(locationRoomLabel('kitchen_room', 'Unknown category', translate), 'kitchen_room');
    assert.equal(locationRoomLabel('kitchen_room', '__proto__', translate), 'kitchen_room');
  });
}
