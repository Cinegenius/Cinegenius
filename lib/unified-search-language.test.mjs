import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { keywordSearchPlan, normalizeKeywordPlan } from './unified-search-intent.ts';
import { matchesMarketplaceConcept, searchKey, wishSearchTerms, wishMarketplaceCategories } from './unified-search-matching.ts';
import { getDepartmentRoleFormLabels } from './departments.ts';
import { SUPPORTED_LOCALES } from './i18n/locales.ts';
import { matchesSearchRequirements } from './unified-search-requirements.ts';

const wish = (query, area = 'marketplace') => ({ query, area, department: '', places: [] });
const t = key => key;
const gaffer = 'Gaffer (Oberbeleuchter)', electrician = 'Beleuchter (Electrician)';

test('all seventeen languages recognize the same lamp and costume inventory independently of interface language', () => {
  const examples = { de:['Lampe','Kostüm'], en:['lamp','costume'], es:['lámpara','vestuario'], it:['lampada','costumi'],
    cs:['svítidlo','kostým'], hu:['lámpa','jelmez'], nl:['lamp','kostuum'], 'nl-BE':['lamp','kostuum'], sv:['lampa','kostym'],
    fr:['lampe','costumes'], pl:['lampy','kostium'], 'pt-PT':['lâmpada','vestuário'], 'zh-Hans':['灯具','服装'],
    ja:['撮影ライト','衣装'], ko:['조명등','의상'], ru:['светильник','костюм'], uk:['світильник','костюм'] };
  assert.deepEqual(Object.keys(examples).sort(), [...SUPPORTED_LOCALES].sort());
  for (const [language, [lamp, costume]] of Object.entries(examples)) {
    const plan = keywordSearchPlan(`${lamp} ${costume} Berlin`, 'de');
    assert.ok(plan, language);
    assert.deepEqual(plan.searches.map(s => s.area), ['marketplace', 'all'], language);
    assert.ok(plan.searches.every(s => s.places[0].city === 'Berlin'), language);
    assert.ok(wishMarketplaceCategories(lamp, t).includes('licht-quellen'), language);
    assert.ok(!wishMarketplaceCategories(lamp, t).includes('licht-steuerung'), language);
    assert.ok(wishMarketplaceCategories(costume, t).includes('kostuem-accessoires'), language);
  }
});

test('catalogue professions and gendered forms work across languages without changing stored identity', () => {
  for (const locale of SUPPORTED_LOCALES) {
    const catalog = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url))).Taxonomy;
    const translate = key => key.split('.').reduce((value, part) => value?.[part], catalog) ?? key;
    for (const label of getDepartmentRoleFormLabels('licht', gaffer, locale, undefined, translate)) {
      const terms = wishSearchTerms(wish(label, 'crew'), 'de');
      assert.ok(terms.includes(gaffer), `${locale}: ${label}`);
      assert.ok(!terms.includes('Rigging Gaffer'), `${locale}: ${label}`);
    }
  }
});

