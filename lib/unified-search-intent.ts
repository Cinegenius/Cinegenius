import { departments, getDepartmentRoleLabel, getDeptLabel } from "./departments";
import { occupationCatalogue } from "./primary-occupation";
import { occupationKey, searchDepartment, searchCityCandidates } from "./unified-search-matching";
import { countryCode } from "./places/core";
import { MAX_SEARCHES, readSearchPlan, type SearchPlan, type SearchWish } from "./unified-search";
import { SEARCH_AREA_WORDS } from "./unified-search-areas";

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
  return index;
}

/** Fully recognized keyword lists only. Unknown modifiers/names are left to Genie.
 * Longest catalogue phrases win, so "Assistant Costume Designer" stays one job.
 * Conjunctions and commas are optional; nothing is silently discarded. */
function keywords(text: string, locale: string, taxonomy?: (key: string) => string, index = keywordIndex(locale, taxonomy)): Keyword[] | null {
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
      const match = index.get(words.slice(offset, end).join(" "));
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
    if (!["crew", "all"].includes(wish.area) || wish.department) return [wish];
    const parts = keywords(wish.query, locale, taxonomy);
    if (!parts || parts.length < 2) return [wish];
    return parts.map(part => ({ ...part, places: wish.places }));
  });
  return readSearchPlan({ version: 1, searches });
}

/** A complete, simple request can correct an omitted/misclassified model wish.
 * Complex place attachment, negation, refinements and unknown text are never guessed. */
export function keywordSearchPlan(text: string, locale = "de", taxonomy?: (key: string) => string): SearchPlan | null {
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
