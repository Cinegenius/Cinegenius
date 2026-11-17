import { searchKey } from "./unified-search-matching";
import type { SearchWish } from "./unified-search";
import { MARKETPLACE_COMMON_FIELDS, marketplaceSpecFields } from "./marketplace-offer";

/** Only explicitly public, search-relevant fields. Never stringify whole records,
 * private metadata, contact details, coordinates or moderation evidence. */
export function publicSearchText(row: Record<string, unknown>): string[] {
  const fields = [row.title, row.name, row.display_name, row.role, row.bio, row.description, row.summary,
    row.category, row.positions, row.categories, row.services, row.training_level, row.special_skills,
    row.vehicle_subtype, row.make, row.model];
  const market = row.marketplace && typeof row.marketplace === "object" ? row.marketplace as Record<string, unknown> : {};
  fields.push(market.brand, market.model);
  // Same public fields as the offer detail. Never flatten arbitrary metadata:
  // contact, moderation and private upload fields must stay outside search.
  fields.push(...MARKETPLACE_COMMON_FIELDS.filter(key => !['excluded', 'faults', 'availability', 'quantity', 'deposit', 'fulfilment_costs'].includes(key)).map(key => market[key]));
  const specs = market.specs && typeof market.specs === 'object' ? market.specs as Record<string, unknown> : {};
  fields.push(...marketplaceSpecFields(String(row.category ?? '')).map(key => specs[key]));
  fields.push(row.amenities);
  return fields.flatMap(value => Array.isArray(value) ? value : [value]).filter((value): value is string => typeof value === "string");
}

function declaration(text: string, term: string): -1 | 0 | 1 {
  const needle = searchKey(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!needle) return 0;
  // A declaration has to occur as a word/phrase, not inside an unrelated word.
  const cjk = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(term);
  const alphabet = /[a-z]/i.test(needle) ? '\\p{Script=Latin}' : '\\p{L}';
  const match = new RegExp(cjk ? needle : `(?<![${alphabet}\\p{N}])${needle}(?![${alphabet}\\p{N}])`, "gu");
  let found = false;
  for (const sentence of text.split(/[.!?;\n]/)) {
   const value = searchKey(sentence);
   for (const hit of value.matchAll(match)) {
    const before = value.slice(Math.max(0, hit.index! - 60), hit.index);
    const after = value.slice(hit.index! + hit[0].length, hit.index! + hit[0].length + 40);
    if (/(?:^|[^\p{L}])(?:kein\p{L}*|nicht|ohne|not|no|without|non|sin|senza|geen|niet|utan|inte|bez|nem|nincs|sans|pas|nie|sem|nao|ne|neni|без|нет|не|немає)(?:\s+[\p{L}]+){0,4}\s*$/u.test(before)
      || /(?:没有|無|无|不含|未配備)\s*$/u.test(before)
      || /^\s*(?:(?:ist|is|are|est|e)\s+)?(?:nicht|not|unavailable|niet|inte|nem|nincs|neni|nie|nao|не)(?:$|[^\p{L}])/u.test(after)
      || /^\s*(?:が|は|이|가|은|는)?\s*(?:ない|なし|ありません|없는|없음|없습니다|없어요)/u.test(after)) return -1;
    found = true;
   }
  }
  return found ? 1 : 0;
}

export function matchesSearchRequirements(row: Record<string, unknown>, wish: SearchWish): boolean {
  const texts = publicSearchText(row);
  const states = (term: string) => texts.map(text => declaration(text, term));
  return (wish.requirements ?? []).every(alternatives => {
    const evidence = alternatives.flatMap(states);
    return evidence.includes(1) && !evidence.includes(-1);
  }) && !(wish.exclude ?? []).some(term => states(term).includes(1));
}

/** Evidence ordering, never a quality rating. Distance only breaks equally good
 * matches. Missing evidence doesn't become a claimed qualification. */
export function searchMatchScore(row: Record<string, unknown>, terms: string[]): number {
  if (!terms.length) return 0;
  const titles = [row.title, row.name, row.display_name, row.role].filter((value): value is string => typeof value === "string");
  const roles = Array.isArray(row.positions) ? row.positions.filter((v): v is string => typeof v === "string") : [];
  if (titles.some(title => terms.some(term => searchKey(title) === searchKey(term)))) return 3;
  if (roles.some(title => terms.some(term => searchKey(title) === searchKey(term)))) return 2;
  return titles.some(title => terms.some(term => declaration(title, term) === 1)) ? 1 : 0;
}