test('real crew shorthand keeps specializations distinct and mixed-language place attachment intact', () => {
  for (const alias of ['gaff','chef élec','chef électricien','oberbeleuchtr']) {
    const terms = wishSearchTerms(wish(alias,'crew'));
    assert.ok(terms.includes(gaffer), alias); assert.ok(!terms.includes(electrician), alias);
  }
  for (const alias of ['spark','sparky','lighting tech','beleuchtr']) {
    const terms = wishSearchTerms(wish(alias,'crew'));
    assert.ok(terms.includes(electrician), alias); assert.ok(!terms.includes(gaffer), alias);
  }
  for (const alias of ['1AC','foquista']) assert.ok(wishSearchTerms(wish(alias,'crew')).includes('1st AC (Focus Puller)'));
  const operators = wishSearchTerms(wish('camop','crew'));
  assert.ok(operators.includes('A-Kamera Operator')); assert.ok(!operators.includes('Director of Photography (DoP)'));
  assert.ok(!operators.includes('Aerial Camera Operator'));
  const drivers=wishSearchTerms(wish('Fahrer','crew'));
  assert.ok(drivers.includes('Produktionsfahrer*in'));assert.ok(drivers.includes('Personal Driver'));
  assert.ok(!drivers.includes('Dolly Grip / Dollyfahrer*in'));
  assert.ok(wishSearchTerms(wish('Kameramann','crew')).includes('Director of Photography (DoP)'));
  assert.ok(wishSearchTerms(wish('Kameramann','crew')).includes('A-Kamera Operator'));
  const plan = keywordSearchPlan('2 sparks in München und foquista in Berlin');
  assert.deepEqual(plan.searches.map(s => [s.query,s.quantity,s.places[0].city]), [[electrician,2,'München'],['1st AC (Focus Puller)',undefined,'Berlin']]);
  for (const input of ['sparky ohne rigging München','camop underwater Berlin','Lampe ARRI M18 Berlin','best boy Berlin','swing Berlin','OB vegan Berlin']) assert.equal(keywordSearchPlan(input),null,input);
});

test('simple spoken introductions and independent locations work without dropping qualifiers', () => {
  for (const input of ['Je cherche une lampe à Berlin','Busco una lámpara en Berlin','Cerco una lampada a Berlin','Hledám svítidlo v Berlin','Szukam lampy w Berlin','Procuro uma lâmpada em Berlin','Ik zoek lampen in Berlin','Jag söker lampor i Berlin','Я ищу лампы в Berlin','Я шукаю світильник у Berlin']) {
    const plan = keywordSearchPlan(input);
    assert.ok(plan,input); assert.equal(plan.searches.length,1,input); assert.equal(plan.searches[0].area,'marketplace',input);
    assert.equal(plan.searches[0].places[0].city,'Berlin',input);
  }
  const plan = keywordSearchPlan('je cherche chef élec à Berlin et foquista à München');
  assert.deepEqual(plan.searches.map(s => s.places[0].city), ['Berlin','München']);
  for (const query of ['je cherche une lampe sans LED à Berlin','procuro lâmpada waterproof em Berlin','Szukam lampy bez LED w Berlin']) assert.equal(keywordSearchPlan(query),null,query);
});

test('Latin accent folding does not erase Japanese voicing or split Korean syllables', () => {
  assert.equal(searchKey('Kostüm'),'kostum'); assert.equal(searchKey('LÁMPARA'),'lampara');
  assert.equal(searchKey('조명등'.normalize('NFD')), '조명등');
  assert.equal(searchKey('ガファー'.normalize('NFD')), searchKey('ガファー'));
  assert.notEqual(searchKey('ガ'), searchKey('カ'));
});

