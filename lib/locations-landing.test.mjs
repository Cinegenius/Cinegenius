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
import * as mapHelpers from './location-map.ts';
import * as privacy from './location-privacy.ts';
import * as geography from './browse-geography.ts';
import { COUNTRY_CODES } from './places/countries.ts';

const require = createRequire(import.meta.url);
const locales = ['de', 'en', 'es', 'it', 'cs', 'hu', 'nl', 'nl-BE', 'sv'];
const dictionaries = Object.fromEntries(locales.map(locale => [locale, JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8'))]));
const translate = (locale, namespace) => createTranslator({locale, messages: dictionaries[locale], namespace, onError(error) { throw error; }});
const image = ({src, alt, className, style}) => React.createElement('img', {src, alt, className, style});
const link = ({href, children, ...props}) => React.createElement('a', {href, ...props}, children);

function compile(file, mocks, globals = {}) {
  const source = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true}}).outputText;
  const compiled = {exports: {}};
  new Function('require', 'module', 'exports', 'fetch', 'window', 'document', 'navigator', source)(
    name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), compiled, compiled.exports,
    () => { throw new Error('The landing fixture must never perform a network request'); }, globals.window, globals.document, globals.navigator,
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

/** Execute real Landing handlers and panel fields in SSR. Native dialog opening/focus is checked in the browser. */
function landingHarness({locale = 'de', props = {}, state = {}, wide = false, navigator = {}} = {}) {
  let language = locale, currentProps = props, tree, refCursor = 0;
  const refs = [], view = {...state};
  const observed = {map: null, urls: [], places: [], controls: null, scrolls: []};
  const intl = {useLocale: () => language, useTranslations: namespace => translate(language, namespace)};
  const ui = {'next/link': link, '@/components/MediaImage': image, '@/components/ListingImage': image, 'next-intl': intl};
  const headerModule = compile('../components/PageHeader.tsx', ui);
  const {default: PageHeader} = headerModule;
  const directoryModule = compile('../components/DirectoryPage.tsx', {
    '@/components/PageHeader': headerModule,
    '@/components/AiDisclosureBadge': () => null,
  });
  const {default: FloatingMapToggle} = compile('../components/FloatingMapToggle.tsx', ui);
  const {default: EmptyState} = compile('../components/EmptyState.tsx', ui);
  const mobile = compile('../components/MobileBrowseControls.tsx', ui);
  const places = compile('../components/PlaceFilters.tsx', {...ui, '@/lib/places/core': placeCore, '@/lib/places/countries': {COUNTRY_CODES}});
  function Mobile(props) { observed.controls = props; return React.createElement(React.Fragment, null, React.createElement(mobile.default, props), React.createElement("section", {"data-fixture-filter-panel": true}, props.children)); }
  function Place(props) { observed.places.push(props); return React.createElement(places.default, props); }
  const hooks = {...React, useEffect: () => {}, useCallback: callback => callback, useMemo: compute => compute(), useSyncExternalStore: () => wide, useState(initial) { const index = refCursor++; refs[index] ??= { value: initial }; return [refs[index].value, next => { refs[index].value = typeof next === 'function' ? next(refs[index].value) : next; }]; }, useRef(initial) { const index = refCursor++; return refs[index] ??= {current: initial}; }};
  const {useNearbyLocation} = compile('../lib/use-nearby-location.ts', {react: hooks, 'next-intl': intl}, {navigator});
  const {default: Landing} = compile('../app/locations/LocationsLanding.tsx', {
    ...ui,
    '@/components/BrowseGeography': () => null,
    '@/lib/use-browse-geography': {useBrowseGeography: () => ({preferred: null, setEnabled() {}})},
    '@/lib/browse-geography': geography,
    '@/components/FloatingMapToggle': FloatingMapToggle,
    react: hooks,
    '@/components/FavoriteButton': props => React.createElement('button', {'data-favorite-for': props.listingId}),
    '@/components/PageHeader': PageHeader, '@/components/EmptyState': EmptyState,
    '@/components/DirectoryPage': directoryModule,
    '@/components/MobileBrowseControls': {__esModule: true, ...mobile, default: Mobile},
    '@/components/PlaceFilters': {__esModule: true, ...places, default: Place},
    'next/dynamic': () => props => { observed.map = props; return React.createElement('div', {'data-location-map': props.locations.map(row => row.id).join(',')}); },
    '@/lib/location-map': mapHelpers,
    '@/lib/use-nearby-location': {useNearbyLocation},
    '@/lib/location-category-labels': {locationCategoryLabel}, '@/lib/places/core': placeCore,
    '@/lib/locations-landing-filters': landingFilters,
    '@/lib/use-view-state': {useViewState(key, initial) {
      if (!Object.hasOwn(view, key)) view[key] = typeof initial === 'function' ? initial() : initial;
      return [view[key], action => { view[key] = typeof action === 'function' ? action(view[key]) : action; }];
    }},
    '@/lib/use-view-url': {useViewUrl(href) { observed.urls.push(href); }},
  }, {navigator});
  function render() {
    refCursor = 0; observed.map = null; observed.places = []; observed.controls = null;
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
  category: 'Studio', metadata: {focal_point: {x: 25, y: 75}, private_note: 'PRIVATE_METADATA_CANARY'}, created_at: '2026-11-09T12:00:00Z',
  published: true, type: 'location', place_country_code: null, place_region_id: null,
  place_city_id: null, place_city_name: `Original place ${index}`, place_region_name: '', place_status: 'pending',
  place_original: 'Private audit snapshot must never be projected', user_id: 'private-owner',
  ...overrides,
});

async function renderPage(inputRows, locale = 'de', error = null, searchParams = {}, coordinateResult = null) {
  const before = structuredClone(inputRows);
  const calls = [];
  const db = {from(table) {
    assert.equal(table, 'listings');
    let columns = [], filters = [];
    const query = {
      select(value) { columns = value.split(',').map(column => column.trim()); calls.push(['select', ...columns]); return query; },
      eq(column, value) { filters.push([column, value]); calls.push(['eq', column, value]); return query; },
      order(column, options) { calls.push(['order', column, options]); return query; },
      async range(start, end) {
        calls.push(['range', start, end]);
        const rows = inputRows.filter(row => filters.every(([column, value]) => row[column] === value)).slice(start, end + 1);
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
    '@/lib/location-privacy': privacy,
    '@/lib/location-map-geocoding': {geocodeLocationCities: async cities => coordinateResult ?? Object.fromEntries(cities.map(city => [city,{lat:52,lng:13}]))},
    './LocationsLanding': harness.component,
  });
  const element = await LocationsPage({searchParams: Promise.resolve(searchParams)});
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

test('saved percentage focal point keeps the Berlin location image inside its preview', async () => {
  const {html} = await renderPage([listing(1, {metadata: {focal_point: {x: 50, y: 33}}})]);
  assert.match(html, /object-position:50% 33%/);
  assert.doesNotMatch(html, /object-position:5000% 3300%/);
});

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
  assert.ok(html.includes(escaped(translate(locale, 'locations')('searchPlaceholder'))));
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
  assert.ok(harness.observed.places.length > 0, 'The actual shared PlaceFilters remains available in the shared panel');
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
  assert.ok(html.includes('mobile-browse-controls'));assert.ok(!html.includes('mobile-browse-controls xl:hidden'));
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
  assert.equal(harness.observed.controls.query, 'Loft & daylight');
  assert.equal(harness.observed.controls.categoryValue, 'Studio');
  assert.equal(harness.observed.controls.sortValue, 'price-desc');
  assert.equal(nodes(harness.tree, node => node.type === 'form').length, 0, 'shared controls replace the separate desktop form');
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
    assert.equal(harness.observed.controls.categoryLabel, translate(locale, 'locations')('categoryLabel'));
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

for(const locale of locales)test(`${locale}: the ordinary Locations page has a shared map toggle and area results in both views`,async()=>{
 const {props:sourceProps}=await renderPage([listing(1),listing(2),listing(3)],locale);
 const original=sourceProps.allLocations;
 const props={...sourceProps,allLocations:original.map((row,index)=>({...row,lat:index===0?52:48,lng:index===0?13:11}))};
 const h=landingHarness({locale,props});h.render();assert.equal(h.observed.map,null);
 const viewButton=label=>nodes(h.observed.controls.viewControls,node=>node.type==='button'&&text(node)===label)[0];
 viewButton(translate(locale,'locations')('viewMap')).props.onClick();h.render();
 assert.equal(h.state['locations.landing.view'],'map');assert.deepEqual(h.observed.map.locations.map(row=>row.id),original.map(row=>row.id));
 h.observed.map.onBoundsChange({south:51,north:53,west:12,east:14});h.render();
 assert.equal(h.observed.map.locations.length,3);assert.equal(h.observed.map.visibleCount,1);
 assert.deepEqual(cardIds(h.render()),['synthetic-location-1']);assert.equal(h.observed.controls.resultSummary,translate(locale,'locations')('results',{count:1}));
 viewButton(translate(locale,'locations')('viewList')).props.onClick();assert.deepEqual(cardIds(h.render()),['synthetic-location-1']);
 h.observed.controls.chips.find(chip=>chip.id==='map-area').onRemove();assert.equal(cardIds(h.render()).length,3);
 assert.equal(h.parameters().toString(),'');
});
test('desktop opens the map next to the first 24 cards and supplies all 51 matching locations to the map',async()=>{
 const {props}=await renderPage(Array.from({length:51},(_,index)=>listing(index+1)));
 const h=landingHarness({props,wide:true});const html=h.render();
 assert.equal(h.state['locations.landing.view'],'split');assert.equal(h.observed.map.locations.length,51);assert.equal(cardIds(html).length,24);
 assert.match(html,/locations-discovery-map[^"\n]*xl:sticky/);assert.match(html,/xl:grid-cols-2/);
 h.observed.controls.onQueryChange('film location 51');const filtered=h.render();assert.equal(h.observed.map.locations.length,1);assert.deepEqual(cardIds(filtered),['synthetic-location-51']);
});
test('landing passes only public area/pricing fields and keeps unsuccessful city geocoding unknown',async()=>{
 const privatePoint={address:'Synthetic exact private address',lat:52.5214321,lng:13.4123456};const area=privacy.publicLocationArea(privatePoint);
 const {props}=await renderPage([listing(1,{metadata:{location_area:{...area,address:privatePoint.address,exact_lat:privatePoint.lat},private_note:'PRIVATE_METADATA_CANARY',price_negotiable:true}}),listing(2)],'de',null,{},{});
 assert.deepEqual(props.allLocations[0].metadata.location_area,area);assert.equal(props.allLocations[0].lat,area.lat);assert.equal(props.allLocations[0].lng,area.lng);
 assert.equal(props.allLocations[1].lat,null);assert.equal(props.allLocations[1].lng,null);assert.ok(!JSON.stringify(props).includes(privatePoint.address));assert.ok(!JSON.stringify(props).includes(String(privatePoint.lat)));
});

for (const locale of locales) test(`${locale}: migrated indoor/outdoor and power filters constrain the same list and map and retain URL values`, async () => {
 const {props}=await renderPage([
  listing('indoor',{metadata:{indoor_outdoor:'innen',power_available:true}}),
  listing('outdoor',{metadata:{indoor_outdoor:'außen',power_available:false}}),
  listing('both',{metadata:{indoor_outdoor:'beides',power_available:true}}),
  listing('legacy',{description:'Lage: Innen · Stromanschluss vorhanden\n\nMember text'})
 ],locale);
 const h=landingHarness({locale,props,wide:true});h.render();
 const select=nodes(h.tree,node=>node.props.options?.some(option=>option.value==='Innen'))[0];assert.ok(select);
 select.props.onChange('Innen');assert.deepEqual(cardIds(h.render()),['synthetic-location-indoor','synthetic-location-both','synthetic-location-legacy']);
 assert.deepEqual(h.observed.map.locations.map(row=>row.id),cardIds(h.render()));
 assert.equal(h.parameters().get('lage'),'Innen');
 const powerLabel=nodes(h.tree,node=>node.type==='label' && text(node)===translate(locale,'locations')('filterPower'))[0];
 const powerInput=nodes(powerLabel,node=>node.type==='input')[0];assert.ok(powerInput);powerInput.props.onChange({target:{checked:true}});h.render();assert.equal(h.parameters().get('power'),'1');
 select.props.onChange('Außen');assert.deepEqual(cardIds(h.render()),['synthetic-location-both']);assert.equal(h.observed.map.locations.length,1);
 h.observed.controls.onReset();assert.equal(cardIds(h.render()).length,4);assert.equal(h.parameters().has('power'),false);assert.equal(h.parameters().has('lage'),false);
});

for (const locale of locales) test(`${locale}: nearby search is explicit, local, shared by map/list and cancellable without retaining precise coordinates`,async()=>{
 const {props}=await renderPage([listing('near'),listing('further'),listing('unknown')],locale);
 const points=[[52.52,13.405],[52,13],[null,null]];
 const modified={...props,allLocations:props.allLocations.map((row,index)=>({...row,lat:points[index][0],lng:points[index][1]}))};
 const requests=[];
 const h=landingHarness({locale,props:modified,wide:true,navigator:{geolocation:{getCurrentPosition(success,error){requests.push({success,error});}}}});
 const t=translate(locale,'locations');h.render();assert.equal(requests.length,0,'rendering must not request a visitor location');
 const locate=()=>nodes(h.tree,node=>node.type==='button' && text(node)===t('locateMe'))[0];
 locate().props.onClick();h.render();assert.equal(requests.length,1);
 requests[0].success({coords:{latitude:52.52,longitude:13.405}});
 assert.deepEqual(cardIds(h.render()),['synthetic-location-near']);assert.equal(h.observed.map.locations.length,1);assert.deepEqual(h.observed.map.userLocation,[52.52,13.405]);
 const radius=nodes(h.tree,node=>node.type==='select' && node.props['aria-label']===t('radiusLabel'))[0];assert.ok(radius);radius.props.onChange({target:{value:'100'}});
 assert.deepEqual(cardIds(h.render()),['synthetic-location-near','synthetic-location-further']);assert.equal(h.observed.map.radiusKm,100);
 assert.ok(!JSON.stringify(h.observed.urls).includes('52.52'));assert.ok(!JSON.stringify(h.state).includes('52.52'));
 h.observed.controls.onReset();assert.equal(cardIds(h.render()).length,3);assert.equal(h.observed.map.userLocation,null);
 locate().props.onClick();h.render();h.observed.controls.onReset();requests[1].success({coords:{latitude:52.52,longitude:13.405}});
 assert.equal(cardIds(h.render()).length,3,'a stale location callback cannot reactivate a reset filter');
 locate().props.onClick();h.render();requests[2].error({code:1});const html=h.render();assert.ok(html.includes(escaped(t('geolocationError'))));assert.equal(cardIds(html).length,3);
});

for(const locale of locales)test(`${locale}: panning and zooming update the list below the map in both directions without dropping map candidates`,async()=>{
 const {props:initial}=await renderPage([listing('berlin'),listing('munich'),listing('unknown')],locale);
 const coords=[[52.52,13.405],[48.14,11.58],[null,null]];
 const props={...initial,allLocations:initial.allLocations.map((row,i)=>({...row,lat:coords[i][0],lng:coords[i][1]}))};
 const h=landingHarness({locale,props,state:{'locations.landing.view':'map'}});
 let html=h.render();assert.ok(html.indexOf('data-location-map=') < html.indexOf('data-id='),'the matching list follows the map in DOM order');
 h.observed.map.onBoundsChange({south:52,north:53,west:13,east:14});html=h.render();assert.deepEqual(cardIds(html),['synthetic-location-berlin']);assert.equal(h.observed.map.visibleCount,1);assert.equal(h.observed.map.locations.length,3);
 h.observed.map.onBoundsChange({south:48,north:49,west:11,east:12});assert.deepEqual(cardIds(h.render()),['synthetic-location-munich']);assert.equal(h.observed.map.locations.length,3);
 h.observed.map.onBoundsChange({south:40,north:55,west:5,east:20});assert.deepEqual(cardIds(h.render()),['synthetic-location-berlin','synthetic-location-munich']);assert.equal(h.observed.map.visibleCount,2);
 h.observed.map.onBoundsChange({south:0,north:1,west:0,east:1});assert.deepEqual(cardIds(h.render()),[]);assert.equal(h.observed.map.locations.length,3,'an empty viewport must not prevent panning back to existing locations');
});

test('nearby viewport changes and pagination never persist a visitor coordinate or derived viewport in history state',async()=>{
 const {props}=await renderPage(Array.from({length:30},(_,i)=>listing(i)));
 props.allLocations.forEach(row=>{row.lat=52.521234;row.lng=13.409876;});let success;
 const h=landingHarness({props,wide:true,navigator:{geolocation:{getCurrentPosition(fn){success=fn;}}}});h.render();
 nodes(h.tree,node=>node.type==='button'&&text(node)===translate('de','locations')('locateMe'))[0].props.onClick();success({coords:{latitude:52.521234,longitude:13.409876}});h.render();
 h.observed.map.onBoundsChange({south:52.501234,north:52.541234,west:13.389876,east:13.429876});h.render();
 nodes(h.tree,node=>node.type==='button'&&text(node)===translate('de','locations')('landingMore'))[0].props.onClick();assert.equal(cardIds(h.render()).length,30);
 const saved=JSON.stringify(h.state);for(const value of ['52.521234','13.409876','52.501234','13.429876'])assert.ok(!saved.includes(value),saved);
});


test('all locations remain discoverable beyond the old 300-row cap, with bounded database and rating batches', async () => {
  const rows = Array.from({length: 521}, (_, index) => listing(index + 1));
  const {props, calls, ratingCalls, harness} = await renderPage(rows);
  assert.equal(props.allLocations.length, 521);
  assert.equal(props.totalCount, 521);
  assert.deepEqual(calls.filter(call => call[0] === 'range'), [['range', 0, 249], ['range', 250, 499], ['range', 500, 749]]);
  assert.equal(ratingCalls.flatMap(call => call.ids).length, 521);
  assert.ok(ratingCalls.every(call => call.ids.length <= 100));
  harness.observed.controls.onQueryChange('Synthetic film location 521');
  assert.deepEqual(cardIds(harness.render()), ['synthetic-location-521']);
});
