import type { AppLocale } from "@/lib/i18n/locales";

/** Verified official event names, not translated titles or per-article overrides.
 * https://mfszemle.hu/en/about-filmszemle/
 * Extend with verified source names when editorial language review finds ambiguity.
 */
const EVENT_NAMES = ["Hungarian Film Review", "Magyar Filmszemle"] as const;
export function newsTranslationNames(fields: Record<string, string>) {
  const text = Object.values(fields).join("\n");
  return EVENT_NAMES.filter(name => text.includes(name));
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const ENGLISH_DATE = new RegExp(`(?<![\\p{L}\\p{N}])(?<day>\\d{1,2}) (?<month>${MONTHS.join("|")})(?: (?<year>\\d{4}))?(?![\\p{L}\\p{N}])`, "gu");

/** Newsroom prose is English. Keep a whole, validated date as one immutable fact,
 * formatted for display before masking it. Opaque separate day/year tokens give
 * the model too little context to choose the correct date order. Original text,
 * numeric/ambiguous dates and all non-English dates remain untouched.
 */
export function maskNewsDates(text: string, locale: AppLocale, mask: (display: string) => string) {
  return text.replace(ENGLISH_DATE, (original, ...args) => {
    const {day, month, year} = args.at(-1) as {day: string; month: string; year?: string};
    const monthIndex = MONTHS.indexOf(month), dayNumber = Number(day);
    const yearNumber = year ? Number(year) : 2000;
    if (yearNumber < 1000 || yearNumber > 9999) return original;
    const date = new Date(Date.UTC(yearNumber, monthIndex, dayNumber));
    if (date.getUTCFullYear() !== yearNumber || date.getUTCMonth() !== monthIndex || date.getUTCDate() !== dayNumber) return original;
    const display = new Intl.DateTimeFormat(locale, {day: "numeric", month: "long", ...(year ? {year: "numeric" as const} : {}), timeZone: "UTC"}).format(date);
    return mask(display);
  });
}
