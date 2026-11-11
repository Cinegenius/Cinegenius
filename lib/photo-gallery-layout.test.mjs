import {intlClientFor, translatorFor} from './i18n-test-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {photoHref} from './photo-link.ts';
import {communityPreviewUrl} from './community-preview.ts';
import * as protectedMedia from './protected-media.ts';
const require = createRequire(import.meta.url);
const compile = path => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true}}).outputText;
function load(code, mocks) {
  const mod = {exports: {}};
  new Function('require', 'module', 'exports', code)(name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), mod, mod.exports);
  return mod.exports;
}
// Both shared MediaImage and Next Image render normally; no image/network request occurs in SSR.
const MediaImage = load(compile('../components/MediaImage.tsx'), {'@/lib/protected-media': protectedMedia}).default;
const galleryCode = compile('../components/PhotoGallery.tsx');
const items = Object.freeze(['portrait', 'landscape', 'logo'].map((kind, index) => Object.freeze({
  profileId: `own-${index}`, profileSlug: `own-${index}`, author: `Author ${kind}`, authorHref: `/profile/own-${index}`,
  sourceTitle: `Source ${kind}`, imageKind: `Kind ${kind}`, imageUrl: `/api/media/own-${index}/${kind}.webp`,
  caption: `Caption ${kind}`, fit: kind === 'logo' ? 'contain' : 'cover', likeCount: index + 2, likedByMe: index === 1,
  canLike: index !== 2, rating: 0, count: 0,
})));
const walk = node => node == null || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(walk) : [node, ...walk(node.props?.children)];
const text = html => html.replace(/<[^>]*>/g, '');
function fixture(locale = 'de', controlled = false) {
  let failed = new Set();
  const dialogs = [], likes = [];
  const PhotoGallery = load(galleryCode, {
    react: controlled ? {...React, useState: () => [failed, value => { failed = typeof value === 'function' ? value(failed) : value; }], useCallback: callback => callback} : React,
    'next-intl': intlClientFor(locale),
    'next/link': ({children, ...props}) => React.createElement('a', props, children),
    'next/navigation': {useRouter: () => ({back() {}, replace() {}})},
    '@/components/HomePhotoDiscovery': {PhotoDialog: props => { dialogs.push(props); return null; }},
    '@/components/MediaImage': MediaImage,
    '@/components/PhotoLikeButton': props => { likes.push(props); return React.createElement('button', {'data-like-owner': props.profileId, 'data-like-image': props.imageUrl}, '♥'); },
    '@/lib/photo-link': {photoHref}, '@/lib/community-preview': {communityPreviewUrl},
  }).PhotoGallery;
  return {dialogs, likes, render(props = {}) { const input = {items, selectedPhoto: null, resumeLike: false, ...props}; return controlled ? PhotoGallery(input) : React.createElement(PhotoGallery, input); }};
}

test('SSR shows complete proportionally scaled photos without forced frames, gutters, footer, tint or hover metadata', () => {
  const f = fixture();
  const html = renderToStaticMarkup(f.render());
  assert.match(html, /role="list" class="columns-2 gap-0 md:columns-3 xl:columns-4"/);
  assert.match(html, /class="site-container pb-6"/);
  const articles = [...html.matchAll(/<article[^>]+class="([^"]+)"/g)];
  assert.equal(articles.length, items.length);
  for (const [, classes] of articles) { assert.match(classes, /(?:^| )block(?: |$)/); assert.doesNotMatch(classes, /(?:^| )(?:inline-block|mb-|rounded|border|bg-)/); }
  assert.equal((html.match(/class="block h-auto w-full"/g) ?? []).length, items.length);
  assert.equal(text(html), '♥'.repeat(items.length));
  assert.doesNotMatch(html, /aspect-ratio|object-cover|object-contain|position:absolute|bg-gradient|group-hover|<footer|<p/);
  for (const item of items) assert.ok(!html.includes(`href="${item.authorHref}"`));
});

