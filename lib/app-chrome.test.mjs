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
    '@/components/Navbar': { default: () => React.createElement('header', null, 'Navigation') },
    '@/components/BottomNav': { default: () => null },
    '@/components/Footer': { default: () => React.createElement('footer', null, 'Public footer') },
    '@/components/PersonalAreaNavigation': { default: ({ children }) => children },
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
