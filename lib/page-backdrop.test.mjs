import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import * as protectedMedia from './protected-media.ts';

const require = createRequire(import.meta.url);

function load(file, mocks) {
  const code = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), mod, mod.exports);
  return mod.exports;
}

const MediaImage = load('../components/MediaImage.tsx', { '@/lib/protected-media': protectedMedia }).default;
const { PageBackdrop, PROJECTS_BACKDROP_IMAGE } = load('../components/PageHeader.tsx', {
  '@/components/MediaImage': { default: MediaImage },
});
const render = props => renderToStaticMarkup(React.createElement(PageBackdrop, props));
const imageTag = html => html.match(/<img\b[^>]*>/)[0];
const attribute = (tag, name) => tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1].replaceAll('&amp;', '&');

test('existing backdrops retain their direct source, eager preload and presentation by default', () => {
  const html = render({});
  const image = imageTag(html);
  assert.equal(attribute(image, 'src'), PROJECTS_BACKDROP_IMAGE);
  assert.equal(attribute(image, 'srcSet'), undefined);
  assert.equal(attribute(image, 'sizes'), undefined);
  assert.match(html, /<link rel="preload" as="image"/);
  assert.match(html, /class="pointer-events-none overflow-hidden absolute inset-0 z-0"/);
  assert.equal(attribute(image, 'class'), 'object-cover');
  assert.match(attribute(image, 'style'), /object-position:center 42%/);
  assert.match(attribute(image, 'style'), /opacity:0\.2/);
  assert.match(html, /class="absolute inset-0 bg-gradient-to-b from-bg-primary\/60 via-bg-primary\/40 to-bg-primary\/80"/);
  assert.equal(attribute(imageTag(render({ image: '/hero-bg.jpg' })), 'src'), '/hero-bg.jpg');
});

test('opting in serves responsive homepage backdrop derivatives with the same layout and overlay', () => {
  const props = {
    image: '/hero-bg.jpg', imageOpacity: 100, className: 'pointer-events-none fixed inset-0 z-[-1]',
    overlayClassName: 'absolute inset-0 bg-bg-primary/72',
  };
  const html = render({ ...props, optimizeImage: true });
  const image = imageTag(html);
  const directImage = imageTag(render(props));
  assert.equal(attribute(image, 'sizes'), '100vw');
  const candidates = attribute(image, 'srcSet').split(', ').map(candidate => {
    const [url, width] = candidate.split(' ');
    const parsed = new URL(url, 'https://www.cinegenius.co');
    assert.equal(parsed.pathname, '/_next/image');
    assert.equal(parsed.searchParams.get('url'), '/hero-bg.jpg');
    assert.equal(`${parsed.searchParams.get('w')}w`, width);
    return Number(parsed.searchParams.get('w'));
  });
  assert.ok(candidates.length > 1 && candidates.some(width => width <= 1080), 'phones receive bounded responsive candidates');
  assert.equal(new URL(attribute(image, 'src'), 'https://www.cinegenius.co').pathname, '/_next/image');
  for (const name of ['alt', 'class', 'style', 'data-nimg']) assert.equal(attribute(image, name), attribute(directImage, name));
  assert.match(html, /class="pointer-events-none overflow-hidden pointer-events-none fixed inset-0 z-\[-1\]"/);
  assert.match(html, /class="absolute inset-0 bg-bg-primary\/72"/);
});

test('the optimization opt-in still keeps protected media outside the shared optimizer', () => {
  const src = '/api/media/user_own/0123456789abcdef0123456789abcdef.webp';
  const html = render({ image: src, optimizeImage: true });
  const image = imageTag(html);
  assert.equal(attribute(image, 'src'), `${src}?size=detail`);
  assert.equal(attribute(image, 'srcSet'), undefined);
  assert.doesNotMatch(html, /\/_next\/image/);
});
