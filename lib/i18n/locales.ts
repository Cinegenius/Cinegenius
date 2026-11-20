export const SUPPORTED_LOCALES = ['de', 'en', 'es', 'it', 'cs', 'hu', 'nl', 'nl-BE', 'sv', 'fr', 'pl', 'pt-PT', 'zh-Hans', 'ja', 'ko', 'ru', 'uk'] as const;
export type AppLocale = typeof SUPPORTED_LOCALES[number];
export const DEFAULT_LOCALE: AppLocale = 'de';
export const LANGUAGE_OPTIONS: readonly {code: AppLocale; label: string; flag: string}[] = [
  {code:'de',label:'Deutsch',flag:'🇩🇪'}, {code:'en',label:'English',flag:'🇬🇧'},
  {code:'es',label:'Español',flag:'🇪🇸'}, {code:'it',label:'Italiano',flag:'🇮🇹'},
  {code:'cs',label:'Čeština',flag:'🇨🇿'}, {code:'hu',label:'Magyar',flag:'🇭🇺'},
  {code:'nl',label:'Nederlands',flag:'🇳🇱'},
  {code:'nl-BE',label:'Nederlands (België)',flag:'🇧🇪'},
  {code:'sv',label:'Svenska',flag:'🇸🇪'},
  {code:'fr',label:'Français',flag:'🇫🇷'}, {code:'pl',label:'Polski',flag:'🇵🇱'},
  {code:'pt-PT',label:'Português (Portugal)',flag:'🇵🇹'}, {code:'zh-Hans',label:'简体中文',flag:'🇨🇳'},
  {code:'ja',label:'日本語',flag:'🇯🇵'}, {code:'ko',label:'한국어',flag:'🇰🇷'},
  {code:'ru',label:'Русский',flag:'🇷🇺'}, {code:'uk',label:'Українська',flag:'🇺🇦'},
];
export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}
/** Canonicalize regional preferences while preserving Belgium as its own choice. */
export function appLocale(value: unknown): AppLocale | undefined {
  if (typeof value !== 'string') return undefined;
  const tag = value.trim().replace(/_/g, '-').toLowerCase();
  if (tag === 'pt' || tag.startsWith('pt-')) return 'pt-PT';
  if (tag === 'zh' || tag === 'zh-cn' || tag === 'zh-sg' || tag === 'zh-hans' || tag.startsWith('zh-hans-')) return 'zh-Hans';
  return SUPPORTED_LOCALES.find(locale => locale.toLowerCase() === tag)
    ?? SUPPORTED_LOCALES.find(locale => locale === tag.split('-')[0]);
}
/** An explicit choice wins; browser preferences apply only before that choice. */
export function resolveLocale(saved: unknown, acceptLanguage = '', requestCountry = ''): AppLocale {
  const selected = appLocale(saved);
  if (selected) return selected;
  const preferred = acceptLanguage.split(',').map((item, index) => {
    const [tag, ...params] = item.trim().split(';');
    const weight = params.find(param => param.trim().startsWith('q='));
    const quality = weight ? Number(weight.trim().slice(2)) : 1;
    return {locale: appLocale(tag), quality, index};
  }).filter(item => item.locale && Number.isFinite(item.quality) && item.quality > 0 && item.quality <= 1)
    .sort((a, b) => b.quality - a.quality || a.index - b.index);
  // A coarse country is only a last resort. Residence must never override an
  // explicit choice or a supported browser language (including multilingual countries).
  const countryFallback: Record<string, AppLocale> = {DE:'de',AT:'de',CH:'de',IT:'it',ES:'es',MX:'es',CZ:'cs',HU:'hu',NL:'nl',SE:'sv',GB:'en',IE:'en',US:'en',AU:'en',NZ:'en',FR:'fr',PL:'pl',PT:'pt-PT',CN:'zh-Hans',JP:'ja',KR:'ko',RU:'ru',UA:'uk'};
  return preferred[0]?.locale ?? countryFallback[requestCountry.toUpperCase()] ?? DEFAULT_LOCALE;
}
