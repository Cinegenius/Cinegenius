/** Normalize directory facets only; never rewrite a member's original language entries. */
const codes = 'de en es fr it cs hu pt nl pl ru uk tr ar zh ja ko el ro bg hr sr bs sl sk da sv no fi is et lv lt he fa hi ur bn ta th vi id ms tl ceb ca eu gl sq mk sw af be hy ka la'.split(' ');
const locales = ['de', 'en', 'es', 'it', 'cs', 'hu'];
const key = (value: string) => value.normalize('NFKC').trim().toLocaleLowerCase('en').replace(/\s+/g, ' ');
const aliases = new Map<string, string>();
for (const locale of locales) {
  const names = new Intl.DisplayNames([locale], { type: 'language' });
  for (const code of codes) {
    aliases.set(code, code);
    const name = names.of(code);
    if (name) aliases.set(key(name), code);
  }
}
for (const code of codes) {
  const autonym = new Intl.DisplayNames([code], { type: 'language' }).of(code);
  if (autonym) aliases.set(key(autonym), code);
}
// Exact legacy spellings, not substring guesses. Bisaya may denote multiple
// Visayan languages, so keep it distinct rather than assuming Cebuano.
for (const [name, code] of Object.entries({ deutsch: 'de', english: 'en', englisch: 'en', espanol: 'es', castilian: 'es', mandarin: 'zh', farsi: 'fa' })) aliases.set(name, code);
const invalid = new Set(['deutschland', 'germany', 'österreich', 'austria', 'schweiz', 'switzerland', 'keine', 'none', '-', 'n/a']);

export function normalizeCrewLanguages(values: readonly string[] | null | undefined): string[] {
  const result = new Set<string>();
  for (const value of values ?? []) {
    if (invalid.has(key(value))) continue;
    for (const part of value.split(/[,;\/\n|]+|\s+(?:und|and|&)\s+/i)) {
      const normalized = key(part);
      if (!normalized || invalid.has(normalized)) continue;
      result.add(aliases.get(normalized) ?? `custom:${normalized}`);
    }
  }
  return [...result];
}

export function crewLanguageLabel(value: string, locale: string): string {
  if (value.startsWith('custom:')) {
    const text = value.slice(7);
    return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
  }
  const code = aliases.get(key(value));
  return code ? new Intl.DisplayNames([locale], { type: 'language' }).of(code) ?? value : value;
}

export function matchesCrewLanguage(values: readonly string[] | null | undefined, selected: string): boolean {
  const selectedIds = selected.startsWith('custom:') ? [selected] : normalizeCrewLanguages([selected]);
  const ids = normalizeCrewLanguages(values);
  return selectedIds.length > 0 && selectedIds.every(id => ids.includes(id));
}
