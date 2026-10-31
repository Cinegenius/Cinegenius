import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { PassThrough } from 'node:stream';
import React from 'react';
import { renderToPipeableStream } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const crew = { user_id: 'own-crew', slug: 'own-crew', display_name: 'Own Crew', profile_type: 'lighting', profile_types: [], positions: [], created_at: '2026-10-30T08:00:00Z' };

function fixture({ queryResult, photoError = false, profiles = [], photoResult, privateIds = [] } = {}) {
  const queries = [], photoCalls = [], ratingCalls = [], selections = [];
  let ratingsStarted;
  const ratingsReady = new Promise(resolve => { ratingsStarted = resolve; });
  let started;
  const queriesStarted = new Promise(resolve => { started = resolve; });
  const db = { from(table) {
    const query = {
      select(fields) { selections.push({table,fields}); return query; }, eq() { return query; }, in() { return query; }, not() { return query; },
      neq() { return query; }, order() { return query; }, limit() { return query; },
      then(resolve, reject) {
        queries.push(table);
        started();
        return Promise.resolve(queryResult ?? { data: table === 'profiles' ? profiles : [], error: null }).then(resolve, reject);
      },
    };
    return query;
  } };
  const empty = () => null;
  const mocks = {
    '@/components/AiDisclosureBadge': {default:()=>null},
    '@/lib/db': { db }, '@/lib/listing-price': { listingPriceLabel: () => 'VB' },
    '@/lib/listing-provider': { getListingProviders: async () => [] }, '@/lib/listing-routes': { listingDetailPath: () => '/props/own-prop' },
    '@clerk/nextjs/server': { auth: async () => ({ userId: null }) },
    'next-intl/server': { getLocale: async () => 'de', getTranslations: async () => key => key },
    'next/link': { default: ({ href, children }) => React.createElement('a', { href }, children) },
    '@/components/MediaImage': { default: empty }, '@/components/PageHeader': { PageBackdrop: empty },
    '@/components/HeroSearch': { default: () => React.createElement('form', { action: '/search', 'data-home-search': true }) },
    '@/components/CommunityBoard': { default: empty }, '@/components/HomeCompanyPartners': { default: empty },
    '@/components/HomePhotoDiscovery': { HomePhotoDiscovery: ({ newPhotos }) => React.createElement('div', { 'data-photo-count': newPhotos.length }) },
    '@/components/Skeleton': { SkeletonBox: () => React.createElement('div', { 'data-home-skeleton': true }) },
    '@/lib/companyCategories': { COMPANY_CATEGORIES: [] },
    '@/lib/profile-types': { PROFILE_CATEGORY_MAP: { lighting: 'crew' }, PROFILE_TYPE_LABELS: { lighting: 'Lighting' } },
    '@/lib/trust': { getPrivateProfileIds: async () => new Set(privateIds) }, '@/lib/ratings': { fetchRatingSummaries: async (ids,type) => {ratingCalls.push({ids,type});ratingsStarted();return {};} },
    '@/lib/rating-ranking': { rankByRatingConfidence: rows => rows },
    '@/lib/community-media-server': { getCommunityMedia: async options => {
      photoCalls.push(options);
      if (photoError) throw new Error('Own fixture media failure');
      return photoResult ?? { photos: [] };
    } },
  };
  const source = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), mod, mod.exports);
  return { ...mod.exports, queries, queriesStarted, photoCalls, selections, ratingCalls, ratingsReady };
}

function startStream(Page) {
  const output = new PassThrough(), errors = [];
  let html = '', ready;
  output.on('data', chunk => { html += chunk.toString(); });
  const finished = new Promise((resolve, reject) => { output.on('end', resolve); output.on('error', reject); });
  const shell = new Promise(resolve => { ready = resolve; });
  const stream = renderToPipeableStream(React.createElement(Page), {
    onShellReady() { stream.pipe(output); ready(); },
    onError(error) { errors.push(error); },
  });
  return { shell, finished, errors, html: () => html, abort: () => stream.abort() };
}

test('hero, search and fixed discovery sections stream while recommendation data is still pending', { timeout: 3000 }, async context => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const home = fixture({ queryResult: pending });
  const stream = startStream(home.default);
  context.after(() => { release({ data: [], error: null }); stream.abort(); });
  await stream.shell;
  await home.queriesStarted;
  assert.ok(home.queries.length > 0, 'the recommendation queries actually started and remain pending');
  assert.match(stream.html(), /<h1[^>]*>homepageTitle<\/h1>/);
  assert.match(stream.html(), /data-home-search="true"/);
  assert.match(stream.html(), /findLocationsTitle/);
  assert.match(stream.html(), /offerLocationTitle/);
  assert.match(stream.html(), /howSearchTitle/);
  assert.match(stream.html(), /data-home-skeleton="true"/);
  assert.doesNotMatch(stream.html(), /newCrewTitle/);
  release({ data: [], error: null });
  await stream.finished;
  assert.match(stream.html(), /newCrewTitle/);
  assert.deepEqual(stream.errors, []);
});

test('database recommendation failure keeps the static homepage and renders its translated notice', { timeout: 3000 }, async context => {
  context.mock.method(console, 'error', () => {});
  const home = fixture({ queryResult: { data: null, error: { code: 'PGRST003' } } });
  const stream = startStream(home.default);
  context.after(stream.abort);
  await stream.finished;
  assert.match(stream.html(), /homepageTitle/);
  assert.match(stream.html(), /data-home-search="true"/);
  assert.match(stream.html(), /role="status"[^>]*>recommendationsUnavailable/);
  assert.deepEqual(stream.errors, []);
});

test('an optional photo failure retains other recommendations and uses a bounded count-free photo request', { timeout: 3000 }, async context => {
  context.mock.method(console, 'error', () => {});
  const home = fixture({ profiles: [crew], photoError: true });
  const stream = startStream(home.default);
  context.after(stream.abort);
  await stream.finished;
  assert.match(stream.html(), /Own Crew/);
  assert.match(stream.html(), /data-photo-count="0"/);
  assert.doesNotMatch(stream.html(), /recommendationsUnavailable/);
  assert.equal(home.photoCalls[0].includeTotal, false);
  assert.ok(home.photoCalls[0].signal instanceof AbortSignal);
  assert.deepEqual(stream.errors, []);
});

test('the recommendation failure notice is present in every supported locale', () => {
  for (const locale of ['de', 'en', 'es', 'it', 'cs', 'hu']) {
    const messages = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8'));
    assert.ok(messages.home.recommendationsUnavailable?.trim(), locale);
  }
});


test('slow photo discovery does not block crew ratings; unused galleries and non-crew/private ratings are not fetched', {timeout:3000}, async context => {
  let release;const photoResult=new Promise(resolve=>{release=resolve});
  const home=fixture({photoResult,profiles:[crew,{...crew,user_id:'own-provider',profile_type:'company',positions:[]},{...crew,user_id:'private-crew'}],privateIds:['private-crew']});
  const stream=startStream(home.default);context.after(()=>{release({photos:[]});stream.abort()});
  await home.ratingsReady;
  assert.deepEqual(home.ratingCalls,[{ids:['own-crew'],type:'user'}]);
  const profileSelect=home.selections.find(s=>s.table==='profiles').fields.split(',');
  assert.ok(profileSelect.includes('avatar_url'));assert.ok(!profileSelect.includes('profile_images'));assert.ok(!profileSelect.includes('portfolio_images'));
  release({photos:[]});await stream.finished;assert.match(stream.html(),/Own Crew/);assert.doesNotMatch(stream.html(),/private-crew|own-provider/);assert.deepEqual(stream.errors,[]);
});