test('actual shared MediaImage renders bounded unoptimized thumbnails while links and like tuples keep original identities', () => {
  const f = fixture('de', true);
  const tree = f.render();
  const images = walk(tree).filter(node => node.type === MediaImage);
  assert.equal(images.length, items.length);
  for (const [index, node] of images.entries()) {
    assert.equal(node.props.src, communityPreviewUrl(items[index].imageUrl));
    assert.equal(node.props.fill, undefined); assert.equal(node.props.mediaSize, 'thumbnail');
    assert.equal(node.props.width, 640); assert.equal(node.props.height, 640);
    assert.equal(node.props.className, 'block h-auto w-full');
    assert.equal(node.props.onLoad, undefined); assert.equal(node.props.onLoadingComplete, undefined);
    assert.match(node.props.sizes, /767px\) 50vw/); assert.match(node.props.sizes, /1279px\) 33vw/); assert.match(node.props.sizes, /320px$/);
  }
  const html = renderToStaticMarkup(tree);
  const sources = [...html.matchAll(/<img[^>]+src="([^"]+)"/g)].map(match => match[1].replaceAll('&amp;', '&'));
  assert.deepEqual(sources, items.map(item => communityPreviewUrl(item.imageUrl)));
  assert.doesNotMatch(html, /\/_next\/image|srcSet=/, 'guarded previews must bypass the shared optimizer');
  for (const [index, item] of items.entries()) {
    assert.ok(html.includes(photoHref(item.profileId, item.imageUrl).replaceAll('&', '&amp;')));
    assert.deepEqual([f.likes[index].profileId, f.likes[index].imageUrl, f.likes[index].initialCount, f.likes[index].initialLiked, f.likes[index].disabled], [item.profileId, item.imageUrl, item.likeCount, item.likedByMe, item.canLike === false]);
  }
  assert.equal(f.dialogs.length, 0);
  renderToStaticMarkup(f.render({selectedPhoto: items[1], resumeLike: true}));
  assert.equal(f.dialogs[0].photo, items[1]); assert.equal(f.dialogs[0].resumeLike, true);
});

test('preview errors remove only failed photos, preserve original data, and show the existing localized all-failed message', () => {
  for (const locale of ['de', 'en', 'es', 'it', 'cs', 'hu', 'nl', 'nl-BE', 'sv']) {
    const f = fixture(locale, true);
    const original = JSON.stringify(items);
    let tree = f.render();
    const firstImages = walk(tree).filter(node => node.type === MediaImage);
    firstImages[1].props.onError();
    tree = f.render();
    const remaining = walk(tree).filter(node => node.type === MediaImage);
    assert.deepEqual(remaining.map(node => node.props.src), [communityPreviewUrl(items[0].imageUrl), communityPreviewUrl(items[2].imageUrl)]);
    assert.ok(walk(tree).every(node => node.props?.style?.aspectRatio === undefined));
    assert.equal(walk(tree).filter(node => node.type === 'article').length, 2);
    assert.equal(text(renderToStaticMarkup(tree)), '♥♥');
    for (const image of remaining) image.props.onError();
    const failed = renderToStaticMarkup(f.render());
    assert.equal(text(failed), translatorFor(locale)('MediaGallery.unavailable'));
    assert.match(failed, /role="status"/); assert.doesNotMatch(failed, /<img|<article|<button|role="listitem"/);
    assert.equal(JSON.stringify(items), original);
    const fresh = renderToStaticMarkup(fixture(locale).render());
    assert.equal((fresh.match(/role="listitem"/g) ?? []).length, items.length, 'failure is local, not persisted deletion');
  }
});

test('empty gallery keeps the existing empty-state message and creates no fake photo slots', () => {
  const html = renderToStaticMarkup(fixture().render({items: []}));
  assert.equal(text(html), translatorFor()('Ui.text_f9a7c6cc9eb091'));
  assert.doesNotMatch(html, /<img|role="listitem"/);
});

test('only the photo page surface changes to the existing design token without a new backdrop image', () => {
  const page = readFileSync(new URL('../app/photo/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /min-h-screen bg-bg-primary/);
  assert.doesNotMatch(page, /min-h-screen bg-black|photo-bg\.jpg|<Image/);
});
