import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import * as icons from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { translatorFor } from './i18n-test-fixture.mjs';

const require = createRequire(import.meta.url);
function sourceFunction(file, name, scope) {
  const text = readFileSync(new URL(file, import.meta.url), 'utf8');
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const node = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name);
  assert.ok(node, `${name} must be the actual production function`);
  const code = ts.transpileModule(`module.exports = (${node.getText(ast).replace(/^export default /, '')});`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', ...Object.keys(scope), code)(require, mod, mod.exports, ...Object.values(scope));
  return mod.exports;
}

function profileEntry({ viewer = null, profile = null, visible = false } = {}) {
  const calls = [];
  const stop = (kind, href) => { throw Object.assign(new Error(kind), { kind, href }); };
  const page = sourceFunction('../app/profile/[slug]/page.tsx', 'ProfilePage', {
    getMetadataTranslations: async () => translatorFor('de'),
    auth: async () => ({ userId: viewer }),
    getProfile: async slug => { calls.push(['profile', slug]); return profile; },
    redirect: href => stop('redirect', href), notFound: () => stop('notFound'),
    profileAccessFor: async (ids, id) => {
      calls.push(['privacy', ids, id]);
      return new Map(ids.map(key => [key, { profile: visible }]));
    },
    db: { from: () => stop('existingProfileContinues') },
  });
  return { calls, open: slug => page({ params: Promise.resolve({ slug }) }) };
}

test('company/provider account without a Crew profile can open its own saved/menu profile link', async () => {
  const f = profileEntry({ viewer: 'own-account' });
  await assert.rejects(f.open('own-account'), e => e.kind === 'redirect' && e.href === '/dashboard');
  assert.deepEqual(f.calls, [['profile', 'own-account']], 'no public company lookup or profile creation');
});

for (const [viewer, slug] of [[null, 'own-account'], ['other-account', 'own-account'], ['own-account', 'unknown-slug']]) {
  test(`missing profile stays hidden for ${viewer ?? 'guest'} requesting ${slug}`, async () => {
    const f = profileEntry({ viewer });
    await assert.rejects(f.open(slug), e => e.kind === 'notFound' && !e.href);
    assert.equal(f.calls.length, 1);
  });
}

test('existing own profile still passes through the existing privacy check and rendering', async () => {
  const f = profileEntry({ viewer: 'own-account', profile: { user_id: 'own-account' }, visible: true });
  await assert.rejects(f.open('own-account'), e => e.kind === 'existingProfileContinues');
  assert.deepEqual(f.calls[1], ['privacy', ['own-account'], 'own-account']);
});

test('an existing hidden profile is never redirected or made public', async () => {
  const f = profileEntry({ viewer: 'other-account', profile: { user_id: 'own-account' } });
  await assert.rejects(f.open('own-account'), e => e.kind === 'notFound' && !e.href);
  assert.equal(f.calls[1][0], 'privacy');
});

function overview(companyId, canEdit) {
  const Overview = sourceFunction('../app/company-dashboard/DashboardClient.tsx', 'OverviewTab', {
    ...Object.fromEntries(['Briefcase', 'Package', 'Users', 'CheckCircle', 'AlertCircle', 'Plus', 'Settings', 'ExternalLink', 'Trash2', 'Loader2', 'X'].map(name => [name, icons[name]])),
    useState: React.useState, useEffect: React.useEffect,
    useTranslations: () => translatorFor('de'),
    Link: ({ children, ...props }) => React.createElement('a', props, children),
  });
  return renderToStaticMarkup(React.createElement(Overview, {
    company: { id: companyId, slug: 'selected-studio', name: 'Selected Studio', published: true },
    canEdit, canDelete: false, setTab() {},
  }));
}

test('all overview photo/edit links retain the selected company, including when another company is selected', () => {
  for (const id of ['company-a', 'company-b', 'id&other=value']) {
    const html = overview(id, true);
    const links = [...html.matchAll(/href="([^\"]+)"/g)].map(m => m[1]);
    const edits = links.filter(href => href.startsWith('/company-setup'));
    assert.ok(edits.length >= 2, 'photo and edit entry are both rendered');
    assert.ok(edits.every(href => href === `/company-setup?company_id=${encodeURIComponent(id)}`));
    assert.ok(links.includes('/companies/selected-studio'));
  }
});

test('read-only company members receive no photo/edit action leading to a denied editor', () => {
  const html = overview('company-a', false);
  assert.ok(!html.includes('href="/company-setup'));
  assert.ok(html.includes('href="/companies/selected-studio"'));
});
