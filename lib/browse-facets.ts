import { marketplaceMatches, type MarketplaceDept } from "./marketplaceCategories";

/** Apply the same canonical and legacy matching as the result filter. */
export function marketplaceBrowseDepartments(departments: MarketplaceDept[], rows: { category: string; type: string }[]): MarketplaceDept[] {
  return departments.map(dept => ({ ...dept, groups: dept.groups.filter(group => rows.some(row => marketplaceMatches(row.category, dept.id, group.id, row.type))) }))
    .filter(dept => rows.some(row => marketplaceMatches(row.category, dept.id, null, row.type)));
}

/** Exhaust pagination before building facets. A failed page must not masquerade as a complete catalogue. */
export async function collectFacetRows<T>(read: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>, size = 250): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += size) {
    const result = await read(from, from + size - 1);
    if (result.error) throw new Error("browse_facets_unavailable", { cause: result.error });
    const page = result.data ?? [];
    rows.push(...page);
    if (page.length < size) return rows;
  }
}
