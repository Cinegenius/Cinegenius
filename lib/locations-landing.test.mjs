import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createTranslator} from 'next-intl';
import {placeReadFields} from './places/catalog.ts';
import {placeDisplay} from './places/core.ts';
import {listingPriceLabel} from './listing-price.ts';
import {locationCategoryLabel} from './location-category-labels.ts';

const require = createRequire(import.meta.url);
const locales = ['de', 'en', 'es', 'it', 'cs', 'hu'];
const dictionaries = Object.fromEntries(locales.map(locale => [locale, JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8'))]));
const translate = (locale, namespace) => createTranslator({locale, messages: dictionaries[locale], namespace, onError(error) { throw error; }});
const image = ({src, alt, className, style}) => React.createElement('img', {src, alt, className, style});
const link = ({href, children, ...props}) => React.createElement('a', {href, ...props}, children);

function compile(file, mocks) {
  const source = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true}}).outputText;
  const compiled = {exports: {}};
  new Function('require', 'module', 'exports', source)(name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), compiled, compiled.exports);
  return compiled.exports;
}

const listing = (index, overrides = {}) => ({
  id: `synthetic-location-${index}`, title: `Synthetic film location ${index}`, city: `Original place ${index}`,
  price: 120 + index, image_url: index % 2 ? `/api/media/synthetic-${index}` : null,
  category: 'Studio', metadata: {focal_point: {x: .25, y: .75}}, created_at: '2026-11-09T12:00:00Z',
  published: true, type: 'location', place_country_code: null, place_region_id: null,
  place_city_id: null, place_city_name: `Original place ${index}`, place_region_name: '', place_status: 'pending',
  place_original: 'Private audit snapshot must never be projected', user_id: 'private-owner',
  ...overrides,
});

async function renderPage(inputRows, locale = 'de', error = null) {
  const before = structuredClone(inputRows);
  const calls = [];
  const db = {from(table) {
    assert.equal(table, 'listings');
    let columns = [], filters = [];
    const query = {
      select(value) { columns = value.split(',').map(column => column.trim()); calls.push(['select', ...columns]); return query; },
      eq(column, value) { filters.push([column, value]); calls.push(['eq', column, value]); return query; },
      order(column, options) { calls.push(['order', column, options]); return query; },
      async limit(maximum) {
        calls.push(['limit', maximum]);
        const rows = inputRows.filter(row => filters.every(([column, value]) => row[column] === value)).slice(0, maximum);
        return {data: rows.map(row => Object.fromEntries(columns.map(column => [column, row[column]]))), error};
      },
    };
    return query;
  }};
  const uiMocks = {'next/link': link, '@/components/MediaImage': image, '@/lib/location-category-labels': {locationCategoryLabel}};
  const {default: PageHeader} = compile('../components/PageHeader.tsx', uiMocks);
  const {default: LocationsLanding} = compile('../app/locations/LocationsLanding.tsx', {
    ...uiMocks,
    'next/navigation': {useRouter: () => ({push() {}})},
    'next-intl': {useLocale: () => locale, useTranslations: namespace => translate(locale, namespace)},
    '@/components/PageHeader': PageHeader,
  });
  const ratingCalls = [];
  const {default: LocationsPage} = compile('../app/locations/page.tsx', {
    'next-intl/server': {getLocale: async () => locale, getTranslations: async namespace => translate(locale, namespace)},
    '@/lib/db': {db},
    '@/lib/ratings': {fetchRatings: async (ids, kind) => { ratingCalls.push({ids, kind}); return {[ids[0]]: {rating: 4.8, reviews: 3}}; }},
    '@/lib/places/catalog': {placeReadFields}, '@/lib/places/core': {placeDisplay}, '@/lib/listing-price': {listingPriceLabel},
    './LocationsLanding': LocationsLanding,
  });
  const element = await LocationsPage();
  const html = renderToStaticMarkup(element);
  assert.deepEqual(inputRows, before, 'Server mapping and rendering must preserve every source field');
  assert.ok(calls.some(call => call[0] === 'eq' && call[1] === 'published' && call[2] === true));
  assert.ok(calls.some(call => call[0] === 'eq' && call[1] === 'type' && call[2] === 'location'));
  assert.ok(!calls.some(call => call[0] === 'eq' && call[1] === 'place_status'), 'Publication must not depend on verification');
  assert.ok(!JSON.stringify(element.props).includes('Private audit snapshot'));
  assert.ok(!JSON.stringify(element.props).includes('private-owner'));
  return {html, props: element.props, calls, ratingCalls};
}

