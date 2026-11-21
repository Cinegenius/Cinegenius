import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {NATIVE_APP_NAV_ITEMS, NATIVE_APP_MENU_ITEMS, nativeAppActiveArea} from './native-app-navigation.ts';

test('native navigation uses the approved real routes with Smart geometrically centered', () => {
  assert.deepEqual(NATIVE_APP_NAV_ITEMS.map(({id, href}) => [id, href]), [
    ['shots', '/app/shots'], ['news', '/news'], ['smart', '/search?smart=1'], ['projects', '/projects'], ['workspace', '/app/workspace'],
  ]);
  assert.equal(NATIVE_APP_NAV_ITEMS[2].id, 'smart');
  assert.equal(new Set(NATIVE_APP_NAV_ITEMS.map(item => item.href)).size, 5);
  assert.deepEqual(NATIVE_APP_MENU_ITEMS.map(item => item.href), ['/community', '/help', '/support']);
  for(const item of [...NATIVE_APP_NAV_ITEMS, ...NATIVE_APP_MENU_ITEMS]) assert.ok(item.href.startsWith('/') && !item.href.startsWith('//'));
});

test('native active areas follow canonical public lists and details with strict route boundaries', () => {
  const cases = {
    shots: ['/app/shots', '/app/shots/example'], workspace: ['/app/workspace', '/app/workspace/example'],
    smart: ['/search','/creators','/creators/fixture','/person/fixture','/profile/fixture','/props/fixture','/vehicles/fixture','/locations/fixture','/companies/fixture','/jobs/fixture','/tiere/fixture','/marketplace'],
    news: ['/news','/news/organization/entry','/organizations','/organizations/fixture'], projects: ['/projects','/projects/film','/projects/fixture'],
  };
  for(const [area, paths] of Object.entries(cases)) for(const path of paths) assert.equal(nativeAppActiveArea(path),area,path);
  for(const path of ['/','/app','/app/shots-other','/app/workspaces','/search-history','/newspaper','/projects-other','/profile','/dashboard','/dashboard/projects/new','/messages','/notifications','/favorites','/company-dashboard','/organization-dashboard','/invoices','/booking','/companies/fixture/message','/projects/neu','/organizations-other','/community','/help','/support','/tools','/photo','/bts']) assert.equal(nativeAppActiveArea(path),null,path);
});

test('native glass styles preserve five equal touch columns, safe area, reduced motion and neutral fallback', () => {
  const css=readFileSync(new URL('../components/app/NativeAppBottomNav.module.css',import.meta.url),'utf8');
  assert.match(css,/grid-template-columns:\s*repeat\(5, minmax\(44px, 1fr\)\)/);
  assert.match(css,/\.item\s*\{[^}]*min-width:\s*44px;[^}]*min-height:\s*52px;/s);
  assert.match(css,/--mobile-safe-area-height, env\(safe-area-inset-bottom, 0px\)/);
  assert.match(css,/prefers-reduced-motion: reduce[^}]*transition: none/s);
  assert.match(css,/var\(--cg-app-accent, #c2f135\)/);
  assert.match(css,/\.menu\.menu\s*\{[^}]*height:\s*auto;[^}]*max-height:\s*calc\(100dvh/s);
  const component=readFileSync(new URL('../components/app/NativeAppBottomNav.tsx',import.meta.url),'utf8');
  assert.doesNotMatch(component,/pushState|replaceState|localStorage|fetch\(/);
  assert.match(component,/onPointerDown=\{pointerDown\}/);
  assert.match(component,/useFormNavigation/);
  assert.match(component,/data-native-app-gesture-ready/);
  assert.match(component,/cinegenius:native-navigation-preview/);
});
