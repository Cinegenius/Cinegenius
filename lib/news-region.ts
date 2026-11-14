import { countryCode, UNASSIGNED_COUNTRY } from '@/lib/places/core';

export function newsCountryChoice(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  if (['auto', 'all', UNASSIGNED_COUNTRY].includes(value)) return value;
  return countryCode(value) || undefined;
}

export function resolvedNewsCountry(choice: string, profileCountry = '', requestCountry = '') {
  if (choice === 'all') return '';
  if (choice !== 'auto') return newsCountryChoice(choice) ?? '';
  return countryCode(profileCountry) || countryCode(requestCountry);
}

type NewsPlace = {place_country_code?: string | null; city?: string | null};
type NewsSource = NewsPlace & {region?: string | null};
/** Source country is an editorial fallback, never a verified event location.
 * A specific entry location wins; ambiguous legacy city names stay unassigned.
 * Only explicit country labels in the source's region may supply a fallback. */
export function newsEntryCountry(entry: NewsPlace & {organization: NewsSource | NewsSource[] | null}): string {
  const own = countryCode(entry.place_country_code ?? '');
  if (own) return own;
  if (entry.city?.trim()) return '';
  const source = Array.isArray(entry.organization) ? entry.organization[0] : entry.organization;
  if (!source) return '';
  const canonical = countryCode(source.place_country_code ?? '');
  if (canonical) return canonical;
  const explicit = [...new Set((source.region ?? '').split(/[·,;/]/).map(part => countryCode(part.trim())).filter(Boolean))];
  return explicit.length === 1 ? explicit[0] : '';
}

export type NewsRegion = {selection: string; country: string; cookieName: string};

/** Store only an explicit preference, never the inferred profile/network country. */
export function rememberNewsCountry(cookieName: string, selection: string) {
  const canonical = newsCountryChoice(selection);
  if (!/^cg_news_country_(guest|[a-f0-9]{16})$/.test(cookieName) || !canonical) return false;
  try {
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${cookieName}=${canonical}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
    return document.cookie.split(';').some(cookie => cookie.trim() === `${cookieName}=${canonical}`);
  } catch { return false; }
}
