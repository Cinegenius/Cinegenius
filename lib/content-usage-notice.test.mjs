import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createTranslator} from 'next-intl';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const contexts = ['profile', 'company', 'offer', 'project', 'board'];
const visibilities = ['private', 'restricted', 'pending', 'public', 'configured'];
const locales = ['de', 'en', 'es', 'it', 'cs', 'hu'];
const source = readFileSync(new URL('../components/ContentUsageNotice.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
}}).outputText;
const catalogs = Object.fromEntries(locales.map(locale => [locale,
  JSON.parse(readFileSync(new URL('../messages/' + locale + '.json', import.meta.url), 'utf8')),
]));

function fixture(locale) {
  const translate = createTranslator({locale, messages: catalogs[locale], namespace: 'ContentUsageNotice'});
  const mod = {exports: {}};
  const mocks = {
    'next/link': {default: ({children, ...props}) => React.createElement('a', props, children)},
    'next-intl': {useTranslations: namespace => {
      assert.equal(namespace, 'ContentUsageNotice');
      return translate;
    }},
  };
  new Function('require', 'module', 'exports', compiled)(
    name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), mod, mod.exports,
  );
  return props => renderToStaticMarkup(React.createElement(mod.exports.default, props));
}

for (const locale of locales) {
  test(locale + ': every source and visibility renders an optional accessible explanation, not consent', () => {
    const render = fixture(locale);
    const copy = catalogs[locale].ContentUsageNotice;
    for (const context of contexts) for (const visibility of visibilities) {
      const html = render({context, visibility});
      assert.ok(html.includes(copy.short));
      assert.ok(html.includes(copy.details));
      assert.ok(html.includes(copy.rights));
      assert.ok(html.includes(visibility === 'public' ? copy.public[context] : copy[visibility]));
      assert.match(html, /<details class=/);
      assert.match(html, /<summary /);
      assert.match(html, /href="\/bildrechte"/);
      assert.doesNotMatch(html, /<input|<select|<textarea|<button|<form|<details[^>]+\bopen(?:=|\s|>)/);
      assert.doesNotMatch(html, /ContentUsageNotice\.|undefined|MISSING_MESSAGE/);
      if (visibility !== 'public' && visibility !== 'configured') for (const publicCopy of Object.values(copy.public)) {
        assert.ok(!html.includes(publicCopy), 'a private/restricted/pending explanation must not advertise public discovery');
      }
    }
  });
}

test('all six translations have exactly the same non-empty keys without placeholder drift', () => {
  function flatten(value, prefix = '') {
    return Object.entries(value).flatMap(([key, item]) => typeof item === 'object'
      ? flatten(item, prefix + key + '.') : [[prefix + key, item]]);
  }
  const expected = flatten(catalogs.de.ContentUsageNotice).map(([key]) => key);
  for (const locale of locales) {
    const entries = flatten(catalogs[locale].ContentUsageNotice);
    assert.deepEqual(entries.map(([key]) => key), expected);
    for (const [, value] of entries) {
      assert.ok(typeof value === 'string' && value.trim().length > 0);
      assert.doesNotMatch(value, /\{[^}]*\}/);
    }
  }
});

test('information introduces no consent or publication writer and leaves legal/auth pages alone', () => {
  assert.doesNotMatch(source, /fetch\(|useEffect|localStorage|sessionStorage|onClick|onChange|checked|defaultChecked/);
  // The pending AGB draft is not substituted for the active legal/authentication pages.
  for (const file of ['../app/agb/page.tsx', '../app/datenschutz/page.tsx', '../app/impressum/page.tsx', '../components/AuthForm.tsx']) {
    assert.doesNotMatch(readFileSync(new URL(file, import.meta.url), 'utf8'), /ContentUsageNotice/);
  }
});

// Cover the real upload entry points without mounting duplicate notices per individual photo.
test('existing photo form surfaces share one informational component and pass an explicit source', () => {
  for (const file of ['../app/profile/page.tsx','../app/company-setup/page.tsx','../app/inserat/page.tsx','../app/dashboard/page.tsx','../components/ProfileSetupWizard.tsx','../components/GuidedListingWizard.tsx']) {
    const form = readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.equal((form.match(/<ContentUsageNotice /g) ?? []).length, 1, file);
    assert.match(form, /<ContentUsageNotice context=/);
    assert.match(form, /visibility="configured"/);
  }
});
