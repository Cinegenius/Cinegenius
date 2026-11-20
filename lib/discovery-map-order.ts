import { searchGroupKey, type SearchGroup, type SearchResult } from "./unified-search";

const resultKey = (result: SearchResult) => `${result.type}:${result.id}`;

/** Keep the loaded presentation order while replacing every row with fresh,
 * permission-checked response facts. Missing rows never survive a refresh. */
export function preserveDiscoveryMapOrder(previousGroups: readonly SearchGroup[], freshGroups: readonly SearchGroup[]): SearchGroup[] {
  const previousByGroup = new Map(previousGroups.map(group => [searchGroupKey(group), group]));
  return freshGroups.map(group => {
    const previous = previousByGroup.get(searchGroupKey(group));
    if (!previous) return group;
    const order = new Map<string, number>();
    for (const result of previous.results) {
      const key = resultKey(result);
      if (!order.has(key)) order.set(key, order.size);
    }
    return { ...group, results: group.results.map((result, index) => ({ result, index }))
      .sort((a, b) => (order.get(resultKey(a.result)) ?? order.size) - (order.get(resultKey(b.result)) ?? order.size) || a.index - b.index)
      .map(entry => entry.result) };
  });
}
