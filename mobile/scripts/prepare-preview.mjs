import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from '../../lib/i18n/locales.ts';
import { previewConfig } from './preview-config.mjs';
import { prepareNativeResources } from './native-resources.mjs';

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
html = html.replaceAll('{{url}}', escapeHtml(new URL(config.server.appStartPath, config.server.url).href));
await writeFile(new URL('offline.html', output), html);
await writeFile(new URL('index.html', output), html);
// Capacitor verifies the local start file even when the entry URL is remote.
// Keep a localized fallback at the configured sign-in path to avoid exit(1).
if (config.server.appStartPath) await writeFile(new URL(config.server.appStartPath, output), html);
for (const name of ['offline.css', 'offline.js']) {
  await copyFile(new URL(`src/${name}`, root), new URL(name, output));
}
// Reuse the application's locale resolver; no second language policy or catalogs.
const localeSource = await readFile(new URL('lib/i18n/locales.ts', repository), 'utf8');
await writeFile(new URL('locale.js', output), stripTypeScriptTypes(localeSource));
await writeFile(new URL('capacitor.config.json', root), JSON.stringify(config, null, 2) + '\n');
await prepareNativeResources(repository, root, output, config.server.url);
const viewportSource = await readFile(new URL('src/app-viewport.js', root), 'utf8');
const viewportCSS = await readFile(new URL('src/app-viewport.css', root), 'utf8');
const presentationCSS = await readFile(new URL('src/app-presentation.css', root), 'utf8');
const viewportMarker = 'null /* CINEGENIUS_VIEWPORT_CONFIG */';
if (viewportSource.split(viewportMarker).length !== 2) throw new Error('Expected exactly one viewport configuration marker');
const origin = new URL(config.server.url).origin;
for (const [file, styleId, css] of [
  ['app-viewport.js', 'cinegenius-app-viewport', `${viewportCSS}\n${presentationCSS}`],
  ['app-presentation.js', 'cinegenius-app-presentation', presentationCSS],
]) {
  await writeFile(new URL(file, output), viewportSource.replace(viewportMarker, () => JSON.stringify({ origin, css, styleId })));
}
const resumeSource = await readFile(new URL('src/app-resume.js', root), 'utf8');
const resumeMarker = 'null /* CINEGENIUS_RESUME_ORIGIN */';
if (resumeSource.split(resumeMarker).length !== 2) throw new Error('Expected exactly one resume origin marker');
await writeFile(new URL('app-resume.js', output), resumeSource.replace(resumeMarker, () => JSON.stringify(origin)));
console.log(`Prepared development preview for ${config.server.url} in ${fileURLToPath(root)}`);
