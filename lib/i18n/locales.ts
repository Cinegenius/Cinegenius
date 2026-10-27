export const SUPPORTED_LOCALES = ['de', 'en', 'es', 'it', 'cs', 'hu'] as const;
export type AppLocale = typeof SUPPORTED_LOCALES[number];
export const DEFAULT_LOCALE: AppLocale = 'de';
export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}
/** Explicit choice wins; browser preferences are used only before the first choice. */
export function resolveLocale(saved: unknown, acceptLanguage = ''): AppLocale {
  if (isAppLocale(saved)) return saved;
  const preferred = acceptLanguage.split(',').map((item, index) => {
    const [tag, ...params] = item.trim().split(';');
    const weight = params.find(param => param.trim().startsWith('q='));
    const quality = weight ? Number(weight.trim().slice(2)) : 1;
    return {locale: tag.toLowerCase().split('-')[0], quality, index};
  }).filter(item => Number.isFinite(item.quality) && item.quality > 0)
    .sort((a,b) => b.quality - a.quality || a.index - b.index);
  return preferred.find(item => isAppLocale(item.locale))?.locale as AppLocale | undefined ?? DEFAULT_LOCALE;
}
