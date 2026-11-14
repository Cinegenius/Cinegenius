import "server-only";
import { getTranslations } from "next-intl/server";
import { departments } from "./departments";
import { placeCandidatesForLabel } from "./places/catalog";
import { readSearchPlan, unifiedSearchHref, type SearchPlan } from "./unified-search";
import { GenieError } from "./genie-error";
import { keywordSearchPlan, normalizeKeywordPlan } from "./unified-search-intent";

export const UNIFIED_SEARCH_INSTRUCTIONS = `Prepare read-only cross-directory searches in searches, one wish per object/occupation with its own places array. Output [] for non-search requests or when clarification is needed. Never claim actual results were found, inspected or available. These are search filters only.
area is crew (people/occupations/departments), marketplace (objects, vehicles, props, equipment), locations (spaces, photo/film studios), companies (businesses), jobs (vacancies), animals (animal portfolios), projects, news, organizations, or all for genuinely unrestricted keywords. Never turn a person request into a goods request: 'jemand vom Kostüm' is crew; 'ein Kostüm mieten' is marketplace. A generic word without clear area can use all.
query is a short singular noun, occupation or keyword in the user's language, without command words, articles, gender/plural inflections or locations. Keep meaningful specializations and proper names. Never join different occupations or objects in one query. For crew, OB means Oberbeleuchter/Gaffer. Generic Fahrer covers driving roles; Produktionsfahrer is narrower. Kameramann/Kamerafrau/Kameramänner means camera people (DoP or camera operator), not camera equipment. Model means a person when asked as crew, never a model maker. department is empty unless a whole crew department was requested (e.g. 'jemand vom kostum' => department kostuem, query empty); valid department IDs: ${departments.map(d => `${d.id} (${d.label})`).join("; ")}.
Treat bare keyword lists as search requests, even without commas, conjunctions or a sentence: 'Beleuchter Kostüm' means two wishes (crew Beleuchter; crew department kostuem). 'Beleuchter Kostüm in Berlin' gives both wishes Berlin. 'OB Fahrer München' also means two crew wishes in Munich. A single 'Kostüm', 'kostum', 'kostuem' or 'costume' without a person/rental qualifier searches all areas for Kostüm. Never require punctuation. Preserve multi-word occupations such as Assistant Costume Designer as one wish. Do not put two independent keywords into one query or silently omit one. Recognize the spoken keyword first, then choose directories; existing platform records use German canonical occupation aliases even when the request is in another language.
places=[] means no geographic restriction. Each place has city (town only), country (explicit ISO code or empty), continent (UN M49: Africa 002, Americas 019, Asia 142, Europe 150, Oceania 009, Antarctica 010, otherwise empty), radiusKm (0 for exact city; crew 'near' defaults to 50, explicit 1–200). A continent has empty city and country. Multiple places for ONE wish are OR alternatives. All constraints within one place are AND. Do not infer private/GPS location. If 'near me' lacks a stated location, ask where. Radius is currently supported only for crew; explain this and ask before substituting a different scope.
Preserve grammatical attachment of places. Examples (all omitted place strings are empty, radiusKm=0):
'Beleuchter in Berlin und Hamburg' => ONE crew wish Beleuchter, places Berlin AND Hamburg as alternatives.
'Model in Berlin und in Hamburg Beleuchter' => TWO wishes: crew Model in Berlin; crew Beleuchter in Hamburg. Do NOT cross-product occupations and cities.
'Fahrer in München und Fahrer in Berlin' => crew Fahrer with both places (or two equivalent wishes).
'OB und Fahrer in München' => TWO crew wishes Oberbeleuchter and Fahrer, each Munich.
'Oberbeleuchter und Produktionsfahrer in München' => TWO distinct crew wishes, both Munich.
'eine vom Kostüm und ein Boot in Berlin' => crew department kostuem in Berlin AND marketplace Boot in Berlin.
'Model in Berlin und ein Auto in Afrika' => crew Model in Berlin AND marketplace Auto with continent 002.
'Studio in der Schweiz' => locations Studio with country CH, city empty. A generic studio covers film and photo studios.
Use at most 6 wishes and at most 4 places per wish. If a request exceeds this, ask to split it, with searches=[]; never silently drop wishes. Fresh complete requests replace previous filters. Only carry forward prior filters for explicit refinements ('instead Hamburg', 'same in Austria'). If attachment is genuinely unclear, ask a brief clarification. Never invent IDs, URLs, coordinates, categories or result counts.
Shared workplace/schedule mutations remain unavailable: do not claim to move a break, save anything, book or notify people. Briefly describe the proposed searches in reply and show no unfiltered catalogue links when a structured search is available.`;

export function validateResolvedSearchPlan(value: unknown): SearchPlan {
  const plan = readSearchPlan(value);
  if (!plan) throw new GenieError("search_unresolved", 422);
  for (const wish of plan.searches) {
    if (wish.department && !departments.some(dept => dept.id === wish.department)) throw new GenieError("search_unresolved", 422);
    for (const place of wish.places) {
      if (place.radiusKm && placeCandidatesForLabel(place.city, place.country).length !== 1) throw new GenieError("search_unresolved", 422);
    }
  }
  return plan;
}

export async function unifiedSearchLinks(value: unknown, locale: string, requestText = "") {
  const empty = Array.isArray(value) && !value.length;
  const provided = empty ? null : validateResolvedSearchPlan({ version: 1, searches: value });
  const taxonomy = await getTranslations({ locale, namespace: "Taxonomy" });
  const literal = keywordSearchPlan(requestText, locale, taxonomy);
  if (!provided && !literal) return [];
  const plan = literal ?? normalizeKeywordPlan(provided!, locale, taxonomy);
  if (!plan) throw new GenieError("search_unresolved", 422);
  const t = await getTranslations({ locale, namespace: "UnifiedSearch" });
  return [{ href: unifiedSearchHref(plan), label: t("showResults") }];
}
