const months = Object.freeze(['january','february','march','april','may','june',
  'july','august','september','october','november','december']);

/** Exact, explicit English ordinal calendar date; no year or date inference. */
export function validEnglishOrdinalDate(iso, literal) {
  if (typeof iso !== 'string' || typeof literal !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/u.test(iso)) return false;
  let m = literal.trim().match(/^([1-9]|[12]\d|3[01])(st|nd|rd|th)\s+(?:of\s+)?(January|February|March|April|May|June|July|August|September|October|November|December)(?:\s*,\s*|\s+)(\d{4})$/iu);
  if (!m) {
    const monthFirst = literal.trim().match(/^(January|February|March|April|May|June|July|August|September|October|November|December)\s+([1-9]|[12]\d|3[01])(st|nd|rd|th)(?:\s*,\s*|\s+)(\d{4})$/iu);
    if (monthFirst) m = [monthFirst[0],monthFirst[2],monthFirst[3],monthFirst[1],monthFirst[4]];
  }
  if (!m) return false;
  const day = Number(m[1]), year = Number(m[4]), month = months.indexOf(m[3].toLowerCase()) + 1;
  const suffix = day % 100 >= 11 && day % 100 <= 13 ? 'th' :
    ({1:'st',2:'nd',3:'rd'}[day % 10] ?? 'th');
  if (m[2].toLowerCase() !== suffix) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month ||
      date.getUTCDate() !== day) return false;
  return Number(iso.slice(0,4)) === year && Number(iso.slice(5,7)) === month &&
    Number(iso.slice(8)) === day;
}
