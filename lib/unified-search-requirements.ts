import { searchKey } from "./unified-search-matching";
import type { SearchWish } from "./unified-search";

const offerModeTerms = new Map<string, "rent" | "sale">([
  ...["Miete", "mieten", "Vermietung", "zur Miete", "zum Ausleihen", "rent", "rental", "for rent", "alquiler", "noleggio", "pronájem", "bérlés", "huur", "uthyrning", "location", "louer", "wynajem", "aluguer", "alugar", "租赁", "出租", "レンタル", "대여", "аренда", "оренда"].map(term => [searchKey(term), "rent"] as const),
  ...["Kauf", "kaufen", "Verkauf", "sale", "for sale", "buy", "venta", "vendita", "prodej", "eladó", "koop", "försäljning", "vente", "sprzedaż", "venda", "出售", "販売", "판매", "продажа", "продаж"].map(term => [searchKey(term), "sale"] as const),
]);

/** Structured public offer modes are evidence even when the description never
 * repeats a rental phrase. Missing mode data is not guessed from a price. */
function declaredOfferMode(row: Record<string, unknown>): string | undefined {
  const market = row.marketplace && typeof row.marketplace === "object" ? row.marketplace as Record<string, unknown> : {};
  if (["rent", "sale", "both", "service"].includes(String(market.mode))) return String(market.mode);
  return ({ miete: "rent", kauf: "sale", beides: "both", dienstleistung: "service" } as Record<string, string>)[String(row.rental_type)];
}

/** Only explicitly public, search-relevant fields. Never stringify whole records,
 * private metadata, contact details, coordinates or moderation evidence. */
export function publicSearchText(row: Record<string, unknown>): string[] {
  const fields = [row.title, row.name, row.display_name, row.role, row.bio, row.description, row.summary,
    row.category, row.positions, row.categories, row.services, row.training_level, row.special_skills,
    row.vehicle_subtype, row.make, row.model];
  const market = row.marketplace && typeof row.marketplace === "object" ? row.marketplace as Record<string, unknown> : {};
  fields.push(market.brand, market.model);
  return fields.flatMap(value => Array.isArray(value) ? value : [value]).filter((value): value is string => typeof value === "string");
}

function declaration(text: string, term: string): -1 | 0 | 1 {
  const needle = searchKey(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!needle) return 0;
  // A declaration has to occur as a word/phrase, not inside an unrelated word.
  const match = new RegExp(`(?:^|[^a-z0-9])${needle}(?=$|[^a-z0-9])`, "g");
  let found = false;
  for (const sentence of text.split(/[.!?;\n]/)) {
   const value = searchKey(sentence);
   for (const hit of value.matchAll(match)) {
    const before = value.slice(Math.max(0, hit.index! - 60), hit.index);
    const after = value.slice(hit.index! + hit[0].length, hit.index! + hit[0].length + 40);
    if (/(?:\b(?:kein\w*|nicht|ohne|not|no|without|non|sin|senza|geen|niet|utan|inte|bez|nem|nincs)\b)(?:\s+\w+){0,4}\s*$/.test(before)
      || /^\s*(?:(?:ist|is|are|est|e)\s+)?(?:nicht|not|unavailable|nicht verfugbar)\b/.test(after)) return -1;
    found = true;
   }
  }
  return found ? 1 : 0;
}

export function matchesSearchRequirements(row: Record<string, unknown>, wish: SearchWish): boolean {
  const texts = publicSearchText(row);
  const states = (term: string) => texts.map(text => declaration(text, term));
  const mode = declaredOfferMode(row);
  return (wish.requirements ?? []).every(alternatives => {
    const requested = alternatives.map(term => offerModeTerms.get(searchKey(term)));
    if (mode && requested[0] && requested.every(value => value === requested[0])) return mode === "both" || mode === requested[0];
    const evidence = alternatives.flatMap(states);
    return evidence.includes(1) && !evidence.includes(-1);
  }) && !(wish.exclude ?? []).some(term => {
    const excluded = offerModeTerms.get(searchKey(term));
    return mode && excluded ? mode === "both" || mode === excluded : states(term).includes(1);
  });
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
