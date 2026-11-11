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
import * as landingFilters from './locations-landing-filters.ts';
import * as placeCore from './places/core.ts';

const require = createRequire(import.meta.url);
const locales = ['de', 'en', 'es', 'it', 'cs', 'hu', 'nl', 'nl-BE', 'sv'];
const dictionaries = Object.fromEntries(locales.map(locale => [locale, JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8'))]));
const translate = (locale, namespace) => createTranslator({locale, messages: dictionaries[locale], namespace, onError(error) { throw error; }});
const image = ({src, alt, className, style}) => React.createElement('img', {src, alt, className, style});
const link = ({href, children, ...props}) => React.createElement('a', {href, ...props}, children);

function compile(file, mocks, globals = {}) {
  const source = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true}}).outputText;
  const compiled = {exports: {}};
  new Function('require', 'module', 'exports', 'fetch', 'window', 'document', source)(
    name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), compiled, compiled.exports,
    () => { throw new Error('The landing fixture must never perform a network request'); }, globals.window, globals.document,
  );
  return compiled.exports;
}

function nodes(value, predicate, result = []) {
  if (Array.isArray(value)) for (const child of value) nodes(child, predicate, result);
  else if (React.isValidElement(value)) {
    if (predicate(value)) result.push(value);
    nodes(value.props.children, predicate, result);
  }
  return result;
}

