import { CATERING_COMPANY_CATEGORY, CATERING_COMPANY_SERVICES, normalizeCateringCompanyDetails } from "./catering-taxonomy";

// Search vocabulary, not display copy. Persisted dietary/service values stay canonical.
const key = (value: string) => value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/ß/g, "ss").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const dietWords: Record<string, string[]> = {
  Vegan: ["vegan", "vegane", "veganes", "veganen", "veganer", "vegano", "vegana", "veganos", "veganas", "vegani", "vegansky", "veganske", "veganskeho", "veganskou", "veganistisch", "veganistische", "veganskt", "veganska"],
  Vegetarisch: ["vegetarisch", "vegetarische", "vegetarisches", "vegetarischen", "vegetarian", "vegetariano", "vegetariana", "vegetariansky", "vegetarianske", "vegetarianus", "vegetarisk", "vegetariskt"],
  Halal: ["halal"], Koscher: ["koscher", "koschere", "koscheres", "koscheren", "kosher", "koser", "kóser"],
  Glutenfrei: ["glutenfrei", "glutenfreie", "glutenfreies", "glutenfreien", "gluten free", "senza glutine", "sin gluten", "bezlepkovy", "bezlepkove", "glutenmentes", "glutenvrij", "glutenfri", "glutenfritt"],
  Laktosefrei: ["laktosefrei", "laktosefreie", "laktosefreies", "laktosefreien", "lactose free", "senza lattosio", "sin lactosa", "bez laktozy", "laktozmentes", "lactosevrij", "laktosfri", "laktosfritt"],
  Allergikerfreundlich: ["allergikerfreundlich", "allergikerfreundliche", "allergikerfreundliches", "allergy friendly", "allergen aware", "per allergici", "apto para alergicos", "vhodny pro alergiky", "allergiabarat", "allergievriendelijk", "allergivanlig", "allergivanligt"],
};
const serviceWords: Record<string, string[]> = {
  "Film- und Setcatering": ["filmcatering", "film catering", "setcatering", "set catering", "setverpflegung"],
  Eventcatering: ["eventcatering", "event catering", "catering per eventi", "catering para eventos", "rendezveny catering", "evenementencatering"],
  "Mobiles Catering / Foodtruck": ["foodtruck", "food truck", "mobiles catering", "mobile catering", "catering mobile", "catering movil"],
  "Craft Service: Snacks und Getränke": ["craft service", "craft services"],
  "Küchenmobil / mobile Küche": ["kuchenmobil", "mobile kuche", "mobile kitchen", "cucina mobile", "cocina movil", "mobilni kuchyne", "mobil konyha", "mobiele keuken", "mobilt kok"],
};
export type CateringSearch = { dietary: string[]; services: string[] };
export const CATERING_SEARCH_TERMS = [...new Set(["Catering", "Setverpflegung", ...CATERING_COMPANY_CATEGORY.searchTerms, ...CATERING_COMPANY_SERVICES.map(service => service.label)])];

/** Recognize the entire service request. Never drop an unknown modifier or turn
 * 'vegan catering' into two independent OR wishes. */
export function cateringSearch(query: string): CateringSearch | null {
  if (key(query) === key(CATERING_COMPANY_CATEGORY.label)) return { dietary: [], services: [] };
  let rest = ` ${key(query)} `, serviceFound = false;
  const dietary: string[] = [], services: string[] = [];
  const consume = (words: string[]) => {
    let found = false;
    for (const word of [...words].sort((a, b) => b.length - a.length)) {
      const needle = ` ${key(word)} `;
      if (rest.includes(needle)) { found = true; rest = rest.replaceAll(needle, " "); }
    }
    return found;
  };
  for (const [value, words] of Object.entries(serviceWords)) if (consume([value, ...words])) { services.push(value); serviceFound = true; }
  if (consume(["catering", "traiteur", "verpflegung"])) serviceFound = true;
  for (const [value, words] of Object.entries(dietWords)) if (consume(words)) dietary.push(value);
  rest = rest.replace(/\b(?:und|and|e|y|a|es|en|och)\b/g, "").trim();
  return serviceFound && !rest ? { dietary, services } : null;
}

function mentioned(text: string, words: string[]) {
  const normalized = ` ${key(text)} `;
  return words.some(word => normalized.includes(` ${key(word)} `));
}

function negatedMention(text: string, words: string[]): boolean {
  // Conservative legacy-text support. Explicit negations override a positive
  // mention; structured options are preferred, but cannot override contradictory text.
  return text.split(/[.!?;\n]/).some(sentence => words.some(word => {
    const normalized = ` ${key(sentence)} `;
    const term = key(word);
    return new RegExp(`\\b(?:nicht|kein(?:e|en|es)?|ohne|no|not|non|sin|neni|bez|nem|geen|niet|inte|ej) (?:(?:rein|reines|ausschliesslich|strictly|fully|exclusively|purely) )?${term}\\b`, "u").test(normalized)
      || new RegExp(`\\b${term} (?:(?:ist|is|are|sind|e|ar) )?(?:nicht|not|non|niet|inte) (?:moglich|verfugbar|angeboten|available|offered|disponibile|beschikbaar|tillganglig)\\b`, "u").test(normalized);
  }));
}

/** Only public company declarations, never inferred from unrelated categories.
 * The same predicate runs before local/nearby selection, pagination and map pins. */
export function matchesCateringSearch(row: Record<string, unknown>, search: CateringSearch): boolean {
  const details = normalizeCateringCompanyDetails(row.catering_details);
  const strings = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  const categories = strings(row.categories), services = strings(row.services);
  const text = [row.name, row.description, ...services].filter(value => typeof value === "string").join(". ");
  const catering = categories.includes(CATERING_COMPANY_CATEGORY.id) || categories.includes(CATERING_COMPANY_CATEGORY.label)
    || details.serviceTypes.length > 0 || mentioned(text, CATERING_SEARCH_TERMS);
  if (!catering || negatedMention(text, ["catering", "setverpflegung"])) return false;
  return search.services.every(service => !negatedMention(text, serviceWords[service]) && (details.serviceTypes.includes(service) || mentioned(text, serviceWords[service])))
    && search.dietary.every(diet => {
      const words = dietWords[diet];
      const explicit = mentioned(text, words);
      return !negatedMention(text, words) && (explicit || details.dietaryOptions.includes(diet));
    });
}
