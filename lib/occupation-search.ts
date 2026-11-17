import { departments, getDepartmentRoleFormLabels, getDepartmentRoleSearchTerms } from "@/lib/departments";
import { normalizeOccupation } from "@/lib/gripTaxonomy";

type TaxonomyTranslator = (key: string) => string;
type SearchIndex = Map<string, readonly string[]>;

const occupations = departments.flatMap(department => department.roles.map(role => ({
  department,
  role,
  values: getDepartmentRoleSearchTerms(department, role),
})));

function add(index: SearchIndex, key: string, values: readonly string[]): void {
  if (!key) return;
  index.set(key, [...new Set([...(index.get(key) ?? []), ...values])]);
}

// Stored canonical titles take precedence over a coincidentally equal alias.
const canonicalIndex: SearchIndex = new Map();
const aliasIndex: SearchIndex = new Map();
for (const occupation of occupations) {
  add(canonicalIndex, normalizeOccupation(occupation.role), occupation.values);
  for (const alias of occupation.values) add(aliasIndex, normalizeOccupation(alias), occupation.values);
}

// A translation function is bound to its current request/bundle. Do not retain it
// in a process-wide locale-only cache, where another translator could be reused.
const localizedIndexes = new WeakMap<TaxonomyTranslator, Map<string, SearchIndex>>();
function localizedIndex(locale: string, taxonomy: TaxonomyTranslator): SearchIndex {
  let locales = localizedIndexes.get(taxonomy);
  if (!locales) {
    locales = new Map();
    localizedIndexes.set(taxonomy, locales);
  }
  const cached = locales.get(locale);
  if (cached) return cached;
  const index: SearchIndex = new Map();
  for (const occupation of occupations) {
    for (const label of getDepartmentRoleFormLabels(occupation.department.id, occupation.role, locale, undefined, taxonomy)) {
      if (typeof label === "string") add(index, normalizeOccupation(label), occupation.values);
    }
  }
  locales.set(locale, index);
  return index;
}

/**
 * Exact occupation lookup for stored profile fields. Search every current-reader
 * form independently of an owner's presentation; never infer gender or widen an
 * assistant/partial phrase into a different job. Unknown text stays ordinary
 * free-text search. The translator is scoped to the Taxonomy namespace.
 */
export function occupationSearchValues(query: string, locale: string, taxonomy: TaxonomyTranslator): string[] {
  const key = normalizeOccupation(query);
  if (!key) return [];
  const canonical = canonicalIndex.get(key);
  if (canonical) return [...canonical];
  return [...new Set([...(aliasIndex.get(key) ?? []), ...(localizedIndex(locale, taxonomy).get(key) ?? [])])];
}
