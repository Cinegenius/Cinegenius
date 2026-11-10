import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createTranslator} from 'next-intl';
import ts from 'typescript';

// Real ICU/catalogue behavior without a Next request, Clerk, database or email transport.
export function messagesFor(locale = 'de') {
  return JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8'));
}
export function translatorFor(locale = 'de', namespace) {
  return createTranslator({locale, messages: messagesFor(locale), namespace, onError(error) { throw error; }});
}
export function intlServerFor(locale = 'de') {
  return {getLocale: async () => locale, getTranslations: async input => translatorFor(typeof input === 'object' ? input?.locale ?? locale : locale, typeof input === 'string' ? input : input?.namespace)};
}
const notificationUrl = new URL('./i18n/notification-copy.ts', import.meta.url);
const notificationRequire = createRequire(notificationUrl);
const code = ts.transpileModule(readFileSync(notificationUrl, 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true},
}).outputText;
const mod = {exports: {}};
new Function('require', 'module', 'exports', code)(notificationRequire, mod, mod.exports);
export const notificationCopy = mod.exports;

/** Native next-intl translators for component fixtures, including rich ICU and the active locale. */
export function intlClientFor(locale = 'de') {
  return {useLocale: () => locale, useTranslations: namespace => translatorFor(locale, namespace)};
}