const text = value => Array.isArray(value) ? value.map(text).join('') : React.isValidElement(value) ? text(value.props.children) : value == null || typeof value === 'boolean' ? '' : String(value);
const cardIds = html => [...html.matchAll(/href="\/locations\/([^"?#]+)"/g)].map(match => match[1]);
const escaped = value => renderToStaticMarkup(React.createElement(React.Fragment, null, value));

/** Execute the real Landing handlers; render the real shared controls with effects disabled by SSR. */
function landingHarness({locale = 'de', props = {}, state = {}} = {}) {
  let language = locale, currentProps = props, tree, refCursor = 0;
  const refs = [], view = {...state};
  const observed = {urls: [], places: [], controls: null, scrolls: []};
  const intl = {useLocale: () => language, useTranslations: namespace => translate(language, namespace)};
  const ui = {'next/link': link, '@/components/MediaImage': image, 'next-intl': intl};
  const {default: PageHeader} = compile('../components/PageHeader.tsx', ui);
  const {default: EmptyState} = compile('../components/EmptyState.tsx', ui);
  const mobile = compile('../components/MobileBrowseControls.tsx', ui);
  const places = compile('../components/PlaceFilters.tsx', {...ui, '@/lib/places/core': placeCore});
  function Mobile(props) { observed.controls = props; return React.createElement(mobile.default, props); }
  function Place(props) { observed.places.push(props); return React.createElement(places.default, props); }
  const {default: Landing} = compile('../app/locations/LocationsLanding.tsx', {
    ...ui,
    react: {...React, useRef(initial) { const index = refCursor++; return refs[index] ??= {current: initial}; }},
    '@/components/PageHeader': PageHeader, '@/components/EmptyState': EmptyState,
    '@/components/MobileBrowseControls': {__esModule: true, ...mobile, default: Mobile},
    '@/components/PlaceFilters': {__esModule: true, ...places, default: Place},
    '@/lib/location-category-labels': {locationCategoryLabel}, '@/lib/places/core': placeCore,
    '@/lib/locations-landing-filters': landingFilters,
    '@/lib/use-view-state': {useViewState(key, initial) {
      if (!Object.hasOwn(view, key)) view[key] = typeof initial === 'function' ? initial() : initial;
      return [view[key], action => { view[key] = typeof action === 'function' ? action(view[key]) : action; }];
    }},
    '@/lib/use-view-url': {useViewUrl(href) { observed.urls.push(href); }},
  });
  function render() {
    refCursor = 0; observed.places = []; observed.controls = null;
    const before = structuredClone(currentProps.allLocations);
    tree = Landing(currentProps);
    for (const node of nodes(tree, node => node.props.id === 'locations-discover')) {
      node.props.ref.current = {scrollIntoView(options) { observed.scrolls.push(options); }};
    }
    const html = renderToStaticMarkup(tree);
    assert.deepEqual(currentProps.allLocations, before, 'Filtering, sorting and rendering must not mutate a source card');
    return html;
  }
  return {
    component: Landing, observed, state: view, render,
    get tree() { return tree; },
    setProps(next) { currentProps = next; }, setLocale(next) { language = next; },
    parameters: () => new URL(observed.urls.at(-1), 'https://fixture.invalid').searchParams,
  };
}

const listing = (index, overrides = {}) => ({
  id: `synthetic-location-${index}`, title: `Synthetic film location ${index}`, city: `Original place ${index}`,
  price: 120 + (typeof index === 'number' ? index : 0), image_url: index % 2 ? `/api/media/synthetic-${index}` : null,
  category: 'Studio', metadata: {focal_point: {x: .25, y: .75}, private_note: 'PRIVATE_METADATA_CANARY'}, created_at: '2026-11-09T12:00:00Z',
  published: true, type: 'location', place_country_code: null, place_region_id: null,
  place_city_id: null, place_city_name: `Original place ${index}`, place_region_name: '', place_status: 'pending',
  place_original: 'Private audit snapshot must never be projected', user_id: 'private-owner',
  ...overrides,
});

async function renderPage(inputRows, locale = 'de', error = null, searchParams = {}) {
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
  const harness = landingHarness({locale});
  const ratingCalls = [];
  const {default: LocationsPage} = compile('../app/locations/page.tsx', {
    'next-intl/server': {getLocale: async () => locale, getTranslations: async namespace => translate(locale, namespace)},
    '@/lib/db': {db},
    '@/lib/ratings': {fetchRatings: async (ids, kind) => { ratingCalls.push({ids, kind}); return {[ids[0]]: {rating: 4.8, reviews: 3}}; }},
    '@/lib/places/catalog': {placeReadFields}, '@/lib/places/core': {placeDisplay}, '@/lib/listing-price': {listingPriceLabel},
    '@/lib/locations-landing-filters': landingFilters,
    './LocationsLanding': harness.component,
  });
  const element = await (Object.keys(searchParams).length ? LocationsPage({searchParams: Promise.resolve(searchParams)}) : LocationsPage());
  harness.setProps(element.props);
  const html = harness.render();
  assert.deepEqual(inputRows, before, 'Server mapping and rendering must preserve every source field');
  assert.ok(calls.some(call => call[0] === 'eq' && call[1] === 'published' && call[2] === true));
  assert.ok(calls.some(call => call[0] === 'eq' && call[1] === 'type' && call[2] === 'location'));
  assert.ok(!calls.some(call => call[0] === 'eq' && call[1] === 'place_status'), 'Publication must not depend on verification');
  assert.ok(!JSON.stringify(element.props).includes('Private audit snapshot'));
  assert.ok(!JSON.stringify(element.props).includes('private-owner'));
  assert.ok(!JSON.stringify(element.props).includes('PRIVATE_METADATA_CANARY'));
  return {html, props: element.props, calls, ratingCalls, harness};
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

test('landing expands its first 24 public offers locally, preserving count, filters and URL', async () => {
  const {html, props, harness} = await renderPage(Array.from({length: 51}, (_, index) => listing(index + 1)));
  assert.equal(props.allLocations.length, 51);
  for (let index = 1; index <= 24; index++) assert.ok(html.includes(`href="/locations/synthetic-location-${index}"`));
  assert.ok(!html.includes('href="/locations/synthetic-location-25"'));
  assert.ok(html.includes(translate('de', 'locations')('landingMore')));
  assert.ok(html.includes(translate('de', 'locations')('results', {count: 51})));
  assert.equal(cardIds(html).length, 24);
  const more = () => nodes(harness.tree, node => node.type === 'button' && text(node) === translate('de', 'locations')('landingMore'))[0];
  more().props.onClick();
  assert.equal(cardIds(harness.render()).length, 48);
  more().props.onClick();
  assert.equal(cardIds(harness.render()).length, 51);
  assert.equal(more(), undefined);
  assert.ok(harness.observed.urls.every(url => url === '/locations'));
  assert.doesNotMatch(html, /href="\/locations\/suche/);
  harness.observed.controls.onQueryChange('Synthetic film location 51');
  assert.deepEqual(cardIds(harness.render()), ['synthetic-location-51'], 'Filter the full loaded collection before taking 24 cards');
  harness.observed.controls.onReset();
  assert.equal(cardIds(harness.render()).length, 51, 'Reset returns to the retained unfiltered pagination entry');
});

test('canonical display is localized while pending and empty-status published offers retain original display and visibility', async () => {
  for (const locale of locales) {
    const {html, props} = await renderPage([
      listing('verified', {city: 'Cologne', place_country_code: 'DE', place_region_id: 'DE-NW', place_city_id: 'geonames:2886242', place_city_name: 'Köln', place_region_name: 'Nordrhein-Westfalen', place_status: 'verified'}),
      listing('pending', {city: 'Own international settlement, NP', price: 0, metadata: {price_on_request: true}}),
      listing('empty', {city: '', place_city_name: '', place_status: 'empty'}),
    ], locale);
    assert.equal(props.allLocations.length, 3);
    assert.equal(props.allLocations[0].place_city_id, 'geonames:2886242');
    assert.ok(html.includes(escaped(placeDisplay(props.allLocations[0], 'Cologne', locale))));
    assert.ok(html.includes('Own international settlement, NP'));
    assert.ok(html.includes('href="/locations/synthetic-location-empty"'));
    assert.ok(html.includes(translate(locale, 'MarketplaceOffer')('request')));
    assert.ok(!html.includes(translate(locale, 'locations')('emptyTitle')));
  }
});

test('database errors fail visibly instead of turning into a false empty listing state', async () => {
  await assert.rejects(renderPage([], 'de', {message: 'controlled fixture failure'}), /controlled fixture failure/);
});

const munich = (index, overrides = {}) => listing(index, {
  city: 'München', place_country_code: 'DE', place_region_id: 'DE.02', place_city_id: 'geonames:2867714',
  place_city_name: 'München', place_region_name: 'Bayern', place_status: 'verified', ...overrides,
});
const priceInput = (harness, position) => nodes(harness.tree, node => node.type === 'input' && node.props.type === 'number')[position];
const change = (element, value) => element.props.onChange({target: {value}});

for (const locale of locales) test(`${locale}: actual shared controls combine category, canonical place and inclusive price filters and reset safely`, async () => {
  const {harness, props} = await renderPage([
    munich('target', {category: 'Filmstudio', price: 200}),
    munich('expensive', {price: 301}),
    munich('photo', {category: 'Fotostudio', price: 200}),
    munich('request', {price: 0, metadata: {price_on_request: true}}),
    munich('other-city', {city: 'Köln', place_city_name: 'Köln', place_city_id: 'geonames:2886242', place_region_id: 'DE.07', place_region_name: 'Nordrhein-Westfalen', price: 200}),
    listing('pending', {city: 'München', place_city_name: 'München', price: 200}),
  ], locale);
  const before = structuredClone(props.allLocations);
  harness.observed.controls.onCategoryChange('Studio');
  harness.render();
  assert.ok(harness.observed.places.length > 0, 'The actual shared PlaceFilters is rendered on desktop');
  harness.observed.places[0].onChange({country: 'DE', region: 'DE.02', city: 'geonames:2867714'});
  harness.render();
  change(priceInput(harness, 0), '150');
  harness.render();
  change(priceInput(harness, 1), '200');
  let html = harness.render();
  assert.deepEqual(cardIds(html), ['synthetic-location-target']);
  assert.equal(harness.observed.controls.resultSummary, translate(locale, 'locations')('results', {count: 1}));
  assert.deepEqual(Object.fromEntries(harness.parameters()), {country: 'DE', region: 'DE.02', city: 'geonames:2867714', type: 'Studio', min: '150', max: '200'});
  assert.ok(harness.observed.controls.chips.some(chip => chip.id === 'city'));
  assert.ok(html.includes(escaped(translate(locale, 'Places')('country'))));
  assert.ok(html.includes(escaped(translate(locale, 'Places')('region'))));
  assert.ok(html.includes(escaped(translate(locale, 'Places')('city'))));
  assert.ok(html.includes('mobile-browse-controls xl:hidden'));
  change(priceInput(harness, 1), '100');
  html = harness.render();
  assert.deepEqual(cardIds(html), []);
  assert.ok(html.includes(escaped(translate(locale, 'locations')('emptyTitleFiltered'))));
  assert.ok(!html.includes(escaped(translate(locale, 'locations')('emptyTitle'))));
  const empty = nodes(harness.tree, node => node.props.action?.label === translate(locale, 'locations')('emptyActionReset'))[0];
  empty.props.action.onClick();
  html = harness.render();
  assert.equal(cardIds(html).length, 6);
  assert.deepEqual(harness.state['locations.landing.filters'], landingFilters.DEFAULT_LOCATION_LANDING_FILTERS);
  assert.equal(harness.observed.urls.at(-1), '/locations');
  assert.deepEqual(props.allLocations, before);
});

test('server search parameters initialize local controls and one canonical /locations URL without narrowing the publication query', async () => {
  const params = {q: [' Loft & daylight ', 'ignored'], cityText: 'Munich', type: 'Filmstudio', country: 'DE', region: 'DE.02', city: 'geonames:2867714', min: '125,50', max: '300', sort: 'price-desc'};
  const {props, html, harness, calls} = await renderPage([
    munich('match', {title: 'Loft & daylight', price: 200}),
    munich('too-cheap', {title: 'Loft & daylight', price: 100}),
    listing('pending', {title: 'Loft & daylight', city: 'München'}),
  ], 'en', null, params);
  assert.equal(props.allLocations.length, 3, 'A reset must retain every published offer loaded by the server');
  assert.deepEqual(cardIds(html), ['synthetic-location-match']);
  assert.equal(props.initialFilters.q, 'Loft & daylight');
  assert.equal(props.initialFilters.type, 'Studio');
  assert.equal(props.initialFilters.min, '125.5');
  assert.deepEqual(calls.filter(call => call[0] === 'eq').map(call => call.slice(1)), [['published', true], ['type', 'location']]);
  const form = nodes(harness.tree, node => node.type === 'form')[0];
  assert.equal(form.props.action, '/locations');
  assert.equal(form.props.method, 'get');
  assert.match(form.props.className, /hidden.*xl:block/);
  const inputs = nodes(form, node => node.type === 'input' && node.props.name);
  assert.equal(inputs.find(node => node.props.name === 'q').props.value, 'Loft & daylight');
  assert.deepEqual(Object.fromEntries(inputs.map(node => [node.props.name, node.props.value])), Object.fromEntries(harness.parameters()));
  let prevented = false;
  form.props.onSubmit({preventDefault() { prevented = true; }});
  assert.equal(prevented, true);
  assert.deepEqual(harness.observed.scrolls, [{behavior: 'smooth', block: 'start'}]);
  assert.ok(harness.observed.urls.every(href => new URL(href, 'https://fixture.invalid').pathname === '/locations'));
  assert.ok(!html.includes('/locations/suche'));
});

test('free place text recognizes Munich aliases, preserves unknown international offers and never turns a label into a selected city ID', async () => {
  const {harness, props} = await renderPage([
    munich('canonical'), listing('legacy', {city: 'München', place_city_name: 'München'}),
    listing('international', {title: 'Own member title', city: 'Own municipality, NP', place_city_name: 'Own municipality'}),
    listing('other', {city: 'Münchenstein', place_city_name: 'Münchenstein'}),
  ], 'de', null, {cityText: 'Munich'});
  assert.deepEqual(cardIds(harness.render()), ['synthetic-location-canonical', 'synthetic-location-legacy']);
  assert.equal(harness.state['locations.landing.filters'].city, '');
  harness.observed.controls.chips.find(chip => chip.id === 'city-text').onRemove();
  harness.render();
  harness.observed.controls.onQueryChange('Own municipality');
  assert.deepEqual(cardIds(harness.render()), ['synthetic-location-international']);
  assert.equal(props.allLocations[2].place_status, 'pending');
  assert.equal(props.allLocations[2].place_country_code, null);
  assert.equal(props.allLocations[2].place_city_id, null);
  assert.ok(!placeCore.placeOptions(props.allLocations, 'city', 'de').some(option => option.value.includes('Own')));
  harness.observed.controls.onReset();
  harness.render();
  harness.observed.controls.onQueryChange('<script>window.fixtureLeak=1</script> & "+');
  const html = harness.render();
  assert.ok(!html.includes('<script>'));
  assert.equal(harness.parameters().get('q'), '<script>window.fixtureLeak=1</script> & "+');
  assert.deepEqual(cardIds(html), []);
});

test('changing a canonical place clears free city text; removing parent chips clears dependent selections while preserving other filters', async () => {
  const {harness} = await renderPage([munich(1), listing(2)], 'de', null, {cityText: 'Munich', type: 'Studio', min: '10'});
  harness.observed.places[0].onChange({country: 'DE', region: 'DE.02', city: 'geonames:2867714'});
  harness.render();
  assert.equal(harness.parameters().has('cityText'), false);
  harness.observed.controls.chips.find(chip => chip.id === 'region').onRemove();
  harness.render();
  assert.equal(harness.parameters().get('country'), 'DE');
  assert.equal(harness.parameters().has('region'), false);
  assert.equal(harness.parameters().has('city'), false);
  harness.observed.places[0].onChange({country: 'DE', region: 'DE.02', city: 'geonames:2867714'});
  harness.render();
  harness.observed.controls.chips.find(chip => chip.id === 'country').onRemove();
  harness.render();
  assert.deepEqual(Object.fromEntries(harness.parameters()), {type: 'Studio', min: '10'});
});

test('language changes preserve selected IDs, text, filter state and native shared controls in all nine locales', async () => {
  const {harness, props} = await renderPage([munich(1)], 'de', null, {country: 'DE', region: 'DE.02', city: 'geonames:2867714', type: 'Studio'});
  const selected = structuredClone(harness.state['locations.landing.filters']);
  for (const locale of locales) {
    harness.setLocale(locale);
    const html = harness.render();
    assert.deepEqual(cardIds(html), ['synthetic-location-1']);
    assert.deepEqual(harness.state['locations.landing.filters'], selected);
    assert.equal(harness.parameters().get('city'), 'geonames:2867714');
    assert.ok(html.includes(escaped(translate(locale, 'locations')('categoryLabel'))));
    assert.ok(html.includes(escaped(translate(locale, 'locations')('sortPriceAsc'))));
    assert.equal(harness.observed.controls.resetLabel, translate(locale, 'locations')('resetFilters'));
  }
  assert.equal(props.allLocations[0].place_city_id, 'geonames:2867714');
});

test('sort handlers operate before pagination and on-request prices stay last in both price orders', async () => {
  const rows = [listing('request', {price: 0, metadata: {price_on_request: true}}), ...Array.from({length: 26}, (_, index) => listing(index + 1, {price: 200 - index}))];
  const {harness} = await renderPage(rows);
  harness.observed.controls.onSortChange('price-asc');
  let ids = cardIds(harness.render());
  assert.equal(ids[0], 'synthetic-location-26');
  assert.equal(ids.length, 24);
  harness.observed.controls.onSortChange('price-desc');
  ids = cardIds(harness.render());
  assert.equal(ids[0], 'synthetic-location-1');
  assert.ok(!ids.includes('synthetic-location-request'));
  assert.equal(harness.parameters().get('sort'), 'price-desc');
});
