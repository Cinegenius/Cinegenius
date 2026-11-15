import { departments, getDepartmentRoleLabel, getDeptLabel } from "./departments";
import { occupationCatalogue } from "./primary-occupation";
import { occupationKey, searchDepartment, searchCityCandidates } from "./unified-search-matching";
import { countryCode } from "./places/core";
import { MAX_SEARCHES, readSearchPlan, type SearchPlan, type SearchWish } from "./unified-search";
import { SEARCH_AREA_WORDS } from "./unified-search-areas";
import { cateringSearch } from "./unified-search-catering";
import { DEPARTMENT_HEADS_QUERY, isDepartmentHeadsQuery } from "./unified-search-production";

type Keyword = Omit<SearchWish, "places">;

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
  const service = text.trim().replace(/^(?:ein(?:e|en)?|a|an)\s+/i, "");
  if (cateringSearch(service)) return [{ area: "companies", query: service, department: "" }];
  const words = occupationKey(text).split(" ");
  if (!text.trim() || words.length > 32) return null;
  const result: Keyword[] = [];
  let offset = 0;
  while (offset < words.length) {
    if (result.length && /^(und|and|et|en|y|e|a|es|och|sowie)$/.test(words[offset])) {
      if (++offset === words.length) return null;
    }
    let found = false;
    for (let end = words.length; end > offset; end--) {
      const phrase = words.slice(offset, end).join(" ");
      const match = isDepartmentHeadsQuery(phrase) ? { area: "crew" as const, query: DEPARTMENT_HEADS_QUERY, department: "" }
        : cateringSearch(phrase) ? { area: "companies" as const, query: phrase, department: "" } : index.get(phrase);
      if (!match) continue;
      result.push(match); offset = end; found = true; break;
    }
    if (!found || result.length > MAX_SEARCHES) return null;
  }
  if (result.length > 1 && /\p{L}-\p{L}/u.test(text)) return null;
  // Beside an explicit crew job, a bare department denotes colleagues there.
  return result.map(wish => {
    const department = wish.area === "all" && result.some(item => item.area === "crew") ? searchDepartment(wish.query, locale, taxonomy) : undefined;
    return department ? { area: "crew", query: "", department: department.id } : wish;
  });
}

export function normalizeKeywordPlan(plan: SearchPlan, locale = "de", taxonomy?: (key: string) => string): SearchPlan | null {
  const searches = plan.searches.flatMap(wish => {
    if (!wish.department && ["crew", "all"].includes(wish.area) && isDepartmentHeadsQuery(wish.query)) return [{ ...wish, area: "crew" as const, query: DEPARTMENT_HEADS_QUERY }];
    if (!wish.department && ["companies", "all"].includes(wish.area) && cateringSearch(wish.query)) return [{ ...wish, area: "companies" as const }];
    if (!["crew", "all"].includes(wish.area) || wish.department) return [wish];
    const parts = keywords(wish.query, locale, taxonomy);
    if (!parts || parts.length < 2) return [wish];
    return parts.map(part => ({ ...part, places: wish.places }));
  });
  return readSearchPlan({ version: 1, searches });
}

/** Complete, unqualified production briefs only. Extra requirements, negation,
 * multi-city attachment and follow-ups stay with the conversational interpreter. */
function productionSearchPlan(text: string): SearchPlan | null {
  const request = text.trim().replace(/[.!?]+$/, "");
  const german = /^ich\s+(?:drehe|plane|produziere)\s+(?:in\s+(.+?)\s+)?(?:einen?\s+)?(polizei[ -]?film|krimi|mittelalter[ -]?film|film)(?:\s+in\s+(.+?))?(?:[,;]\s*(?:dafür|dafuer)\s+brauche\s+ich\s+alles)?$/i.exec(request);
  const english = /^i(?:'m| am)?\s+(?:shooting|filming|making|planning)\s+(?:a\s+)?(police|crime|medieval)?\s*(?:film|movie)\s+in\s+(.+)$/i.exec(request);
  if (!german && !english) return null;
  const city = german ? german[1] || german[3] : english![2];
  if (!city || (german?.[1] && german[3]) || searchCityCandidates(city).length !== 1) return null;
  const theme = /polizei|police|crime|krimi/i.test(german?.[2] ?? english?.[1] ?? "") ? "Polizei"
    : /mittelalter|medieval/i.test(german?.[2] ?? english?.[1] ?? "") ? "Mittelalter" : "";
  const places = [{ city, country: "", continent: "", radiusKm: 0 }];
  return readSearchPlan({ version: 1, searches: [
    { area: "crew", query: DEPARTMENT_HEADS_QUERY, department: "", places },
    ...(theme ? [{ area: "all", query: theme, department: "", places }] : []),
    { area: "companies", query: "Filmproduktion", department: "", places },
    { area: "companies", query: "Catering", department: "", places },
    { area: "locations", query: "Location", department: "", places },
  ] });
}

/** A complete, simple request can correct an omitted/misclassified model wish.
 * Complex place attachment, negation, refinements and unknown text are never guessed. */
export function keywordSearchPlan(text: string, locale = "de", taxonomy?: (key: string) => string): SearchPlan | null {
  const production = productionSearchPlan(text);
  if (production) return production;
  const index = keywordIndex(locale, taxonomy);
  const request = text.trim().replace(/[.!?]+$/, "").replace(/^(?:(?:ich\s+)?suche|zeig(?:e)?\s+mir|ich\s+brauche|find|show\s+me|i(?:'m|\s+am)\s+looking\s+for)\s+/i, "");
  let parts = keywords(request, locale, taxonomy, index);
  let places: SearchWish["places"] = [];
  if (!parts) {
    const match = /^(.*?)\s+(?:in|en|v|ve|i)\s+(?:(?:der|den|the|la|les)\s+)?(.+)$/i.exec(request);
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
  return readSearchPlan({ version: 1, searches: parts.map(part => ({ ...part, places })) });
}
