// A source typo may leave its ISO interpretation unknown. Never repair source text.
const months = Object.freeze(['january','february','march','april','may','june',
  'july','august','september','october','november','december']);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const sourceText = (value, maximum) => typeof value === 'string' && value.length >= 1 &&
  value.length <= maximum && value.trim().length > 0 && !value.includes('\0');

/** Only the complete V7 English grammar, with a demonstrably incorrect suffix. */
export function matchingISOWithWrongOrdinalSuffix(iso, literal) {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(iso) ||
      !sourceText(literal, 120)) return false;
  let match = literal.trim().match(/^([1-9]|[12]\d|3[01])(st|nd|rd|th)\s+(?:of\s+)?(January|February|March|April|May|June|July|August|September|October|November|December)(?:\s*,\s*|\s+)(\d{4})$/iu);
  if (!match) {
    const reverse = literal.trim().match(/^(January|February|March|April|May|June|July|August|September|October|November|December)\s+([1-9]|[12]\d|3[01])(st|nd|rd|th)(?:\s*,\s*|\s+)(\d{4})$/iu);
    if (reverse) match = [reverse[0], reverse[2], reverse[3], reverse[1], reverse[4]];
  }
  if (!match) return false;
  const day = Number(match[1]), month = months.indexOf(match[3].toLowerCase()) + 1,
    year = Number(match[4]);
  const expectedSuffix = day % 100 >= 11 && day % 100 <= 13 ? 'th' :
    ({1:'st', 2:'nd', 3:'rd'}[day % 10] ?? 'th');
  if (match[2].toLowerCase() === expectedSuffix) return false;
  const calendar = new Date(Date.UTC(year, month - 1, day));
  return calendar.getUTCFullYear() === year && calendar.getUTCMonth() + 1 === month &&
    calendar.getUTCDate() === day && Number(iso.slice(0,4)) === year &&
    Number(iso.slice(5,7)) === month && Number(iso.slice(8)) === day;
}

function exactOwnSourceEvidence(day, input) {
  const proof = day.evidence;
  if (!Array.isArray(proof) || proof.length < 1 || proof.length > 5 ||
      new Set(proof.map(entry => JSON.stringify(entry))).size !== proof.length) return false;
  if (!proof.every(entry => object(entry) && Object.keys(entry).length === 2 &&
      Object.hasOwn(entry, 'page') && Object.hasOwn(entry, 'quote') &&
      Number.isSafeInteger(entry.page) && entry.page >= 1 &&
      entry.page <= input.document.pages.length && sourceText(entry.quote, 4000) &&
      input.document.pages[entry.page - 1].text.includes(entry.quote))) return false;
  // No normalized whitespace/case, foreign evidence, or reconstructed substring.
  return proof.some(entry => entry.quote.includes(day.dateLiteral));
}

/** Mutates only the caller's private clone. The caller must validate every fact. */
export function clearUnsupportedOrdinalISOs(working, input) {
  if (!Array.isArray(working.days) || working.days.length > 20) return 0;
  let count = 0;
  for (const day of working.days) {
    if (!object(day) || !matchingISOWithWrongOrdinalSuffix(day.dateISO, day.dateLiteral) ||
        !exactOwnSourceEvidence(day, input)) continue;
    // Missing dateISO is the existing unknown-date wire representation (Swift nil).
    delete day.dateISO;
    count++;
  }
  return count;
}
