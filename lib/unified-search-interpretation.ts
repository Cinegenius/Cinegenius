import { keywordSearchPlan } from './unified-search-intent';
import { searchCityCandidates, searchDepartment } from './unified-search-matching';
import { readSearchPlan, type SearchPlan, type SearchBudget, type SearchWish } from './unified-search';

type Context = { plan: SearchPlan; wishIndex?: number };
const trim = (value: string) => value.trim().replace(/^[,;\s]+|[,;.!?\s]+$/g, '');

/** Fully consumed, unambiguous clauses only. Unknown words go to the existing
 * conversational interpreter; they are never removed to force a local match. */
function takeBudget(text: string): { rest: string; budget?: SearchBudget } {
  const pattern = /(?:bis(?:\s+zu)?|maximal|höchstens|up to|under|jusqu’à|jusqu'a|hasta|fino a|tot|até|do|legfeljebb|högst)\s*(\d+(?:[.,]\d{1,2})?)\s*(Euro|EUR|€|CHF|USD|GBP)(?:\s*(?:pro|per|par|por|a|\/)?\s*(Tag|day|jour|día|giorno|dag|den|nap|dia|Stunde|hour|Woche|week|Monat|month|Projekt|project))?/iu;
  const match = pattern.exec(text);
  if (!match) return { rest: text };
  const units: Record<string, SearchBudget['unit']> = { tag:'day',day:'day',jour:'day',día:'day',giorno:'day',dag:'day',den:'day',nap:'day',dia:'day',stunde:'hour',hour:'hour',woche:'week',week:'week',monat:'month',month:'month',projekt:'project',project:'project' };
  return { rest: trim(text.slice(0, match.index) + ' ' + text.slice(match.index + match[0].length)), budget: {
    max: Number(match[1].replace(',', '.')), currency: /^(?:€|euro|eur)$/i.test(match[2]) ? 'EUR' : match[2].toUpperCase() as SearchBudget['currency'],
    unit: units[match[3]?.toLowerCase()] ?? 'unspecified', scope: 'unknown',
  } };
}

export function refineSearchPlan(text: string, context: Context): SearchPlan | null {
  let rest = trim(text);
  const prefix = /^(?:doch(?:\s+lieber)?|lieber|stattdessen|instead(?:\s+in)?|rather(?:\s+in)?|plutôt(?:\s+à)?|mejor(?:\s+en)?|piuttosto(?:\s+a)?|raději|inkább|liever(?:\s+in)?|hellre(?:\s+i)?|raczej|antes(?:\s+em)?|改为|やはり|대신|лучше(?:\s+в)?|краще(?:\s+[ув])?)\s*/iu;
  if (!prefix.test(rest)) return null;
  rest = rest.replace(prefix, '').replace(/[,;]?\s*(?:alles andere wie vorher|everything else as before|keep everything else|tout le reste comme avant|todo lo demás igual|tutto il resto come prima|vše ostatní jako předtím|minden más maradjon|al het andere hetzelfde|allt annat som tidigare|reszta bez zmian|tudo o resto igual|其他不变|ほかはそのまま|나머지는 그대로|остальное как раньше|решта без змін)\s*$/iu, '');
  const extracted = takeBudget(rest);
  const city = trim(extracted.rest).replace(/^(?:in|à|a|en|v|ve|i|w|em|в|у)\s+/iu, '');
  const candidates = city ? searchCityCandidates(city) : [];
  if ((!city && !extracted.budget) || (city && candidates.length !== 1)) return null;
  if (context.wishIndex === undefined && context.plan.searches.length > 1
    && (extracted.budget || (city && new Set(context.plan.searches.map(wish => JSON.stringify(wish.places))).size > 1))) return null;
  return readSearchPlan({ version: 2, searches: context.plan.searches.map((wish, index) => {
    if (context.wishIndex !== undefined && context.wishIndex !== index) return wish;
    const budget = extracted.budget ? { ...extracted.budget,
      unit: extracted.budget.unit === 'unspecified' ? wish.budget?.unit ?? 'unspecified' : extracted.budget.unit,
      scope: wish.budget?.scope ?? 'unknown',
    } : wish.budget;
    return { ...wish, ...(budget ? { budget } : {}), ...(city ? { places: [{ city, country: wish.places[0]?.country === candidates[0].country ? candidates[0].country : '', continent: '', radiusKm: wish.places[0]?.radiusKm ?? 0 }], allowNearby: false } : {}) };
  }) });
}

export function interpretSearchPlan(text: string, locale = 'de', taxonomy?: (key: string) => string, context?: Context): SearchPlan | null {
  if (context) {
    const refined = refineSearchPlan(text, context);
    if (refined) return refined;
    // A complete new catalogue request with its own place can replace an older
    // search. Bare answers and selected-wish edits still need their context.
    if (context.wishIndex !== undefined) return null;
    const fresh = keywordSearchPlan(text, locale, taxonomy);
    return fresh?.searches.every(wish => wish.places.length) ? fresh : null;
  }
  const direct = keywordSearchPlan(text, locale, taxonomy);
  if (direct) return direct;
  const budget = takeBudget(text);
  let rest = budget.rest;
  let period: string | undefined;
  rest = rest.replace(/\b(?:für|am|on|for)\s+((?:Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)(?:\s+\d{1,2}\.\d{1,2}\.(?:\d{4})?)?)\b/iu, (_, value) => { period = value; return ''; });
  const requirements: string[][] = [];
  rest = rest.replace(/\b(?:mit\s+eigener\s+Kamera|with\s+(?:their\s+)?own\s+camera)\b/iu, phrase => { requirements.push(/^with/iu.test(phrase) ? ['own camera', 'eigene Kamera', 'eigener Kamera'] : ['eigene Kamera', 'eigener Kamera', 'own camera']); return ''; });
  rest = rest.replace(/\b(?:mit\s+Balkon|with\s+(?:a\s+)?balcony)\b/iu, phrase => { requirements.push(/^with/iu.test(phrase) ? ['balcony', 'Balkon'] : ['Balkon', 'balcony']); return ''; });
  rest = rest.replace(/\bLED[-\s]+(?=Leuchten?\b|Lampen?\b|lights?\b|lamps?\b)/iu, () => { requirements.push(['LED']); return ''; });
  let historical = false;
  rest = rest.replace(/\bfür\s+einen\s+historischen\s+Film\b/iu, () => { historical = true; requirements.push(['historisch', 'historical', 'Mittelalter', 'medieval']); return ''; });
  rest = rest.replace(/\bfür\s+einen\s+Dreh\b/iu, '');
  const exclude: string[] = [];
  rest = rest.replace(/[,;]?\s*\b(?:keine?\s+Studios?|no\s+studios?)\s*[.!?]?$/iu, () => { exclude.push('Studio', 'Filmstudio', 'Fotostudio'); return ''; });
  let radius: SearchWish['places'] | undefined;
  let badRadius = false;
  rest = rest.replace(/(?:höchstens|maximal|within|at most)?\s*(\d{1,3})\s*km\s*(?:um|around|of)\s+([^,;.!?]+)[.!?]?$/iu, (_, km, city) => {
    if (Number(km) < 1 || Number(km) > 200 || searchCityCandidates(city.trim()).length !== 1) badRadius = true;
    radius = [{ city: city.trim(), country: '', continent: '', radiusKm: Number(km) }]; return '';
  });
  if (badRadius) return null;
  rest = trim(rest.replace(/\s+/g, ' '));
  const base = keywordSearchPlan(rest, locale, taxonomy);
  if (!base || (base.searches.length > 1 && (budget.budget || ((period || radius || requirements.length || exclude.length) && !historical)))) return null;
  if (historical && base.searches.some(wish => wish.area !== 'marketplace' && !(wish.area === 'all' && searchDepartment(wish.query, locale, taxonomy)?.id === 'kostuem'))) return null;
  return readSearchPlan({ version: 2, searches: base.searches.map(wish => ({ ...wish,
    ...(historical ? { area: 'marketplace' } : {}), ...(budget.budget ? { budget: { ...budget.budget, scope: (wish.quantity ?? 1) === 1 ? 'each' : 'unknown' } } : {}),
    ...(period ? { period } : {}), ...(radius ? { places: radius } : {}),
    ...(requirements.length ? { requirements } : {}), ...(exclude.length ? { exclude } : {}),
  })) });
}
