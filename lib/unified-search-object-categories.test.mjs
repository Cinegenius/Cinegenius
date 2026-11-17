import test from 'node:test';
import assert from 'node:assert/strict';
import { marketplaceSearchCategories } from './marketplaceCategories.ts';
import { wishMarketplaceCategories, wishSearchTerms, matchesWishPlaces } from './unified-search-matching.ts';
import { placeWriteFields } from './places/catalog.ts';
import { translatorFor } from './i18n-test-fixture.mjs';

const terms = {
  de: ['Lampe', 'Kostüm'], en: ['lamp', 'costume'], es: ['lámpara', 'vestuario'],
  it: ['lampada', 'costume'], cs: ['svítidlo', 'kostým'], hu: ['lámpa', 'jelmez'],
  nl: ['lamp', 'kostuum'], 'nl-BE': ['lamp', 'kostuum'], sv: ['lampa', 'kostym'],
  fr: ['lampe', 'costume'], pl: ['lampa', 'kostium'], 'pt-PT': ['lâmpada', 'figurino'],
  'zh-Hans': ['灯', '服装'], ja: ['ランプ', '衣装'], ko: ['램프', '의상'],
  ru: ['лампа', 'костюм'], uk: ['лампа', 'костюм'],
};

for (const [locale, [lamp, costume]] of Object.entries(terms)) {
  test(`${locale}: broad lamps and costumes include current and legacy categories in ordinary and Smart search`, () => {
    const t = translatorFor(locale, 'MarketplaceCatalog');
    for (const categoriesFor of [query => marketplaceSearchCategories(query, t), query => wishMarketplaceCategories(query, t)]) {
      const lamps = categoriesFor(lamp), costumes = categoriesFor(costume);
      for (const category of ['licht-quellen', 'hmi', 'led-panel']) assert.ok(lamps.includes(category), `${lamp}: ${category}`);
      for (const category of ['kostuem-kleidung', 'kostuem-accessoires', 'hut', 'alltagskleidung']) assert.ok(costumes.includes(category), `${costume}: ${category}`);
      assert.ok(!costumes.includes('requisiten-moebel'));
    }
    // Smart treats the complete object as a light source. Ordinary directory
    // search retains its established partial matching of translated labels.
    const lamps = wishMarketplaceCategories(lamp, t);
    for (const category of ['licht-signal', 'licht-stative', 'licht-steuerung', 'strom-messung', 'Lichttechnik']) assert.ok(!lamps.includes(category), `${lamp} must not include ${category}`);
  });
}

test('ordinary lamp search retains decorative and practical legacy candidates', () => {
  const categories = marketplaceSearchCategories('Lampe', translatorFor('de', 'MarketplaceCatalog'));
  for (const category of ['licht-quellen', 'lampen', 'practical']) assert.ok(categories.includes(category), category);
});

test('complete multiword object phrases work without dropping specific modifiers', () => {
  const t = translatorFor('de', 'MarketplaceCatalog');
  for (const query of ['light fixture', 'light fixtures', 'oprawa oświetleniowa', '조명 기구', '  LAMPEN  ']) {
    assert.ok(marketplaceSearchCategories(query, t).includes('licht-quellen'), query);
    assert.ok(wishMarketplaceCategories(query, t).includes('licht-quellen'), query);
  }
  for (const query of ['ARRI M18', 'Godox F800R', 'rote Lampe', 'Lodenfrey Hut', 'Hut', 'Motorrad', 'Boot']) {
    const categories = wishMarketplaceCategories(query, t);
    for (const broad of ['licht-quellen', 'kostuem-kleidung', 'kostuem-accessoires', 'fahrzeuge-bild']) assert.ok(!categories.includes(broad), `${query} must remain specific`);
  }
});

test('Munich regression: model-only lights and the costume hat remain eligible without moving unrelated or Berlin offers into the result', () => {
  // Public offer titles and saved categories observed on 17 November 2026.
  // Model-only offers require taxonomy; the legacy M18 already matches its description.
  const records = [
    ['Godox KNOWLED F800R', 'licht-quellen', 'München'],
    ['Aputure Nova P600C', 'licht-quellen', 'München'],
    ['ARRI M18', 'Lichttechnik', 'München', 'Super Lampe mit Brenner und Cannon Stecker. Läuft immer!!'],
    ['Bayrischer Hut von Lodenfrey mit Orginal Gamsbart', 'kostuem-accessoires', 'München'],
    ['DMX Node 4 Port', 'licht-signal', 'München'],
    ['grandMA3 TourPack', 'licht-steuerung', 'München'],
    ['Astera LunaBulb', 'licht-quellen', 'Berlin'],
  ].map(([title, category, city, description = '']) => ({title, category, city, description, ...placeWriteFields(`${city}, DE`)}));
  const snapshot = JSON.stringify(records), t = translatorFor('de', 'MarketplaceCatalog');
  const resultsFor = query => {
    const wish = {area: 'marketplace', query, department: '', places: [{city: 'München', country: '', continent: '', radiusKm: 0}]};
    const categories = wishMarketplaceCategories(query, t);
    const terms = wishSearchTerms(wish).map(term => term.toLocaleLowerCase('de'));
    return records.filter(record => (categories.includes(record.category) || terms.some(term => `${record.title} ${record.description}`.toLocaleLowerCase('de').includes(term))) && matchesWishPlaces(record, wish)).map(record => record.title);
  };
  assert.deepEqual(resultsFor('Lampe'), ['Godox KNOWLED F800R', 'Aputure Nova P600C', 'ARRI M18']);
  assert.deepEqual(resultsFor('Kostüm'), ['Bayrischer Hut von Lodenfrey mit Orginal Gamsbart']);
  assert.equal(JSON.stringify(records), snapshot);
});
