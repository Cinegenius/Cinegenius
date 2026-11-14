import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from '../../lib/i18n/locales.ts';

export function nativeStrings(catalog, expectedKeys) {
  const strings = catalog.NativeRoomScanner;
  if (!strings || typeof strings !== 'object' || Array.isArray(strings)) throw new Error('Missing NativeRoomScanner catalogue');
  const keys = Object.keys(strings).sort();
  if (expectedKeys && JSON.stringify(keys) !== JSON.stringify(expectedKeys)) throw new Error('NativeRoomScanner catalogue keys differ');
  for (const key of keys) if (typeof strings[key] !== 'string' || !strings[key].trim()) throw new Error(`Missing NativeRoomScanner.${key}`);
  for (const key of ['cameraUsage', 'localAuthReason', 'workplaceTitle', 'locationsTitle']) {
    if (!strings[key]) throw new Error(`Missing NativeRoomScanner.${key}`);
  }
  return strings;
}

const stringsLiteral = value => JSON.stringify(value).replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');

export async function prepareNativeResources(repository, mobile, output, origin) {
  const nativeOutput = new URL('native-room-scanner/', output);
  await mkdir(nativeOutput, { recursive: true });
  const english = JSON.parse(await readFile(new URL('messages/en.json', repository), 'utf8'));
  const expectedKeys = Object.keys(nativeStrings(english)).sort();
  const menu = { allowedOrigins: [new URL(origin).origin], defaultLocale: DEFAULT_LOCALE, locales: {} };
  for (const locale of SUPPORTED_LOCALES) {
    const catalog = JSON.parse(await readFile(new URL(`messages/${locale}.json`, repository), 'utf8'));
    const copy = nativeStrings(catalog, expectedKeys);
    await writeFile(new URL(`${locale}.json`, nativeOutput), JSON.stringify(copy));
    // These are generated Xcode resources, never a second translation catalogue.
    const permissionFolder = new URL(`ios/App/App/NativeStrings/${locale}.lproj/`, mobile);
    await mkdir(permissionFolder, { recursive: true });
    await writeFile(new URL('InfoPlist.strings', permissionFolder),
      `"NSCameraUsageDescription" = ${stringsLiteral(copy.cameraUsage)};\n"NSFaceIDUsageDescription" = ${stringsLiteral(copy.localAuthReason)};\n`);
    menu.locales[locale] = {
      legacyLabel: catalog.nav.ai,
      legacyBadge: catalog.nav.comingSoon,
      title: copy.workplaceTitle,
      description: copy.locationsTitle,
    };
  }
  await writeFile(new URL('locales.json', nativeOutput), JSON.stringify({ defaultLocale: DEFAULT_LOCALE, supportedLocales: SUPPORTED_LOCALES }));
  const adapter = await readFile(new URL('src/workplace-menu.js', mobile), 'utf8');
  const marker = 'null /* CINEGENIUS_WORKPLACE_CONFIG */';
  if (adapter.split(marker).length !== 2) throw new Error('Expected exactly one workplace configuration marker');
  await writeFile(new URL('workplace-menu.js', output), adapter.replace(marker, JSON.stringify(menu)));
}
