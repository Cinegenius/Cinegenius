import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { PassThrough } from 'node:stream';
import React from 'react';
import { renderToPipeableStream } from 'react-dom/server';
import ts from 'typescript';
import * as rights from './project-media-rights.ts';
import * as labels from './project-type-labels.ts';
import { intlServerFor } from './i18n-test-fixture.mjs';

const require = createRequire(import.meta.url);
function load(path, mocks) {
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), mod, mod.exports);
  return mod.exports;
}

test('home projects read only published records, limit their payload, and omit unconfirmed media and private licensing data', async () => {
  const calls = [];
  const own = { id: 'own', title: 'Public project', year: 2026, type: 'Spielfilm', poster_url: '/api/media/own', created_by: 'author' };
  const metadata = { media_rights: rights.projectMediaGrant(own, { confirmed: true, basis: 'own', holder: 'author', credit: 'Artist' }, 'author') };
  const query = Object.fromEntries(['select','order','limit','abortSignal'].map(method => [method, (...args) => { calls.push([method, ...args]); return query; }]));
  query.then = resolve => Promise.resolve({ data: [{ ...own, metadata }, { ...own, id: 'unconfirmed', metadata: {} }], error: null }).then(resolve);
  const { getHomeProjects } = load('./home-projects-server.ts', { 'server-only': {}, '@/lib/db': { db: { from(table) { assert.equal(table, 'projects'); return query; } } }, '@/lib/project-media-rights': rights });
  const rows = await getHomeProjects();
  assert.equal(rows[0].poster_url, '/api/media/own');
  assert.equal(rows[0].image_credit, 'Artist');
  assert.equal(rows[1].poster_url, null);
  assert.equal(rows[1].image_credit, null);
  assert.ok(rows.every(row => !('metadata' in row) && !('created_by' in row)));
  assert.deepEqual(calls.find(call => call[0] === 'limit'), ['limit', 12]);
  assert.ok(calls.find(call => call[0] === 'abortSignal')[1] instanceof AbortSignal);
  query.then = resolve => Promise.resolve({ data: null, error: { message: 'private database detail' } }).then(resolve);
  await assert.rejects(getHomeProjects, /^Error: Homepage projects unavailable$/);
});

function component(getHomeProjects, locale = 'de') {
  return load('../components/HomeProjects.tsx', {
    'next-intl/server': intlServerFor(locale),
    'next/link': { default: ({children, ...props}) => React.createElement('a', props, children) },
    '@/components/MediaImage': { default: ({src, alt}) => React.createElement('img', {src, alt}) },
    '@/components/HomeCardRail': { default: ({children}) => React.createElement('div', { 'data-project-rail': true }, children) },
    '@/lib/home-projects-server': { getHomeProjects }, '@/lib/project-type-labels': labels,
  }).default;
}
function stream(Component) {
  const output = new PassThrough();
  let html = '', shellReady;
  output.on('data', chunk => { html += chunk.toString(); });
  const finished = new Promise(resolve => output.on('end', resolve));
  const shell = new Promise(resolve => { shellReady = resolve; });
  const rendering = renderToPipeableStream(React.createElement(Component), { onShellReady() { rendering.pipe(output); shellReady(); } });
  return { html: () => html, finished, shell, abort: () => rendering.abort() };
}

test('project destination is usable while cards are pending and remains usable on failure', {timeout:3000}, async context => {
  context.mock.method(console, 'error', () => {});
  let reject;
  const pending = new Promise((_, fail) => { reject = fail; });
  const result = stream(component(() => pending));
  context.after(result.abort);
  await result.shell;
  assert.match(result.html(), /href="\/projects\/alle"/);
  assert.doesNotMatch(result.html(), /data-project-rail/);
  reject(new Error('Fixture unavailable'));
  await result.finished;
  assert.match(result.html(), /href="\/projects\/alle"/);
  assert.doesNotMatch(result.html(), /Fixture unavailable|data-project-rail/);
});

test('project rail contains only real project links and preserves media attribution in every locale', {timeout:10000}, async () => {
  for (const locale of ['de','en','es','it','cs','hu','nl','nl-BE','sv','fr','pl','pt-PT','zh-Hans','ja','ko','ru','uk']) {
    const result = stream(component(async () => [
      {id:'with-photo',title:'Real project',year:2026,type:'Spielfilm',poster_url:'/api/media/poster',image_credit:'Real artist'},
      {id:'without-photo',title:'Real project without artwork',year:null,type:null,poster_url:null,image_credit:null},
    ], locale));
    await result.finished;
    assert.match(result.html(), /href="\/projects\/with-photo"/, locale);
    assert.match(result.html(), /href="\/projects\/without-photo"/, locale);
    assert.match(result.html(), /©/, locale);
    assert.match(result.html(), /Real artist/, locale);
    assert.equal((result.html().match(/<img /g) ?? []).length, 1, locale);
  }
});
