type Offer = { id: string; type?: string | null; category?: string | null };
const ROTATION_INTERVAL = 15 * 60 * 1000;

/** Stable during a visit, rotating between visits; interleave public offer types/categories. */
export function selectHomeMarketplace<T extends Offer>(offers: readonly T[], now: number, count = 4): T[] {
  const epoch = Math.floor(now / ROTATION_INTERVAL);
  const groups = new Map<string, T[]>();
  for (const offer of offers) {
    const key = `${offer.type ?? ''}:${offer.category ?? ''}`;
    const group = groups.get(key) ?? [];
    if (!group.some(row => row.id === offer.id)) group.push(offer);
    groups.set(key, group);
  }
  const buckets = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, rows], index) => {
    // Advance each category when its turn comes around. Rotating categories
    // and rows by the same modulus can otherwise permanently skip offers.
    const start = Math.floor((epoch + groups.size - 1 - index) / groups.size) % rows.length;
    return [...rows.slice(start), ...rows.slice(0, start)];
  });
  const selected: T[] = [];
  if (!buckets.length) return selected;
  const start = epoch % buckets.length;
  for (let round = 0; selected.length < count; round++) {
    let found = false;
    for (let offset = 0; offset < buckets.length && selected.length < count; offset++) {
      const offer = buckets[(start + offset) % buckets.length][round];
      if (offer && !selected.some(row => row.id === offer.id)) { selected.push(offer); found = true; }
    }
    if (!found) break;
  }
  return selected;
}
