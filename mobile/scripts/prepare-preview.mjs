import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from '../../lib/i18n/locales.ts';
import { previewConfig } from './preview-config.mjs';

const root = new URL('../', import.meta.url);
const repository = new URL('../', root);
const { values } = parseArgs({ options: { url: { type: 'string' } } });
const config = previewConfig(values.url);
const output = new URL('www/', root);
await mkdir(new URL('locales/', output), { recursive: true });

const escapeHtml = value => value.replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);
let fallback;
for (const locale of SUPPORTED_LOCALES) {
  const catalog = JSON.parse(await readFile(new URL(`messages/${locale}.json`, repository), 'utf8'));
  const copy = catalog.MobilePreview;
  for (const key of ['unavailableTitle', 'unavailableDescription', 'retry']) {
    if (typeof copy?.[key] !== 'string' || !copy[key].trim()) throw new Error(`Missing MobilePreview.${key} in ${locale}`);
  }
  await writeFile(new URL(`locales/${locale}.json`, output), JSON.stringify(copy));
  if (locale === DEFAULT_LOCALE) fallback = copy;
}

let html = await readFile(new URL('src/offline.html', root), 'utf8');
for (const [key, value] of Object.entries(fallback)) html = html.replaceAll(`{{${key}}}`, escapeHtml(value));
html = html.replaceAll('{{url}}', escapeHtml(config.server.url));
await writeFile(new URL('offline.html', output), html);
await writeFile(new URL('index.html', output), html);
for (const name of ['offline.css', 'offline.js']) {
  await copyFile(new URL(`src/${name}`, root), new URL(name, output));
}
// Reuse the application's locale resolver; no second language policy or catalogs.
const localeSource = await readFile(new URL('lib/i18n/locales.ts', repository), 'utf8');
await writeFile(new URL('locale.js', output), stripTypeScriptTypes(localeSource));
await writeFile(new URL('capacitor.config.json', root), JSON.stringify(config, null, 2) + '\n');
console.log(`Prepared development preview for ${config.server.url} in ${fileURLToPath(root)}`);
