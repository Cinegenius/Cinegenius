import { DEPARTMENTS, marketplaceCategory, marketplaceSearchCategories } from './marketplaceCategories';

export type MarketplaceCategoryOption = {
  value: string;
  label: string;
  departmentId: string;
  departmentLabel: string;
  path: string;
};

type CategorySearchOptions = { vehicleOnly?: boolean };
type CategoryTranslator = (key: string) => string;

/** Display choices only: persisted category IDs and legacy values stay untouched. */
export function marketplaceCategoryOptions(
  translate: CategoryTranslator,
  locale: string,
  { vehicleOnly = false }: CategorySearchOptions = {},
): MarketplaceCategoryOption[] {
  const collator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true });
  return DEPARTMENTS.filter(department => !vehicleOnly || department.id === 'fahrzeuge')
    .flatMap(department => {
      const departmentLabel = translate(`categories.${department.id}`);
      return department.groups.map(group => {
        const label = translate(`subcategories.${group.id}`);
        return { value: group.id, label, departmentId: department.id, departmentLabel, path: `${departmentLabel} › ${label}` };
      });
    })
    .sort((left, right) => collator.compare(left.departmentLabel, right.departmentLabel)
      || collator.compare(left.label, right.label)
      || (left.value < right.value ? -1 : left.value > right.value ? 1 : 0));
}

/** Known aliases and synonyms expand search results; only explicit selection returns an ID. */
export function searchMarketplaceCategoryOptions(
  query: string,
  translate: CategoryTranslator,
  locale: string,
  options: CategorySearchOptions = {},
): MarketplaceCategoryOption[] {
  const choices = marketplaceCategoryOptions(translate, locale, options);
  const normalize = (value: string) => value.normalize('NFKC').trim().toLocaleLowerCase(locale);
  const text = normalize(query);
  if (!text) return choices;
  const words = text.split(/\s+/);
  const categoryIds = new Set(marketplaceSearchCategories(query, translate)
    .map(value => marketplaceCategory(value)?.subcategory).filter((value): value is string => Boolean(value)));
  return choices.filter(choice => {
    const path = normalize(`${choice.path} ${choice.value}`);
    return categoryIds.has(choice.value) || words.every(word => path.includes(word));
  });
}
