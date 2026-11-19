import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { NATIVE_CREATE_DESTINATIONS } from './native-create-destinations.ts';
import { SUPPORTED_LOCALES } from './i18n/locales.ts';
import { translatorFor } from './i18n-test-fixture.mjs';

test('native create choices point to existing guarded editors and never duplicate personal profile creation', () => {
  assert.deepEqual(NATIVE_CREATE_DESTINATIONS.map(item => item.href), [
    '/inserat?group=marktplatz', '/inserat?group=drehorte', '/inserat?group=jobs', '/projects/neu', '/company-setup', '/profile',
  ]);
  for (const item of NATIVE_CREATE_DESTINATIONS) assert.ok(existsSync(`app${item.href.split('?')[0]}/page.tsx`), item.href);
  assert.equal(NATIVE_CREATE_DESTINATIONS.filter(item => item.id === 'profile').length, 1);
  assert.equal(NATIVE_CREATE_DESTINATIONS.find(item => item.id === 'profile').label, 'PersonalArea.editProfile');
});

for (const locale of SUPPORTED_LOCALES) test(`${locale}: native create title and every destination have full localized labels`, () => {
  const t = translatorFor(locale);
  for (const key of ['NativeAppChrome.createEntry', ...NATIVE_CREATE_DESTINATIONS.map(item => item.label)]) {
    assert.ok(t(key).trim()); assert.notEqual(t(key),key);
  }
});

test('location creation accepts its existing direct destination while confirmed saved location recovery still takes precedence', () => {
  const source = readFileSync('app/inserat/page.tsx','utf8');
  const initial = source.match(/const group = new URLSearchParams\(window.location.search\).get\("group"\);([\s\S]*?)\}, \[\]\);/)?.[1];
  assert.ok(initial);
  assert.match(initial, /group === "drehorte"/);
  assert.match(initial, /setActiveGroup\(current => current \?\? group\)/);
  assert.match(source, /saved\?\.version === 1/);
  assert.match(source, /setActiveGroup\(typeof saved.groupId === "string"/);
});

test('native directory header compaction is exact-marker scoped and covers nested News markup', () => {
  const css = readFileSync('components/PageHeader.module.css','utf8');
  assert.match(css, /html\[data-cg-native-community-appearance="app"\]/);
  assert.match(css, /:global\(\.directory-page\) \.hero/);
  assert.doesNotMatch(css, /\.directory-page\) > \.hero/);
  assert.match(css, /data-page-header="title"/);
  assert.match(css, /clip-path: inset\(50%\)/);
  const news = readFileSync('app/news/page.tsx','utf8');
  assert.match(news, /<DirectoryPage area="news"><main/);
});
