import codes from './currency-codes.json' with { type: 'json' };

/** ISO 4217 current circulating currencies, SIX list dated 2026-09-17.
 * Stored values never depend on a visitor's language or location. */
export const CURRENCY_CODES: readonly string[] = Object.freeze(codes);
const supported = new Set(CURRENCY_CODES);
// Preserve previously stored amounts in withdrawn currencies without conversion.
const legacy = new Set(['ANG', 'BGN', 'CUC', 'HRK', 'SLL', 'ZWL', 'XDR', 'XSU']);
export function isCurrencyCode(value: unknown): value is string {
  return typeof value === 'string' && supported.has(value);
}
export function isStoredCurrency(value: unknown): value is string {
  return isCurrencyCode(value) || typeof value === 'string' && legacy.has(value);
}
export function storedCurrency(value: unknown): string {
  return isStoredCurrency(value) ? value : 'EUR';
}
/** All legacy offers without an explicit code were entered in euros. */
export function listingCurrency(metadata: unknown): string {
  return storedCurrency(metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>).price_currency : undefined);
}
export function formatOfferAmount(amount: number, currency: string, locale: string): string {
  const code = storedCurrency(currency);
  // Keep subunits intact, including three-decimal currencies, and disambiguate pesos/dollars.
  return `${amount.toLocaleString(locale, { maximumFractionDigits: 6 })} ${code === 'EUR' ? '€' : code}`;
}
export function currencyOptions(locale: string, current?: string) {
  const names = new Intl.DisplayNames([locale], { type: 'currency' });
  const values = current && isStoredCurrency(current) && !supported.has(current) ? [current, ...CURRENCY_CODES] : CURRENCY_CODES;
  return values.map(value => ({ value, label: `${value} · ${names.of(value) ?? value}` }));
}
