import type { SearchResult, SearchWish } from './unified-search';
import { listingPriceMetadata } from './listing-price';

/** Compare declared prices only, in their actual currency, unit and bundle.
 * No exchange rates, inferred stock or invented zero-price offers. */
export function searchBudgetState(row: Record<string, unknown>, wish: SearchWish): 'match' | 'unknown' | 'outside' {
  const budget = wish.budget;
  if (!budget) return 'match';
  if (budget.currency !== 'EUR' || budget.unit === 'unspecified') return 'unknown';
  const flags = listingPriceMetadata(row), market = flags.marketplace;
  let amount: number | null = null;
  if (market) {
    const sale = budget.unit === 'purchase';
    if (sale ? !['sale', 'both'].includes(market.mode) : market.mode === 'sale') return 'unknown';
    if (!sale && market.unit !== budget.unit) return 'unknown';
    const mode = sale ? market.sale_mode : market.rent_mode;
    const value = sale ? market.sale_price : market.rent_price;
    if (mode !== 'fixed' || typeof value !== 'number' || value <= 0) return 'unknown';
    amount = value;
    if ((wish.quantity ?? 1) > 1 && budget.scope === 'unknown') return market.bundle === 'single' && value > budget.max ? 'outside' : 'unknown';
    if ((wish.quantity ?? 1) > 1 && budget.scope === 'total' && market.bundle !== 'single') return 'unknown';
  } else {
    if (!['prop', 'vehicle', 'location'].includes(String(row.type)) || flags.price_negotiable || flags.price_on_request
      || typeof row.price !== 'number' || !Number.isFinite(row.price) || row.price <= 0) return 'unknown';
    if (budget.unit !== (flags.rental_type === 'kauf' ? 'purchase' : 'day')) return 'unknown';
    if ((wish.quantity ?? 1) > 1 && budget.scope !== 'each') return 'unknown';
    amount = row.price;
  }
  const units = budget.scope === 'total' ? wish.quantity ?? 1 : 1;
  return Math.round(amount * units * 100) <= Math.round(budget.max * 100) ? 'match' : 'outside';
}

export function unconfirmedSearchFacts(row: Record<string, unknown>, wish: SearchWish): NonNullable<SearchResult['unconfirmed']> {
  const facts: NonNullable<SearchResult['unconfirmed']> = [];
  if (wish.budget && searchBudgetState(row, wish) === 'unknown') facts.push('price');
  // A general "available" flag or a free-text schedule is not a date reservation.
  if (wish.period) facts.push('period');
  if (wish.quantity && wish.quantity > 1) facts.push('quantity');
  if (wish.unsupported?.length) facts.push('unsupported');
  return facts;
}
