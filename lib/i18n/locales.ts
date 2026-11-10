export const SUPPORTED_LOCALES = ['de', 'en', 'es', 'it', 'cs', 'hu', 'nl', 'nl-BE', 'sv'] as const;
export type AppLocale = typeof SUPPORTED_LOCALES[number];
export const DEFAULT_LOCALE: AppLocale = 'de';
export const LANGUAGE_OPTIONS: readonly {code: AppLocale; label: string; flag: string}[] = [
  {code:'de',label:'Deutsch',flag:'🇩🇪'}, {code:'en',label:'English',flag:'🇬🇧'},
  {code:'es',label:'Español',flag:'🇪🇸'}, {code:'it',label:'Italiano',flag:'🇮🇹'},
  {code:'cs',label:'Čeština',flag:'🇨🇿'}, {code:'hu',label:'Magyar',flag:'🇭🇺'},
  {code:'nl',label:'Nederlands',flag:'🇳🇱'},
  {code:'nl-BE',label:'Nederlands (België)',flag:'🇧🇪'},
  {code:'sv',label:'Svenska',flag:'🇸🇪'},
];
export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}
/** Canonicalize regional preferences while preserving Belgium as its own choice. */
export function appLocale(value: unknown): AppLocale | undefined {
  if (typeof value !== 'string') return undefined;
  const tag = value.trim().replace(/_/g, '-').toLowerCase();
  return SUPPORTED_LOCALES.find(locale => locale.toLowerCase() === tag)
    ?? SUPPORTED_LOCALES.find(locale => locale === tag.split('-')[0]);
}
/** An explicit choice wins; browser preferences apply only before that choice. */
export function resolveLocale(saved: unknown, acceptLanguage = ''): AppLocale {
  const selected = appLocale(saved);
  if (selected) return selected;
  const preferred = acceptLanguage.split(',').map((item, index) => {
    const [tag, ...params] = item.trim().split(';');
    const weight = params.find(param => param.trim().startsWith('q='));
    const quality = weight ? Number(weight.trim().slice(2)) : 1;
    return {locale: appLocale(tag), quality, index};
  }).filter(item => item.locale && Number.isFinite(item.quality) && item.quality > 0 && item.quality <= 1)
    .sort((a, b) => b.quality - a.quality || a.index - b.index);
  return preferred[0]?.locale ?? DEFAULT_LOCALE;
}
