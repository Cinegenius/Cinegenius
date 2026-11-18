import { departments, getDepartmentRoleLabel, getDeptLabel } from "./departments";
import { occupationCatalogue } from "./primary-occupation";
import { occupationKey, searchDepartment, searchCityCandidates } from "./unified-search-matching";
import { countryCode } from "./places/core";
import { MAX_SEARCHES, readSearchPlan, type SearchPlan, type SearchWish } from "./unified-search";
import { SEARCH_AREA_WORDS } from "./unified-search-areas";
import { cateringSearch } from "./unified-search-catering";
import { DEPARTMENT_HEADS_QUERY, isDepartmentHeadsQuery, PRODUCTION_CREW_QUERY, isProductionCrewQuery } from "./unified-search-production";
import { ambiguousCrewShorthand, searchJargon, vocabularyKeyword } from "./unified-search-vocabulary";

type Keyword = Omit<SearchWish, "places">;

const placePreposition = "(?:in|en|v|ve|i|à|a|w|we|em|в|у|на)";
const placeArticle = "(?:(?:der|den|the|la|les|el|los|le|il|de|do|da)\\s+)?";
const stripPlacePrefix = (text: string) => text.replace(new RegExp(`^${placePreposition}\\s+${placeArticle}`, "i"), "");
const stripRequestPrefix = (text: string) => text.trim().replace(/[.!?。]+$/, "")
  .replace(/^(?:(?:ich\s+)?suche|zeig(?:e)?\s+mir|ich\s+brauche|find|show\s+me|i(?:'m|\s+am)\s+looking\s+for|je\s+(?:cherche|recherche)|busco|cerco|hledám|hledam|szukam|procuro|ik\s+zoek|jag\s+söker|я\s+ищу|я\s+шукаю|szeretnék)\s+/iu, "");

function keywordIndex(locale: string, taxonomy?: (key: string) => string) {
  const index = new Map<string, Keyword>();
  const add = (label: string, wish: Keyword) => {
    const key = occupationKey(label);
    if (key && !index.has(key)) index.set(key, wish);
  };
  for (const department of departments) {
    for (const label of [department.id, department.label, ...Object.values(department.labels), getDeptLabel(department, locale, undefined, taxonomy)]) {
      add(label, { area: "all", query: department.label, department: "" });
    }
  }
  for (const role of occupationCatalogue) {
    for (const label of [...role.aliases, getDepartmentRoleLabel(role.departmentId, role.label, locale, undefined, taxonomy)]) {
      add(label, { area: "crew", query: role.label, department: "" });
    }
  }
  for (const query of ["OB", "Fahrer", "Driver", "Beleuchter", "Kameramann", "Kamerafrau", "Kameramänner"]) {
    index.set(occupationKey(query), { area: "crew", query, department: "" });
  }
  for (const query of ["Boot", "Boat", "Auto", "Car", "Motorrad", "Fahrrad", "Yacht"]) {
    add(query, { area: "marketplace", query, department: "" });
  }
  for (const query of ["Studio", "Fotostudio", "Filmstudio"]) add(query, { area: "locations", query, department: "" });
  for (const [area, words] of Object.entries(SEARCH_AREA_WORDS)) {
    for (const word of words) index.set(occupationKey(word), { area: area as Keyword["area"], query: words[0], department: "" });
  }
  for (const query of ["Polizei", "Police", "Polizia", "Policía", "Policie", "Rendőrség", "Politie", "Polis"]) {
    add(query, { area: "all", query: "Polizei", department: "" });
  }
  index.set("catering", { area: "companies", query: "Catering", department: "" });
  return index;
}

/** Fully recognized keyword lists only. Unknown modifiers/names are left to Genie.
 * Longest catalogue phrases win, so "Assistant Costume Designer" stays one job.
 * Conjunctions and commas are optional; nothing is silently discarded. */
function keywords(text: string, locale: string, taxonomy?: (key: string) => string, index = keywordIndex(locale, taxonomy)): Keyword[] | null {
  const person = /^(?:jemand(?:en)?|eine?|einen)\s+(?:vom|aus\s+dem|aus\s+der)\s+(.+)$/i.exec(text.trim());
  if (person) {
    const dept = searchDepartment(person[1], locale, taxonomy);
    if (dept) return [{ area: "crew", query: "", department: dept.id }];
  }
  const service = text.trim().replace(/^(?:ein(?:e|en)?|a|an)\s+/i, "");
  if (cateringSearch(service)) return [{ area: "companies", query: service, department: "" }];
  const words = occupationKey(text).split(" ");
  if (!text.trim() || words.length > 32) return null;
  const result: Keyword[] = [];
  let offset = 0;
  while (offset < words.length) {
    if (result.length && /^(und|and|et|en|y|e|a|es|och|sowie|i|oraz|и|та|і)$/.test(words[offset])) {
      if (++offset === words.length) return null;
    }
    const numbers: Record<string, number> = { ein: 1, eine: 1, einen: 1, eins: 1, zwei: 2, drei: 3, vier: 4, funf: 5,
      one: 1, two: 2, three: 3, four: 4, five: 5, dos: 2, tres: 3, due: 2, tre: 3, twee: 2, drie: 3, tva: 2, dva: 2, harom: 3, ket: 2 };
    const quantity = /^\d{1,3}$/.test(words[offset]) ? Number(words[offset]) : numbers[words[offset]];
    if (quantity) offset++;
    else if (/^(a|an|un|une|una|unos|unas|des|du|um|uma)$/.test(words[offset])) offset++;
    if (offset >= words.length) return null;
    let found = false;
    for (let end = words.length; end > offset; end--) {
      const phrase = words.slice(offset, end).join(" ");
      if (ambiguousCrewShorthand(phrase)) return null;
      const match = isProductionCrewQuery(phrase) ? { area: "crew" as const, query: PRODUCTION_CREW_QUERY, department: "" }
        : isDepartmentHeadsQuery(phrase) ? { area: "crew" as const, query: DEPARTMENT_HEADS_QUERY, department: "" }
        : cateringSearch(phrase) ? { area: "companies" as const, query: phrase, department: "" }
        : searchJargon(phrase) ? vocabularyKeyword(phrase) : index.get(phrase) ?? vocabularyKeyword(phrase);
      if (!match) continue;
      result.push({ ...match, ...(quantity ? { quantity } : {}) }); offset = end; found = true; break;
    }
    if (!found || result.length > MAX_SEARCHES) return null;
  }
  if (result.length > 1 && /\p{L}-\p{L}/u.test(text)) return null;
  // Beside an explicit crew job, a bare department denotes colleagues there.
  return result.map(wish => {
    const department = wish.area === "all" && result.some(item => item.area === "crew") ? searchDepartment(wish.query, locale, taxonomy) : undefined;
    return department ? { ...wish, area: "crew", query: "", department: department.id } : wish;
  });
}

export function normalizeKeywordPlan(plan: SearchPlan, locale = "de", taxonomy?: (key: string) => string): SearchPlan | null {
  const searches = plan.searches.flatMap(wish => {
    if (!wish.department && ["crew", "all"].includes(wish.area) && isProductionCrewQuery(wish.query)) return [{ ...wish, area: "crew" as const, query: PRODUCTION_CREW_QUERY }];
    if (!wish.department && ["crew", "all"].includes(wish.area) && isDepartmentHeadsQuery(wish.query)) return [{ ...wish, area: "crew" as const, query: DEPARTMENT_HEADS_QUERY }];
    if (!wish.department && ["companies", "all"].includes(wish.area) && cateringSearch(wish.query)) return [{ ...wish, area: "companies" as const }];
    if (!["crew", "all"].includes(wish.area) || wish.department) return [wish];
    const parts = keywords(wish.query, locale, taxonomy);
    if (!parts || parts.length < 2) return [wish];
    if (wish.quantity || wish.requirements?.length || wish.exclude?.length) return [wish];
    return parts.map(part => ({ ...wish, ...part, places: wish.places }));
  });
  return readSearchPlan({ version: plan.version, searches });
}

/** Complete, unqualified production briefs only. Extra requirements, negation,
 * multi-city attachment and follow-ups stay with the conversational interpreter. */
function productionSearchPlan(text: string): SearchPlan | null {
  const request = text.trim().replace(/[.!?]+$/, "");
  const german = /^ich\s+(?:drehe|plane|produziere)\s+(?:in\s+(.+?)\s+)?(?:einen?\s+)?(polizei[ -]?film|krimi|mittelalter[ -]?film|film)(?:\s+in\s+(.+?))?(?:[,;]\s*(?:dafür|dafuer)\s+brauche\s+ich\s+alles)?$/i.exec(request);
  const english = /^i(?:'m| am)?\s+(?:shooting|filming|making|planning)\s+(?:a\s+)?(police|crime|medieval)?\s*(?:film|movie)\s+in\s+(.+)$/i.exec(request);
  const generic = [
    /^ich\s+(?:drehe|filme|plane\s+einen\s+dreh)\s+in\s+(.+)$/i,
    /^ich\s+(?:will|möchte|moechte)\s+in\s+(.+?)\s+(?:drehen|filmen)$/i,
    /^i(?:'m| am)?\s+(?:shooting|filming)\s+in\s+(.+)$/i,
    /^(?:estoy\s+rodando|voy\s+a\s+rodar|ruedo)\s+en\s+(.+)$/i,
    /^(?:sto\s+girando|giro|voglio\s+girare)\s+(?:a|in)\s+(.+)$/i,
    /^(?:natáčím|natacim|chci\s+natáčet)\s+(?:v|ve)\s+(.+)$/i,
    /^(.+?)(?:ban|ben)\s+forgatok$/i,
    /^ik\s+(?:film|draai|ga\s+filmen)\s+in\s+(.+)$/i,
    /^jag\s+(?:filmar|ska\s+filma)\s+i\s+(.+)$/i,
    /^je\s+(?:tourne|prévois\s+un\s+tournage)\s+à\s+(.+)$/i,
    /^(?:kręcę|planuję\s+zdjęcia)\s+w\s+(.+)$/i,
    /^estou\s+a\s+filmar\s+em\s+(.+)$/i,
    /^我(?:计划)?在(.+?)(?:拍摄|拍片)[。]?$/u,
    /^(.+?)で撮影を(?:計画しています|しています)[。]?$/u,
    /^(.+?)에서\s*촬영을\s*(?:계획하고\s*있어요|하고\s*있어요)$/u,
    /^я\s+(?:планирую\s+съёмки|снимаю)\s+в\s+(.+)$/i,
    /^я\s+(?:планую\s+зйомки|знімаю)\s+[ув]\s+(.+)$/i,
  ].map(pattern => pattern.exec(request)).find(Boolean);
  if (!german && !english && !generic) return null;
  const city = german ? german[1] || german[3] : english ? english[2] : generic![1];
  if (!city || (german?.[1] && german[3]) || searchCityCandidates(city).length !== 1) return null;
  const theme = /polizei|police|crime|krimi/i.test(german?.[2] ?? english?.[1] ?? "") ? "Polizei"
    : /mittelalter|medieval/i.test(german?.[2] ?? english?.[1] ?? "") ? "Mittelalter" : "";
  const places = [{ city, country: "", continent: "", radiusKm: 0 }];
  return readSearchPlan({ version: 2, searches: [
    { area: "crew", query: PRODUCTION_CREW_QUERY, department: "", places },
    ...(theme ? ["marketplace", "locations", "companies"].map(area => ({ area, query: theme, department: "", places })) : []),
    { area: "companies", query: theme ? "Filmproduktion" : "Firma", department: "", places },
    { area: "companies", query: "Catering", department: "", places },
    ...(!theme ? [{ area: "locations", query: "Location", department: "", places }, { area: "marketplace", query: "Marktplatz", department: "", places }] : []),
  ].map(wish => ({ ...wish, recommended: true })) });
}

/** A complete, simple request can correct an omitted/misclassified model wish.
 * Complex place attachment, negation, refinements and unknown text are never guessed. */
function simpleSearchPlan(text: string, locale = "de", taxonomy?: (key: string) => string): SearchPlan | null {
  const production = productionSearchPlan(text);
  if (production) return production;
  const index = keywordIndex(locale, taxonomy);
  const request = stripRequestPrefix(text);
  let parts = keywords(request, locale, taxonomy, index);
  let places: SearchWish["places"] = [];
  if (!parts) {
    const match = new RegExp(`^(.*?)\\s+${placePreposition}\\s+${placeArticle}(.+)$`, "i").exec(request);
    if (match) {
      parts = keywords(match[1], locale, taxonomy, index);
      if (!parts) return null;
      const country = countryCode(match[2]);
      const cities = country ? [] : searchCityCandidates(match[2]);
      if (!country && !cities.length) return null;
      places = [{ city: country ? "" : match[2], country, continent: "", radiusKm: 0 }];
    } else {
      // Bare city-first/city-last requests are common on phones. Accept only a
      // unique catalogue place and a fully recognized remainder; never drop words.
      const words = request.replace(/,/g, " ").split(/\s+/).filter(Boolean);
      if (words.length > 32) return null;
      const candidates = new Map<string, { parts: Keyword[]; places: SearchWish["places"] }>();
      for (let split = 1; split < words.length; split++) {
        for (const [placeText, terms] of [[words.slice(0, split).join(" "), words.slice(split).join(" ")], [words.slice(split).join(" "), words.slice(0, split).join(" ")]]) {
          const found = keywords(terms, locale, taxonomy, index);
          if (!found) continue;
          const country = placeText.length > 2 ? countryCode(placeText) : "";
          if (index.has(occupationKey(placeText)) || (!country && searchCityCandidates(placeText).length !== 1)) continue;
          const choice = { parts: found, places: [{ city: country ? "" : placeText, country, continent: "", radiusKm: 0 }] };
          candidates.set(JSON.stringify(choice), choice);
        }
      }
      if (candidates.size !== 1) return null;
      ({ parts, places } = candidates.values().next().value!);
    }
  }
  return readSearchPlan({ version: 2, searches: parts.map(part => ({ ...part, places })) });
}

/** Compose only fully recognized clauses. Longest phrases are attempted first;
 * ambiguous attachments and unknown modifiers still go to the interpreter. */
export function keywordSearchPlan(text: string, locale = "de", taxonomy?: (key: string) => string): SearchPlan | null {
  const direct = simpleSearchPlan(text, locale, taxonomy);
  if (direct) return direct;
  const request = stripRequestPrefix(text);
  const chunks = request.split(/\s+(?:und|and|en|och|y|e|et|oraz|и|та|і|sowie)\s+|\s*[,;]\s*/i);
  if (chunks.length < 2 || chunks.length > 10) return null;
  const wishes: SearchWish[] = [];
  for (let i = 0; i < chunks.length;) {
    let parsed = false;
    for (let end = chunks.length; end > i; end--) {
      const phrase = chunks.slice(i, end).join(" und ");
      const part = simpleSearchPlan(stripPlacePrefix(phrase), locale, taxonomy);
      if (part && !part.searches.some(wish => wish.recommended)) {
        wishes.push(...part.searches); i = end; parsed = true; break;
      }
    }
    if (parsed) continue;
    const placeText = stripPlacePrefix(chunks[i]);
    const country = countryCode(placeText);
    if (!wishes.length || (!country && searchCityCandidates(placeText).length !== 1)) return null;
    // A place-only continuation belongs to the immediately preceding wish.
    const previous = wishes[wishes.length - 1];
    if (!previous.places.length) return null;
    previous.places.push({ city: country ? "" : placeText, country, continent: "", radiusKm: 0 });
    i++;
  }
  const placed = wishes.filter(wish => wish.places.length);
  if (placed.length && wishes.some(wish => !wish.places.length)) {
    // Only an unambiguous trailing shared place can apply backwards.
    const last = wishes.at(-1)!;
    if (!last.places.length || placed.some(wish => JSON.stringify(wish.places) !== JSON.stringify(last.places))) return null;
    wishes.forEach(wish => { if (!wish.places.length) wish.places = last.places; });
  }
  return readSearchPlan({ version: 2, searches: wishes });
}
