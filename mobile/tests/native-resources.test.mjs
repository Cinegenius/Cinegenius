import test from 'node:test';
import assert from 'node:assert/strict';
import { nativeStrings } from '../scripts/native-resources.mjs';
import { readFile } from 'node:fs/promises';
import { SUPPORTED_LOCALES } from '../../lib/i18n/locales.ts';

test('native UI and permission strings are complete in all existing language catalogues', async () => {
  const english = JSON.parse(await readFile(new URL('../../messages/en.json', import.meta.url)));
  const keys = Object.keys(nativeStrings(english)).sort();
  const placeholders = text => [...text.matchAll(/\{([a-zA-Z]+)\}/g)].map(match => match[1]).sort();
  for (const locale of SUPPORTED_LOCALES) {
    const catalog = JSON.parse(await readFile(new URL(`../../messages/${locale}.json`, import.meta.url)));
    const copy = nativeStrings(catalog, keys);
    for (const key of keys) assert.deepEqual(placeholders(copy[key]), placeholders(english.NativeRoomScanner[key]), `${locale}.${key}`);
    assert.ok(catalog.nav.ai && catalog.nav.comingSoon, `${locale}: existing app menu identification`);
  }
});

test('missing permission text or inconsistent native catalogues fail preparation', () => {
  assert.throws(() => nativeStrings({}));
  assert.throws(() => nativeStrings({ NativeRoomScanner: { cameraUsage: '' } }));
  assert.throws(() => nativeStrings({ NativeRoomScanner: { cameraUsage: 'camera', localAuthReason: 'unlock', workplaceTitle: 'Workspace', locationsTitle: 'Locations' } }, ['cameraUsage']));
});