test('Postgres inventory recall includes unnamed light models and costume accessories without unrelated equipment', async () => {
  const db = new PGlite();
  try {
    await db.exec('create table listings (title text, description text, category text, city text, published boolean, visible boolean)');
    const rows = [
      ['ARRI M18','HMI Scheinwerfer','Lichttechnik'], ['Aputure Nova P600C','RGBWW Panel','licht-quellen'],
      ['Godox KNOWLED F800R','Flexibles Panel','licht-quellen'], ['Bayerischer Hut','Gamsbart','kostuem-accessoires'],
      ['DMX Node','Vier Ports','licht-signal'], ['grandMA3','Steuerpult','licht-steuerung'], ['Unterwassergehäuse','Gehäuse','licht-other'],
      ['Lastenkraxe','Hat einen guten Schutz','requisiten-other'],
    ];
    for (const row of rows) await db.query('insert into listings values ($1,$2,$3,$4,true,true)',[...row,'München']);
    await db.query('insert into listings values ($1,$2,$3,$4,true,false)', ['Private Lampe','Scheinwerfer','licht-quellen','München']);
    await db.query('insert into listings values ($1,$2,$3,$4,false,true)', ['Entwurf Lampe','Scheinwerfer','licht-quellen','München']);
    const search = async query => {
      const terms = wishSearchTerms(wish(query)).map(term => `%${term.replace(/[\\%_]/g, '\\$&')}%`);
      const result = await db.query('select title,description,category from listings where published and visible and city=$1 and (category=any($2::text[]) or title ilike any($3::text[]) or description ilike any($3::text[]) or category ilike any($3::text[])) order by title', ['München',wishMarketplaceCategories(query,t),terms]);
      return result.rows.filter(row => matchesMarketplaceConcept(row,query)).map(row=>row.title);
    };
    assert.deepEqual(await search('Lampe'), ['ARRI M18','Aputure Nova P600C','Godox KNOWLED F800R']);
    assert.deepEqual(await search('Kostüm'), ['Bayerischer Hut']);
    assert.deepEqual(await search('chapeau'), ['Bayerischer Hut']);
    assert.deepEqual(await search('ARRI M18'), ['ARRI M18']);
    assert.deepEqual(await search('DMX Node'), ['DMX Node']);
    assert.ok(!wishMarketplaceCategories('Hut',t).includes('kostuem-accessoires'));
  } finally { await db.close(); }
});

test('short object names do not match unrelated substrings or a German auxiliary verb', () => {
  assert.equal(matchesMarketplaceConcept({ title:'Tatonka Lastenkraxe',description:'Hat einen Schutz',category:'requisiten-other'},'Hut'),false);
  assert.equal(matchesMarketplaceConcept({ title:'Feiner Filzhut',category:'kostuem-accessoires'},'Hut'),true);
  assert.equal(matchesMarketplaceConcept({ title:'Vintage hat',category:'kostuem-accessoires'},'chapeau'),true);
  assert.equal(matchesMarketplaceConcept({ title:'撮影用の帽子',category:'kostuem-accessoires'},'Hut'),true);
});

test('rental and sale constraints use actual public offer mode, including multilingual phrases', () => {
  for (const term of ['Miete','Vermietung','zum Ausleihen','rental','rent','alquiler','noleggio','pronájem','bérlés','huur','uthyrning','louer','wynajem','aluguer','出租','レンタル','대여','аренда','оренда']) {
    const request={...wish('Lampe'),requirements:[[term]]};
    assert.ok(matchesSearchRequirements({title:'M18',rental_type:'miete'},request),term);
    assert.ok(matchesSearchRequirements({title:'M18',marketplace:{mode:'both'}},request),term);
    assert.ok(!matchesSearchRequirements({title:'M18',description:'Auch zur Miete?',rental_type:'kauf'},request),term);
    assert.ok(!matchesSearchRequirements({title:'M18'},request),term);
  }
  assert.ok(matchesSearchRequirements({rental_type:'kauf'},{...wish('M18'),requirements:[['sale','Verkauf']]}));
  assert.ok(!matchesSearchRequirements({rental_type:'miete'},{...wish('M18'),exclude:['rent']}));
  assert.ok(!matchesSearchRequirements({rental_type:'miete'},{...wish('M18'),requirements:[['rental'],['waterproof']]}));
});

test('model-added duplicate query requirements cannot hide inventory while real properties remain mandatory', () => {
 const plan=normalizeKeywordPlan({version:2,searches:[{...wish('Lampe'),requirements:[['Lampe','lampada'],['waterproof'],['rental']],exclude:['broken']}]});
 assert.deepEqual(plan.searches[0].requirements,[['waterproof'],['rental']]);assert.deepEqual(plan.searches[0].exclude,['broken']);
 const explicit=normalizeKeywordPlan({version:2,searches:[{...wish('Hut'),requirements:[['red','Hut']]}]});
 assert.deepEqual(explicit.searches[0].requirements,[['red','Hut']]);
});