for (const locale of locales) test(`${locale}: actual Locations server page renders all 12 published pending locations instead of false empty state`, async () => {
  const rows = Array.from({length: 12}, (_, index) => listing(index + 1));
  const {html, props, ratingCalls} = await renderPage([
    ...rows, listing('unpublished', {published: false}), listing('prop', {type: 'prop'}),
  ], locale);
  assert.equal(props.allLocations.length, 12);
  assert.equal(props.totalCount, 12);
  assert.ok(props.allLocations.every(location => location.place_status === 'pending' && location.place_city_id === null));
  for (const row of rows) {
    assert.ok(html.includes(`href="/locations/${row.id}"`), row.id);
    assert.ok(html.includes(row.title));
    assert.ok(html.includes(row.city));
  }
  assert.ok(!html.includes(translate(locale, 'locations')('emptyTitle')));
  assert.ok(!html.includes('/locations/synthetic-location-unpublished'));
  assert.ok(!html.includes('/locations/synthetic-location-prop'));
  assert.deepEqual(ratingCalls, [{ids: rows.map(row => row.id), kind: 'listing'}]);
  assert.match(html, /grid-cols-1[^\"]*sm:grid-cols-2[^\"]*lg:grid-cols-3/);
  assert.match(html, /aspect-video/);
  assert.match(html, /line-clamp-2/);
  assert.ok(html.includes('mobile-bottom-nav-clear'));
  assert.ok(html.includes('/api/media/synthetic-1'));
  assert.ok(html.includes(translate(locale, 'locations')('landingSearch')));
});

test('true empty state appears only when there are zero published location listings', async () => {
  const {html, props} = await renderPage([listing(1, {published: false}), listing(2, {type: 'prop'})]);
  assert.equal(props.allLocations.length, 0);
  assert.ok(html.includes(translate('de', 'locations')('emptyTitle')));
  assert.ok(html.includes(translate('de', 'locations')('emptyDesc')));
  assert.ok(html.includes('href="/inserat?group=drehorte"'));
  assert.doesNotMatch(html, /href="\/locations\/synthetic-location-/);
});

test('landing shows the first 24 public offers and links to the complete search without losing its count', async () => {
  const {html, props} = await renderPage(Array.from({length: 25}, (_, index) => listing(index + 1)));
  assert.equal(props.allLocations.length, 25);
  for (let index = 1; index <= 24; index++) assert.ok(html.includes(`href="/locations/synthetic-location-${index}"`));
  assert.ok(!html.includes('href="/locations/synthetic-location-25"'));
  assert.ok(html.includes(translate('de', 'locations')('landingMore')));
  assert.ok(html.includes(translate('de', 'locations')('results', {count: 25})));
  assert.equal((html.match(/class="browse-card /g) ?? []).length, 24);
});

test('canonical display is localized while pending and empty-status published offers retain original display and visibility', async () => {
  for (const locale of ['de', 'en']) {
    const {html, props} = await renderPage([
      listing('verified', {city: 'Cologne', place_country_code: 'DE', place_region_id: 'DE-NW', place_city_id: 'geonames:2886242', place_city_name: 'Köln', place_region_name: 'Nordrhein-Westfalen', place_status: 'verified'}),
      listing('pending', {city: 'Own international settlement, NP', price: 0, metadata: {price_on_request: true}}),
      listing('empty', {city: '', place_city_name: '', place_status: 'empty'}),
    ], locale);
    assert.equal(props.allLocations.length, 3);
    assert.equal(props.allLocations[0].place_city_id, 'geonames:2886242');
    assert.ok(html.includes(locale === 'de' ? 'Köln, Deutschland' : 'Cologne, Germany'));
    assert.ok(html.includes('Own international settlement, NP'));
    assert.ok(html.includes('href="/locations/synthetic-location-empty"'));
    assert.ok(html.includes(translate(locale, 'MarketplaceOffer')('request')));
    assert.ok(!html.includes(translate(locale, 'locations')('emptyTitle')));
  }
});

test('database errors fail visibly instead of turning into a false empty listing state', async () => {
  await assert.rejects(renderPage([], 'de', {message: 'controlled fixture failure'}), /controlled fixture failure/);
});
