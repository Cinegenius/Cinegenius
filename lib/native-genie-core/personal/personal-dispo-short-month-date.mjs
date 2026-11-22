// Frozen Intl/ICU78.3/CLDR48.0 short-month symbols; never locale-generated at runtime.
// Exact NFC + lowercase lookup; accents and punctuation remain significant.
export const PERSONAL_DISPO_SHORT_MONTHS = Object.freeze({
  "abr": 4,
  "ago": 8,
  "août": 8,
  "apr": 4,
  "apr.": 4,
  "ápr.": 4,
  "aug": 8,
  "aug.": 8,
  "avr.": 4,
  "bře": 3,
  "čvc": 7,
  "čvn": 6,
  "dec": 12,
  "dec.": 12,
  "déc.": 12,
  "dez": 12,
  "dez.": 12,
  "dic": 12,
  "dub": 4,
  "ene": 1,
  "feb": 2,
  "feb.": 2,
  "febr.": 2,
  "févr.": 2,
  "gen": 1,
  "giu": 6,
  "jan": 1,
  "jan.": 1,
  "janv.": 1,
  "juil.": 7,
  "juin": 6,
  "jul": 7,
  "júl.": 7,
  "juli": 7,
  "jun": 6,
  "jún.": 6,
  "juni": 6,
  "kvě": 5,
  "led": 1,
  "lis": 11,
  "lug": 7,
  "mag": 5,
  "mai": 5,
  "maj": 5,
  "máj.": 5,
  "mar": 3,
  "mär": 3,
  "márc.": 3,
  "mars": 3,
  "märz": 3,
  "may": 5,
  "mei": 5,
  "mrt": 3,
  "nov": 11,
  "nov.": 11,
  "oct": 10,
  "oct.": 10,
  "okt": 10,
  "okt.": 10,
  "ott": 10,
  "pro": 12,
  "říj": 10,
  "sep": 9,
  "sep.": 9,
  "sept": 9,
  "sept.": 9,
  "set": 9,
  "srp": 8,
  "szept.": 9,
  "úno": 2,
  "zář": 9
});
const monthToken = String.raw`([\p{L}\p{M}]+\.?)`;
const dayFirst = new RegExp(String.raw`^([0-9]{1,2})\.?\s+(?:de\s+)?${monthToken}\s+(?:de\s+)?([0-9]{4})$`, 'u');
const monthFirst = new RegExp(String.raw`^${monthToken}\s+([0-9]{1,2}),?\s+([0-9]{4})$`, 'u');
const yearFirst = new RegExp(String.raw`^([0-9]{4})\.?\s+${monthToken}\s+([0-9]{1,2})\.?$`, 'u');

/** Only explicit calendar dates using one complete frozen short-month token. */
export function validShortMonthDate(iso, literal) {
  if (typeof iso !== 'string' || typeof literal !== 'string' ||
      !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/u.test(iso)) return false;
  let day, token, year;
  const text = literal.trim(), forward = text.match(dayFirst);
  if (forward) [, day, token, year] = forward;
  else {
    const reverse = text.match(monthFirst), leadingYear = text.match(yearFirst);
    if (reverse) [, token, day, year] = reverse;
    else if (leadingYear) [, year, token, day] = leadingYear;
    else return false;
  }
  const month = PERSONAL_DISPO_SHORT_MONTHS[token.normalize('NFC').toLowerCase()];
  if (month === undefined) return false;
  day = Number(day); year = Number(year);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month ||
      date.getUTCDate() !== day) return false;
  return Number(iso.slice(0,4)) === year && Number(iso.slice(5,7)) === month &&
    Number(iso.slice(8)) === day;
}
