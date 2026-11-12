import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

function render(pathname) {
  const mocks = {
    'react/jsx-runtime': jsxRuntime,
    'next/navigation': { usePathname: () => pathname },
    '@/lib/server-admin-context': {ServerAdminContext: React.createContext(null)},
    '@/components/NavigationRestoration': { default: () => null },
    '@/components/LegalLanguageNotice': { default: () => null },
    '@/components/Navbar': { default: () => React.createElement('header', null, 'Navigation') },
    '@/components/BottomNav': { default: () => React.createElement('nav', { 'data-fixture-bottom-navigation': true }) },
    '@/components/Footer': { default: () => React.createElement('footer', null, 'Public footer') },
    '@/components/PersonalAreaNavigation': { default: ({ children }) => children },
    '@/contexts/SiteNavigationContext': { SiteNavigationProvider: ({ children }) => children },
    '@/components/SiteNavigationMenu': { default: () => null },
  };
  const compiled = ts.transpileModule(readFileSync(new URL('../components/AppChrome.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(name => mocks[name], mod, mod.exports);
  return renderToStaticMarkup(React.createElement(mod.exports.default, { initialIsSignedIn: true }, React.createElement('div', null, 'Page content')));
}

test('fixed messaging workspace has no overlapping public footer; normal pages retain it', () => {
  assert.doesNotMatch(render('/messages'), /<footer/);
  assert.match(render('/messages'), /Page content/);
  assert.match(render('/messages'), /<header/);
  for (const route of ['/', '/companies', '/profile/example']) assert.match(render(route), /<footer/);
});

test('the shared shell mounts one bottom navigation across public and personal areas', () => {
  for (const route of ['/', '/creators', '/locations', '/projects', '/props', '/dashboard', '/profile', '/messages', '/notifications', '/company-dashboard']) {
    assert.equal([...render(route).matchAll(/data-fixture-bottom-navigation=/g)].length, 1, route);
  }
});

test('guided profile setup keeps its dedicated shell', () => {
  const html = render('/profile-setup');
  assert.match(html, /Page content/);
  assert.doesNotMatch(html, /<header|<footer|data-fixture-bottom-navigation/);
});
